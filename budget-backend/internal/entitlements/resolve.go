package entitlements

import (
	"database/sql"
	"fmt"
)

// GetHouseholdPlan returns the plan column for a household (defaults free).
func GetHouseholdPlan(conn *sql.DB, householdID string) (string, error) {
	if conn == nil || householdID == "" {
		return PlanFree, nil
	}
	var plan sql.NullString
	err := conn.QueryRow(`SELECT COALESCE(plan, 'free') FROM households WHERE id = $1`, householdID).Scan(&plan)
	if err == sql.ErrNoRows {
		return PlanFree, nil
	}
	if err != nil {
		return PlanFree, err
	}
	if !plan.Valid || plan.String == "" {
		return PlanFree, nil
	}
	return NormalizePlan(plan.String), nil
}

// SetHouseholdPlan updates households.plan (dev/admin; no billing).
func SetHouseholdPlan(conn *sql.DB, householdID, plan string) error {
	if conn == nil || householdID == "" {
		return fmt.Errorf("missing household")
	}
	plan = NormalizePlan(plan)
	if !IsValidPlan(plan) {
		return fmt.Errorf("invalid plan")
	}
	res, err := conn.Exec(`
		UPDATE households SET plan = $1, plan_updated_at = NOW() WHERE id = $2
	`, plan, householdID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CountHouseholdLinkedAccounts counts linked bank rows for the household
// (household_id match OR owned by any household member — legacy rows often omit household_id).
func CountHouseholdLinkedAccounts(conn *sql.DB, householdID string) (int, error) {
	if conn == nil || householdID == "" {
		return 0, nil
	}
	var n int
	err := conn.QueryRow(`
		SELECT COUNT(*) FROM linked_accounts la
		WHERE la.household_id = $1
		   OR la.user_id IN (SELECT user_id FROM household_members WHERE household_id = $1)
	`, householdID).Scan(&n)
	return n, err
}

// CountHouseholdAIUserMessages counts user-role AI chat messages for the household
// in a rolling window of windowDays (Free=7, Plus=30).
func CountHouseholdAIUserMessages(conn *sql.DB, householdID string, windowDays int) (int, error) {
	if conn == nil || householdID == "" {
		return 0, nil
	}
	if windowDays <= 0 {
		windowDays = FreeAIWindowDays
	}
	var n int
	err := conn.QueryRow(`
		SELECT COUNT(*) FROM ai_messages m
		JOIN ai_conversations c ON c.id = m.conversation_id
		WHERE m.role = 'user'
		  AND m.created_at > NOW() - make_interval(days => $2)
		  AND (
		    c.household_id = $1
		    OR c.user_id IN (SELECT user_id FROM household_members WHERE household_id = $1)
		  )
	`, householdID, windowDays).Scan(&n)
	return n, err
}

// ResolveForHousehold loads plan + usage and builds the entitlements payload.
func ResolveForHousehold(conn *sql.DB, householdID string) (Entitlements, error) {
	if householdID == "" {
		return Build(PlanFree, "", 0, 0), nil
	}
	plan, err := GetHouseholdPlan(conn, householdID)
	if err != nil {
		return Entitlements{}, err
	}
	banks, err := CountHouseholdLinkedAccounts(conn, householdID)
	if err != nil {
		return Entitlements{}, err
	}
	window := FreeAIWindowDays
	if plan == PlanPlus {
		window = PlusAIWindowDays
	}
	aiUsed, err := CountHouseholdAIUserMessages(conn, householdID, window)
	if err != nil {
		return Entitlements{}, err
	}
	return Build(plan, householdID, banks, aiUsed), nil
}

// ResolveForUser resolves via the user's household membership (empty household → Free defaults).
func ResolveForUser(conn *sql.DB, userID string) (Entitlements, error) {
	if conn == nil || userID == "" {
		return Build(PlanFree, "", 0, 0), nil
	}
	var householdID string
	err := conn.QueryRow(`SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1`, userID).Scan(&householdID)
	if err == sql.ErrNoRows {
		return Build(PlanFree, "", 0, 0), nil
	}
	if err != nil {
		return Entitlements{}, err
	}
	return ResolveForHousehold(conn, householdID)
}
