package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// ─── Create Milestone ────────────────────────────────────────

func CreateMilestone(w http.ResponseWriter, r *http.Request) {
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
		Title        string  `json:"title"`
		TargetAmount float64 `json:"target_amount"`
		TargetDate   string  `json:"target_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.Title == "" {
		http.Error(w, "Milestone title is required", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify the user has access to this plan
	if !userCanAccessPlan(conn, userID, planID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var targetDateArg interface{}
	if body.TargetDate != "" {
		targetDateArg = body.TargetDate
	}

	var m models.PlanMilestone
	err = conn.QueryRow(`
		INSERT INTO plan_milestones (plan_id, title, target_amount, target_date)
		VALUES ($1, $2, $3, $4::date)
		RETURNING id, plan_id, title, COALESCE(target_amount, 0),
		          COALESCE(target_date::text, ''), status, completed_at
	`, planID, body.Title, body.TargetAmount, targetDateArg).Scan(
		&m.ID, &m.PlanID, &m.Title, &m.TargetAmount,
		&m.TargetDate, &m.Status, &m.CompletedAt,
	)
	if err != nil {
		log.Printf("CreateMilestone insert error: %v", err)
		http.Error(w, "Failed to create milestone", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

// ─── Update Milestone ────────────────────────────────────────

func UpdateMilestone(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	planID := vars["planId"]
	milestoneID := vars["milestoneId"]
	if planID == "" || milestoneID == "" {
		http.Error(w, "Missing plan or milestone ID", http.StatusBadRequest)
		return
	}

	var body struct {
		Title        *string  `json:"title"`
		TargetAmount *float64 `json:"target_amount"`
		TargetDate   *string  `json:"target_date"`
		Status       *string  `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.Status != nil && *body.Status != "pending" && *body.Status != "reached" && *body.Status != "skipped" {
		http.Error(w, "Status must be pending, reached, or skipped", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify access
	if !userCanAccessPlan(conn, userID, planID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Build update — support editing title, amount, date, and status
	var completedAtExpr string
	statusVal := "pending"
	if body.Status != nil {
		statusVal = *body.Status
	}
	if statusVal == "reached" {
		completedAtExpr = "NOW()"
	} else {
		completedAtExpr = "NULL"
	}

	var m models.PlanMilestone
	scanErr := conn.QueryRow(`
		UPDATE plan_milestones SET
			title = COALESCE($3, title),
			target_amount = COALESCE($4, target_amount),
			target_date = COALESCE($5::date, target_date),
			status = COALESCE($6, status),
			completed_at = CASE WHEN $6 = 'reached' THEN NOW() WHEN $6 IS NOT NULL THEN NULL ELSE completed_at END
		WHERE id = $1 AND plan_id = $2
		RETURNING id, plan_id, title, COALESCE(target_amount, 0),
		          COALESCE(target_date::text, ''), status, completed_at
	`, milestoneID, planID, body.Title, body.TargetAmount, body.TargetDate, body.Status).Scan(
		&m.ID, &m.PlanID, &m.Title, &m.TargetAmount,
		&m.TargetDate, &m.Status, &m.CompletedAt,
	)
	_ = completedAtExpr // used in query logic above
	if scanErr != nil {
		log.Printf("UpdateMilestone error: %v", scanErr)
		http.Error(w, "Milestone not found", http.StatusNotFound)
		return
	}

	// Send notification if milestone reached
	if body.Status != nil && *body.Status == "reached" {
		householdID := db.ResolveHouseholdID(conn.Raw(), userID)
		if householdID != "" {
			SendHouseholdNotification(householdID, userID,
				"Milestone reached! \U0001f389",
				"Milestone reached: "+m.Title,
				map[string]string{"type": "milestone_reached", "plan_id": planID, "milestone_id": m.ID},
			)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

// userCanAccessPlan checks if the user owns or shares a household with the plan.
func userCanAccessPlan(conn *db.DB, userID, planID string) bool {
	var ownerID, planHH string
	err := conn.QueryRow(`
		SELECT created_by, COALESCE(household_id::text, '')
		FROM financial_plans WHERE id = $1
	`, planID).Scan(&ownerID, &planHH)
	if err != nil {
		return false
	}
	if ownerID == userID {
		return true
	}
	if planHH != "" {
		userHH := db.ResolveHouseholdID(conn.Raw(), userID)
		return userHH == planHH
	}
	return false
}
