package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

func getDebts(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	scope := ScopeFromInput(input, householdID)
	hasHH := householdID != ""
	where := debtScopeWhere(scope, "$1", "$2", hasHH)
	args := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		args = []interface{}{userID, householdID}
	}

	rows, err := conn.Query(`
		SELECT d.id, d.name, d.balance, COALESCE(d.apr, 0),
		       COALESCE(d.min_payment, 0), COALESCE(d.strategy, ''),
		       COALESCE(d.debt_category, 'attack'), COALESCE(d.liability_type, 'other'),
		       COALESCE(d.is_shared, false), d.user_id::text
		FROM debt_accounts d
		WHERE `+where+`
		ORDER BY d.debt_category, d.apr DESC
	`, args...)
	if err != nil {
		return "[]", fmt.Errorf("query debts: %w", err)
	}
	defer rows.Close()

	var debts []map[string]interface{}
	for rows.Next() {
		var id, name, strategy, category, liabilityType, ownerID string
		var balance, apr, minPayment float64
		var isShared bool
		if err := rows.Scan(&id, &name, &balance, &apr, &minPayment, &strategy, &category, &liabilityType, &isShared, &ownerID); err != nil {
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
			"is_shared":       isShared,
			"owner_user_id":   ownerID,
			"is_mine":         ownerID == userID,
		})
	}

	if debts == nil {
		debts = []map[string]interface{}{}
	}
	out := scopeMeta(scope, householdID)
	out["debts"] = debts
	result, _ := json.Marshal(out)
	return string(result), nil
}

func getSavingsGoals(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	scope := ScopeFromInput(input, householdID)
	hasHH := householdID != ""
	where := savingsScopeWhere(scope, "$1", "$2", hasHH)
	args := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		args = []interface{}{userID, householdID}
	}

	rows, err := conn.Query(`
		SELECT g.id, g.name, COALESCE(g.current_amount, 0), COALESCE(g.target_amount, 0),
		       COALESCE(g.target_date::text, ''), COALESCE(g.is_shared, false), g.user_id::text
		FROM savings_goals g
		WHERE `+where+`
		ORDER BY g.created_at DESC
	`, args...)
	if err != nil {
		return "[]", fmt.Errorf("query savings goals: %w", err)
	}
	defer rows.Close()

	var goals []map[string]interface{}
	for rows.Next() {
		var id, name, targetDate, ownerID string
		var current, target float64
		var isShared bool
		if err := rows.Scan(&id, &name, &current, &target, &targetDate, &isShared, &ownerID); err != nil {
			continue
		}

		goal := map[string]interface{}{
			"id":             id,
			"name":           name,
			"current_amount": current,
			"target_amount":  target,
			"is_shared":      isShared,
			"owner_user_id":  ownerID,
			"is_mine":        ownerID == userID,
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
	out := scopeMeta(scope, householdID)
	out["goals"] = goals
	result, _ := json.Marshal(out)
	return string(result), nil
}

func getSpendingByCategory(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	months := 3
	scopeRaw := ""
	if input != nil {
		var params struct {
			Months int    `json:"months"`
			Scope  string `json:"scope"`
		}
		if err := json.Unmarshal(input, &params); err == nil {
			if params.Months > 0 && params.Months <= 12 {
				months = params.Months
			}
			scopeRaw = params.Scope
		}
	}
	scope := ParseScope(scopeRaw, householdID)
	hasHH := householdID != ""
	where := txScopeWhere(scope, "$1", "$3", hasHH)
	args := []interface{}{userID, fmt.Sprintf("%d", months)}
	if hasHH && scope == ScopeHousehold {
		// $1=user, $2=months interval, $3=hh — but txScopeWhere uses $1 and $3
		where = txScopeWhere(scope, "$1", "$3", hasHH)
		args = []interface{}{userID, fmt.Sprintf("%d", months), householdID}
	}

	rows, err := conn.Query(`
		SELECT COALESCE(c.name, t.category_name, 'Uncategorized') as category,
		       SUM(t.amount) as total,
		       COUNT(*) as transaction_count
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE `+where+`
		  AND t.type = 'expense'
		  AND t.date >= NOW() - ($2 || ' months')::INTERVAL
		GROUP BY category
		ORDER BY total DESC
	`, args...)
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

	out := scopeMeta(scope, householdID)
	out["months"] = months
	out["categories"] = categories
	result, _ := json.Marshal(out)
	return string(result), nil
}

func getBills(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	scope := ScopeFromInput(input, householdID)
	hasHH := householdID != ""
	where := billsScopeWhere(scope, "$1", "$2", hasHH)
	args := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		args = []interface{}{userID, householdID}
	}

	rows, err := conn.Query(`
		SELECT b.id, b.name, b.amount_due, b.due_day, COALESCE(b.frequency, 'monthly'),
		       COALESCE(b.is_autopay, false), COALESCE(b.is_shared, false), b.user_id::text
		FROM bills b
		WHERE `+where+`
		ORDER BY b.due_day ASC
	`, args...)
	if err != nil {
		return "[]", fmt.Errorf("query bills: %w", err)
	}
	defer rows.Close()

	var bills []map[string]interface{}
	for rows.Next() {
		var id, name, frequency, ownerID string
		var amount float64
		var dueDay int
		var autopay, isShared bool
		if err := rows.Scan(&id, &name, &amount, &dueDay, &frequency, &autopay, &isShared, &ownerID); err != nil {
			continue
		}
		bills = append(bills, map[string]interface{}{
			"id":            id,
			"name":          name,
			"amount":        amount,
			"due_day":       dueDay,
			"frequency":     frequency,
			"autopay":       autopay,
			"is_shared":     isShared,
			"owner_user_id": ownerID,
			"is_mine":       ownerID == userID,
		})
	}

	if bills == nil {
		bills = []map[string]interface{}{}
	}
	out := scopeMeta(scope, householdID)
	out["bills"] = bills
	result, _ := json.Marshal(out)
	return string(result), nil
}
