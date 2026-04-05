package models

import (
	"encoding/json"
	"time"
)

// AIConversation represents a chat session between a user and the AI assistant.
type AIConversation struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	HouseholdID      *string   `json:"household_id,omitempty"`
	Title            string    `json:"title"`
	ConversationType string    `json:"conversation_type"` // planning, advice, review, general
	ContextSnapshot  string    `json:"context_snapshot,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	// Populated on read — not stored in ai_conversations table.
	Messages []AIMessage `json:"messages,omitempty"`
}

// AIMessage represents a single message within an AI conversation.
type AIMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	Role           string    `json:"role"` // user, assistant, system
	Content        string    `json:"content"`
	ToolCalls      *string   `json:"tool_calls,omitempty"`
	ToolResults    *string   `json:"tool_results,omitempty"`
	TokenCount     int       `json:"token_count"`
	CreatedAt      time.Time `json:"created_at"`
}

// ClaudeMessage is the shape sent to/from the Claude API.
// When IsRaw is true, Content is pre-encoded JSON (e.g. content blocks array)
// and should be marshaled as raw JSON rather than a string.
type ClaudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"-"`
	IsRaw   bool   `json:"-"`
}

// MarshalJSON implements custom marshaling so that raw content blocks
// are emitted as a JSON array instead of a string.
func (m ClaudeMessage) MarshalJSON() ([]byte, error) {
	if m.IsRaw {
		return []byte(`{"role":` + mustQuote(m.Role) + `,"content":` + m.Content + `}`), nil
	}
	return []byte(`{"role":` + mustQuote(m.Role) + `,"content":` + mustQuote(m.Content) + `}`), nil
}

func mustQuote(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// ClaudeRequest is the request body for the Anthropic Messages API.
type ClaudeRequest struct {
	Model     string               `json:"model"`
	MaxTokens int                  `json:"max_tokens"`
	System    string               `json:"system,omitempty"`
	Messages  []ClaudeMessage      `json:"messages"`
	Stream    bool                 `json:"stream"`
	Tools     []ClaudeToolDef      `json:"tools,omitempty"`
}

// ClaudeToolDef defines a tool that Claude can call.
type ClaudeToolDef struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"input_schema"`
}

// ClaudeResponse is the non-streaming response from Claude.
type ClaudeResponse struct {
	ID           string               `json:"id"`
	Type         string               `json:"type"`
	Role         string               `json:"role"`
	Content      []ClaudeContentBlock `json:"content"`
	Model        string               `json:"model"`
	StopReason   string               `json:"stop_reason"`
	Usage        ClaudeUsage          `json:"usage"`
}

// ClaudeContentBlock represents a content block in the Claude response.
type ClaudeContentBlock struct {
	Type  string `json:"type"`  // text, tool_use
	Text  string `json:"text,omitempty"`
	ID    string `json:"id,omitempty"`    // for tool_use
	Name  string `json:"name,omitempty"`  // for tool_use
	Input interface{} `json:"input,omitempty"` // for tool_use
}

// ClaudeUsage contains token usage information.
type ClaudeUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// ClaudeStreamEvent represents a single SSE event from Claude's streaming API.
type ClaudeStreamEvent struct {
	Type  string `json:"type"`
	Index int    `json:"index,omitempty"`
	Delta *struct {
		Type        string `json:"type,omitempty"`
		Text        string `json:"text,omitempty"`
		PartialJSON string `json:"partial_json,omitempty"`
		StopReason  string `json:"stop_reason,omitempty"`
	} `json:"delta,omitempty"`
	ContentBlock *ClaudeContentBlock `json:"content_block,omitempty"`
	Message      *ClaudeResponse     `json:"message,omitempty"`
	Usage        *ClaudeUsage        `json:"usage,omitempty"`
}
