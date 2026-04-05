package ai

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aboogie/budget-backend/models"
)

const (
	claudeAPIURL = "https://api.anthropic.com/v1/messages"
	claudeModel  = "claude-opus-4-6"
)

// Client wraps communication with the Anthropic Messages API.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a Claude API client using the ANTHROPIC_API_KEY env var.
func NewClient() *Client {
	key := os.Getenv("ANTHROPIC_API_KEY")
	if key == "" {
		log.Println("WARNING: ANTHROPIC_API_KEY not set — AI features will be unavailable")
	}
	return &Client{
		apiKey:     key,
		httpClient: &http.Client{},
	}
}

// IsAvailable returns true if the API key is configured.
func (c *Client) IsAvailable() bool {
	return c.apiKey != ""
}

// SendMessage sends a non-streaming request to Claude and returns the full response.
func (c *Client) SendMessage(req models.ClaudeRequest) (*models.ClaudeResponse, error) {
	req.Stream = false
	if req.Model == "" {
		req.Model = claudeModel
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 4096
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", claudeAPIURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claude API error %d: %s", resp.StatusCode, string(respBody))
	}

	var claudeResp models.ClaudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &claudeResp, nil
}

// StreamResult holds the outcome of a single streaming call to Claude.
type StreamResult struct {
	Text       string
	Tokens     int
	StopReason string
	ToolCalls  []ToolCall // non-nil when Claude wants to call tools
}

// ToolCall represents a single tool_use block from Claude's response.
type ToolCall struct {
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`
}

// StreamMessage sends a streaming request to Claude and writes text SSE events
// to the provided writer. It returns the accumulated text, token count, and any
// tool calls that Claude made. The caller is responsible for executing tools and
// re-calling if needed.
func (c *Client) StreamMessage(req models.ClaudeRequest, w http.ResponseWriter, flusher http.Flusher) (StreamResult, error) {
	req.Stream = true
	if req.Model == "" {
		req.Model = claudeModel
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 4096
	}

	body, err := json.Marshal(req)
	if err != nil {
		return StreamResult{}, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", claudeAPIURL, bytes.NewReader(body))
	if err != nil {
		return StreamResult{}, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return StreamResult{}, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return StreamResult{}, fmt.Errorf("claude API error %d: %s", resp.StatusCode, string(respBody))
	}

	var result StreamResult
	var fullText strings.Builder
	var toolCalls []ToolCall

	// Track the current content block being built
	var currentToolCall *ToolCall
	var currentToolInput strings.Builder

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var event models.ClaudeStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			log.Printf("stream parse error: %v (data: %s)", err, data)
			continue
		}

		switch event.Type {
		case "content_block_start":
			if event.ContentBlock != nil && event.ContentBlock.Type == "tool_use" {
				currentToolCall = &ToolCall{
					ID:   event.ContentBlock.ID,
					Name: event.ContentBlock.Name,
				}
				currentToolInput.Reset()
			}

		case "content_block_delta":
			if event.Delta != nil {
				if event.Delta.Type == "text_delta" && event.Delta.Text != "" {
					fullText.WriteString(event.Delta.Text)
					// Forward text to the client
					chunk, _ := json.Marshal(map[string]string{
						"type": "text",
						"text": event.Delta.Text,
					})
					fmt.Fprintf(w, "data: %s\n\n", chunk)
					flusher.Flush()
				} else if event.Delta.Type == "input_json_delta" && event.Delta.PartialJSON != "" {
					currentToolInput.WriteString(event.Delta.PartialJSON)
				}
			}

		case "content_block_stop":
			if currentToolCall != nil {
				inputJSON := currentToolInput.String()
				if inputJSON == "" {
					inputJSON = "{}"
				}
				currentToolCall.Input = json.RawMessage(inputJSON)
				toolCalls = append(toolCalls, *currentToolCall)
				currentToolCall = nil
			}

		case "message_delta":
			if event.Usage != nil {
				result.Tokens = event.Usage.OutputTokens
			}
			if event.Delta != nil && event.Delta.StopReason != "" {
				result.StopReason = event.Delta.StopReason
			}

		case "message_start":
			if event.Message != nil && event.Message.Usage.InputTokens > 0 {
				result.Tokens += event.Message.Usage.InputTokens
			}

		case "message_stop":
			// Stream complete
		}
	}

	if err := scanner.Err(); err != nil {
		return StreamResult{Text: fullText.String(), Tokens: result.Tokens}, fmt.Errorf("stream read error: %w", err)
	}

	result.Text = fullText.String()
	result.ToolCalls = toolCalls

	return result, nil
}
