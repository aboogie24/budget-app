package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/internal/entitlements"
)

func TestWithBankLinkGate_BlocksFreeAtCap(t *testing.T) {
	userID := "u1"
	hhID := "h1"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.FreeAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	called := false
	h := WithBankLinkGate(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/link_token?user_id="+userID, nil)
	rr := httptest.NewRecorder()
	h(rr, req)
	if called {
		t.Fatal("next handler must not run when Free bank cap is hit")
	}
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code=%d body=%s", rr.Code, rr.Body.String())
	}
}

func TestWithBankLinkGate_AllowsUnderCap(t *testing.T) {
	userID := "u1"
	hhID := "h1"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.FreeAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	called := false
	h := WithBankLinkGate(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})
	req := httptest.NewRequest(http.MethodGet, "/link_token?user_id="+userID, nil)
	rr := httptest.NewRecorder()
	h(rr, req)
	if !called {
		t.Fatal("expected next handler")
	}
	if rr.Code != http.StatusNoContent {
		t.Fatalf("code=%d", rr.Code)
	}
}
