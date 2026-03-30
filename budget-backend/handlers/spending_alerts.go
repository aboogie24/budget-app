package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/google/uuid"
)

var spendingAlertsDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// GetSpendingAlerts returns all spending alert configurations for the household.
// GET /auth/spending-alerts?user_id=UUID
func GetSpendingAlerts(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	client, err := spendingAlertsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Resolve household ID from user_id
	householdID := db.ResolveHouseholdID(client.Raw(), userID)
	if householdID == "" {
		// User is not in a household, return empty list
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string][]models.SpendingAlert{
			"spending_alerts": {},
		})
		return
	}

	rows, err := client.Query(`
		SELECT id, household_id, budget_id, alert_type, threshold_percent, is_enabled, created_at
		FROM spending_alerts
		WHERE household_id = $1
		ORDER BY created_at DESC
	`, householdID)
	if err != nil {
		log.Printf("GetSpendingAlerts query error: %v", err)
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var alerts []models.SpendingAlert
	for rows.Next() {
		var alert models.SpendingAlert
		if err := rows.Scan(&alert.ID, &alert.HouseholdID, &alert.BudgetID, &alert.AlertType, &alert.ThresholdPercent, &alert.IsEnabled, &alert.CreatedAt); err != nil {
			log.Printf("GetSpendingAlerts scan error: %v", err)
			continue
		}
		alerts = append(alerts, alert)
	}

	if alerts == nil {
		alerts = []models.SpendingAlert{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]models.SpendingAlert{
		"spending_alerts": alerts,
	})
}

// UpsertSpendingAlert creates or updates an alert for a specific budget.
// POST /auth/spending-alerts
// Body: {user_id, budget_id, threshold_percent, is_enabled}
func UpsertSpendingAlert(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID           string `json:"user_id"`
		BudgetID         string `json:"budget_id"`
		ThresholdPercent *int   `json:"threshold_percent"`
		IsEnabled        *bool  `json:"is_enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if body.UserID == "" || body.BudgetID == "" {
		http.Error(w, "user_id and budget_id are required", http.StatusBadRequest)
		return
	}

	client, err := spendingAlertsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Resolve household ID from user_id
	householdID := db.ResolveHouseholdID(client.Raw(), body.UserID)
	if householdID == "" {
		http.Error(w, "user is not in a household", http.StatusBadRequest)
		return
	}

	// Verify that the budget belongs to this household
	var budgetHouseholdID sql.NullString
	err = client.QueryRow(`
		SELECT household_id FROM budgets WHERE id = $1
	`, body.BudgetID).Scan(&budgetHouseholdID)
	if err != nil {
		log.Printf("UpsertSpendingAlert budget check error: %v", err)
		http.Error(w, "budget not found", http.StatusNotFound)
		return
	}

	if !budgetHouseholdID.Valid || budgetHouseholdID.String != householdID {
		http.Error(w, "budget does not belong to this household", http.StatusForbidden)
		return
	}

	// Set defaults
	thresholdPercent := 80
	if body.ThresholdPercent != nil {
		thresholdPercent = *body.ThresholdPercent
	}

	isEnabled := true
	if body.IsEnabled != nil {
		isEnabled = *body.IsEnabled
	}

	// Check if alert already exists
	var existingID string
	err = client.QueryRow(`
		SELECT id FROM spending_alerts
		WHERE household_id = $1 AND budget_id = $2
	`, householdID, body.BudgetID).Scan(&existingID)

	alertID := existingID
	if err != nil && err != sql.ErrNoRows {
		log.Printf("UpsertSpendingAlert existing check error: %v", err)
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}

	if err == sql.ErrNoRows {
		// Insert new alert
		alertID = uuid.New().String()
		_, err = client.Exec(`
			INSERT INTO spending_alerts (id, household_id, budget_id, alert_type, threshold_percent, is_enabled, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, alertID, householdID, body.BudgetID, "threshold", thresholdPercent, isEnabled, time.Now())
		if err != nil {
			log.Printf("UpsertSpendingAlert insert error: %v", err)
			http.Error(w, "insert error", http.StatusInternalServerError)
			return
		}
	} else {
		// Update existing alert
		_, err = client.Exec(`
			UPDATE spending_alerts
			SET threshold_percent = $1, is_enabled = $2
			WHERE id = $3
		`, thresholdPercent, isEnabled, alertID)
		if err != nil {
			log.Printf("UpsertSpendingAlert update error: %v", err)
			http.Error(w, "update error", http.StatusInternalServerError)
			return
		}
	}

	// Fetch and return the alert
	var alert models.SpendingAlert
	err = client.QueryRow(`
		SELECT id, household_id, budget_id, alert_type, threshold_percent, is_enabled, created_at
		FROM spending_alerts
		WHERE id = $1
	`, alertID).Scan(&alert.ID, &alert.HouseholdID, &alert.BudgetID, &alert.AlertType, &alert.ThresholdPercent, &alert.IsEnabled, &alert.CreatedAt)
	if err != nil {
		log.Printf("UpsertSpendingAlert fetch error: %v", err)
		http.Error(w, "fetch error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alert)
}

// CheckBudgetThresholds checks all shared budgets for the household and returns which ones have exceeded their threshold.
// POST /auth/spending-alerts/check?user_id=UUID
func CheckBudgetThresholds(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	client, err := spendingAlertsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Resolve household ID from user_id
	householdID := db.ResolveHouseholdID(client.Raw(), userID)
	if householdID == "" {
		// User is not in a household, return empty alerts
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models.CheckBudgetThresholdsResponse{
			Alerts: []models.AlertCheckResult{},
		})
		return
	}

	// Get current month boundaries
	now := time.Now().UTC()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	// Fetch all spending alerts for this household that are enabled
	alertRows, err := client.Query(`
		SELECT id, budget_id, threshold_percent
		FROM spending_alerts
		WHERE household_id = $1 AND is_enabled = true
	`, householdID)
	if err != nil {
		log.Printf("CheckBudgetThresholds query error: %v", err)
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer alertRows.Close()

	type alertInfo struct {
		AlertID          string
		BudgetID         string
		ThresholdPercent int
	}
	var alerts []alertInfo

	for alertRows.Next() {
		var a alertInfo
		if err := alertRows.Scan(&a.AlertID, &a.BudgetID, &a.ThresholdPercent); err != nil {
			log.Printf("CheckBudgetThresholds scan error: %v", err)
			continue
		}
		alerts = append(alerts, a)
	}

	var results []models.AlertCheckResult

	// For each alert, check if the threshold has been exceeded
	for _, alert := range alerts {
		// Get budget info
		var budgetName string
		var budgetAmount float64
		err := client.QueryRow(`
			SELECT name, amount FROM budgets WHERE id = $1
		`, alert.BudgetID).Scan(&budgetName, &budgetAmount)
		if err != nil {
			log.Printf("CheckBudgetThresholds budget lookup error: %v", err)
			continue
		}

		// Calculate spending for this budget for the current month
		var spent float64
		err = client.QueryRow(`
			SELECT COALESCE(SUM(amount), 0)
			FROM transactions
			WHERE budget_id = $1 AND type = 'expense' AND date >= $2 AND date < $3
		`, alert.BudgetID, monthStart, monthEnd).Scan(&spent)
		if err != nil && err != sql.ErrNoRows {
			log.Printf("CheckBudgetThresholds spending query error: %v", err)
			continue
		}

		// Calculate percent used
		percentUsed := 0
		if budgetAmount > 0 {
			percentUsed = int((spent / budgetAmount) * 100)
			if percentUsed > 100 {
				percentUsed = 100
			}
		}

		// Check if over threshold
		overThreshold := percentUsed >= alert.ThresholdPercent

		result := models.AlertCheckResult{
			BudgetID:         alert.BudgetID,
			BudgetName:       budgetName,
			BudgetAmount:     budgetAmount,
			SpentAmount:      spent,
			PercentUsed:      percentUsed,
			ThresholdPercent: alert.ThresholdPercent,
			OverThreshold:    overThreshold,
		}

		results = append(results, result)
	}

	if results == nil {
		results = []models.AlertCheckResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.CheckBudgetThresholdsResponse{
		Alerts: results,
	})
}
