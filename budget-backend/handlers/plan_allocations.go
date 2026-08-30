package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"sort"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/gorilla/mux"
)

// suggestedAlloc is one auto-suggested allocation line, in priority order.
type suggestedAlloc struct {
	TargetID      string
	TargetType    string
	MonthlyAmount float64
	PriorityOrder int
}

// monthsUntil returns whole months from now until a YYYY-MM-DD date (min 1).
// Returns 0 when the date is empty/unparseable (caller treats as "no date").
func monthsUntil(date string) int {
	if len(date) < 10 {
		return 0
	}
	d, err := time.Parse("2006-01-02", date[:10])
	if err != nil {
		return 0
	}
	now := time.Now().UTC()
	months := int(d.Year()-now.Year())*12 + int(d.Month()) - int(now.Month())
	if months < 1 {
		return 1
	}
	return months
}

// suggestAllocations distributes a monthly pot across the given targets in the
// couple's PRIORITY order (the single ordering from ListFinancialPriorities):
//  1. Dated savings goals first receive the monthly amount needed to hit their
//     target by their target date.
//  2. Any remaining pot cascades down the priority order to the next unfunded
//     target (debt payoff / dateless savings), capped by what that target needs.
//
// Callers may override any line afterwards; the sum is guaranteed <= pot.
func suggestAllocations(conn *sql.DB, userID string, pot float64, targetIDs []string) []suggestedAlloc {
	type target struct {
		id, typ string
		rank    int
		curr    float64
		tgt     float64
		date    string
		balance float64
	}
	var targets []target
	for _, id := range targetIDs {
		typ := resolveTargetType(conn, userID, id)
		if typ == "" {
			continue
		}
		t := target{id: id, typ: typ}
		if typ == "savings_goal" {
			_ = conn.QueryRow(`SELECT COALESCE(current_amount,0), COALESCE(target_amount,0), COALESCE(target_date,'')
				FROM savings_goals WHERE id = $1`, id).Scan(&t.curr, &t.tgt, &t.date)
		} else {
			_ = conn.QueryRow(`SELECT COALESCE(balance,0) FROM debt_accounts WHERE id = $1`, id).Scan(&t.balance)
		}
		_ = conn.QueryRow(`SELECT COALESCE(MIN(rank),0) FROM financial_priorities
			WHERE target_id = $1 AND target_type = $2`, id, typ).Scan(&t.rank)
		targets = append(targets, t)
	}

	// Priority order: ranked ascending, unranked (0) last, original order as tiebreak.
	sort.SliceStable(targets, func(i, j int) bool {
		ri, rj := targets[i].rank, targets[j].rank
		if (ri == 0) != (rj == 0) {
			return rj == 0
		}
		return ri < rj
	})

	remaining := pot
	amount := map[string]float64{}

	// Pass 1 — dated savings get their required monthly.
	for _, t := range targets {
		if remaining <= 0 {
			break
		}
		if t.typ == "savings_goal" && t.date != "" {
			need := t.tgt - t.curr
			months := monthsUntil(t.date)
			if need > 0 && months > 0 {
				monthly := math.Ceil(need/float64(months)*100) / 100
				if monthly > remaining {
					monthly = remaining
				}
				amount[t.id] = monthly
				remaining = round2(remaining - monthly)
			}
		}
	}

	// Pass 2 — remainder cascades down priority order to the next unfunded target.
	for _, t := range targets {
		if remaining <= 0 {
			break
		}
		if _, done := amount[t.id]; done {
			continue
		}
		var need float64
		if t.typ == "debt" {
			need = t.balance
		} else {
			need = t.tgt - t.curr
		}
		if need <= 0 {
			continue
		}
		give := remaining
		if give > need {
			give = need
		}
		amount[t.id] = round2(give)
		remaining = round2(remaining - give)
	}

	out := make([]suggestedAlloc, 0, len(targets))
	for i, t := range targets {
		out = append(out, suggestedAlloc{
			TargetID:      t.id,
			TargetType:    t.typ,
			MonthlyAmount: amount[t.id],
			PriorityOrder: i + 1,
		})
	}
	return out
}

// userCanEditPlan reports whether the user owns the plan or shares its household.
func userCanEditPlan(conn *sql.DB, userID, planID string) bool {
	var ownerID, planHH string
	err := conn.QueryRow(`SELECT created_by::text, COALESCE(household_id::text,'') FROM financial_plans WHERE id = $1`, planID).Scan(&ownerID, &planHH)
	if err != nil {
		return false
	}
	if ownerID == userID {
		return true
	}
	if planHH != "" && db.ResolveHouseholdID(conn, userID) == planHH {
		return true
	}
	return false
}

// UpdateAllocation sets one allocation's monthly_amount (a manual override),
// enforcing that the plan's allocations still sum to <= its monthly_contribution.
// PATCH /plans/{id}/allocations/{allocId}
func UpdateAllocation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	planID := mux.Vars(r)["id"]
	allocID := mux.Vars(r)["allocId"]
	if planID == "" || allocID == "" {
		http.Error(w, "Missing plan or allocation id", http.StatusBadRequest)
		return
	}
	var body struct {
		MonthlyAmount float64 `json:"monthly_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if body.MonthlyAmount < 0 {
		http.Error(w, "monthly_amount must be >= 0", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	if !userCanEditPlan(conn.Raw(), userID, planID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Sum-check: other allocations + the new amount must not exceed the pot.
	var pot, otherSum float64
	_ = conn.QueryRow(`SELECT COALESCE(monthly_contribution,0) FROM financial_plans WHERE id = $1`, planID).Scan(&pot)
	_ = conn.QueryRow(`SELECT COALESCE(SUM(monthly_amount),0) FROM plan_allocations WHERE plan_id = $1 AND id != $2`, planID, allocID).Scan(&otherSum)
	if round2(otherSum+body.MonthlyAmount) > round2(pot)+0.01 {
		http.Error(w, "That would push allocations above the plan's monthly amount", http.StatusBadRequest)
		return
	}

	res, err := conn.Exec(`UPDATE plan_allocations SET monthly_amount = $1 WHERE id = $2 AND plan_id = $3`, body.MonthlyAmount, allocID, planID)
	if err != nil {
		log.Printf("UpdateAllocation error: %v", err)
		http.Error(w, "Update failed", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "Allocation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": allocID, "monthly_amount": body.MonthlyAmount})
}

// DeleteAllocation removes one allocation from a plan.
// DELETE /plans/{id}/allocations/{allocId}
func DeleteAllocation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	planID := mux.Vars(r)["id"]
	allocID := mux.Vars(r)["allocId"]
	if planID == "" || allocID == "" {
		http.Error(w, "Missing plan or allocation id", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	if !userCanEditPlan(conn.Raw(), userID, planID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	res, err := conn.Exec(`DELETE FROM plan_allocations WHERE id = $1 AND plan_id = $2`, allocID, planID)
	if err != nil {
		http.Error(w, "Delete failed", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "Allocation not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// effectiveMonthlyByTarget returns, for a scope (household or solo user), the
// total monthly amount allocated to each target SUMMED ACROSS ALL ACTIVE PLANS.
// This is the single source of truth for "how much per month toward target X".
// Keyed by target_id. Orphaned allocations (target no longer exists) are skipped.
func effectiveMonthlyByTarget(conn *sql.DB, userID string) map[string]float64 {
	out := map[string]float64{}
	_, hh := scopeKeyFor(conn, userID)
	var planFilter string
	var arg interface{}
	if hh != "" {
		planFilter = "p.household_id::text = $1"
		arg = hh
	} else {
		planFilter = "p.created_by = $1"
		arg = userID
	}
	rows, err := conn.Query(`
		SELECT a.target_id::text, COALESCE(SUM(a.monthly_amount),0)
		FROM plan_allocations a
		JOIN financial_plans p ON p.id = a.plan_id
		WHERE p.status = 'active' AND `+planFilter+`
		  AND (
		    (a.target_type = 'savings_goal' AND EXISTS (SELECT 1 FROM savings_goals g WHERE g.id = a.target_id))
		    OR (a.target_type = 'debt' AND EXISTS (SELECT 1 FROM debt_accounts d WHERE d.id = a.target_id))
		  )
		GROUP BY a.target_id
	`, arg)
	if err != nil {
		log.Printf("effectiveMonthlyByTarget error: %v", err)
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var sum float64
		if rows.Scan(&id, &sum) == nil {
			out[id] = sum
		}
	}
	return out
}
