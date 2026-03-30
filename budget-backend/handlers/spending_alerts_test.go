package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
)

func TestGetSpendingAlerts_ReturnsAlertsForHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// GetSpendingAlerts query
		rows := sqlmock.NewRows([]string{
			"id", "household_id", "budget_id", "alert_type", "threshold_percent", "is_enabled", "created_at",
		}).AddRow(
			"sa1", householdID, "b1", "threshold", 80, true, time.Now(),
		)

		mock.ExpectQuery(`FROM spending_alerts`).
			WithArgs(householdID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/spending-alerts?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetSpendingAlerts(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if alerts, ok := result["spending_alerts"]; !ok {
		t.Fatalf("expected spending_alerts key in response")
	} else if len(alerts.([]interface{})) != 1 {
		t.Fatalf("expected 1 alert, got %d", len(alerts.([]interface{})))
	}
}

func TestGetSpendingAlerts_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/spending-alerts", nil)
	rr := httptest.NewRecorder()

	GetSpendingAlerts(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetSpendingAlerts_UserNotInHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/spending-alerts?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetSpendingAlerts(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var result map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &result)
	if alerts, ok := result["spending_alerts"]; ok && len(alerts.([]interface{})) != 0 {
		t.Fatalf("expected empty alerts for user not in household")
	}
}

func TestUpsertSpendingAlert_CreateNewAlert(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"
	budgetID := "b1111111-1111-1111-1111-111111111111"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Budget check
		mock.ExpectQuery(`SELECT household_id FROM budgets WHERE id = `).
			WithArgs(budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Check if alert exists
		mock.ExpectQuery(`SELECT id FROM spending_alerts`).
			WithArgs(householdID, budgetID).
			WillReturnError(sql.ErrNoRows)

		// INSERT new alert
		mock.ExpectExec(`INSERT INTO spending_alerts`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// Fetch alert
		mock.ExpectQuery(`SELECT id, household_id, budget_id, alert_type, threshold_percent, is_enabled, created_at`).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "household_id", "budget_id", "alert_type", "threshold_percent", "is_enabled", "created_at",
			}).AddRow(
				"sa1", householdID, budgetID, "threshold", 80, true, time.Now(),
			))
	})

	body := map[string]interface{}{
		"user_id":            userID,
		"budget_id":          budgetID,
		"threshold_percent":  80,
		"is_enabled":         true,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	UpsertSpendingAlert(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["id"] == "" {
		t.Fatalf("expected alert id in response")
	}
}

func TestUpsertSpendingAlert_UpdateExisting(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"
	budgetID := "b1111111-1111-1111-1111-111111111111"
	alertID := "sa1111111-1111-1111-1111-111111111111"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Budget check
		mock.ExpectQuery(`SELECT household_id FROM budgets WHERE id = `).
			WithArgs(budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Check if alert exists - returns existing
		mock.ExpectQuery(`SELECT id FROM spending_alerts`).
			WithArgs(householdID, budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).
				AddRow(alertID))

		// UPDATE existing alert
		mock.ExpectExec(`UPDATE spending_alerts`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// Fetch alert
		mock.ExpectQuery(`SELECT id, household_id, budget_id, alert_type, threshold_percent, is_enabled, created_at`).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "household_id", "budget_id", "alert_type", "threshold_percent", "is_enabled", "created_at",
			}).AddRow(
				alertID, householdID, budgetID, "threshold", 90, true, time.Now(),
			))
	})

	body := map[string]interface{}{
		"user_id":            userID,
		"budget_id":          budgetID,
		"threshold_percent":  90,
		"is_enabled":         true,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	UpsertSpendingAlert(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestUpsertSpendingAlert_MissingRequired(t *testing.T) {
	tests := []struct {
		name string
		body map[string]interface{}
	}{
		{"missing user_id", map[string]interface{}{"budget_id": "b1"}},
		{"missing budget_id", map[string]interface{}{"user_id": "u1"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			UpsertSpendingAlert(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestUpsertSpendingAlert_BudgetNotInHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"
	budgetID := "b1111111-1111-1111-1111-111111111111"
	otherHouseholdID := "hh222222-2222-2222-2222-222222222222"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Budget check - belongs to different household
		mock.ExpectQuery(`SELECT household_id FROM budgets WHERE id = `).
			WithArgs(budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(otherHouseholdID))
	})

	body := map[string]interface{}{
		"user_id":   userID,
		"budget_id": budgetID,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	UpsertSpendingAlert(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCheckBudgetThresholds_ReturnsOverThresholdBudgets(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Fetch enabled alerts
		alertRows := sqlmock.NewRows([]string{
			"id", "budget_id", "threshold_percent",
		}).AddRow(
			"sa1", "b1", 80,
		)
		mock.ExpectQuery(`FROM spending_alerts`).
			WithArgs(householdID).
			WillReturnRows(alertRows)

		// Get budget info
		mock.ExpectQuery(`SELECT name, amount FROM budgets WHERE id = `).
			WithArgs("b1").
			WillReturnRows(sqlmock.NewRows([]string{"name", "amount"}).
				AddRow("Groceries", 500.0))

		// Get spending for budget
		mock.ExpectQuery(`SELECT COALESCE.SUM.amount`).
			WithArgs("b1").
			WillReturnRows(sqlmock.NewRows([]string{"amount"}).
				AddRow(450.0))
	})

	req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts/check?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	CheckBudgetThresholds(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if alerts, ok := result["alerts"]; !ok {
		t.Fatalf("expected alerts key in response")
	} else if len(alerts.([]interface{})) == 0 {
		t.Fatalf("expected at least 1 alert")
	}
}

func TestCheckBudgetThresholds_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts/check", nil)
	rr := httptest.NewRecorder()

	CheckBudgetThresholds(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCheckBudgetThresholds_UserNotInHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withSpendingAlertsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
	})

	req := httptest.NewRequest(http.MethodPost, "/auth/spending-alerts/check?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	CheckBudgetThresholds(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var result map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &result)
	if alerts, ok := result["alerts"]; ok && len(alerts.([]interface{})) != 0 {
		t.Fatalf("expected empty alerts for user not in household")
	}
}

// Helper function with spending alerts DB factory mock
func withSpendingAlertsMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	oldFactory := spendingAlertsDBFactory
	spendingAlertsDBFactory = func() (db.DBTX, error) { return &mockDB{db: mockSQL}, nil }
	t.Cleanup(func() { spendingAlertsDBFactory = oldFactory })

	setup(mock)
}
