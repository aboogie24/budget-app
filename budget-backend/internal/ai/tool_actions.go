package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
)

// Action tools — the advisor's WRITE surface. Every action here:
//   - is additive (create/update); the advisor never deletes — destructive
//     actions stay human-only in the UI,
//   - is scoped to the calling user (and their household when shared),
//   - records an activity_events row so the partner sees what the AI did,
//   - returns JSON that names the screen where the result is visible, so the
//     advisor can tell the user where to find it.

// recordAIActivity mirrors handlers.RecordActivity (which we can't import —
// handlers depends on this package). Best-effort: a feed miss never fails the
// action itself.
func recordAIActivity(conn *sql.DB, householdID, userID, eventType, entityID, entityType string, amount float64, description string) {
	if householdID == "" {
		return // activity feed is a household feature
	}
	var amountPtr *float64
	if amount != 0 {
		amountPtr = &amount
	}
	var entityIDPtr *string
	if entityID != "" {
		entityIDPtr = &entityID
	}
	var entityTypePtr *string
	if entityType != "" {
		entityTypePtr = &entityType
	}
	if _, err := conn.Exec(`
		INSERT INTO activity_events (id, household_id, user_id, event_type, entity_id, entity_type, amount, description, metadata)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, '{}')
	`, householdID, userID, eventType, entityIDPtr, entityTypePtr, amountPtr, description); err != nil {
		log.Printf("ai activity insert error: %v", err)
	}
}

// ── create_savings_goal ──────────────────────────────────────────

func createSavingsGoalTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		Name          string  `json:"name"`
		TargetAmount  float64 `json:"target_amount"`
		TargetDate    string  `json:"target_date"`
		CurrentAmount float64 `json:"current_amount"`
		IsShared      *bool   `json:"is_shared"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("create_savings_goal: parse input: %w", err)
	}
	if strings.TrimSpace(params.Name) == "" {
		return "", fmt.Errorf("create_savings_goal: name is required")
	}
	if params.TargetAmount <= 0 {
		return "", fmt.Errorf("create_savings_goal: target_amount must be positive")
	}
	if params.TargetDate != "" {
		if _, err := time.Parse("2006-01-02", params.TargetDate); err != nil {
			return "", fmt.Errorf("create_savings_goal: target_date must be YYYY-MM-DD")
		}
	}

	// Shared by default when the user has a household — trip/goal planning in
	// a couples app is a joint activity unless they say otherwise.
	shared := householdID != ""
	if params.IsShared != nil {
		shared = *params.IsShared && householdID != ""
	}
	var hhVal interface{}
	if shared {
		hhVal = householdID
	}

	var goalID string
	err := conn.QueryRow(`
		INSERT INTO savings_goals (id, user_id, household_id, name, target_amount, current_amount, target_date, priority, is_shared)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NULLIF($6, ''), 0, $7)
		RETURNING id
	`, userID, hhVal, strings.TrimSpace(params.Name), params.TargetAmount, params.CurrentAmount, params.TargetDate, shared).Scan(&goalID)
	if err != nil {
		log.Printf("create_savings_goal insert error: %v", err)
		return "", fmt.Errorf("create_savings_goal: save failed")
	}

	recordAIActivity(conn, householdID, userID, "goal_created", goalID, "savings_goal", params.TargetAmount,
		fmt.Sprintf("AI advisor created savings goal %q ($%.0f)", params.Name, params.TargetAmount))

	out, _ := json.Marshal(map[string]interface{}{
		"goal_id":       goalID,
		"name":          params.Name,
		"target_amount": params.TargetAmount,
		"target_date":   params.TargetDate,
		"is_shared":     shared,
		"visible_at":    "Savings (Home menu → Savings)",
		"next_step":     "Use create_financial_plan with this goal_id to set up monthly contributions and milestones.",
	})
	return string(out), nil
}

// ── update_savings_goal ──────────────────────────────────────────

func updateSavingsGoalTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		GoalID       string   `json:"goal_id"`
		AddAmount    float64  `json:"add_amount"`
		TargetAmount *float64 `json:"target_amount"`
		TargetDate   string   `json:"target_date"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("update_savings_goal: parse input: %w", err)
	}
	if params.GoalID == "" {
		return "", fmt.Errorf("update_savings_goal: goal_id is required")
	}
	if params.TargetDate != "" {
		if _, err := time.Parse("2006-01-02", params.TargetDate); err != nil {
			return "", fmt.Errorf("update_savings_goal: target_date must be YYYY-MM-DD")
		}
	}

	// Ownership: the goal must belong to this user or their household.
	var owned bool
	if err := conn.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM savings_goals
			WHERE id = $1 AND (user_id = $2 OR ($3 != '' AND household_id::text = $3))
		)
	`, params.GoalID, userID, householdID).Scan(&owned); err != nil || !owned {
		return "", fmt.Errorf("update_savings_goal: goal not found for this user")
	}

	var name string
	var current, target float64
	err := conn.QueryRow(`
		UPDATE savings_goals SET
			current_amount = GREATEST(current_amount + $2, 0),
			target_amount  = COALESCE($3, target_amount),
			target_date    = COALESCE(NULLIF($4, ''), target_date)
		WHERE id = $1
		RETURNING name, current_amount, target_amount
	`, params.GoalID, params.AddAmount, params.TargetAmount, params.TargetDate).Scan(&name, &current, &target)
	if err != nil {
		log.Printf("update_savings_goal error: %v", err)
		return "", fmt.Errorf("update_savings_goal: update failed")
	}

	if params.AddAmount != 0 {
		verb := "added $%.0f to"
		if params.AddAmount < 0 {
			verb = "withdrew $%.0f from"
		}
		recordAIActivity(conn, householdID, userID, "goal_progress", params.GoalID, "savings_goal", params.AddAmount,
			fmt.Sprintf("AI advisor "+verb+" savings goal %q", absF(params.AddAmount), name))
	}

	out, _ := json.Marshal(map[string]interface{}{
		"goal_id":        params.GoalID,
		"name":           name,
		"current_amount": current,
		"target_amount":  target,
		"percent":        pctOf(current, target),
		"visible_at":     "Savings (Home menu → Savings)",
	})
	return string(out), nil
}

// ── create_budget ────────────────────────────────────────────────

func createBudgetTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		Name      string  `json:"name"`
		Amount    float64 `json:"amount"`
		Type      string  `json:"type"`
		Frequency string  `json:"frequency"`
		IsShared  *bool   `json:"is_shared"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("create_budget: parse input: %w", err)
	}
	if strings.TrimSpace(params.Name) == "" {
		return "", fmt.Errorf("create_budget: name is required")
	}
	if params.Amount <= 0 {
		return "", fmt.Errorf("create_budget: amount must be positive")
	}
	if params.Type != "income" {
		params.Type = "expense"
	}
	switch params.Frequency {
	case "weekly", "biweekly", "monthly", "1st-15th":
	default:
		params.Frequency = "monthly"
	}

	shared := householdID != ""
	if params.IsShared != nil {
		shared = *params.IsShared && householdID != ""
	}
	var hhVal interface{}
	if shared {
		hhVal = householdID
	}

	var budgetID string
	err := conn.QueryRow(`
		INSERT INTO budgets (id, user_id, household_id, name, amount, type, created_at, updated_at, start_date, frequency, is_shared)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW(), CURRENT_DATE, $6, $7)
		RETURNING id
	`, userID, hhVal, strings.TrimSpace(params.Name), params.Amount, params.Type, params.Frequency, shared).Scan(&budgetID)
	if err != nil {
		log.Printf("create_budget insert error: %v", err)
		if strings.Contains(err.Error(), "idx_budgets_user_category_type_unique") {
			return "", fmt.Errorf("create_budget: a %s budget with this category already exists — suggest updating it in the Budget tab instead", params.Type)
		}
		return "", fmt.Errorf("create_budget: save failed")
	}

	recordAIActivity(conn, householdID, userID, "budget_created", budgetID, "budget", params.Amount,
		fmt.Sprintf("AI advisor created %s budget %q ($%.0f %s)", params.Type, params.Name, params.Amount, params.Frequency))

	out, _ := json.Marshal(map[string]interface{}{
		"budget_id":  budgetID,
		"name":       params.Name,
		"amount":     params.Amount,
		"type":       params.Type,
		"frequency":  params.Frequency,
		"is_shared":  shared,
		"visible_at": "Budget tab",
	})
	return string(out), nil
}

// ── log_transaction ──────────────────────────────────────────────

func logTransactionTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		Type         string  `json:"type"`
		Amount       float64 `json:"amount"`
		Note         string  `json:"note"`
		Date         string  `json:"date"`
		CategoryName string  `json:"category_name"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("log_transaction: parse input: %w", err)
	}
	if params.Type != "income" && params.Type != "expense" {
		return "", fmt.Errorf("log_transaction: type must be income or expense")
	}
	if params.Amount <= 0 {
		return "", fmt.Errorf("log_transaction: amount must be positive")
	}
	txDate := time.Now().UTC()
	if params.Date != "" {
		d, err := time.Parse("2006-01-02", params.Date)
		if err != nil {
			return "", fmt.Errorf("log_transaction: date must be YYYY-MM-DD")
		}
		txDate = d
	}

	// Best-effort category match by name (user's own or household categories).
	var categoryID interface{}
	var categoryName interface{}
	if params.CategoryName != "" {
		var cid, cname string
		err := conn.QueryRow(`
			SELECT c.id::text, c.name FROM categories c
			WHERE (c.user_id = $1 OR ($2 != '' AND c.household_id::text = $2))
			  AND c.type = $3 AND c.name ILIKE $4
			ORDER BY (c.name = $4) DESC LIMIT 1
		`, userID, householdID, params.Type, params.CategoryName).Scan(&cid, &cname)
		if err == nil {
			categoryID = cid
			categoryName = cname
		}
	}

	var hhVal interface{}
	if householdID != "" {
		hhVal = householdID
	}

	var txID string
	err := conn.QueryRow(`
		INSERT INTO transactions (id, user_id, household_id, category_id, type, amount, currency, category_name, note, date, source)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'USD', $6, $7, $8, 'manual')
		RETURNING id
	`, userID, hhVal, categoryID, params.Type, params.Amount, categoryName, params.Note, txDate).Scan(&txID)
	if err != nil {
		log.Printf("log_transaction insert error: %v", err)
		return "", fmt.Errorf("log_transaction: save failed")
	}

	recordAIActivity(conn, householdID, userID, "transaction_added", txID, "transaction", params.Amount,
		fmt.Sprintf("AI advisor logged %s: %s ($%.2f)", params.Type, params.Note, params.Amount))

	out, _ := json.Marshal(map[string]interface{}{
		"transaction_id": txID,
		"type":           params.Type,
		"amount":         params.Amount,
		"note":           params.Note,
		"date":           txDate.Format("2006-01-02"),
		"category":       categoryName,
		"visible_at":     "Transactions (Home menu → Transactions)",
	})
	return string(out), nil
}

// ── small helpers ────────────────────────────────────────────────

func absF(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func pctOf(current, target float64) int {
	if target <= 0 {
		return 0
	}
	p := int(current / target * 100)
	if p > 100 {
		p = 100
	}
	if p < 0 {
		p = 0
	}
	return p
}
