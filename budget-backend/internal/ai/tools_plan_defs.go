package ai

import (
	"github.com/aboogie/budget-backend/models"
)

func toolDefsPlans() []models.ClaudeToolDef {
	return []models.ClaudeToolDef{
		{
			Name:        "create_financial_plan",
			Description: "Create a new financial plan (debt payoff, savings, or combined) with allocations, milestones, and AI analysis. This SAVES to the database. Use this when the user wants to formalize a plan after discussing options. ALWAYS include milestones with target dates and an ai_analysis summary.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Name for the financial plan.",
					},
					"plan_type": map[string]interface{}{
						"type":        "string",
						"description": "Type of plan: debt_payoff, savings, or combined.",
						"enum":        []string{"debt_payoff", "savings", "combined"},
					},
					"monthly_contribution": map[string]interface{}{
						"type":        "number",
						"description": "Total monthly contribution for this plan.",
					},
					"goal_ids": map[string]interface{}{
						"type":        "array",
						"description": "Array of debt account IDs or savings goal IDs to include in the plan.",
						"items":       map[string]interface{}{"type": "string"},
					},
					"milestones": map[string]interface{}{
						"type":        "array",
						"description": "Key milestones for the plan. Include 3-6 milestones with realistic target dates.",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"title":         map[string]interface{}{"type": "string", "description": "Short milestone title, e.g. 'Pay off credit card' or 'Emergency fund at $5,000'"},
								"target_amount": map[string]interface{}{"type": "number", "description": "Dollar amount target for this milestone"},
								"target_date":   map[string]interface{}{"type": "string", "description": "Target date in YYYY-MM-DD format"},
							},
							"required": []string{"title", "target_date"},
						},
					},
					"ai_analysis": map[string]interface{}{
						"type":        "string",
						"description": "Your analysis and reasoning for this plan. Explain why this plan makes sense, key assumptions, and what to watch for. 2-4 sentences.",
					},
					"projected_end_date": map[string]interface{}{
						"type":        "string",
						"description": "Projected completion date in YYYY-MM-DD format.",
					},
				},
				"required": []string{"name", "plan_type", "monthly_contribution"},
			},
		},
		{
			Name:        "assess_savings_goal",
			Description: "Check whether a savings goal is realistic before creating a plan for it. Given a target amount and target date, returns the required monthly contribution, the couple's free monthly cash flow (surplus minus what active plans already commit), whether it's feasible, and — when it isn't — a realistic later date, a lower target that fits, and how much more per month they'd need to free up. Use this when a couple wants to save for something by a date, then give them a realistic, encouraging read and (if they agree) create the goal and plan.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":           map[string]interface{}{"type": "string", "description": "What they're saving for."},
					"target_amount":  map[string]interface{}{"type": "number", "description": "The savings target amount."},
					"current_amount": map[string]interface{}{"type": "number", "description": "How much they already have saved toward it (default 0)."},
					"target_date":    map[string]interface{}{"type": "string", "description": "The date they want to reach it by, YYYY-MM-DD."},
				},
				"required": []string{"target_amount", "target_date"},
			},
		},
	}
}
