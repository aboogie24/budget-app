package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
)

// mockDB adapts sqlmock's *sql.DB to the db.DBTX interface.
type mockDB struct {
	db *sql.DB
}

func (m *mockDB) Query(q string, args ...interface{}) (*sql.Rows, error) {
	return m.db.Query(q, args...)
}
func (m *mockDB) QueryRow(q string, args ...interface{}) *sql.Row { return m.db.QueryRow(q, args...) }
func (m *mockDB) Exec(q string, args ...interface{}) (sql.Result, error) {
	return m.db.Exec(q, args...)
}
func (m *mockDB) Close() error { return m.db.Close() }
func (m *mockDB) Raw() *sql.DB { return m.db }

func withMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	oldFactory := plannerDBFactory
	plannerDBFactory = func() (db.DBTX, error) { return &mockDB{db: mockSQL}, nil }
	t.Cleanup(func() { plannerDBFactory = oldFactory })

	setup(mock)
}

func TestListDebts_PersonalOnly(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withMockDB(t, func(mock sqlmock.Sqlmock) {

		// Personal debts query.
		rows := sqlmock.NewRows([]string{"id", "user_id", "household_id", "name", "balance", "apr", "min_payment", "due_day", "strategy", "is_shared"}).
			AddRow("d1", userID, "", "Card", 1200.0, 12.5, 45.0, nil, "snowball", false)
		mock.ExpectQuery(`FROM debt_accounts`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/debts?user_id="+url.QueryEscape(userID), nil)
	rr := httptest.NewRecorder()

	ListDebts(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var debts []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &debts); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(debts) != 1 {
		t.Fatalf("unexpected debts payload: %#v", debts)
	}
	if debts[0]["user_id"] != userID || debts[0]["name"] != "Card" {
		t.Fatalf("wrong debt data: %#v", debts[0])
	}
}

func TestListSavingsGoals_WithHousehold(t *testing.T) {
	userID := "22222222-2222-2222-2222-222222222222"
	hhID := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

	withMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))

		rows := sqlmock.NewRows([]string{"id", "user_id", "household_id", "name", "target_amount", "current_amount", "target_date", "priority", "is_shared"}).
			AddRow("g1", userID, hhID, "Trip fund", 5000.0, 1200.0, "2025-12-31", 1, true)
		mock.ExpectQuery(`FROM savings_goals`).
			WithArgs(hhID, userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/savings-goals?user_id="+url.QueryEscape(userID), nil)
	rr := httptest.NewRecorder()

	ListSavingsGoals(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var goals []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &goals); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(goals) != 1 || goals[0]["household_id"] != hhID {
		t.Fatalf("unexpected goals payload: %#v", goals)
	}
}

func TestListDebts_MissingUserID(t *testing.T) {
	// Test that missing user_id parameter returns 400 Bad Request
	req := httptest.NewRequest(http.MethodGet, "/auth/debts", nil)
	rr := httptest.NewRecorder()

	ListDebts(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}

	body := rr.Body.String()
	if body != "Missing or invalid user_id\n" {
		t.Fatalf("unexpected error message: %s", body)
	}
}

func TestListSavingsGoals_PersonalOnly(t *testing.T) {
	userID := "33333333-3333-3333-3333-333333333333"

	withMockDB(t, func(mock sqlmock.Sqlmock) {
		// Household lookup returns no rows => personal only
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// Personal savings goals query
		rows := sqlmock.NewRows([]string{"id", "user_id", "household_id", "name", "target_amount", "current_amount", "target_date", "priority", "is_shared"}).
			AddRow("g1", userID, "", "Emergency Fund", 10000.0, 2500.0, "2026-06-30", 1, false).
			AddRow("g2", userID, "", "Vacation", 3000.0, 500.0, "2025-08-15", 2, false)
		mock.ExpectQuery(`FROM savings_goals`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/savings-goals?user_id="+url.QueryEscape(userID), nil)
	rr := httptest.NewRecorder()

	ListSavingsGoals(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var goals []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &goals); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(goals) != 2 {
		t.Fatalf("expected 2 goals, got %d: %#v", len(goals), goals)
	}
	if goals[0]["name"] != "Emergency Fund" || goals[1]["name"] != "Vacation" {
		t.Fatalf("unexpected goals data: %#v", goals)
	}
}

func TestListDebts_WithHousehold(t *testing.T) {
	userID := "22222222-2222-2222-2222-222222222222"
	hhID := "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

	withMockDB(t, func(mock sqlmock.Sqlmock) {
		// Return debts with household_id populated
		rows := sqlmock.NewRows([]string{"id", "user_id", "household_id", "name", "balance", "apr", "min_payment", "due_day", "strategy", "is_shared"}).
			AddRow("d1", userID, hhID, "Shared Mortgage", 250000.0, 3.5, 1200.0, 1, "avalanche", true).
			AddRow("d2", userID, hhID, "Joint Credit Card", 5000.0, 18.9, 150.0, 15, "snowball", true).
			AddRow("d3", userID, "", "Personal Loan", 8000.0, 7.5, 200.0, 10, "avalanche", false)
		mock.ExpectQuery(`FROM debt_accounts`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/debts?user_id="+url.QueryEscape(userID), nil)
	rr := httptest.NewRecorder()

	ListDebts(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var debts []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &debts); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(debts) != 3 {
		t.Fatalf("expected 3 debts, got %d: %#v", len(debts), debts)
	}

	// Verify household debts
	if debts[0]["household_id"] != hhID || debts[0]["is_shared"] != true {
		t.Fatalf("unexpected first debt: %#v", debts[0])
	}
	if debts[1]["household_id"] != hhID || debts[1]["is_shared"] != true {
		t.Fatalf("unexpected second debt: %#v", debts[1])
	}

	// Verify personal debt has no household_id
	if debts[2]["is_shared"] != false {
		t.Fatalf("unexpected third debt: %#v", debts[2])
	}
}
