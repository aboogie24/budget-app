package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateTransaction_MissingUserID(t *testing.T) {
	body := `{"amount":50,"type":"expense","date":"2025-06-01T00:00:00Z"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateTransaction_ZeroAmount(t *testing.T) {
	body := `{"user_id":"u1","amount":0,"type":"expense","date":"2025-06-01T00:00:00Z"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateTransaction_NegativeAmount(t *testing.T) {
	body := `{"user_id":"u1","amount":-10,"type":"expense","date":"2025-06-01T00:00:00Z"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateTransaction_InvalidType(t *testing.T) {
	body := `{"user_id":"u1","amount":50,"type":"transfer","date":"2025-06-01T00:00:00Z"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateTransaction_MissingDate(t *testing.T) {
	body := `{"user_id":"u1","amount":50,"type":"expense"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreateTransaction_InvalidJSON(t *testing.T) {
	body := `not json`
	req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateTransaction(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestDeleteTransaction_MissingID(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/transactions/", nil)
	rr := httptest.NewRecorder()

	DeleteTransaction(rr, req)

	// The handler splits on "/" and requires segment [2] which would be empty
	// This should still work (attempt to delete empty id) or return an error.
	// We just verify it doesn't panic.
	_ = rr.Code
}

func TestGetTransactions_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/transactions", nil)
	rr := httptest.NewRecorder()

	GetTransactions(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	body := rr.Body.String()
	if !strings.Contains(body, "Missing user_id") {
		t.Fatalf("unexpected error: %s", body)
	}
}

func TestCreateBudget_Validation(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
	}{
		{"missing name", `{"user_id":"u1","amount":100,"type":"expense"}`, 400},
		{"zero amount", `{"user_id":"u1","name":"Rent","amount":0,"type":"expense"}`, 400},
		{"missing user_id", `{"name":"Rent","amount":100,"type":"expense"}`, 400},
		{"invalid type", `{"user_id":"u1","name":"Rent","amount":100,"type":"transfer"}`, 400},
		{"invalid frequency", `{"user_id":"u1","name":"Rent","amount":100,"type":"expense","frequency":"yearly"}`, 400},
		{"invalid JSON", `{not valid`, 400},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/budgets", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			CreateBudget(rr, req)

			if rr.Code != tt.want {
				t.Fatalf("expected %d, got %d: %s", tt.want, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestGetSpendingInsights_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/insights", nil)
	rr := httptest.NewRecorder()

	GetSpendingInsights(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetTopMerchants_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/top-categories", nil)
	rr := httptest.NewRecorder()

	GetTopMerchants(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCreateTransaction_AllValidationMessages(t *testing.T) {
	// Verify specific validation error messages.
	tests := []struct {
		body    string
		errMsg  string
	}{
		{`{"amount":50,"type":"expense","date":"2025-01-01T00:00:00Z"}`, "User ID is required"},
		{`{"user_id":"u1","amount":0,"type":"expense","date":"2025-01-01T00:00:00Z"}`, "Amount must be greater than zero"},
		{`{"user_id":"u1","amount":50,"type":"bad","date":"2025-01-01T00:00:00Z"}`, "Type must be 'income' or 'expense'"},
		{`{"user_id":"u1","amount":50,"type":"expense"}`, "Date is required"},
	}
	for _, tt := range tests {
		t.Run(tt.errMsg, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/auth/transactions", strings.NewReader(tt.body))
			rr := httptest.NewRecorder()
			CreateTransaction(rr, req)
			if rr.Code != 400 {
				t.Fatalf("expected 400, got %d", rr.Code)
			}
			if !strings.Contains(rr.Body.String(), tt.errMsg) {
				t.Fatalf("expected error %q, got %q", tt.errMsg, rr.Body.String())
			}
		})
	}
}

func TestListFinancialPriorities_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/priorities", nil)
	rr := httptest.NewRecorder()

	ListFinancialPriorities(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestReorderFinancialPriorities_EmptyOrder(t *testing.T) {
	body := `{"order":[]}`
	req := httptest.NewRequest(http.MethodPatch, "/auth/priorities/reorder", strings.NewReader(body))
	rr := httptest.NewRecorder()

	ReorderFinancialPriorities(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestReorderFinancialPriorities_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPatch, "/auth/priorities/reorder", strings.NewReader("nope"))
	rr := httptest.NewRecorder()

	ReorderFinancialPriorities(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// Verify JSON response shape helpers.
func mustDecodeJSON(t *testing.T, data []byte, target interface{}) {
	t.Helper()
	if err := json.Unmarshal(data, target); err != nil {
		t.Fatalf("failed to decode JSON: %v\nbody: %s", err, string(data))
	}
}
