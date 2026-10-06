package households

import (
	"github.com/aboogie/budget-backend/internal/entitlements"
)

// MaxPlan returns plus if either side is plus, else free (C038 join resolution).
func MaxPlan(a, b string) string {
	if entitlements.NormalizePlan(a) == entitlements.PlanPlus || entitlements.NormalizePlan(b) == entitlements.PlanPlus {
		return entitlements.PlanPlus
	}
	return entitlements.PlanFree
}

// GetPlan returns households.plan (defaults free).
func GetPlan(q Querier, householdID string) (string, error) {
	if householdID == "" {
		return entitlements.PlanFree, nil
	}
	var plan string
	err := q.QueryRow(`SELECT COALESCE(plan, 'free') FROM households WHERE id = $1`, householdID).Scan(&plan)
	if err != nil {
		return entitlements.PlanFree, err
	}
	return entitlements.NormalizePlan(plan), nil
}

// SetPlan updates households.plan inside the current querier/transaction.
func SetPlan(q Querier, householdID, plan string) error {
	plan = entitlements.NormalizePlan(plan)
	_, err := q.Exec(`UPDATE households SET plan = $1, plan_updated_at = NOW() WHERE id = $2`, plan, householdID)
	return err
}
