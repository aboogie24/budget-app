package ai

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"

	"github.com/aboogie/budget-backend/internal/recurrence"
)

func getFinancialSnapshot(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	scope := ScopeFromInput(input, householdID)
	hasHH := householdID != ""
	snapshot := scopeMeta(scope, householdID)

	now := time.Now().UTC()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	// Budgeted income — same occurrence math as the budget tab / dashboard.
	var budgetedIncome float64
	budgetWhere := budgetScopeWhere(scope, "$1", "$2", hasHH)
	budgetArgs := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		budgetArgs = []interface{}{userID, householdID}
	}
	budgetSQL := `
		SELECT amount, COALESCE(frequency, ''), start_date
		FROM budgets b WHERE ` + budgetWhere
	if budgetRows, err := conn.Query(budgetSQL, budgetArgs...); err != nil {
		log.Printf("snapshot budgeted income query error: %v", err)
	} else {
		for budgetRows.Next() {
			var amount float64
			var freq string
			var start sql.NullTime
			if budgetRows.Scan(&amount, &freq, &start) == nil {
				var startPtr *time.Time
				if start.Valid {
					startPtr = &start.Time
				}
				budgetedIncome += amount * float64(recurrence.OccurrencesInMonth(startPtr, freq, monthStart, monthEnd))
			}
		}
		budgetRows.Close()
	}
	snapshot["budgeted_monthly_income"] = budgetedIncome

	// Actuals — calendar month, sharing-gated like GetTransactions / dashboard.
	txWhere := txScopeWhere(scope, "$1", "$2", hasHH)
	txArgs := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		txArgs = []interface{}{userID, householdID}
	}
	var actualIncome, actualExpenses sql.NullFloat64
	err := conn.QueryRow(`
		SELECT
			COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
			COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
		FROM transactions t
		WHERE `+txWhere+`
		  AND date >= date_trunc('month', CURRENT_DATE)
	`, txArgs...).Scan(&actualIncome, &actualExpenses)
	if err != nil {
		log.Printf("snapshot actuals query error: %v", err)
	}
	snapshot["income_received_this_month"] = actualIncome.Float64
	snapshot["expenses_this_month"] = actualExpenses.Float64
	snapshot["cash_flow_this_month"] = actualIncome.Float64 - actualExpenses.Float64
	snapshot["numbers_note"] = "income_received/expenses/cash_flow are ACTUAL calendar-month transactions (internal transfers excluded). budgeted_monthly_income is the PLAN — never compare it against actual expenses as if it were money received."

	// Total debt
	debtWhere := debtScopeWhere(scope, "$1", "$2", hasHH)
	debtArgs := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		debtArgs = []interface{}{userID, householdID}
	}
	var totalDebt sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(balance), 0)
		FROM debt_accounts d
		WHERE `+debtWhere, debtArgs...).Scan(&totalDebt)
	if err != nil {
		log.Printf("snapshot debt query error: %v", err)
	}
	snapshot["total_debt"] = totalDebt.Float64

	// Total savings
	savWhere := savingsScopeWhere(scope, "$1", "$2", hasHH)
	savArgs := []interface{}{userID}
	if hasHH && scope == ScopeHousehold {
		savArgs = []interface{}{userID, householdID}
	}
	var totalSavings sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(current_amount), 0)
		FROM savings_goals g
		WHERE `+savWhere, savArgs...).Scan(&totalSavings)
	if err != nil {
		log.Printf("snapshot savings query error: %v", err)
	}
	snapshot["total_savings"] = totalSavings.Float64

	// Account balances — personal bank links stay personal; household scope
	// still sums the caller's balances (partners don't share raw bank links).
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

	// Active budgets (scoped)
	var budgetCount int
	_ = conn.QueryRow(`SELECT COUNT(*) FROM budgets b WHERE `+budgetWhere, budgetArgs...).Scan(&budgetCount)
	snapshot["active_budgets"] = budgetCount

	// Linked accounts (caller's) — drives empty-state setup policy.
	var linkedAccounts int
	_ = conn.QueryRow(`SELECT COUNT(*) FROM linked_accounts WHERE user_id = $1`, userID).Scan(&linkedAccounts)
	snapshot["linked_accounts"] = linkedAccounts

	// When household scope, also surface personal cash-flow so the advisor can
	// answer Me vs Household the way the dashboard toggle does.
	if hasHH && scope == ScopeHousehold {
		var meIncome, meExpenses sql.NullFloat64
		_ = conn.QueryRow(`
			SELECT
				COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
				COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
			FROM transactions
			WHERE user_id = $1
			  AND date >= date_trunc('month', CURRENT_DATE)
		`, userID).Scan(&meIncome, &meExpenses)
		snapshot["me"] = map[string]interface{}{
			"income_received_this_month": meIncome.Float64,
			"expenses_this_month":        meExpenses.Float64,
			"cash_flow_this_month":       meIncome.Float64 - meExpenses.Float64,
		}
	}

	if budgetCount == 0 && linkedAccounts == 0 {
		snapshot["setup_priority"] = true
		snapshot["setup_guidance"] = "No active budgets and no linked bank accounts. Prioritize setup before ambitious plans: offer create_budget for a few starter expense/income lines, and point them to Link Account in the app. Do NOT lead with vacation/debt-payoff multi-milestone plans until they have a budget or synced transactions."
	}

	result, _ := json.Marshal(snapshot)
	return string(result), nil
}
