package ai

import "github.com/aboogie/budget-backend/models"

// GetToolDefinitionsForMode returns Free light (read-only + remember_fact) or full Plus tools.
// Light excludes mutating tools, plan writes, and web_search (C029/C031).
func GetToolDefinitionsForMode(aiMode string) []models.ClaudeToolDef {
	if aiMode == "light" {
		tools := toolDefsFinancialReads()
		tools = append(tools, rememberFactToolDef())
		// assess_savings_goal is read/compute — useful on Free without writes.
		tools = append(tools, assessSavingsGoalToolDef())
		return tools
	}
	return GetToolDefinitions()
}

func rememberFactToolDef() models.ClaudeToolDef {
	for _, t := range toolDefsMemoryAndMutations() {
		if t.Name == "remember_fact" {
			return t
		}
	}
	return models.ClaudeToolDef{Name: "remember_fact"}
}

func assessSavingsGoalToolDef() models.ClaudeToolDef {
	for _, t := range toolDefsPlans() {
		if t.Name == "assess_savings_goal" {
			return t
		}
	}
	return models.ClaudeToolDef{Name: "assess_savings_goal"}
}
