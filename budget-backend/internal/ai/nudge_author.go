package ai

import (
	"database/sql"
	"encoding/json"
	"log"

	"github.com/aboogie/budget-backend/models"
)

// discussNudgeTypes are nudge categories better explored in a conversation than
// by navigating to a screen. For these, AuthorNudges turns the card into a
// seeded "ask the advisor" entry point. Action-required types (review
// transactions, create a budget) keep their navigate_to action.
var discussNudgeTypes = map[string]bool{
	"spending_alert":            true,
	"savings_tip":               true,
	"debt_progress":             true,
	"debt_reclassification":     true,
	"debt_category_suggestion":  true,
	"structured_debt_milestone": true,
	"milestone_reminder":        true,
}

const nudgeAuthorSystemPrompt = `You are CoupleFlow AI, a warm, encouraging financial advisor for couples. You rewrite auto-generated alert cards into short, human, couple-aware notifications.

For each card you receive, rewrite it using the EXACT numbers given — never invent or change figures. Keep the same factual meaning, but make it warm, plain-spoken, and never judgmental about spending.

Also write a "chat_seed": a short first-person message the user could tap to start a conversation with you about this card.

Rules:
- title: 3-7 words, specific, no emoji.
- body: 1-2 short sentences using the provided numbers.
- chat_seed: one natural first-person question, under 12 words (e.g. "Why is my spending up this week?").
- Use the "What the advisor remembers" facts to personalize when relevant, but never contradict the numbers.`

// nudgeAuthorSchema constrains the structured output (one rewritten card per input).
var nudgeAuthorSchema = map[string]interface{}{
	"type": "object",
	"properties": map[string]interface{}{
		"cards": map[string]interface{}{
			"type": "array",
			"items": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"index":     map[string]interface{}{"type": "integer"},
					"title":     map[string]interface{}{"type": "string"},
					"body":      map[string]interface{}{"type": "string"},
					"chat_seed": map[string]interface{}{"type": "string"},
				},
				"required":             []string{"index", "title", "body", "chat_seed"},
				"additionalProperties": false,
			},
		},
	},
	"required":             []string{"cards"},
	"additionalProperties": false,
}

type authoredCard struct {
	Index    int    `json:"index"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	ChatSeed string `json:"chat_seed"`
}

// AuthorNudges rewrites the title/body of NEW nudges into warm, memory-grounded
// copy using the cheap model, and seeds discussable cards with an opening chat
// question. It mutates nudges in place. On any failure it leaves the
// deterministic copy untouched — authorship is an enhancement, never a gate.
//
// Call AFTER AssignDedupKeys and BEFORE SaveNudges.
func AuthorNudges(client *Client, conn *sql.DB, userID, householdID string, nudges []models.AINudge) {
	if client == nil || !client.IsAvailable() || len(nudges) == 0 {
		return
	}

	// Only spend tokens on nudges that will actually be saved (not deduped away).
	var indices []int
	for i := range nudges {
		if isNewNudge(conn, nudges[i]) {
			indices = append(indices, i)
		}
	}
	if len(indices) == 0 {
		return
	}

	type cardIn struct {
		Index int    `json:"index"`
		Type  string `json:"type"`
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	cards := make([]cardIn, 0, len(indices))
	for _, i := range indices {
		cards = append(cards, cardIn{Index: i, Type: nudges[i].NudgeType, Title: nudges[i].Title, Body: nudges[i].Body})
	}
	payload, _ := json.Marshal(map[string]interface{}{"cards": cards})

	system := nudgeAuthorSystemPrompt
	if mems, _ := LoadAdvisorMemories(conn, userID, householdID); len(mems) > 0 {
		if memBlock := BuildMemoryBlock(mems); memBlock != "" {
			system += "\n\n## What the advisor remembers\n" + memBlock
		}
	}

	resp, err := client.SendMessage(models.ClaudeRequest{
		Model:     ClassifyModel,
		MaxTokens: 2048,
		System:    system,
		Messages:  []models.ClaudeMessage{{Role: "user", Content: string(payload)}},
		OutputConfig: &models.ClaudeOutputConfig{
			Format: &models.ClaudeOutputFormat{Type: "json_schema", Schema: nudgeAuthorSchema},
		},
	})
	if err != nil {
		log.Printf("nudge author: request error: %v", err)
		return
	}

	var text string
	for _, b := range resp.Content {
		if b.Type == "text" {
			text += b.Text
		}
	}
	var parsed struct {
		Cards []authoredCard `json:"cards"`
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		log.Printf("nudge author: parse error: %v", err)
		return
	}

	for _, c := range parsed.Cards {
		if c.Index < 0 || c.Index >= len(nudges) {
			continue
		}
		if c.Title != "" {
			nudges[c.Index].Title = c.Title
		}
		if c.Body != "" {
			nudges[c.Index].Body = c.Body
		}
		// Turn discussable cards into a seeded "ask the advisor" entry point.
		if c.ChatSeed != "" && discussNudgeTypes[nudges[c.Index].NudgeType] {
			askAI := "ask_ai"
			seed := c.ChatSeed
			nudges[c.Index].ActionType = &askAI
			nudges[c.Index].ActionData = &seed
		}
	}
}
