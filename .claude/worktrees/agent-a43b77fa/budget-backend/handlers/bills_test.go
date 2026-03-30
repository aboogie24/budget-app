package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
	"github.com/gorilla/mux"
)

func withBillsMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	oldFactory := billsDBFactory
	billsDBFactory = func() (db.DBTX, error) { return &mockDB{db: mockSQL}, nil }
	t.Cleanup(func() { billsDBFactory = oldFactory })

	setup(mock)
}

func TestListBills_PersonalOnly(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID query — returns no rows (personal only)
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// ListBills query — personal
		rows := sqlmock.NewRows([]string{
			"id", "user_id", "household_id", "name", "amount_due",
			"due_day", "frequency", "payee", "category_id", "debt_account_id",
			"is_autopay", "is_shared",
			"cat_name", "debt_name",
		}).AddRow(
			"b1", userID, "", "Netflix", 15.99,
			1, "monthly", "Netflix Inc", nil, nil,
			true, false,
			"Entertainment", "",
		)
		mock.ExpectQuery(`FROM bills`).
			WithArgs(userID).
			WillReturnRows(rows)

		// Status check for bill b1
		mock.ExpectQuery(`FROM bill_payments`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/bills?user_id="+url.QueryEscape(userID), nil)
	rr := httptest.NewRecorder()

	ListBills(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var bills []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &bills); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(bills) != 1 {
		t.Fatalf("expected 1 bill, got %d: %#v", len(bills), bills)
	}
	if bills[0]["name"] != "Netflix" {
		t.Fatalf("wrong bill name: %v", bills[0]["name"])
	}
	if bills[0]["is_autopay"] != true {
		t.Fatalf("expected is_autopay=true: %#v", bills[0])
	}
}

func TestListBills_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/bills", nil)
	rr := httptest.NewRecorder()

	ListBills(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCreateBill_Basic(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// Insert
		mock.ExpectExec(`INSERT INTO bills`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{
		"user_id":    userID,
		"name":       "Rent",
		"amount_due": 1500.00,
		"due_day":    1,
		"frequency":  "monthly",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/bills", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateBill(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result["name"] != "Rent" {
		t.Fatalf("wrong name: %v", result["name"])
	}
}

func TestCreateBill_ValidationErrors(t *testing.T) {
	tests := []struct {
		name string
		body map[string]any
	}{
		{"missing name", map[string]any{"user_id": "11111111-1111-1111-1111-111111111111", "amount_due": 100, "due_day": 1}},
		{"zero amount", map[string]any{"user_id": "11111111-1111-1111-1111-111111111111", "name": "Test", "amount_due": 0, "due_day": 1}},
		{"due_day too high", map[string]any{"user_id": "11111111-1111-1111-1111-111111111111", "name": "Test", "amount_due": 100, "due_day": 32}},
		{"due_day too low", map[string]any{"user_id": "11111111-1111-1111-1111-111111111111", "name": "Test", "amount_due": 100, "due_day": 0}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
				// Some tests may reach the household lookup
				mock.ExpectQuery(`SELECT household_id FROM household_members`).
					WillReturnError(sql.ErrNoRows)
			})

			b, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/auth/bills", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			CreateBill(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestCreateBill_WithDebtLink(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	debtID := "dddddddd-dddd-dddd-dddd-dddddddddddd"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		mock.ExpectExec(`INSERT INTO bills`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{
		"user_id":         userID,
		"name":            "Car Payment",
		"amount_due":      450.00,
		"due_day":         15,
		"frequency":       "monthly",
		"debt_account_id": debtID,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/bills", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateBill(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	json.Unmarshal(rr.Body.Bytes(), &result)
	if result["debt_account_id"] != debtID {
		t.Fatalf("expected debt_account_id=%s, got %v", debtID, result["debt_account_id"])
	}
}

func TestMarkBillPaid_Basic(t *testing.T) {
	billID := "b1111111-1111-1111-1111-111111111111"
	userID := "11111111-1111-1111-1111-111111111111"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		// Fetch the bill (with category join)
		mock.ExpectQuery(`FROM bills b`).
			WithArgs(billID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "user_id", "household_id", "name", "amount_due",
				"due_day", "frequency", "payee", "category_id", "debt_account_id",
				"is_autopay", "is_shared", "cat_name",
			}).AddRow(
				billID, userID, "", "Rent", 1500.00,
				1, "monthly", "", nil, nil,
				false, false, "",
			))

		// Insert transaction (bill creates expense transaction for budget)
		mock.ExpectExec(`INSERT INTO transactions`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// Insert bill_payment
		mock.ExpectExec(`INSERT INTO bill_payments`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{"amount": 1500.00}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/bills/"+billID+"/pay", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": billID})
	rr := httptest.NewRecorder()

	MarkBillPaid(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	json.Unmarshal(rr.Body.Bytes(), &result)
	if result["status"] != "paid" {
		t.Fatalf("expected status=paid, got %v", result["status"])
	}
}

func TestMarkBillPaid_WithDebtDecrease(t *testing.T) {
	billID := "b1111111-1111-1111-1111-111111111111"
	userID := "11111111-1111-1111-1111-111111111111"
	debtID := "dddddddd-dddd-dddd-dddd-dddddddddddd"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		// Fetch the bill (with debt_account_id and category join)
		mock.ExpectQuery(`FROM bills b`).
			WithArgs(billID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "user_id", "household_id", "name", "amount_due",
				"due_day", "frequency", "payee", "category_id", "debt_account_id",
				"is_autopay", "is_shared", "cat_name",
			}).AddRow(
				billID, userID, "", "Car Payment", 450.00,
				15, "monthly", "", nil, debtID,
				false, false, "",
			))

		// Insert transaction (bill creates expense transaction for budget)
		mock.ExpectExec(`INSERT INTO transactions`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// Insert bill_payment
		mock.ExpectExec(`INSERT INTO bill_payments`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// Debt balance decrease
		mock.ExpectExec(`UPDATE debt_accounts SET balance`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]any{"amount": 450.00}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/bills/"+billID+"/pay", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": billID})
	rr := httptest.NewRecorder()

	MarkBillPaid(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	json.Unmarshal(rr.Body.Bytes(), &result)
	if result["status"] != "paid" {
		t.Fatalf("expected status=paid, got %v", result["status"])
	}
}

func TestDeleteBill(t *testing.T) {
	billID := "b1111111-1111-1111-1111-111111111111"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectExec(`DELETE FROM bills`).
			WithArgs(billID).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	req := httptest.NewRequest(http.MethodDelete, "/auth/bills/"+billID, nil)
	req = mux.SetURLVars(req, map[string]string{"id": billID})
	rr := httptest.NewRecorder()

	DeleteBill(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteBill_NotFound(t *testing.T) {
	billID := "b1111111-1111-1111-1111-111111111111"

	withBillsMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectExec(`DELETE FROM bills`).
			WithArgs(billID).
			WillReturnResult(sqlmock.NewResult(0, 0))
	})

	req := httptest.NewRequest(http.MethodDelete, "/auth/bills/"+billID, nil)
	req = mux.SetURLVars(req, map[string]string{"id": billID})
	rr := httptest.NewRecorder()

	DeleteBill(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
	}
}
