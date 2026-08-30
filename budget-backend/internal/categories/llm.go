package categories

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aboogie/budget-backend/models"
)

// ClaudeSender is the slice of the Claude client that the classifier needs.
// internal/ai.Client satisfies it — passing an interface keeps this package
// free of an import dependency on internal/ai.
type ClaudeSender interface {
	SendMessage(req models.ClaudeRequest) (*models.ClaudeResponse, error)
}

// MerchantInput is one merchant to classify.
type MerchantInput struct {
	Name   string `json:"name"`           // normalized merchant key
	Sample string `json:"sample"`         // a raw bank description sample
	Hint   string `json:"hint,omitempty"` // provider category hint, if any
}

// CategoryOption is one allowed category the model may choose.
type CategoryOption struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Parent string `json:"parent,omitempty"`
}

// Classification is the model's answer for one merchant.
type Classification struct {
	Merchant   string `json:"merchant"`
	CategoryID string `json:"category_id"` // "" when the model is not confident
}

// classifyModel is the cheap, fast model used for bulk merchant
// categorization. This is a commodity classification task, so it does not need
// the top-tier conversational model.
const classifyModel = "claude-haiku-4-5"

const classifySystemPrompt = `You are a precise transaction-categorization assistant for a personal budgeting app.

You receive a JSON object with two arrays: "categories" (each with an id, name, and parent) and "merchants" (each a normalized merchant name with a sample raw bank description and an optional category hint).

For each merchant, choose the single best-fitting category from the allowed list.

Rules:
- Return one classification element per merchant, using the merchant name verbatim.
- Use only category_id values that appear in the provided categories list.
- If you cannot confidently determine the category for a merchant, set "category_id" to "" (empty string). Do not guess.`

// classifySchema constrains the response via structured outputs so the model
// must return well-formed JSON in a fixed shape — no prose-wrapping or fence
// stripping to recover from. All objects use additionalProperties:false and
// list every property as required, per the structured-outputs constraints.
var classifySchema = map[string]interface{}{
	"type": "object",
	"properties": map[string]interface{}{
		"classifications": map[string]interface{}{
			"type": "array",
			"items": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"merchant":    map[string]interface{}{"type": "string"},
					"category_id": map[string]interface{}{"type": "string"},
				},
				"required":             []string{"merchant", "category_id"},
				"additionalProperties": false,
			},
		},
	},
	"required":             []string{"classifications"},
	"additionalProperties": false,
}

// classifyResponse is the structured-output envelope returned by the model.
type classifyResponse struct {
	Classifications []Classification `json:"classifications"`
}

// ClassifyMerchants asks Claude to assign a category to each merchant. It is a
// single API call; callers should batch merchants into reasonably-sized groups.
// A returned Classification with an empty CategoryID means the model declined
// to guess — the transaction should be left uncategorized.
func ClassifyMerchants(sender ClaudeSender, merchants []MerchantInput, cats []CategoryOption) ([]Classification, error) {
	if len(merchants) == 0 {
		return nil, nil
	}

	payload, err := json.Marshal(map[string]interface{}{
		"categories": cats,
		"merchants":  merchants,
	})
	if err != nil {
		return nil, fmt.Errorf("classify: marshal payload: %w", err)
	}

	resp, err := sender.SendMessage(models.ClaudeRequest{
		Model:     classifyModel,
		MaxTokens: 4096,
		System:    classifySystemPrompt,
		Messages:  []models.ClaudeMessage{{Role: "user", Content: string(payload)}},
		OutputConfig: &models.ClaudeOutputConfig{
			Format: &models.ClaudeOutputFormat{Type: "json_schema", Schema: classifySchema},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("classify: claude request: %w", err)
	}

	// Structured outputs guarantee the first text block is valid JSON matching
	// classifySchema — no array-scanning or fence-stripping needed.
	var text strings.Builder
	for _, b := range resp.Content {
		if b.Type == "text" {
			text.WriteString(b.Text)
		}
	}

	var parsed classifyResponse
	if err := json.Unmarshal([]byte(text.String()), &parsed); err != nil {
		return nil, fmt.Errorf("classify: parse response: %w", err)
	}
	return parsed.Classifications, nil
}
