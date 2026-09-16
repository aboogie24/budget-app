package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/internal/entitlements"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
)

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

	// C031: household Free AI message budget (rolling 7d) before spending tokens.
	ent, ok := checkAIMessageAllowed(w, conn.Raw(), userID)
	if !ok {
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

	// Build dynamic context with live financial data (household-grounded).
	var userName string
	_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&userName)
	householdID := db.ResolveHouseholdID(conn.Raw(), userID)
	systemPrompt := ai.BuildLiveSystemPrompt(conn.Raw(), userID, householdID, userName, convoID)

	// Build Claude request. Model defaults to ai.ChatModel (Opus 4.8) in the
	// client. Adaptive thinking + high effort buys the deeper, couple-aware
	// reasoning the advisor is for; "summarized" display keeps the raw chain of
	// thought private while still letting us surface progress later.
	claudeReq := models.ClaudeRequest{
		MaxTokens:    4096,
		System:       systemPrompt,
		Messages:     messages,
		Tools:        ai.GetToolDefinitionsForMode(ent.AIMode),
		Thinking:     &models.ClaudeThinking{Type: "adaptive", Display: "summarized"},
		OutputConfig: &models.ClaudeOutputConfig{Effort: "high"},
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

		// Execute each tool and build the tool_result message. Mutating tools
		// are NOT executed here: they're queued as pending actions the user
		// approves or declines via a card in the chat UI — conversational
		// consent alone is not an audit trail. The card is pushed to the
		// client immediately over the same SSE stream.
		var toolResults []map[string]interface{}
		for _, tc := range result.ToolCalls {
			var toolResult string
			if entitlements.IsLightAI(ent.Plan) && (ai.MutatingTools[tc.Name] || tc.Name == "web_search") {
				toolResult = `{"error": "This action requires CoupleFlow Plus. Free AI is read-only."}`
			} else if ai.MutatingTools[tc.Name] {
				actionID := uuid.Must(uuid.NewV4()).String()
				summary := ai.SummarizeAction(tc.Name, tc.Input)
				if _, aerr := conn.Exec(`
					INSERT INTO ai_pending_actions (id, user_id, conversation_id, tool_name, tool_input, summary)
					VALUES ($1, $2, $3, $4, $5, $6)
				`, actionID, userID, convoID, tc.Name, string(tc.Input), summary); aerr != nil {
					log.Printf("queue pending action %s: %v", tc.Name, aerr)
					toolResult = `{"error": "could not queue the action for approval"}`
				} else {
					pendingMsg, _ := json.Marshal(map[string]string{
						"type":      "pending_action",
						"action_id": actionID,
						"tool_name": tc.Name,
						"summary":   summary,
					})
					fmt.Fprintf(w, "data: %s\n\n", pendingMsg)
					flusher.Flush()
					toolResult = fmt.Sprintf(
						`{"status": "pending_approval", "action_id": "%s", "summary": %q, "note": "An approval card was shown to the user. Tell them what it will do and that nothing happens until they tap Approve. Do NOT claim the action is done."}`,
						actionID, summary)
				}
			} else {
				var toolErr error
				toolResult, toolErr = ai.ExecuteTool(conn.Raw(), userID, householdID, tc.Name, tc.Input)
				if toolErr != nil {
					log.Printf("tool %s error: %v", tc.Name, toolErr)
					toolResult = fmt.Sprintf(`{"error": "%s"}`, toolErr.Error())
				}
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
