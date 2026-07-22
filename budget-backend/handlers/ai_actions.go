package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/gorilla/mux"
)

// AI pending actions — the approval layer for advisor write tools. The chat
// handler queues mutating tool calls here; the user approves or declines from
// a card in the chat. Approving executes the STORED call (the advisor can't
// change it after the fact); every outcome is kept for audit and fed back to
// the advisor as context on the next turn.

// GET /auth/ai/actions?status=pending
func ListAIPendingActions(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT id, COALESCE(conversation_id::text, ''), tool_name, summary, status, COALESCE(result, ''), created_at
		FROM ai_pending_actions
		WHERE user_id = $1 AND status = $2
		ORDER BY created_at DESC
		LIMIT 50
	`, userID, status)
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	actions := []map[string]interface{}{}
	for rows.Next() {
		var id, convoID, tool, summary, st, result, createdAt string
		if err := rows.Scan(&id, &convoID, &tool, &summary, &st, &result, &createdAt); err == nil {
			actions = append(actions, map[string]interface{}{
				"id": id, "conversation_id": convoID, "tool_name": tool,
				"summary": summary, "status": st, "result": result, "created_at": createdAt,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"actions": actions})
}

// POST /auth/ai/actions/{id}/approve — executes the stored tool call.
func ApproveAIPendingAction(w http.ResponseWriter, r *http.Request) {
	resolveAIPendingAction(w, r, true)
}

// POST /auth/ai/actions/{id}/decline
func DeclineAIPendingAction(w http.ResponseWriter, r *http.Request) {
	resolveAIPendingAction(w, r, false)
}

func resolveAIPendingAction(w http.ResponseWriter, r *http.Request, approve bool) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	actionID := mux.Vars(r)["id"]

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Claim the action atomically: only a pending row owned by this user can
	// be resolved, and double-taps can't execute twice.
	var toolName string
	var toolInput []byte
	err = conn.QueryRow(`
		UPDATE ai_pending_actions
		SET status = CASE WHEN $3 THEN 'approved' ELSE 'declined' END, resolved_at = NOW()
		WHERE id = $1 AND user_id = $2 AND status = 'pending'
		RETURNING tool_name, tool_input
	`, actionID, userID, approve).Scan(&toolName, &toolInput)
	if err == sql.ErrNoRows {
		http.Error(w, "Action not found or already resolved", http.StatusConflict)
		return
	}
	if err != nil {
		log.Printf("resolve ai action %s: %v", actionID, err)
		http.Error(w, "Failed to resolve action", http.StatusInternalServerError)
		return
	}

	if !approve {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "declined"})
		return
	}

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)
	result, execErr := ai.ExecuteTool(conn.Raw(), userID, householdID, toolName, toolInput)
	if execErr != nil {
		log.Printf("execute approved action %s (%s): %v", actionID, toolName, execErr)
		result = `{"error": ` + jsonQuote(execErr.Error()) + `}`
		_, _ = conn.Exec(`UPDATE ai_pending_actions SET status = 'failed', result = $2 WHERE id = $1`, actionID, result)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]string{"status": "failed", "error": execErr.Error()})
		return
	}

	_, _ = conn.Exec(`UPDATE ai_pending_actions SET result = $2 WHERE id = $1`, actionID, result)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "approved",
		"result": json.RawMessage(result),
	})
}

func jsonQuote(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// requireUserID extracts the caller's user id from header or auth context.
func requireUserID(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return "", false
	}
	return userID, true
}
