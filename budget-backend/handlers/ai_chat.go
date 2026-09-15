package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// aiClient is the shared Claude API client, initialized once.
var aiClient *ai.Client

func getAIClient() *ai.Client {
	if aiClient == nil {
		aiClient = ai.NewClient()
	}
	return aiClient
}

// getUserIDFromRequest extracts the authenticated user ID from the request.
func getUserIDFromRequest(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token := strings.TrimSpace(authHeader[len("bearer "):])
		return auth.ValidateToken(token)
	}
	return "", fmt.Errorf("no auth token")
}

// ─── Create Conversation ───────────────────────────────────────

func CreateAIConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Title            string `json:"title"`
		ConversationType string `json:"conversation_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Title = "New Conversation"
		req.ConversationType = "general"
	}
	if req.Title == "" {
		req.Title = "New Conversation"
	}
	if req.ConversationType == "" {
		req.ConversationType = "general"
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Resolve household
	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	var convoID string
	var hhArg interface{}
	if householdID != "" {
		hhArg = householdID
	}

	log.Printf("CreateAIConversation: userID=%s, householdID=%v, title=%s, type=%s", userID, hhArg, req.Title, req.ConversationType)
	err = conn.QueryRow(`
		INSERT INTO ai_conversations (user_id, household_id, title, conversation_type)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, userID, hhArg, req.Title, req.ConversationType).Scan(&convoID)
	if err != nil {
		log.Printf("CreateAIConversation: insert error: %v", err)
		http.Error(w, "Failed to create conversation", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                convoID,
		"title":             req.Title,
		"conversation_type": req.ConversationType,
	})
}

// ─── List Conversations ────────────────────────────────────────

func ListAIConversations(w http.ResponseWriter, r *http.Request) {
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
		SELECT c.id, c.title, c.conversation_type, c.created_at, c.updated_at,
		       (SELECT content FROM ai_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
		FROM ai_conversations c
		WHERE c.user_id = $1
		ORDER BY c.updated_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var conversations []map[string]interface{}
	for rows.Next() {
		var id, title, convoType string
		var createdAt, updatedAt string
		var lastMessage sql.NullString
		if err := rows.Scan(&id, &title, &convoType, &createdAt, &updatedAt, &lastMessage); err != nil {
			continue
		}
		convo := map[string]interface{}{
			"id":                id,
			"title":             title,
			"conversation_type": convoType,
			"created_at":        createdAt,
			"updated_at":        updatedAt,
		}
		if lastMessage.Valid {
			// Truncate for preview
			preview := lastMessage.String
			if len(preview) > 120 {
				preview = preview[:120] + "..."
			}
			convo["last_message"] = preview
		}
		conversations = append(conversations, convo)
	}

	if conversations == nil {
		conversations = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conversations)
}

// ─── Get Conversation with Messages ────────────────────────────

func GetAIConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	convoID := mux.Vars(r)["id"]
	if convoID == "" {
		http.Error(w, "Missing conversation ID", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify ownership
	var ownerID string
	err = conn.QueryRow(`SELECT user_id FROM ai_conversations WHERE id = $1`, convoID).Scan(&ownerID)
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Get conversation
	var convo models.AIConversation
	err = conn.QueryRow(`
		SELECT id, user_id, title, conversation_type, created_at, updated_at
		FROM ai_conversations WHERE id = $1
	`, convoID).Scan(&convo.ID, &convo.UserID, &convo.Title, &convo.ConversationType, &convo.CreatedAt, &convo.UpdatedAt)
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	// Get messages
	msgRows, err := conn.Query(`
		SELECT id, role, content, token_count, created_at
		FROM ai_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`, convoID)
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer msgRows.Close()

	convo.Messages = []models.AIMessage{}
	for msgRows.Next() {
		var msg models.AIMessage
		if err := msgRows.Scan(&msg.ID, &msg.Role, &msg.Content, &msg.TokenCount, &msg.CreatedAt); err != nil {
			continue
		}
		msg.ConversationID = convoID
		convo.Messages = append(convo.Messages, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(convo)
}

// ─── Delete Conversation ───────────────────────────────────────

func DeleteAIConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	convoID := mux.Vars(r)["id"]
	if convoID == "" {
		http.Error(w, "Missing conversation ID", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify ownership and delete
	result, err := conn.Exec(`
		DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2
	`, convoID, userID)
	if err != nil {
		http.Error(w, "Delete failed", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
