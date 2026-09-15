package ai

import (
	"database/sql"
	"fmt"
)

// LoadFinancialContext fills ContextData cash-flow fields using the same
// Me vs Household sharing-preferences gates as the dashboard and read tools.
// linked_accounts / account_balances stay personal (per-user). Private memory
// is intentionally not loaded here — callers keep using LoadAdvisorMemories.
func LoadFinancialContext(dbConn *sql.DB, userID, householdID string, ctx *ContextData) error {
	if ctx == nil {
		return fmt.Errorf("nil context")
	}
	scope := ParseScope("", householdID)
	ctx.Scope = scope
	hasHH := householdID != "" && scope == ScopeHousehold

	txWhere := txScopeWhere(scope, "$1", "$2", hasHH)
	budgetWhere := budgetScopeWhere(scope, "$1", "$2", hasHH)
	debtWhere := debtScopeWhere(scope, "$1", "$2", hasHH)
	savWhere := savingsScopeWhere(scope, "$1", "$2", hasHH)

	ctxArgs := []interface{}{userID}
	if hasHH {
		ctxArgs = []interface{}{userID, householdID}
	}

	monthStart, monthEnd := currentMonthBoundsUTC()
	ctx.BudgetedIncome = sumBudgetedMonthlyIncome(dbConn, budgetWhere, ctxArgs, monthStart, monthEnd)

	// Actuals: type IN (income, expense) excludes internal transfers (type=transfer).
	q := "SELECT " +
		"COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE (" + txWhere + ") " +
		"AND t.type = 'income' AND t.date >= date_trunc('month', CURRENT_DATE)), 0), " +
		"COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE (" + txWhere + ") " +
		"AND t.type = 'expense' AND t.date >= date_trunc('month', CURRENT_DATE)), 0), " +
		"COALESCE((SELECT SUM(d.balance) FROM debt_accounts d WHERE " + debtWhere + "), 0), " +
		"(SELECT COUNT(*) FROM debt_accounts d WHERE " + debtWhere + "), " +
		"COALESCE((SELECT SUM(g.current_amount) FROM savings_goals g WHERE " + savWhere + "), 0), " +
		"(SELECT COUNT(*) FROM savings_goals g WHERE " + savWhere + "), " +
		"COALESCE((SELECT SUM(current_balance) FROM account_balances WHERE user_id = $1), 0), " +
		"(SELECT COUNT(*) FROM budgets b WHERE " + budgetWhere + "), " +
		"(SELECT COUNT(*) FROM linked_accounts WHERE user_id = $1)"

	err := dbConn.QueryRow(q, ctxArgs...).Scan(
		&ctx.ActualIncome,
		&ctx.MonthlyExpenses,
		&ctx.TotalDebt,
		&ctx.DebtCount,
		&ctx.TotalSavings,
		&ctx.SavingsCount,
		&ctx.BankBalance,
		&ctx.BudgetCount,
		&ctx.LinkedAccounts,
	)
	if err != nil {
		return err
	}

	if hasHH {
		_ = dbConn.QueryRow(
			"SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0), "+
				"COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) "+
				"FROM transactions WHERE user_id = $1 AND type IN ('income','expense') "+
				"AND date >= date_trunc('month', CURRENT_DATE)",
			userID,
		).Scan(&ctx.MeActualIncome, &ctx.MeExpenses)
	}
	return nil
}
