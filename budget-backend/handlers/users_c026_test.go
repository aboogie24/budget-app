package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestGetCurrentUser_ReturnsOnboardingFlag(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	withUsersMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT id, email, COALESCE\(full_name`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "email", "full_name", "onboarding_complete", "monthly_budget_goal",
			}).AddRow(userID, "a@example.com", "Ada", true, 3000.0))
	})

	req := httptest.NewRequest(http.MethodGet, "/users/me?user_id="+userID, nil)
	rr := httptest.NewRecorder()
	GetCurrentUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if result["onboarding_complete"] != true {
		t.Fatalf("expected onboarding_complete=true, got %v", result["onboarding_complete"])
	}
	if result["email"] != "a@example.com" {
		t.Fatalf("email=%v", result["email"])
	}
}

func TestGetCurrentUser_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
	rr := httptest.NewRecorder()
	GetCurrentUser(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCompleteOnboarding_ReturnsOnboardingCompleteFlag(t *testing.T) {
	withUsersMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectExec(`UPDATE users`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"user_id":             "11111111-1111-1111-1111-111111111111",
		"monthly_budget_goal": 0,
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/onboarding/complete", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	CompleteOnboarding(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var result map[string]interface{}
	_ = json.Unmarshal(rr.Body.Bytes(), &result)
	if result["onboarding_complete"] != true {
		t.Fatalf("expected onboarding_complete=true, got %v", result)
	}
}
