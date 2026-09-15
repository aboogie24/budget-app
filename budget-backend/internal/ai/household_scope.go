package ai

import (
	"encoding/json"
	"strings"
)

// ScopeMe and ScopeHousehold mirror the dashboard Me vs Household toggle.
const (
	ScopeMe        = "me"
	ScopeHousehold = "household"
)

// ParseScope resolves the tool "scope" input. Couples default to household
// (matching the dashboard); solo users always get me. Invalid values fall back
// to the same default.
func ParseScope(raw string, householdID string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if householdID == "" {
		return ScopeMe
	}
	switch s {
	case ScopeMe, "personal", "mine":
		return ScopeMe
	case ScopeHousehold, "couple", "shared", "we", "":
		return ScopeHousehold
	default:
		return ScopeHousehold
	}
}

// ScopeFromInput extracts an optional "scope" field from a tool's JSON input.
func ScopeFromInput(input json.RawMessage, householdID string) string {
	raw := ""
	if len(input) > 0 {
		var params struct {
			Scope string `json:"scope"`
		}
		if err := json.Unmarshal(input, &params); err == nil {
			raw = params.Scope
		}
	}
	return ParseScope(raw, householdID)
}

// partnerShareSubquery returns a SQL fragment selecting partner user_ids in the
// household who opted into sharing the given preference column
// (share_transactions, share_budgets, share_debts, share_savings). Defaults to
// true when no sharing_preferences row exists — same gate as
// handlers/transactions.go and handlers/budgets.go.
func partnerShareSubquery(prefColumn string, hhPlaceholder, userPlaceholder string) string {
	return "(SELECT hm.user_id FROM household_members hm" +
		" LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id" +
		" AND (sp.household_id::text = " + hhPlaceholder + " OR sp.household_id IS NULL)" +
		" WHERE hm.household_id::text = " + hhPlaceholder +
		" AND hm.user_id != " + userPlaceholder +
		" AND COALESCE(sp." + prefColumn + ", true) = true)"
}

// txScopeWhere is the transaction visibility predicate used by GetTransactions /
// GetBudgetSummary. Solo: caller's rows. Household: caller's rows OR any row
// tagged with the household OR partner rows they opted to share.
func txScopeWhere(scope, userPlaceholder, hhPlaceholder string, hasHousehold bool) string {
	if !hasHousehold || scope == ScopeMe {
		return "t.user_id = " + userPlaceholder
	}
	return "(t.user_id = " + userPlaceholder +
		" OR t.household_id::text = " + hhPlaceholder +
		" OR (t.household_id IS NOT NULL AND t.user_id IN " +
		partnerShareSubquery("share_transactions", hhPlaceholder, userPlaceholder) + "))"
}

// budgetScopeWhere mirrors GetBudgetsByUser: own budgets, plus partner budgets
// that are is_shared and the partner opted into share_budgets.
func budgetScopeWhere(scope, userPlaceholder, hhPlaceholder string, hasHousehold bool) string {
	if !hasHousehold || scope == ScopeMe {
		return "b.user_id = " + userPlaceholder
	}
	return "(b.user_id = " + userPlaceholder +
		" OR (b.is_shared = true AND b.user_id IN " +
		partnerShareSubquery("share_budgets", hhPlaceholder, userPlaceholder) + "))"
}

// debtScopeWhere: own debts, plus partner debts that are is_shared and the
// partner opted into share_debts. Also includes rows tagged with household_id
// so totals align with /auth/households/summary.
func debtScopeWhere(scope, userPlaceholder, hhPlaceholder string, hasHousehold bool) string {
	if !hasHousehold || scope == ScopeMe {
		return "d.user_id = " + userPlaceholder
	}
	return "(d.user_id = " + userPlaceholder +
		" OR d.household_id::text = " + hhPlaceholder +
		" OR (d.is_shared = true AND d.user_id IN " +
		partnerShareSubquery("share_debts", hhPlaceholder, userPlaceholder) + "))"
}

// savingsScopeWhere: own goals, household-tagged goals, or partner shared goals
// gated by share_savings.
func savingsScopeWhere(scope, userPlaceholder, hhPlaceholder string, hasHousehold bool) string {
	if !hasHousehold || scope == ScopeMe {
		return "g.user_id = " + userPlaceholder
	}
	return "(g.user_id = " + userPlaceholder +
		" OR g.household_id::text = " + hhPlaceholder +
		" OR (g.is_shared = true AND g.user_id IN " +
		partnerShareSubquery("share_savings", hhPlaceholder, userPlaceholder) + "))"
}

// billsScopeWhere mirrors ListBills (share_budgets gate + is_shared).
func billsScopeWhere(scope, userPlaceholder, hhPlaceholder string, hasHousehold bool) string {
	if !hasHousehold || scope == ScopeMe {
		return "b.user_id = " + userPlaceholder
	}
	return "(b.user_id = " + userPlaceholder +
		" OR (b.is_shared = true AND b.user_id IN " +
		partnerShareSubquery("share_budgets", hhPlaceholder, userPlaceholder) + "))"
}

// scopeMeta adds Me-vs-Household labeling to a tool result map.
func scopeMeta(scope, householdID string) map[string]interface{} {
	meta := map[string]interface{}{
		"scope": scope,
	}
	if householdID != "" {
		meta["household_id"] = householdID
		meta["scope_note"] = "scope=household includes your data plus partner-shared data gated by sharing preferences (same gate as the dashboard Me/Household toggle). scope=me is only yours."
	} else {
		meta["scope_note"] = "Solo user — personal scope only."
	}
	return meta
}
