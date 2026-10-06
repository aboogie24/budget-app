package households

import (
	"database/sql"

	"github.com/lib/pq"
)

// DataBlockers counts real-data rows that make a solo non-empty.
type DataBlockers struct {
	LinkedAccounts      int `json:"linked_accounts"`
	Transactions        int `json:"transactions"`
	NonStarterBudgets   int `json:"non_starter_budgets"`
	Debts               int `json:"debts"`
	SavingsGoals        int `json:"savings_goals"`
	Bills               int `json:"bills"`
	Properties          int `json:"properties"`
	Categories          int `json:"categories"`
	FinancialPriorities int `json:"financial_priorities"`
	Trips               int `json:"trips"`
	FinancialPlans      int `json:"financial_plans"`
}

// Total returns the sum of blocker counts (starters excluded).
func (b DataBlockers) Total() int {
	return b.LinkedAccounts + b.Transactions + b.NonStarterBudgets +
		b.Debts + b.SavingsGoals + b.Bills + b.Properties +
		b.Categories + b.FinancialPriorities + b.Trips + b.FinancialPlans
}

// IsEmpty is true when there is no real user data (starter budgets alone OK).
func (b DataBlockers) IsEmpty() bool {
	return b.Total() == 0
}

// MembershipInfo describes the accepting user's current household membership.
type MembershipInfo struct {
	HouseholdID string
	Role        string
	MemberCount int
	IsSolo      bool // sole member and that member is the accepting user
}

// LookupMembership returns the user's household membership.
// When forUpdate is true, locks the membership row (SELECT … FOR UPDATE).
func LookupMembership(q Querier, userID string, forUpdate bool) (MembershipInfo, error) {
	var info MembershipInfo
	query := `SELECT household_id, COALESCE(role, '') FROM household_members WHERE user_id = $1 LIMIT 1`
	if forUpdate {
		query += ` FOR UPDATE`
	}
	err := q.QueryRow(query, userID).Scan(&info.HouseholdID, &info.Role)
	if err == sql.ErrNoRows {
		return info, nil
	}
	if err != nil {
		return info, err
	}
	if err := q.QueryRow(`
		SELECT COUNT(*) FROM household_members WHERE household_id = $1
	`, info.HouseholdID).Scan(&info.MemberCount); err != nil {
		return info, err
	}
	info.IsSolo = info.MemberCount == 1
	return info, nil
}

// ClassifySoloEmptiness counts real-data for user U scoped to solo household.
func ClassifySoloEmptiness(q Querier, userID, soloID string) (DataBlockers, error) {
	var b DataBlockers
	starters := StarterBudgetNameList()

	type countQuery struct {
		dest *int
		sql  string
		args []any
	}
	queries := []countQuery{
		{&b.Transactions, `
			SELECT COUNT(*) FROM transactions
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.LinkedAccounts, `
			SELECT COUNT(*) FROM linked_accounts
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.NonStarterBudgets, `
			SELECT COUNT(*) FROM budgets
			WHERE user_id = $1
			  AND NOT (
			    category_id IS NULL
			    AND LOWER(TRIM(name)) = ANY($2)
			  )`, []any{userID, pq.Array(starters)}},
		{&b.Debts, `
			SELECT COUNT(*) FROM debt_accounts
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.SavingsGoals, `
			SELECT COUNT(*) FROM savings_goals
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.Bills, `
			SELECT COUNT(*) FROM bills
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.Properties, `
			SELECT COUNT(*) FROM properties
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		// Custom household-scoped rows that would otherwise block DELETE or be silently lost.
		{&b.Categories, `
			SELECT COUNT(*) FROM categories
			WHERE household_id = $1 OR (user_id = $2 AND household_id IS NOT NULL)`, []any{soloID, userID}},
		{&b.FinancialPriorities, `
			SELECT COUNT(*) FROM financial_priorities
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.Trips, `
			SELECT COUNT(*) FROM trips
			WHERE user_id = $1 OR household_id = $2`, []any{userID, soloID}},
		{&b.FinancialPlans, `
			SELECT COUNT(*) FROM financial_plans
			WHERE household_id = $1 OR created_by = $2`, []any{soloID, userID}},
	}
	for _, cq := range queries {
		if err := q.QueryRow(cq.sql, cq.args...).Scan(cq.dest); err != nil {
			return b, err
		}
	}
	return b, nil
}

// CountHouseholdLinkedAccounts mirrors entitlements helper for use with Querier/Tx.
func CountHouseholdLinkedAccounts(q Querier, householdID string) (int, error) {
	if householdID == "" {
		return 0, nil
	}
	var n int
	err := q.QueryRow(`
		SELECT COUNT(*) FROM linked_accounts la
		WHERE la.household_id = $1
		   OR la.user_id IN (SELECT user_id FROM household_members WHERE household_id = $1)
	`, householdID).Scan(&n)
	return n, err
}

// BanksLimitConflict is true when Free+Free merge would exceed FreeBanksLimit.
func BanksLimitConflict(soloBanks, targetBanks int, planAfterJoin string) bool {
	if planAfterJoin != "free" {
		return false
	}
	if soloBanks < 1 {
		return false
	}
	return targetBanks+soloBanks > 1 // entitlements.FreeBanksLimit
}
