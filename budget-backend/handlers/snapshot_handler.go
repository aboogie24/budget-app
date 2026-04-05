package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// ─── Create Snapshot ─────────────────────────────────────────

func CreateSnapshot(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	planID := mux.Vars(r)["id"]
	if planID == "" {
		http.Error(w, "Missing plan ID", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	if !userCanAccessPlan(conn, userID, planID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	// Gather financial state
	var totalDebt float64
	dq := `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1`
	dArgs := []interface{}{userID}
	if householdID != "" {
		dq = `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1 OR household_id = $2`
		dArgs = append(dArgs, householdID)
	}
	_ = conn.QueryRow(dq, dArgs...).Scan(&totalDebt)

	var totalSavings float64
	sq := `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1`
	sArgs := []interface{}{userID}
	if householdID != "" {
		sq = `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1 OR household_id = $2`
		sArgs = append(sArgs, householdID)
	}
	_ = conn.QueryRow(sq, sArgs...).Scan(&totalSavings)

	var totalBalance float64
	_ = conn.QueryRow(`SELECT COALESCE(SUM(current_balance), 0) FROM account_balances WHERE user_id = $1`, userID).Scan(&totalBalance)

	var monthlyIncome float64
	_ = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = $1 AND type = 'income' AND date >= CURRENT_DATE - INTERVAL '30 days'
	`, userID).Scan(&monthlyIncome)

	var monthlyExpenses float64
	_ = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = $1 AND type = 'expense' AND date >= CURRENT_DATE - INTERVAL '30 days'
	`, userID).Scan(&monthlyExpenses)

	financialState := map[string]interface{}{
		"total_debt":       totalDebt,
		"total_savings":    totalSavings,
		"total_balance":    totalBalance,
		"monthly_income":   monthlyIncome,
		"monthly_expenses": monthlyExpenses,
		"net_worth":        totalSavings + totalBalance - totalDebt,
	}

	// Gather progress metrics
	var milestonesTotal, milestonesReached int
	_ = conn.QueryRow(`SELECT COUNT(*) FROM plan_milestones WHERE plan_id = $1`, planID).Scan(&milestonesTotal)
	_ = conn.QueryRow(`SELECT COUNT(*) FROM plan_milestones WHERE plan_id = $1 AND status = 'reached'`, planID).Scan(&milestonesReached)

	var allocationsTotal int
	var allocationsSum float64
	_ = conn.QueryRow(`SELECT COUNT(*), COALESCE(SUM(monthly_amount), 0) FROM plan_allocations WHERE plan_id = $1`, planID).Scan(&allocationsTotal, &allocationsSum)

	milestonePct := 0.0
	if milestonesTotal > 0 {
		milestonePct = float64(milestonesReached) / float64(milestonesTotal) * 100
	}

	progressMetrics := map[string]interface{}{
		"milestones_total":   milestonesTotal,
		"milestones_reached": milestonesReached,
		"milestone_pct":      milestonePct,
		"allocations_total":  allocationsTotal,
		"allocations_sum":    allocationsSum,
	}

	financialStateJSON, _ := json.Marshal(financialState)
	progressMetricsJSON, _ := json.Marshal(progressMetrics)

	// Upsert: one snapshot per plan per day
	var snap models.PlanSnapshot
	var financialStateStr, progressMetricsStr string
	err = conn.QueryRow(`
		INSERT INTO plan_snapshots (plan_id, financial_state, progress_metrics)
		VALUES ($1, $2::jsonb, $3::jsonb)
		ON CONFLICT (plan_id, snapshot_date)
		DO UPDATE SET financial_state = EXCLUDED.financial_state,
		             progress_metrics = EXCLUDED.progress_metrics
		RETURNING id, plan_id, snapshot_date::text, financial_state::text, progress_metrics::text,
		          ai_review_summary, created_at
	`, planID, string(financialStateJSON), string(progressMetricsJSON)).Scan(
		&snap.ID, &snap.PlanID, &snap.SnapshotDate,
		&financialStateStr, &progressMetricsStr,
		&snap.AIReviewSummary, &snap.CreatedAt,
	)
	if err != nil {
		log.Printf("CreateSnapshot upsert error: %v", err)
		http.Error(w, "Failed to create snapshot", http.StatusInternalServerError)
		return
	}

	// Parse JSONB strings back into the response
	_ = json.Unmarshal([]byte(financialStateStr), &snap.FinancialState)
	_ = json.Unmarshal([]byte(progressMetricsStr), &snap.ProgressMetrics)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(snap)
}

// ─── Get Plan Progress ───────────────────────────────────────

func GetPlanProgress(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	planID := mux.Vars(r)["id"]
	if planID == "" {
		http.Error(w, "Missing plan ID", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	if !userCanAccessPlan(conn, userID, planID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Fetch all snapshots for charting
	rows, err := conn.Query(`
		SELECT id, plan_id, snapshot_date::text, financial_state::text, progress_metrics::text,
		       ai_review_summary, created_at
		FROM plan_snapshots
		WHERE plan_id = $1
		ORDER BY snapshot_date DESC
	`, planID)
	if err != nil {
		log.Printf("GetPlanProgress query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var snapshots []models.PlanSnapshot
	for rows.Next() {
		var s models.PlanSnapshot
		var fsStr, pmStr string
		if err := rows.Scan(&s.ID, &s.PlanID, &s.SnapshotDate, &fsStr, &pmStr, &s.AIReviewSummary, &s.CreatedAt); err != nil {
			log.Printf("GetPlanProgress scan error: %v", err)
			continue
		}
		_ = json.Unmarshal([]byte(fsStr), &s.FinancialState)
		_ = json.Unmarshal([]byte(pmStr), &s.ProgressMetrics)
		snapshots = append(snapshots, s)
	}
	if snapshots == nil {
		snapshots = []models.PlanSnapshot{}
	}

	// Get milestone summary
	var milestonesTotal, milestonesReached int
	_ = conn.QueryRow(`SELECT COUNT(*) FROM plan_milestones WHERE plan_id = $1`, planID).Scan(&milestonesTotal)
	_ = conn.QueryRow(`SELECT COUNT(*) FROM plan_milestones WHERE plan_id = $1 AND status = 'reached'`, planID).Scan(&milestonesReached)

	milestonePct := 0.0
	if milestonesTotal > 0 {
		milestonePct = float64(milestonesReached) / float64(milestonesTotal) * 100
	}

	// Get projected end date for comparison
	var projectedEnd string
	_ = conn.QueryRow(`SELECT COALESCE(projected_end_date::text, '') FROM financial_plans WHERE id = $1`, planID).Scan(&projectedEnd)

	response := map[string]interface{}{
		"snapshots":          snapshots,
		"milestones_total":   milestonesTotal,
		"milestones_reached": milestonesReached,
		"milestone_pct":      milestonePct,
		"projected_end_date": projectedEnd,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
