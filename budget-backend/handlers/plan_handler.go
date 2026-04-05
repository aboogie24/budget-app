package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// planDBFactory allows swapping the DB in tests.
var planDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// ─── Create Plan ──────────────────────────────────────────────

func CreatePlan(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, "Plan name is required", http.StatusBadRequest)
		return
	}
	if req.PlanType == "" {
		req.PlanType = "combined"
	}

	conn, err := planDBFactory()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)
	var hhArg interface{}
	if householdID != "" {
		hhArg = householdID
	}

	// Insert plan
	var plan models.FinancialPlan
	err = conn.QueryRow(`
		INSERT INTO financial_plans (household_id, created_by, name, plan_type, monthly_contribution, start_date)
		VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
		RETURNING id, COALESCE(household_id::text, ''), created_by, name, plan_type, status,
		          COALESCE(framework_level, ''), monthly_contribution,
		          COALESCE(start_date::text, ''), COALESCE(projected_end_date::text, ''),
		          COALESCE(ai_analysis::text, '{}'), COALESCE(scenarios::text, '{}'),
		          created_at, updated_at
	`, hhArg, userID, req.Name, req.PlanType, req.MonthlyContribution).Scan(
		&plan.ID, &plan.HouseholdID, &plan.CreatedBy, &plan.Name, &plan.PlanType, &plan.Status,
		&plan.FrameworkLevel, &plan.MonthlyContribution,
		&plan.StartDate, &plan.ProjectedEndDate,
		&plan.AIAnalysis, &plan.Scenarios,
		&plan.CreatedAt, &plan.UpdatedAt,
	)
	if err != nil {
		log.Printf("CreatePlan insert error: %v", err)
		http.Error(w, "Failed to create plan", http.StatusInternalServerError)
		return
	}

	// Create allocations
	plan.Allocations = []models.PlanAllocation{}
	perGoalAmount := 0.0
	if len(req.GoalIDs) > 0 {
		perGoalAmount = req.MonthlyContribution / float64(len(req.GoalIDs))
	}

	for i, goalID := range req.GoalIDs {
		targetType := resolveTargetType(conn.Raw(), userID, goalID)
		if targetType == "" {
			continue
		}

		var alloc models.PlanAllocation
		err := conn.QueryRow(`
			INSERT INTO plan_allocations (plan_id, target_id, target_type, monthly_amount, priority_order)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, plan_id, target_id, target_type, monthly_amount, priority_order
		`, plan.ID, goalID, targetType, perGoalAmount, i+1).Scan(
			&alloc.ID, &alloc.PlanID, &alloc.TargetID, &alloc.TargetType,
			&alloc.MonthlyAmount, &alloc.PriorityOrder,
		)
		if err != nil {
			log.Printf("CreatePlan allocation insert error: %v", err)
			continue
		}
		plan.Allocations = append(plan.Allocations, alloc)
	}

	plan.Milestones = []models.PlanMilestone{}

	// ── Couple Collaboration: create approval rows ──
	plan.Approvals = []models.PlanApproval{}
	if householdID != "" {
		// Creator auto-approves
		var selfApproval models.PlanApproval
		err = conn.QueryRow(`
			INSERT INTO plan_approvals (plan_id, user_id, status, responded_at)
			VALUES ($1, $2, 'approved', NOW())
			RETURNING id, plan_id, user_id, status, feedback, responded_at, created_at
		`, plan.ID, userID).Scan(
			&selfApproval.ID, &selfApproval.PlanID, &selfApproval.UserID,
			&selfApproval.Status, &selfApproval.Feedback, &selfApproval.RespondedAt, &selfApproval.CreatedAt,
		)
		if err != nil {
			log.Printf("CreatePlan self-approval error: %v", err)
		} else {
			_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&selfApproval.UserName)
			plan.Approvals = append(plan.Approvals, selfApproval)
		}

		// Create pending approvals for other household members
		memberRows, mErr := conn.Query(`
			SELECT user_id FROM household_members
			WHERE household_id = $1 AND user_id != $2
		`, householdID, userID)
		if mErr == nil {
			defer memberRows.Close()
			for memberRows.Next() {
				var memberID string
				if err := memberRows.Scan(&memberID); err != nil {
					continue
				}
				var memberApproval models.PlanApproval
				err = conn.QueryRow(`
					INSERT INTO plan_approvals (plan_id, user_id, status)
					VALUES ($1, $2, 'pending')
					RETURNING id, plan_id, user_id, status, feedback, responded_at, created_at
				`, plan.ID, memberID).Scan(
					&memberApproval.ID, &memberApproval.PlanID, &memberApproval.UserID,
					&memberApproval.Status, &memberApproval.Feedback, &memberApproval.RespondedAt, &memberApproval.CreatedAt,
				)
				if err != nil {
					log.Printf("CreatePlan partner approval error: %v", err)
					continue
				}
				_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, memberID).Scan(&memberApproval.UserName)
				plan.Approvals = append(plan.Approvals, memberApproval)
			}
		}

		// Notify household (excluding creator)
		var userName string
		_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&userName)
		SendHouseholdNotification(householdID, userID,
			"New Plan", userName+" created a new plan: "+plan.Name+". Review?",
			map[string]string{"type": "plan_created", "plan_id": plan.ID},
		)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(plan)
}

// ─── List Plans ───────────────────────────────────────────────

func ListPlans(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := planDBFactory()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	var rows *sql.Rows
	if householdID != "" {
		rows, err = conn.Query(`
			SELECT id, COALESCE(household_id::text, ''), created_by, name, plan_type, status,
			       COALESCE(framework_level, ''), monthly_contribution,
			       COALESCE(start_date::text, ''), COALESCE(projected_end_date::text, ''),
			       created_at, updated_at
			FROM financial_plans
			WHERE household_id::text = $1
			ORDER BY updated_at DESC
		`, householdID)
	} else {
		rows, err = conn.Query(`
			SELECT id, COALESCE(household_id::text, ''), created_by, name, plan_type, status,
			       COALESCE(framework_level, ''), monthly_contribution,
			       COALESCE(start_date::text, ''), COALESCE(projected_end_date::text, ''),
			       created_at, updated_at
			FROM financial_plans
			WHERE created_by = $1
			ORDER BY updated_at DESC
		`, userID)
	}
	if err != nil {
		log.Printf("ListPlans query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var plans []models.FinancialPlan
	for rows.Next() {
		var p models.FinancialPlan
		if err := rows.Scan(
			&p.ID, &p.HouseholdID, &p.CreatedBy, &p.Name, &p.PlanType, &p.Status,
			&p.FrameworkLevel, &p.MonthlyContribution,
			&p.StartDate, &p.ProjectedEndDate,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			log.Printf("ListPlans scan error: %v", err)
			continue
		}
		plans = append(plans, p)
	}

	if plans == nil {
		plans = []models.FinancialPlan{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plans)
}

// ─── Get Plan ─────────────────────────────────────────────────

func GetPlan(w http.ResponseWriter, r *http.Request) {
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

	conn, err := planDBFactory()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Fetch plan and verify ownership
	var plan models.FinancialPlan
	err = conn.QueryRow(`
		SELECT id, COALESCE(household_id::text, ''), created_by, name, plan_type, status,
		       COALESCE(framework_level, ''), monthly_contribution,
		       COALESCE(start_date::text, ''), COALESCE(projected_end_date::text, ''),
		       COALESCE(ai_analysis::text, '{}'), COALESCE(scenarios::text, '{}'),
		       created_at, updated_at
		FROM financial_plans WHERE id = $1
	`, planID).Scan(
		&plan.ID, &plan.HouseholdID, &plan.CreatedBy, &plan.Name, &plan.PlanType, &plan.Status,
		&plan.FrameworkLevel, &plan.MonthlyContribution,
		&plan.StartDate, &plan.ProjectedEndDate,
		&plan.AIAnalysis, &plan.Scenarios,
		&plan.CreatedAt, &plan.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "Plan not found", http.StatusNotFound)
		return
	}

	// Ownership check: either created_by or same household
	if plan.CreatedBy != userID {
		householdID := db.ResolveHouseholdID(conn.Raw(), userID)
		if householdID == "" || householdID != plan.HouseholdID {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	// Fetch milestones
	plan.Milestones = []models.PlanMilestone{}
	mRows, err := conn.Query(`
		SELECT id, plan_id, title, COALESCE(target_amount, 0), COALESCE(target_date::text, ''),
		       status, completed_at
		FROM plan_milestones WHERE plan_id = $1
		ORDER BY target_date ASC NULLS LAST
	`, planID)
	if err == nil {
		defer mRows.Close()
		for mRows.Next() {
			var m models.PlanMilestone
			if err := mRows.Scan(&m.ID, &m.PlanID, &m.Title, &m.TargetAmount, &m.TargetDate, &m.Status, &m.CompletedAt); err != nil {
				continue
			}
			plan.Milestones = append(plan.Milestones, m)
		}
	}

	// Fetch allocations
	plan.Allocations = []models.PlanAllocation{}
	aRows, err := conn.Query(`
		SELECT id, plan_id, target_id, target_type, monthly_amount, priority_order
		FROM plan_allocations WHERE plan_id = $1
		ORDER BY priority_order ASC
	`, planID)
	if err == nil {
		defer aRows.Close()
		for aRows.Next() {
			var a models.PlanAllocation
			if err := aRows.Scan(&a.ID, &a.PlanID, &a.TargetID, &a.TargetType, &a.MonthlyAmount, &a.PriorityOrder); err != nil {
				continue
			}
			plan.Allocations = append(plan.Allocations, a)
		}
	}

	// Fetch approvals
	plan.Approvals = []models.PlanApproval{}
	apRows, err := conn.Query(`
		SELECT pa.id, pa.plan_id, pa.user_id, COALESCE(u.full_name, u.email, ''),
		       pa.status, pa.feedback, pa.responded_at, pa.created_at
		FROM plan_approvals pa
		JOIN users u ON u.id = pa.user_id
		WHERE pa.plan_id = $1
		ORDER BY pa.created_at ASC
	`, planID)
	if err == nil {
		defer apRows.Close()
		for apRows.Next() {
			var a models.PlanApproval
			if err := apRows.Scan(
				&a.ID, &a.PlanID, &a.UserID, &a.UserName,
				&a.Status, &a.Feedback, &a.RespondedAt, &a.CreatedAt,
			); err != nil {
				continue
			}
			plan.Approvals = append(plan.Approvals, a)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plan)
}

// ─── Update Plan ──────────────────────────────────────────────

func UpdatePlan(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		Name                *string  `json:"name"`
		Status              *string  `json:"status"`
		FrameworkLevel      *string  `json:"framework_level"`
		MonthlyContribution *float64 `json:"monthly_contribution"`
		ProjectedEndDate    *string  `json:"projected_end_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	conn, err := planDBFactory()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify ownership
	var ownerID string
	err = conn.QueryRow(`SELECT created_by FROM financial_plans WHERE id = $1`, planID).Scan(&ownerID)
	if err != nil {
		http.Error(w, "Plan not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		householdID := db.ResolveHouseholdID(conn.Raw(), userID)
		var planHH string
		_ = conn.QueryRow(`SELECT COALESCE(household_id::text, '') FROM financial_plans WHERE id = $1`, planID).Scan(&planHH)
		if householdID == "" || householdID != planHH {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	// Build dynamic update
	res, err := conn.Exec(`
		UPDATE financial_plans SET
			name = COALESCE($2, name),
			status = COALESCE($3, status),
			framework_level = COALESCE($4, framework_level),
			monthly_contribution = COALESCE($5, monthly_contribution),
			projected_end_date = COALESCE($6::date, projected_end_date),
			updated_at = NOW()
		WHERE id = $1
	`, planID, body.Name, body.Status, body.FrameworkLevel, body.MonthlyContribution, body.ProjectedEndDate)
	if err != nil {
		log.Printf("UpdatePlan error: %v", err)
		http.Error(w, "Update failed", http.StatusInternalServerError)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Plan not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      planID,
		"updated": true,
	})
}

// ─── Delete Plan ──────────────────────────────────────────────

func DeletePlan(w http.ResponseWriter, r *http.Request) {
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

	conn, err := planDBFactory()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify ownership
	var ownerID string
	err = conn.QueryRow(`SELECT created_by FROM financial_plans WHERE id = $1`, planID).Scan(&ownerID)
	if err != nil {
		http.Error(w, "Plan not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		householdID := db.ResolveHouseholdID(conn.Raw(), userID)
		var planHH string
		_ = conn.QueryRow(`SELECT COALESCE(household_id::text, '') FROM financial_plans WHERE id = $1`, planID).Scan(&planHH)
		if householdID == "" || householdID != planHH {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	// CASCADE handles milestones + allocations
	res, err := conn.Exec(`DELETE FROM financial_plans WHERE id = $1`, planID)
	if err != nil {
		log.Printf("DeletePlan error: %v", err)
		http.Error(w, "Delete failed", http.StatusInternalServerError)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Plan not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// resolveTargetType checks whether a goal ID is a debt_account or savings_goal.
func resolveTargetType(conn *sql.DB, userID, goalID string) string {
	var exists bool
	err := conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM debt_accounts WHERE id = $1 AND user_id = $2)`, goalID, userID).Scan(&exists)
	if err == nil && exists {
		return "debt"
	}
	err = conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM savings_goals WHERE id = $1 AND user_id = $2)`, goalID, userID).Scan(&exists)
	if err == nil && exists {
		return "savings_goal"
	}
	return ""
}
