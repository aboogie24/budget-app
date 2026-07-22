package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/aboogie/budget-backend/models"
)

// GetToolDefinitions returns the Claude tool definitions for financial data access.
func GetToolDefinitions() []models.ClaudeToolDef {
	tools := []models.ClaudeToolDef{
		{
			Name:        "get_financial_snapshot",
			Description: "Get the user's complete financial snapshot including income, expenses, account balances, and net worth summary. Use this to understand their overall financial picture.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
		{
			Name:        "get_debts",
			Description: "Get all of the user's debt accounts with balances, APRs, minimum payments, and payoff strategies. Use this when discussing debt payoff plans.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
		{
			Name:        "get_savings_goals",
			Description: "Get all of the user's savings goals with current amounts, target amounts, and deadlines. Use this when discussing savings progress or planning.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
		{
			Name:        "get_spending_by_category",
			Description: "Get the user's spending broken down by category for a given number of months. Use this to analyze spending patterns and suggest budget adjustments.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"months": map[string]interface{}{
						"type":        "integer",
						"description": "Number of months to look back (1-12). Defaults to 3.",
						"minimum":     1,
						"maximum":     12,
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "get_bills",
			Description: "Get all of the user's recurring bills with amounts, due dates, and autopay status. Use this when discussing monthly expenses or cash flow.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
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
		{
			Name:        "remember_fact",
			Description: "Save a durable fact about this couple so you remember it in future conversations — their goals in their own words, constraints, preferences, decisions or commitments they've made, or what they've already tried. Use this whenever the user shares something worth remembering long-term. Do NOT use it for transient numbers you can already get from the financial tools. Set scope to 'shared' for couple-level facts both partners should see (shared goals, agreed strategy, household constraints), or 'private' for one person's individual context (personal worries, individual preferences, solo aspirations). When unsure, use 'private' — private facts are never shown to the partner.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"fact": map[string]interface{}{
						"type":        "string",
						"description": "The fact to remember, written concisely in your own words.",
					},
					"scope": map[string]interface{}{
						"type":        "string",
						"description": "'shared' (both partners can see it) or 'private' (only the current user). Defaults to 'private' when unsure.",
						"enum":        []string{"shared", "private"},
					},
				},
				"required": []string{"fact"},
			},
		},
		{
			Name:        "create_savings_goal",
			Description: "Create a new savings goal in the app. This SAVES to the database and appears on the Savings screen. Use after the user agrees to a goal (e.g. a trip, an emergency fund top-up). Run assess_savings_goal FIRST so the target and date are realistic. Defaults to shared with the partner when the user has one; pass is_shared=false only if the user asks for a personal goal.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":           map[string]interface{}{"type": "string", "description": "Goal name, e.g. 'Jamaica trip — December'."},
					"target_amount":  map[string]interface{}{"type": "number", "description": "Total dollar amount to save."},
					"target_date":    map[string]interface{}{"type": "string", "description": "Target date YYYY-MM-DD."},
					"current_amount": map[string]interface{}{"type": "number", "description": "Amount already saved toward it, if any. Defaults to 0."},
					"is_shared":      map[string]interface{}{"type": "boolean", "description": "Whether the partner can see it. Defaults to true when a household exists."},
				},
				"required": []string{"name", "target_amount"},
			},
		},
		{
			Name:        "update_savings_goal",
			Description: "Update an existing savings goal: add saved money (add_amount, may be negative for a withdrawal), change the target amount, or move the target date. Use get_savings_goals first to find the goal_id. This SAVES to the database.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"goal_id":       map[string]interface{}{"type": "string", "description": "ID of the goal to update."},
					"add_amount":    map[string]interface{}{"type": "number", "description": "Dollars to add to current progress (negative to withdraw)."},
					"target_amount": map[string]interface{}{"type": "number", "description": "New total target, if changing it."},
					"target_date":   map[string]interface{}{"type": "string", "description": "New target date YYYY-MM-DD, if changing it."},
				},
				"required": []string{"goal_id"},
			},
		},
		{
			Name:        "create_budget",
			Description: "Create a budget line in the app (Budget tab). This SAVES to the database. Useful as an actionable step in a plan — e.g. a monthly 'Trip fund' expense budget, or trimming a category by creating an explicit cap. Weekly/biweekly budgets count real calendar occurrences per month.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":      map[string]interface{}{"type": "string", "description": "Budget name, e.g. 'Dining out' or 'Jamaica trip fund'."},
					"amount":    map[string]interface{}{"type": "number", "description": "Amount per frequency period."},
					"type":      map[string]interface{}{"type": "string", "enum": []string{"expense", "income"}, "description": "Budget type. Defaults to expense."},
					"frequency": map[string]interface{}{"type": "string", "enum": []string{"weekly", "biweekly", "monthly", "1st-15th"}, "description": "How often the amount applies. Defaults to monthly."},
					"is_shared": map[string]interface{}{"type": "boolean", "description": "Whether the partner can see it. Defaults to true when a household exists."},
				},
				"required": []string{"name", "amount"},
			},
		},
		{
			Name:        "log_transaction",
			Description: "Record a manual income or expense transaction the user tells you about (e.g. 'I put $200 aside for the trip', 'log $45 for dinner'). This SAVES to the database and appears in Transactions. Do NOT invent transactions — only log what the user explicitly states. If they name a category, it is matched to their existing categories when possible.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"type":          map[string]interface{}{"type": "string", "enum": []string{"income", "expense"}, "description": "Transaction type."},
					"amount":        map[string]interface{}{"type": "number", "description": "Positive dollar amount."},
					"note":          map[string]interface{}{"type": "string", "description": "Short description, e.g. 'Transfer to Jamaica fund'."},
					"date":          map[string]interface{}{"type": "string", "description": "YYYY-MM-DD. Defaults to today."},
					"category_name": map[string]interface{}{"type": "string", "description": "Category name to match against their categories, if the user gave one."},
				},
				"required": []string{"type", "amount", "note"},
			},
		},
	}

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

// ExecuteTool runs a tool call and returns the result as a JSON string.
func ExecuteTool(conn *sql.DB, userID string, householdID string, toolName string, input json.RawMessage) (string, error) {
	switch toolName {
	case "get_financial_snapshot":
		return getFinancialSnapshot(conn, userID, householdID)
	case "get_debts":
		return getDebts(conn, userID, householdID)
	case "get_savings_goals":
		return getSavingsGoals(conn, userID, householdID)
	case "get_spending_by_category":
		return getSpendingByCategory(conn, userID, householdID, input)
	case "get_bills":
		return getBills(conn, userID, householdID)
	case "calculate_debt_payoff":
		return calculateDebtPayoffTool(conn, userID, householdID, input)
	case "project_savings":
		return projectSavingsTool(conn, userID, householdID, input)
	case "get_partner_status":
		return getPartnerStatus(conn, userID, householdID)
	case "create_financial_plan":
		return createFinancialPlanTool(conn, userID, householdID, input)
	case "assess_savings_goal":
		return assessSavingsGoalTool(conn, userID, householdID, input)
	case "remember_fact":
		return rememberFactTool(conn, userID, householdID, input)
	case "create_savings_goal":
		return createSavingsGoalTool(conn, userID, householdID, input)
	case "update_savings_goal":
		return updateSavingsGoalTool(conn, userID, householdID, input)
	case "create_budget":
		return createBudgetTool(conn, userID, householdID, input)
	case "log_transaction":
		return logTransactionTool(conn, userID, householdID, input)
	case "web_search":
		return executeWebSearch(userID, input)
	default:
		return "", fmt.Errorf("unknown tool: %s", toolName)
	}
}

func getFinancialSnapshot(conn *sql.DB, userID, householdID string) (string, error) {
	snapshot := map[string]interface{}{}

	// Budgeted income (expected monthly from budget entries)
	var budgetedIncome sql.NullFloat64
	err := conn.QueryRow(`
		SELECT COALESCE(SUM(
			CASE frequency
				WHEN 'weekly' THEN amount * 4
				WHEN 'biweekly' THEN amount * 2
				WHEN '1st-15th' THEN amount * 2
				ELSE amount
			END
		), 0) FROM budgets WHERE user_id = $1 AND type = 'income'
	`, userID).Scan(&budgetedIncome)
	if err != nil {
		log.Printf("snapshot budgeted income query error: %v", err)
	}
	snapshot["budgeted_monthly_income"] = budgetedIncome.Float64

	// Actual income received (transactions this month)
	var actualIncome sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'income'
		  AND date >= NOW() - INTERVAL '30 days'
	`, userID).Scan(&actualIncome)
	if err != nil {
		log.Printf("snapshot actual income query error: %v", err)
	}
	snapshot["actual_income_received"] = actualIncome.Float64

	// Monthly expenses (sum of expense transactions in last 30 days)
	var monthlyExpenses sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND date >= NOW() - INTERVAL '30 days'
	`, userID).Scan(&monthlyExpenses)
	if err != nil {
		log.Printf("snapshot expenses query error: %v", err)
	}
	snapshot["monthly_expenses"] = monthlyExpenses.Float64
	snapshot["expected_cash_flow"] = budgetedIncome.Float64 - monthlyExpenses.Float64

	// Total debt (column is "balance" not "current_balance")
	var totalDebt sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(balance), 0)
		FROM debt_accounts
		WHERE user_id = $1
	`, userID).Scan(&totalDebt)
	if err != nil {
		log.Printf("snapshot debt query error: %v", err)
	}
	snapshot["total_debt"] = totalDebt.Float64

	// Total savings
	var totalSavings sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(current_amount), 0)
		FROM savings_goals
		WHERE user_id = $1
	`, userID).Scan(&totalSavings)
	if err != nil {
		log.Printf("snapshot savings query error: %v", err)
	}
	snapshot["total_savings"] = totalSavings.Float64

	// Account balances (from Plaid)
	var totalBankBalance sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(current_balance), 0)
		FROM account_balances
		WHERE user_id = $1
	`, userID).Scan(&totalBankBalance)
	if err != nil {
		log.Printf("snapshot balance query error: %v", err)
	}
	snapshot["total_bank_balance"] = totalBankBalance.Float64

	// Number of active budgets
	var budgetCount int
	_ = conn.QueryRow(`SELECT COUNT(*) FROM budgets WHERE user_id = $1`, userID).Scan(&budgetCount)
	snapshot["active_budgets"] = budgetCount

	result, _ := json.Marshal(snapshot)
	return string(result), nil
}

func getDebts(conn *sql.DB, userID, householdID string) (string, error) {
	rows, err := conn.Query(`
		SELECT id, name, balance, COALESCE(apr, 0),
		       COALESCE(min_payment, 0), COALESCE(strategy, ''),
		       COALESCE(debt_category, 'attack'), COALESCE(liability_type, 'other')
		FROM debt_accounts
		WHERE user_id = $1
		ORDER BY debt_category, apr DESC
	`, userID)
	if err != nil {
		return "[]", fmt.Errorf("query debts: %w", err)
	}
	defer rows.Close()

	var debts []map[string]interface{}
	for rows.Next() {
		var id, name, strategy, category, liabilityType string
		var balance, apr, minPayment float64
		if err := rows.Scan(&id, &name, &balance, &apr, &minPayment, &strategy, &category, &liabilityType); err != nil {
			continue
		}
		debts = append(debts, map[string]interface{}{
			"id":              id,
			"name":            name,
			"balance":         balance,
			"apr":             apr,
			"minimum_payment": minPayment,
			"payoff_strategy": strategy,
			"debt_category":   category,
			"liability_type":  liabilityType,
		})
	}

	if debts == nil {
		debts = []map[string]interface{}{}
	}
	result, _ := json.Marshal(debts)
	return string(result), nil
}

func getSavingsGoals(conn *sql.DB, userID, householdID string) (string, error) {
	rows, err := conn.Query(`
		SELECT id, name, COALESCE(current_amount, 0), COALESCE(target_amount, 0),
		       COALESCE(target_date, '')
		FROM savings_goals
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return "[]", fmt.Errorf("query savings goals: %w", err)
	}
	defer rows.Close()

	var goals []map[string]interface{}
	for rows.Next() {
		var id, name, targetDate string
		var current, target float64
		if err := rows.Scan(&id, &name, &current, &target, &targetDate); err != nil {
			continue
		}

		goal := map[string]interface{}{
			"id":             id,
			"name":           name,
			"current_amount": current,
			"target_amount":  target,
		}
		if targetDate != "" {
			goal["target_date"] = targetDate
		}
		pct := 0.0
		if target > 0 {
			pct = (current / target) * 100
		}
		goal["progress_percent"] = fmt.Sprintf("%.1f", pct)
		goals = append(goals, goal)
	}

	if goals == nil {
		goals = []map[string]interface{}{}
	}
	result, _ := json.Marshal(goals)
	return string(result), nil
}

func getSpendingByCategory(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	months := 3
	if input != nil {
		var params struct {
			Months int `json:"months"`
		}
		if err := json.Unmarshal(input, &params); err == nil && params.Months > 0 && params.Months <= 12 {
			months = params.Months
		}
	}

	rows, err := conn.Query(`
		SELECT COALESCE(c.name, t.category_name, 'Uncategorized') as category,
		       SUM(t.amount) as total,
		       COUNT(*) as transaction_count
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
		  AND t.type = 'expense'
		  AND t.date >= NOW() - ($2 || ' months')::INTERVAL
		GROUP BY category
		ORDER BY total DESC
	`, userID, fmt.Sprintf("%d", months))
	if err != nil {
		return "[]", fmt.Errorf("query spending: %w", err)
	}
	defer rows.Close()

	var categories []map[string]interface{}
	for rows.Next() {
		var category string
		var total float64
		var count int
		if err := rows.Scan(&category, &total, &count); err != nil {
			continue
		}
		categories = append(categories, map[string]interface{}{
			"category":          category,
			"total":             total,
			"transaction_count": count,
			"monthly_average":   total / float64(months),
		})
	}

	if categories == nil {
		categories = []map[string]interface{}{}
	}

	result, _ := json.Marshal(map[string]interface{}{
		"months":     months,
		"categories": categories,
	})
	return string(result), nil
}

func getBills(conn *sql.DB, userID, householdID string) (string, error) {
	rows, err := conn.Query(`
		SELECT id, name, amount_due, due_day, COALESCE(frequency, 'monthly'),
		       COALESCE(is_autopay, false)
		FROM bills
		WHERE user_id = $1
		ORDER BY due_day ASC
	`, userID)
	if err != nil {
		return "[]", fmt.Errorf("query bills: %w", err)
	}
	defer rows.Close()

	var bills []map[string]interface{}
	for rows.Next() {
		var id, name, frequency string
		var amount float64
		var dueDay int
		var autopay bool
		if err := rows.Scan(&id, &name, &amount, &dueDay, &frequency, &autopay); err != nil {
			continue
		}
		bills = append(bills, map[string]interface{}{
			"id":        id,
			"name":      name,
			"amount":    amount,
			"due_day":   dueDay,
			"frequency": frequency,
			"autopay":   autopay,
		})
	}

	if bills == nil {
		bills = []map[string]interface{}{}
	}
	result, _ := json.Marshal(bills)
	return string(result), nil
}
