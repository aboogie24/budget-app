package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// ─── Approve Plan ────────────────────────────────────────────

func ApprovePlan(w http.ResponseWriter, r *http.Request) {
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

	// Verify user is in the same household as the plan
	planHH, planCreatedBy, planName, ok := verifyPlanHouseholdAccess(conn, userID, planID)
	if !ok {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if planHH == "" {
		http.Error(w, "Plan is not associated with a household", http.StatusBadRequest)
		return
	}

	// Upsert approval with status='approved'
	var approval models.PlanApproval
	err = conn.QueryRow(`
		INSERT INTO plan_approvals (plan_id, user_id, status, responded_at)
		VALUES ($1, $2, 'approved', NOW())
		ON CONFLICT (plan_id, user_id)
		DO UPDATE SET status = 'approved', feedback = NULL, responded_at = NOW()
		RETURNING id, plan_id, user_id, status, feedback, responded_at, created_at
	`, planID, userID).Scan(
		&approval.ID, &approval.PlanID, &approval.UserID,
		&approval.Status, &approval.Feedback, &approval.RespondedAt, &approval.CreatedAt,
	)
	if err != nil {
		log.Printf("ApprovePlan upsert error: %v", err)
		http.Error(w, "Failed to approve plan", http.StatusInternalServerError)
		return
	}

	// Check if ALL household members have approved → activate the plan
	var totalMembers, approvedCount int
	err = conn.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM household_members WHERE household_id = $1),
			(SELECT COUNT(*) FROM plan_approvals WHERE plan_id = $2 AND status = 'approved')
	`, planHH, planID).Scan(&totalMembers, &approvedCount)
	if err == nil && approvedCount >= totalMembers && totalMembers > 0 {
		_, err = conn.Exec(`
			UPDATE financial_plans
			SET status = 'active', start_date = CURRENT_DATE, updated_at = NOW()
			WHERE id = $1 AND status = 'draft'
		`, planID)
		if err != nil {
			log.Printf("ApprovePlan activate error: %v", err)
		}
	}

	// Send push notification to plan creator
	if planCreatedBy != userID {
		SendPushNotification(planCreatedBy, "Plan Approved", "Partner approved your plan: "+planName, map[string]string{
			"type":    "plan_approved",
			"plan_id": planID,
		})
	}

	// Populate user name for response
	_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&approval.UserName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(approval)
}

// ─── Reject Plan ─────────────────────────────────────────────

func RejectPlan(w http.ResponseWriter, r *http.Request) {
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
		Feedback string `json:"feedback"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify user is in the same household as the plan
	planHH, planCreatedBy, planName, ok := verifyPlanHouseholdAccess(conn, userID, planID)
	if !ok {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	if planHH == "" {
		http.Error(w, "Plan is not associated with a household", http.StatusBadRequest)
		return
	}

	// Upsert approval with status='rejected'
	var feedbackArg interface{}
	if body.Feedback != "" {
		feedbackArg = body.Feedback
	}

	var approval models.PlanApproval
	err = conn.QueryRow(`
		INSERT INTO plan_approvals (plan_id, user_id, status, feedback, responded_at)
		VALUES ($1, $2, 'rejected', $3, NOW())
		ON CONFLICT (plan_id, user_id)
		DO UPDATE SET status = 'rejected', feedback = $3, responded_at = NOW()
		RETURNING id, plan_id, user_id, status, feedback, responded_at, created_at
	`, planID, userID, feedbackArg).Scan(
		&approval.ID, &approval.PlanID, &approval.UserID,
		&approval.Status, &approval.Feedback, &approval.RespondedAt, &approval.CreatedAt,
	)
	if err != nil {
		log.Printf("RejectPlan upsert error: %v", err)
		http.Error(w, "Failed to reject plan", http.StatusInternalServerError)
		return
	}

	// Send push notification to plan creator
	if planCreatedBy != userID {
		SendPushNotification(planCreatedBy, "Plan Feedback", "Partner has feedback on "+planName, map[string]string{
			"type":    "plan_rejected",
			"plan_id": planID,
		})
	}

	// Populate user name for response
	_ = conn.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&approval.UserName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(approval)
}

// ─── Get Plan Approvals ──────────────────────────────────────

func GetPlanApprovals(w http.ResponseWriter, r *http.Request) {
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

	// Verify user is in the same household as the plan
	_, _, _, ok := verifyPlanHouseholdAccess(conn, userID, planID)
	if !ok {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	approvals, err := fetchPlanApprovals(conn, planID)
	if err != nil {
		log.Printf("GetPlanApprovals query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(approvals)
}

// ─── Helpers ─────────────────────────────────────────────────

// verifyPlanHouseholdAccess checks that the user belongs to the same household
// as the plan. Returns (householdID, createdBy, planName, ok).
func verifyPlanHouseholdAccess(conn *db.DB, userID, planID string) (string, string, string, bool) {
	var planHH, createdBy, planName string
	err := conn.QueryRow(`
		SELECT COALESCE(household_id::text, ''), created_by, name
		FROM financial_plans WHERE id = $1
	`, planID).Scan(&planHH, &createdBy, &planName)
	if err != nil {
		return "", "", "", false
	}

	// Creator always has access
	if createdBy == userID {
		return planHH, createdBy, planName, true
	}

	// Otherwise must be in the same household
	userHH := db.ResolveHouseholdID(conn.Raw(), userID)
	if userHH == "" || userHH != planHH {
		return "", "", "", false
	}
	return planHH, createdBy, planName, true
}

// fetchPlanApprovals returns all approvals for a plan, joined with user names.
func fetchPlanApprovals(conn *db.DB, planID string) ([]models.PlanApproval, error) {
	rows, err := conn.Query(`
		SELECT pa.id, pa.plan_id, pa.user_id, COALESCE(u.full_name, u.email, ''),
		       pa.status, pa.feedback, pa.responded_at, pa.created_at
		FROM plan_approvals pa
		JOIN users u ON u.id = pa.user_id
		WHERE pa.plan_id = $1
		ORDER BY pa.created_at ASC
	`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var approvals []models.PlanApproval
	for rows.Next() {
		var a models.PlanApproval
		if err := rows.Scan(
			&a.ID, &a.PlanID, &a.UserID, &a.UserName,
			&a.Status, &a.Feedback, &a.RespondedAt, &a.CreatedAt,
		); err != nil {
			log.Printf("fetchPlanApprovals scan error: %v", err)
			continue
		}
		approvals = append(approvals, a)
	}

	if approvals == nil {
		approvals = []models.PlanApproval{}
	}
	return approvals, nil
}
