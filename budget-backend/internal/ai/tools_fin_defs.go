package ai

import (
	"github.com/aboogie/budget-backend/models"
)

func toolDefsFinancialAndPlans() []models.ClaudeToolDef {
	out := toolDefsFinancialReads()
	out = append(out, toolDefsPlans()...)
	return out
}

func toolDefsFinancialReads() []models.ClaudeToolDef {
	return []models.ClaudeToolDef{
		{
			Name:        "get_financial_snapshot",
			Description: "Get the couple's (or personal) financial snapshot: income, expenses, debt, savings, bank balances, and active budgets. Defaults to Household scope when the user is in a couple — same numbers as the dashboard Household toggle. Pass scope='me' for personal-only. When budgets and accounts are empty, the result includes a setup_priority flag — prioritize create_budget / link-bank CTAs before ambitious plans.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scope": map[string]interface{}{
						"type":        "string",
						"description": "Me vs Household, matching the dashboard toggle. 'household' (default when in a couple) includes partner-shared data gated by sharing preferences. 'me' is only the current user's data.",
						"enum":        []string{"me", "household"},
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "get_debts",
			Description: "Get debt accounts with balances, APRs, minimum payments, and payoff strategies. Defaults to Household scope (own + partner-shared debts gated by share_debts). Pass scope='me' for personal-only.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scope": map[string]interface{}{
						"type":        "string",
						"description": "Me vs Household, matching the dashboard toggle. 'household' (default when in a couple) includes partner-shared data gated by sharing preferences. 'me' is only the current user's data.",
						"enum":        []string{"me", "household"},
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "get_savings_goals",
			Description: "Get savings goals with current amounts, targets, and deadlines. Defaults to Household scope (own + partner-shared goals gated by share_savings). Pass scope='me' for personal-only.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scope": map[string]interface{}{
						"type":        "string",
						"description": "Me vs Household, matching the dashboard toggle. 'household' (default when in a couple) includes partner-shared data gated by sharing preferences. 'me' is only the current user's data.",
						"enum":        []string{"me", "household"},
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "get_spending_by_category",
			Description: "Get spending broken down by category. Defaults to Household scope so questions like 'what did we spend on dining?' include both partners' shared transactions (same sharing gate as the dashboard). Pass scope='me' for personal-only.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"months": map[string]interface{}{
						"type":        "integer",
						"description": "Number of months to look back (1-12). Defaults to 3.",
						"minimum":     1,
						"maximum":     12,
					},
					"scope": map[string]interface{}{
						"type":        "string",
						"description": "Me vs Household, matching the dashboard toggle. 'household' (default when in a couple) includes partner-shared data gated by sharing preferences. 'me' is only the current user's data.",
						"enum":        []string{"me", "household"},
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "get_bills",
			Description: "Get recurring bills with amounts, due dates, and autopay status. Defaults to Household scope (own + partner-shared bills). Pass scope='me' for personal-only.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scope": map[string]interface{}{
						"type":        "string",
						"description": "Me vs Household, matching the dashboard toggle. 'household' (default when in a couple) includes partner-shared data gated by sharing preferences. 'me' is only the current user's data.",
						"enum":        []string{"me", "household"},
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "calculate_debt_payoff",
			Description: "Calculate a month-by-month debt payoff schedule. By default only includes 'attack' debts (aggressive payoff). Use debt_category='all' to include structured debts (mortgage etc.) with standard amortization. Use this when the user asks about paying off debt or comparing strategies.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"strategy": map[string]interface{}{
						"type":        "string",
						"description": "Payoff strategy: avalanche (highest APR first), snowball (lowest balance first), or hybrid (APR bands + balance).",
						"enum":        []string{"avalanche", "snowball", "hybrid"},
					},
					"extra_payment": map[string]interface{}{
						"type":        "number",
						"description": "Extra monthly payment above all minimum payments.",
					},
					"debt_category": map[string]interface{}{
						"type":        "string",
						"description": "Filter by debt category. 'attack' = debts to pay off aggressively (default). 'structured' = debts on standard schedule (mortgage). 'all' = both with appropriate treatment.",
						"enum":        []string{"attack", "structured", "all"},
					},
				},
				"required": []string{"strategy", "extra_payment"},
			},
		},
		{
			Name:        "project_savings",
			Description: "Project month-by-month savings growth with compound interest for one or all savings goals. Shows when the target will be reached. Use this when discussing savings timelines or contribution amounts.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"goal_id": map[string]interface{}{
						"type":        "string",
						"description": "Specific savings goal ID. If omitted, projects all goals.",
					},
					"monthly_amount": map[string]interface{}{
						"type":        "number",
						"description": "Monthly contribution amount.",
					},
					"annual_rate": map[string]interface{}{
						"type":        "number",
						"description": "Annual interest/return rate as a decimal (e.g. 0.05 for 5%). Defaults to 0.05.",
					},
				},
				"required": []string{"monthly_amount"},
			},
		},
		{
			Name:        "get_partner_status",
			Description: "Get partner's pending reviews, shared goals status, and recent activity. Use when discussing couple goals or plan approvals.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
	}
}
