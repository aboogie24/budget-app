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

// ─── Send Message (SSE Streaming) ──────────────────────────────

func SendAIMessage(w http.ResponseWriter, r *http.Request) {
	log.Printf("SendAIMessage: ENTERED handler")
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	client := getAIClient()
	if !client.IsAvailable() {
		http.Error(w, "AI service unavailable — ANTHROPIC_API_KEY not configured", http.StatusServiceUnavailable)
		return
	}

	convoID := mux.Vars(r)["id"]
	if convoID == "" {
		http.Error(w, "Missing conversation ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		http.Error(w, "Message content required", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		log.Printf("SendAIMessage: db connection error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify conversation ownership
	var ownerID string
	err = conn.QueryRow(`SELECT user_id FROM ai_conversations WHERE id = $1`, convoID).Scan(&ownerID)
	if err != nil {
		log.Printf("SendAIMessage: conversation lookup error (id=%s): %v", convoID, err)
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		log.Printf("SendAIMessage: forbidden — owner=%s, caller=%s", ownerID, userID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Save the user's message
	_, err = conn.Exec(`
		INSERT INTO ai_messages (conversation_id, role, content)
		VALUES ($1, 'user', $2)
	`, convoID, req.Content)
	if err != nil {
		log.Printf("SendAIMessage: save user message error: %v", err)
		http.Error(w, "Failed to save message", http.StatusInternalServerError)
		return
	}

	// Load conversation history (last 20 messages for context window)
	historyRows, err := conn.Query(`
		SELECT role, content FROM ai_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
		LIMIT 20
	`, convoID)
	if err != nil {
		log.Printf("SendAIMessage: history query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer historyRows.Close()

	var messages []models.ClaudeMessage
	for historyRows.Next() {
		var msg models.ClaudeMessage
		if err := historyRows.Scan(&msg.Role, &msg.Content); err != nil {
			continue
		}
		// Skip system messages — they go in the system prompt
		if msg.Role == "system" {
			continue
		}
		messages = append(messages, msg)
	}

	// Build dynamic context with live financial data
	var userName string
	_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&userName)
	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	ctxData := ai.ContextData{UserName: userName}

	// Household name
	if householdID != "" {
		var hhName string
		_ = conn.QueryRow(`SELECT COALESCE(name, '') FROM households WHERE id = $1`, householdID).Scan(&hhName)
		ctxData.HouseholdName = hhName
	}

	// Framework level
	assessment := ai.AssessFrameworkLevel(conn.Raw(), userID, householdID)
	ctxData.FrameworkLevel = assessment.LevelName
	ctxData.FrameworkPct = assessment.CompletedPct

	// Consolidated financial context — single query with subqueries
	_ = conn.QueryRow(`
		SELECT
			COALESCE((SELECT SUM(
				CASE frequency
					WHEN 'weekly' THEN amount * 4
					WHEN 'biweekly' THEN amount * 2
					WHEN '1st-15th' THEN amount * 2
					ELSE amount
				END
			) FROM budgets WHERE user_id = $1 AND type = 'income'), 0),
			COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = $1 AND type = 'income' AND date >= NOW() - INTERVAL '30 days'), 0),
			COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = $1 AND type = 'expense' AND date >= NOW() - INTERVAL '30 days'), 0),
			COALESCE((SELECT SUM(balance) FROM debt_accounts WHERE user_id = $1), 0),
			(SELECT COUNT(*) FROM debt_accounts WHERE user_id = $1),
			COALESCE((SELECT SUM(current_amount) FROM savings_goals WHERE user_id = $1), 0),
			(SELECT COUNT(*) FROM savings_goals WHERE user_id = $1),
			COALESCE((SELECT SUM(current_balance) FROM account_balances WHERE user_id = $1), 0),
			(SELECT COUNT(*) FROM budgets WHERE user_id = $1)
	`, userID).Scan(
		&ctxData.BudgetedIncome,
		&ctxData.ActualIncome,
		&ctxData.MonthlyExpenses,
		&ctxData.TotalDebt,
		&ctxData.DebtCount,
		&ctxData.TotalSavings,
		&ctxData.SavingsCount,
		&ctxData.BankBalance,
		&ctxData.BudgetCount,
	)

	systemPrompt := ai.SystemPrompt
	contextBlock := ai.BuildContextBlock(ctxData)
	if contextBlock != "" {
		systemPrompt += "\n\n" + contextBlock
	}

	// Build Claude request
	claudeReq := models.ClaudeRequest{
		MaxTokens: 4096,
		System:    systemPrompt,
		Messages:  messages,
		Tools:     ai.GetToolDefinitions(),
	}

	// Set up SSE streaming
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Stream the response, handling tool use loops (max 5 iterations)
	var fullText strings.Builder
	totalTokens := 0
	const maxToolRounds = 5

	for round := 0; round < maxToolRounds; round++ {
		result, err := client.StreamMessage(claudeReq, w, flusher)
		if err != nil {
			log.Printf("stream error: %v", err)
			errMsg, _ := json.Marshal(map[string]string{"type": "error", "error": err.Error()})
			fmt.Fprintf(w, "data: %s\n\n", errMsg)
			flusher.Flush()
			return
		}

		fullText.WriteString(result.Text)
		totalTokens += result.Tokens

		// If no tool calls, we're done
		if len(result.ToolCalls) == 0 {
			break
		}

		// Claude wants to call tools — execute them and continue the conversation.
		// Build an assistant message with the tool_use blocks, then tool results.
		var assistantContent []map[string]interface{}
		if result.Text != "" {
			assistantContent = append(assistantContent, map[string]interface{}{
				"type": "text",
				"text": result.Text,
			})
		}
		for _, tc := range result.ToolCalls {
			var inputObj interface{}
			_ = json.Unmarshal(tc.Input, &inputObj)
			assistantContent = append(assistantContent, map[string]interface{}{
				"type":  "tool_use",
				"id":    tc.ID,
				"name":  tc.Name,
				"input": inputObj,
			})
		}

		// Execute each tool and build the tool_result message
		var toolResults []map[string]interface{}
		for _, tc := range result.ToolCalls {
			toolResult, toolErr := ai.ExecuteTool(conn.Raw(), userID, householdID, tc.Name, tc.Input)
			if toolErr != nil {
				log.Printf("tool %s error: %v", tc.Name, toolErr)
				toolResult = fmt.Sprintf(`{"error": "%s"}`, toolErr.Error())
			}
			toolResults = append(toolResults, map[string]interface{}{
				"type":       "tool_result",
				"tool_use_id": tc.ID,
				"content":    toolResult,
			})
		}

		// Append the assistant turn (with tool_use) and user turn (with tool_results)
		// to the messages for the next API call. Use raw JSON content blocks.
		assistantJSON, _ := json.Marshal(assistantContent)
		toolResultJSON, _ := json.Marshal(toolResults)

		claudeReq.Messages = append(claudeReq.Messages,
			models.ClaudeMessage{Role: "assistant", Content: string(assistantJSON), IsRaw: true},
			models.ClaudeMessage{Role: "user", Content: string(toolResultJSON), IsRaw: true},
		)
	}

	// Send done event
	doneMsg, _ := json.Marshal(map[string]string{"type": "done"})
	fmt.Fprintf(w, "data: %s\n\n", doneMsg)
	flusher.Flush()

	// Save the assistant's response
	_, err = conn.Exec(`
		INSERT INTO ai_messages (conversation_id, role, content, token_count)
		VALUES ($1, 'assistant', $2, $3)
	`, convoID, fullText.String(), totalTokens)
	if err != nil {
		log.Printf("save assistant message error: %v", err)
	}

	// Update conversation timestamp and auto-title if still default
	_, _ = conn.Exec(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`, convoID)

	var currentTitle string
	_ = conn.QueryRow(`SELECT title FROM ai_conversations WHERE id = $1`, convoID).Scan(&currentTitle)
	if currentTitle == "New Conversation" {
		title := req.Content
		if len(title) > 60 {
			title = title[:60] + "..."
		}
		_, _ = conn.Exec(`UPDATE ai_conversations SET title = $1 WHERE id = $2`, title, convoID)
	}
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
