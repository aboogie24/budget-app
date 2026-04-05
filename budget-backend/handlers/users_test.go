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

func TestRegisterUser_ValidRegistration(t *testing.T) {
	withUsersMockDB(t, func(mock sqlmock.Sqlmock) {
		// Check for existing user
		mock.ExpectQuery(`SELECT id FROM users WHERE email = `).
			WithArgs("newuser@example.com").
			WillReturnError(sql.ErrNoRows)

		// INSERT new user
		mock.ExpectExec(`INSERT INTO users`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"id":       "11111111-1111-1111-1111-111111111111",
		"email":    "newuser@example.com",
		"password": "SecurePassword123",
		"full_name": "John Doe",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RegisterUser(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["status"] != "user registered" {
		t.Fatalf("expected status=user registered, got %v", result["status"])
	}
}

func TestRegisterUser_DuplicateEmail(t *testing.T) {
	withUsersMockDB(t, func(mock sqlmock.Sqlmock) {
		// Check for existing user - returns existing ID
		mock.ExpectQuery(`SELECT id FROM users WHERE email = `).
			WithArgs("existing@example.com").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).
				AddRow("22222222-2222-2222-2222-222222222222"))
	})

	body := map[string]interface{}{
		"id":       "11111111-1111-1111-1111-111111111111",
		"email":    "existing@example.com",
		"password": "SecurePassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RegisterUser(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRegisterUser_InvalidEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
	}{
		{"empty email", ""},
		{"invalid format", "not-an-email"},
		{"no domain", "user@"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]interface{}{
				"id":       "11111111-1111-1111-1111-111111111111",
				"email":    tc.email,
				"password": "SecurePassword123",
			}
			b, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			RegisterUser(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestRegisterUser_PasswordTooShort(t *testing.T) {
	body := map[string]interface{}{
		"id":       "11111111-1111-1111-1111-111111111111",
		"email":    "user@example.com",
		"password": "short",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RegisterUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRegisterUser_MissingUserID(t *testing.T) {
	body := map[string]interface{}{
		"email":    "user@example.com",
		"password": "SecurePassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RegisterUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestRegisterUser_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RegisterUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCompleteOnboarding_Success(t *testing.T) {
	withUsersMockDB(t, func(mock sqlmock.Sqlmock) {
		// UPDATE user
		mock.ExpectExec(`UPDATE users`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"user_id":              "11111111-1111-1111-1111-111111111111",
		"monthly_budget_goal": 3000.0,
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
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["status"] != "onboarding complete" {
		t.Fatalf("expected status=onboarding complete, got %v", result["status"])
	}
}

func TestCompleteOnboarding_MissingUserID(t *testing.T) {
	body := map[string]interface{}{
		"monthly_budget_goal": 3000.0,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/onboarding/complete", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CompleteOnboarding(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCompleteOnboarding_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/onboarding/complete", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CompleteOnboarding(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// Helper function with users DB factory mock
func withUsersMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}

	cleanup := db.OverridePool(mockSQL)
	t.Cleanup(func() {
		cleanup()
		mockSQL.Close()
	})

	setup(mock)
}
