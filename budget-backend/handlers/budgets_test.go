package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
	"github.com/gorilla/mux"
)

func TestCreateBudget_ValidCreation(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"user_id": userID,
		"name":    "Groceries",
		"amount":  500.0,
		"type":    "expense",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/budgets", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateBudget(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["name"] != "Groceries" {
		t.Fatalf("expected name=Groceries, got %v", result["name"])
	}
	if result["amount"] != 500.0 {
		t.Fatalf("expected amount=500, got %v", result["amount"])
	}
}

func TestCreateBudget_MissingName(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"user_id": userID,
		"amount":  500.0,
		"type":    "expense",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/budgets", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateBudget(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateBudget_InvalidAmount(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
	}{
		{"zero amount", 0},
		{"negative amount", -100},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			userID := "11111111-1111-1111-1111-111111111111"

			body := map[string]interface{}{
				"user_id": userID,
				"name":    "Test Budget",
				"amount":  tc.amount,
				"type":    "expense",
			}
			b, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/budgets", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			CreateBudget(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestCreateBudget_MissingUserID(t *testing.T) {
	body := map[string]interface{}{
		"name":   "Groceries",
		"amount": 500.0,
		"type":   "expense",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/budgets", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateBudget(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCreateBudget_InvalidType(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"user_id": userID,
		"name":    "Test",
		"amount":  500.0,
		"type":    "invalid",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/budgets", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateBudget(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetBudgetsByUser_ReturnsUserBudgets(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty (no household)
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// GetBudgetsByUser query
		rows := sqlmock.NewRows([]string{
			"id", "user_id", "household_id", "name", "amount", "type",
			"category_id", "category_name", "created_at", "updated_at", "start_date", "frequency", "is_shared",
		}).AddRow(
			"b1", userID, nil, "Groceries", 500.0, "expense",
			nil, nil, "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z", nil, "monthly", false,
		)
		mock.ExpectQuery(`FROM budgets b`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/budgets/user/"+userID, nil)
	req = mux.SetURLVars(req, map[string]string{"user_id": userID})
	rr := httptest.NewRecorder()

	GetBudgetsByUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var budgets []map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &budgets); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(budgets) != 1 {
		t.Fatalf("expected 1 budget, got %d", len(budgets))
	}
}

func TestGetBudgetsByUser_WithHouseholdAndSharedBudgets(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns household ID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// GetBudgetsByUser query with shared budgets
		rows := sqlmock.NewRows([]string{
			"id", "user_id", "household_id", "name", "amount", "type",
			"category_id", "category_name", "created_at", "updated_at", "start_date", "frequency", "is_shared",
		}).
			AddRow("b1", userID, householdID, "Groceries", 500.0, "expense",
				nil, nil, "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z", nil, "monthly", false).
			AddRow("b2", "other-user-id", householdID, "Utilities", 200.0, "expense",
				nil, nil, "2025-01-01T00:00:00Z", "2025-01-01T00:00:00Z", nil, "monthly", true)

		mock.ExpectQuery(`FROM budgets b`).
			WithArgs(householdID, userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/budgets/user/"+userID, nil)
	req = mux.SetURLVars(req, map[string]string{"user_id": userID})
	rr := httptest.NewRecorder()

	GetBudgetsByUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var budgets []map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &budgets); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(budgets) != 2 {
		t.Fatalf("expected 2 budgets, got %d", len(budgets))
	}
}

func TestUpdateBudget_SuccessfulUpdate(t *testing.T) {
	budgetID := "b1111111-1111-1111-1111-111111111111"
	userID := "11111111-1111-1111-1111-111111111111"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ownershipCheck query
		mock.ExpectQuery(`SELECT user_id FROM budgets WHERE id = `).
			WithArgs(budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"user_id"}).
				AddRow(userID))

		// UPDATE query
		mock.ExpectExec(`UPDATE budgets`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"user_id": userID,
		"name":    "Updated Budget",
		"amount":  600.0,
		"type":    "expense",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/budgets/"+budgetID, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": budgetID})
	rr := httptest.NewRecorder()

	UpdateBudget(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateBudget_OwnershipCheckFail(t *testing.T) {
	budgetID := "b1111111-1111-1111-1111-111111111111"
	userID := "11111111-1111-1111-1111-111111111111"
	otherUserID := "22222222-2222-2222-2222-222222222222"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ownershipCheck returns different user
		mock.ExpectQuery(`SELECT user_id FROM budgets WHERE id = `).
			WithArgs(budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"user_id"}).
				AddRow(otherUserID))
	})

	body := map[string]interface{}{
		"user_id": userID,
		"name":    "Updated Budget",
		"amount":  600.0,
		"type":    "expense",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/budgets/"+budgetID, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": budgetID})
	rr := httptest.NewRecorder()

	UpdateBudget(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateBudget_MissingUserID(t *testing.T) {
	budgetID := "b1111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"name":   "Updated Budget",
		"amount": 600.0,
		"type":   "expense",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/budgets/"+budgetID, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": budgetID})
	rr := httptest.NewRecorder()

	UpdateBudget(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteBudget_SuccessfulDelete(t *testing.T) {
	budgetID := "b1111111-1111-1111-1111-111111111111"
	userID := "11111111-1111-1111-1111-111111111111"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ownershipCheck query
		mock.ExpectQuery(`SELECT user_id FROM budgets WHERE id = `).
			WithArgs(budgetID).
			WillReturnRows(sqlmock.NewRows([]string{"user_id"}).
				AddRow(userID))

		// DELETE query
		mock.ExpectExec(`DELETE FROM budgets`).
			WithArgs(budgetID).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	req := httptest.NewRequest(http.MethodDelete, "/budgets/"+budgetID+"?user_id="+userID, nil)
	req = mux.SetURLVars(req, map[string]string{"id": budgetID})
	rr := httptest.NewRecorder()

	DeleteBudget(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rr.Code, rr.Body.String())
	}
}

// Helper function with budgets DB factory mock
func withBudgetsMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	// Note: CreateBudget doesn't use a factory, so we can't mock it
	// This test helper is for other budget handlers that do use factories
	setup(mock)
}
