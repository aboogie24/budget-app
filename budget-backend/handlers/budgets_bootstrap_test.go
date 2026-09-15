package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestBootstrapBudgets_CreatesExpensesAndIncome(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	hhID := "22222222-2222-2222-2222-222222222222"
	income := 5000.0

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// EnsureHouseholdForUser → ResolveHouseholdID hit
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))

		// expense lookup miss + insert (x2)
		for range 2 {
			mock.ExpectQuery(`SELECT id FROM budgets`).
				WillReturnError(sql.ErrNoRows)
			mock.ExpectExec(`INSERT INTO budgets`).
				WillReturnResult(sqlmock.NewResult(0, 1))
		}
		// income lookup miss + insert
		mock.ExpectQuery(`SELECT id FROM budgets`).
			WillReturnError(sql.ErrNoRows)
		mock.ExpectExec(`INSERT INTO budgets`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{
		"user_id": userID,
		"income":  income,
		"expenses": []map[string]any{
			{"name": "Rent/housing", "amount": 1800},
			{"name": "Groceries", "amount": 600},
		},
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/budgets/bootstrap", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	BootstrapBudgets(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["household_id"] != hhID {
		t.Fatalf("household_id=%v", resp["household_id"])
	}
	budgets, ok := resp["budgets"].([]any)
	if !ok || len(budgets) != 3 {
		t.Fatalf("expected 3 budgets, got %v", resp["budgets"])
	}
	if int(resp["created_count"].(float64)) != 3 {
		t.Fatalf("created_count=%v", resp["created_count"])
	}
}

func TestBootstrapBudgets_IdempotentUpdatesExisting(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	hhID := "22222222-2222-2222-2222-222222222222"
	existingBudget := "b1111111-1111-1111-1111-111111111111"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))

		mock.ExpectQuery(`SELECT id FROM budgets`).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(existingBudget))
		mock.ExpectExec(`UPDATE budgets`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{
		"user_id": userID,
		"expenses": []map[string]any{
			{"name": "Groceries", "amount": 650},
		},
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/budgets/bootstrap", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	BootstrapBudgets(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if int(resp["created_count"].(float64)) != 0 {
		t.Fatalf("expected created_count=0, got %v", resp["created_count"])
	}
	budgets := resp["budgets"].([]any)
	first := budgets[0].(map[string]any)
	if first["id"] != existingBudget {
		t.Fatalf("expected existing id, got %v", first["id"])
	}
	if first["created"] != false {
		t.Fatalf("expected created=false")
	}
}

func TestBootstrapBudgets_RejectsEmpty(t *testing.T) {
	body := map[string]any{
		"user_id":  "11111111-1111-1111-1111-111111111111",
		"expenses": []map[string]any{},
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/budgets/bootstrap", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	BootstrapBudgets(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestBootstrapBudgets_EnsuresHouseholdWhenMissing(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withBudgetsMockDB(t, func(mock sqlmock.Sqlmock) {
		// Resolve miss → create household + member
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
		mock.ExpectExec(`INSERT INTO households`).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec(`INSERT INTO household_members`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		mock.ExpectQuery(`SELECT id FROM budgets`).
			WillReturnError(sql.ErrNoRows)
		mock.ExpectExec(`INSERT INTO budgets`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{
		"user_id": userID,
		"expenses": []map[string]any{
			{"name": "Transport", "amount": 200},
		},
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/budgets/bootstrap", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	BootstrapBudgets(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}
