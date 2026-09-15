package ai

import (
	"github.com/aboogie/budget-backend/models"
)

func toolDefsMemoryAndMutations() []models.ClaudeToolDef {
	return []models.ClaudeToolDef{
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
			Name:        "create_category",
			Description: "Create a new transaction category (optionally as a subcategory). This SAVES to the database and appears in Settings → Categories. Fails if a same-named category already exists — assign to the existing one instead.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":        map[string]interface{}{"type": "string", "description": "Category name, e.g. 'Pet Care'."},
					"type":        map[string]interface{}{"type": "string", "enum": []string{"expense", "income"}, "description": "Defaults to expense."},
					"parent_name": map[string]interface{}{"type": "string", "description": "Optional parent category name to nest under."},
					"color":       map[string]interface{}{"type": "string", "description": "Optional hex color."},
					"icon":        map[string]interface{}{"type": "string", "description": "Optional Ionicons icon name."},
				},
				"required": []string{"name"},
			},
		},
		{
			Name:        "assign_transaction_category",
			Description: "Categorize transactions: either ONE transaction by id, or ALL of the user's transactions matching a merchant name. Assignments are marked user-verified (the user approves every action). Set create_rule=true with a merchant to also save the mapping so future syncs categorize automatically.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"transaction_id": map[string]interface{}{"type": "string", "description": "A single transaction to categorize."},
					"merchant":       map[string]interface{}{"type": "string", "description": "Merchant name — categorizes every matching transaction (e.g. 'starbucks')."},
					"category_name":  map[string]interface{}{"type": "string", "description": "Existing category name to assign."},
					"create_rule":    map[string]interface{}{"type": "boolean", "description": "Also save a merchant→category rule for future syncs."},
				},
				"required": []string{"category_name"},
			},
		},
		{
			Name:        "upsert_category_rule",
			Description: "Create or update an auto-categorization rule: merchant (exact normalized name) or keyword (substring) → category. Future synced transactions matching it categorize automatically. Visible in Settings → Category Rules.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"merchant":      map[string]interface{}{"type": "string", "description": "Normalized merchant name for an exact-match rule."},
					"keyword":       map[string]interface{}{"type": "string", "description": "Substring keyword rule (used when merchant is not given)."},
					"category_name": map[string]interface{}{"type": "string", "description": "Existing category name the rule maps to."},
				},
				"required": []string{"category_name"},
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
}
