package ai

import (
	"github.com/aboogie/budget-backend/models"
)

// GetToolDefinitions returns the Claude tool definitions for financial data access.
func GetToolDefinitions() []models.ClaudeToolDef {
	tools := toolDefsFinancialAndPlans()
	tools = append(tools, toolDefsMemoryAndMutations()...)
	// Conditionally add web_search tool if Tavily API key is configured
	if IsWebSearchAvailable() {
		tools = append(tools, models.ClaudeToolDef{
			Name:        "web_search",
			Description: "Search the web for current information. Use this when you need real-time data like hotel prices, flight costs, travel info, current interest rates, product prices, or any information that may have changed recently. Returns relevant web results with snippets.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "The search query. Be specific — include dates, locations, and price ranges when relevant.",
					},
					"max_results": map[string]interface{}{
						"type":        "integer",
						"description": "Number of results to return (1-10). Defaults to 5.",
						"minimum":     1,
						"maximum":     10,
					},
				},
				"required": []string{"query"},
			},
		})
	}

	return tools
}
