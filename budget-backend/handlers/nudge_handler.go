package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/gorilla/mux"
)

// GetNudges returns unread nudges for the authenticated user, ordered by priority then recency.
func GetNudges(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT id, user_id, COALESCE(household_id::text, ''), nudge_type, title, body,
		       COALESCE(action_type, ''), COALESCE(action_data, ''), priority, is_read,
		       COALESCE(expires_at::text, ''), created_at::text
		FROM ai_nudges
		WHERE user_id = $1 AND is_read = false
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY priority ASC, created_at DESC
		LIMIT 10
	`, userID)
	if err != nil {
		log.Printf("GetNudges query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var nudges []map[string]interface{}
	for rows.Next() {
		var id, uid, hh, nudgeType, title, body string
		var actionType, actionData, expiresAt, createdAt string
		var priority int
		var isRead bool
		if err := rows.Scan(&id, &uid, &hh, &nudgeType, &title, &body,
			&actionType, &actionData, &priority, &isRead,
			&expiresAt, &createdAt); err != nil {
			log.Printf("GetNudges scan error: %v", err)
			continue
		}
		nudge := map[string]interface{}{
			"id":         id,
			"user_id":    uid,
			"nudge_type": nudgeType,
			"title":      title,
			"body":       body,
			"priority":   priority,
			"is_read":    isRead,
			"created_at": createdAt,
		}
		if hh != "" {
			nudge["household_id"] = hh
		}
		if actionType != "" {
			nudge["action_type"] = actionType
		}
		if actionData != "" {
			nudge["action_data"] = actionData
		}
		if expiresAt != "" {
			nudge["expires_at"] = expiresAt
		}
		nudges = append(nudges, nudge)
	}

	if nudges == nil {
		nudges = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nudges)
}

// DismissNudge marks a nudge as read.
func DismissNudge(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	nudgeID := mux.Vars(r)["id"]
	if nudgeID == "" {
		http.Error(w, "Missing nudge id", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	res, err := conn.Exec(`
		UPDATE ai_nudges SET is_read = true
		WHERE id = $1 AND user_id = $2
	`, nudgeID, userID)
	if err != nil {
		log.Printf("DismissNudge error: %v", err)
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Nudge not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "dismissed"})
}

// GenerateNudgesNow manually triggers nudge generation for the current user.
func GenerateNudgesNow(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	nudges := ai.GenerateNudges(conn.Raw(), userID, householdID)
	if err := ai.SaveNudges(conn.Raw(), nudges); err != nil {
		log.Printf("GenerateNudgesNow save error: %v", err)
		http.Error(w, "Save error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"generated": len(nudges),
		"nudges":    nudges,
	})
}
