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
)

func TestGetSupportedCurrencies_ReturnsCompleteList(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/currencies", nil)
	rr := httptest.NewRecorder()

	GetSupportedCurrencies(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var currencies []map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &currencies); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(currencies) == 0 {
		t.Fatalf("expected at least one currency")
	}

	// Verify some expected currencies exist
	expectedCodes := []string{"USD", "EUR", "GBP"}
	found := make(map[string]bool)
	for _, c := range currencies {
		code := c["Code"].(string)
		for _, exp := range expectedCodes {
			if code == exp {
				found[exp] = true
			}
		}
	}

	for _, code := range expectedCodes {
		if !found[code] {
			t.Fatalf("expected currency %s not found", code)
		}
	}
}

func TestGetUserCurrency_ReturnsHouseholdDefault(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withCurrenciesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// Get household currency
		mock.ExpectQuery(`SELECT COALESCE.default_currency`).
			WithArgs(householdID).
			WillReturnRows(sqlmock.NewRows([]string{"default_currency"}).
				AddRow("EUR"))
	})

	req := httptest.NewRequest(http.MethodGet, "/currencies/user?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetUserCurrency(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["currency"] != "EUR" {
		t.Fatalf("expected currency=EUR, got %v", result["currency"])
	}

	if result["source"] != "household" {
		t.Fatalf("expected source=household, got %v", result["source"])
	}
}

func TestGetUserCurrency_FallsBackToUserDefault(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withCurrenciesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty (no household)
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// Get user currency
		mock.ExpectQuery(`SELECT COALESCE.default_currency`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"default_currency"}).
				AddRow("GBP"))
	})

	req := httptest.NewRequest(http.MethodGet, "/currencies/user?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetUserCurrency(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["currency"] != "GBP" {
		t.Fatalf("expected currency=GBP, got %v", result["currency"])
	}

	if result["source"] != "user" {
		t.Fatalf("expected source=user, got %v", result["source"])
	}
}

func TestGetUserCurrency_DefaultsToUSD(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withCurrenciesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// Get user currency - returns NULL, defaults to USD
		mock.ExpectQuery(`SELECT COALESCE.default_currency`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"default_currency"}).
				AddRow("USD"))
	})

	req := httptest.NewRequest(http.MethodGet, "/currencies/user?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetUserCurrency(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var result map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &result)
	if result["currency"] != "USD" {
		t.Fatalf("expected default currency USD, got %v", result["currency"])
	}
}

func TestGetUserCurrency_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/currencies/user", nil)
	rr := httptest.NewRecorder()

	GetUserCurrency(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestSetUserCurrency_UpdatesUserCurrency(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withCurrenciesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// UPDATE user currency
		mock.ExpectExec(`UPDATE users`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"user_id":  userID,
		"currency": "EUR",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/currencies/user", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	SetUserCurrency(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["status"] != "ok" {
		t.Fatalf("expected status=ok, got %v", result["status"])
	}

	if result["currency"] != "EUR" {
		t.Fatalf("expected currency=EUR, got %v", result["currency"])
	}
}

func TestSetUserCurrency_UpdatesHouseholdCurrency(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withCurrenciesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// UPDATE household currency
		mock.ExpectExec(`UPDATE households`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"user_id":  userID,
		"currency": "JPY",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/currencies/user", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	SetUserCurrency(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["currency"] != "JPY" {
		t.Fatalf("expected currency=JPY, got %v", result["currency"])
	}
}

func TestSetUserCurrency_MissingCurrency(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"user_id": userID,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/currencies/user", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	SetUserCurrency(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSetUserCurrency_MissingUserID(t *testing.T) {
	body := map[string]interface{}{
		"currency": "EUR",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/currencies/user", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	SetUserCurrency(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSetUserCurrency_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/currencies/user", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	SetUserCurrency(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// Helper function with currencies DB factory mock
func withCurrenciesMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	setup(mock)
}
