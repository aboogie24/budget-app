package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"
)

// assessSavingsGoalTool lets the advisor check whether a savings goal is
// realistic (required monthly vs. free cash flow), mirroring the app's guided
// flow, so the chat can walk a couple through creating a goal + plan. It returns
// the deterministic numbers; the advisor narrates the realistic pointers itself.
func assessSavingsGoalTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var p struct {
		Name          string  `json:"name"`
		TargetAmount  float64 `json:"target_amount"`
		CurrentAmount float64 `json:"current_amount"`
		TargetDate    string  `json:"target_date"`
	}
	_ = json.Unmarshal(input, &p)
	if p.TargetDate == "" || p.TargetAmount <= 0 {
		return `{"error":"target_amount and target_date (YYYY-MM-DD) are required"}`, nil
	}

	months := monthsUntilFeas(p.TargetDate)
	need := p.TargetAmount - p.CurrentAmount
	if need < 0 {
		need = 0
	}
	required := 0.0
	if months > 0 {
		required = math.Ceil(need/float64(months)*100) / 100
	}

	surplus := round2Feas(scopeSurplus(conn, userID, householdID))
	committed := round2Feas(scopeCommitted(conn, userID, householdID))
	available := round2Feas(surplus - committed)
	feasible := need == 0 || (required > 0 && required <= available)

	out := map[string]interface{}{
		"months":            months,
		"required_monthly":  required,
		"surplus_monthly":   surplus,
		"committed_monthly": committed,
		"available_monthly": available,
		"feasible":          feasible,
	}
	if !feasible && need > 0 {
		if available > 0 {
			mn := int(math.Ceil(need / available))
			if mn < 1 {
				mn = 1
			}
			out["realistic_date"] = time.Now().UTC().AddDate(0, mn, 0).Format("2006-01-02")
			out["lower_target"] = round2Feas(p.CurrentAmount + available*float64(months))
		}
		fu := round2Feas(required - available)
		if fu < 0 {
			fu = 0
		}
		out["free_up_monthly"] = fu
	}

	b, _ := json.Marshal(out)
	return string(b), nil
}

// scopeSurplus = income - expenses this month for the household (or user if solo).
func scopeSurplus(conn *sql.DB, userID, householdID string) float64 {
	col, val := "user_id", userID
	if householdID != "" {
		col, val = "household_id", householdID
	}
	var inc, exp float64
	_ = conn.QueryRow(fmt.Sprintf(`
		SELECT
			COALESCE((SELECT SUM(amount) FROM transactions WHERE %s = $1 AND type = 'income'  AND date >= date_trunc('month', CURRENT_DATE)), 0),
			COALESCE((SELECT SUM(amount) FROM transactions WHERE %s = $1 AND type = 'expense' AND date >= date_trunc('month', CURRENT_DATE)), 0)
	`, col, col), val).Scan(&inc, &exp)
	return inc - exp
}

// scopeCommitted = total monthly already allocated by active plans in scope.
func scopeCommitted(conn *sql.DB, userID, householdID string) float64 {
	var filter string
	var val interface{}
	if householdID != "" {
		filter, val = "p.household_id::text = $1", householdID
	} else {
		filter, val = "p.created_by = $1", userID
	}
	var sum float64
	_ = conn.QueryRow(`
		SELECT COALESCE(SUM(a.monthly_amount), 0)
		FROM plan_allocations a
		JOIN financial_plans p ON p.id = a.plan_id
		WHERE p.status = 'active' AND `+filter, val).Scan(&sum)
	return sum
}

func monthsUntilFeas(date string) int {
	if len(date) < 10 {
		return 0
	}
	d, err := time.Parse("2006-01-02", date[:10])
	if err != nil {
		return 0
	}
	now := time.Now().UTC()
	m := int(d.Year()-now.Year())*12 + int(d.Month()) - int(now.Month())
	if m < 1 {
		return 1
	}
	return m
}

func round2Feas(v float64) float64 { return math.Round(v*100) / 100 }
