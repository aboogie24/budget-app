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
	"github.com/aboogie/budget-backend/models"
)

func TestLoginUser_ValidLogin(t *testing.T) {
	withLoginMockDB(t, func(mock sqlmock.Sqlmock) {
		userID := "11111111-1111-1111-1111-111111111111"
		email := "user@example.com"

		// Create a user to get the hashed password
		user := models.User{
			ID:       userID,
			Email:    email,
			Password: "SecurePassword123",
		}
		user.HashPassword()

		// Fetch user query
		mock.ExpectQuery(`SELECT id, email, COALESCE.full_name`).
			WithArgs(email).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "email", "full_name", "password", "onboarding_complete",
			}).AddRow(
				userID, email, "John Doe", user.Password, false,
			))
	})

	body := map[string]interface{}{
		"email":    "user@example.com",
		"password": "SecurePassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["status"] != "login successful" {
		t.Fatalf("expected status=login successful, got %v", result["status"])
	}

	if result["token"] == "" {
		t.Fatalf("expected token in response")
	}
}

func TestLoginUser_UserNotFound(t *testing.T) {
	withLoginMockDB(t, func(mock sqlmock.Sqlmock) {
		// Fetch user query - user not found
		mock.ExpectQuery(`SELECT id, email, COALESCE.full_name`).
			WithArgs("nonexistent@example.com").
			WillReturnError(sql.ErrNoRows)
	})

	body := map[string]interface{}{
		"email":    "nonexistent@example.com",
		"password": "SomePassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLoginUser_WrongPassword(t *testing.T) {
	withLoginMockDB(t, func(mock sqlmock.Sqlmock) {
		userID := "11111111-1111-1111-1111-111111111111"
		email := "user@example.com"

		// Create a user with correct password hash
		user := models.User{
			ID:       userID,
			Email:    email,
			Password: "CorrectPassword123",
		}
		user.HashPassword()

		// Fetch user query
		mock.ExpectQuery(`SELECT id, email, COALESCE.full_name`).
			WithArgs(email).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "email", "full_name", "password", "onboarding_complete",
			}).AddRow(
				userID, email, "John Doe", user.Password, false,
			))
	})

	body := map[string]interface{}{
		"email":    "user@example.com",
		"password": "WrongPassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLoginUser_MissingEmail(t *testing.T) {
	body := map[string]interface{}{
		"password": "SomePassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLoginUser_MissingPassword(t *testing.T) {
	body := map[string]interface{}{
		"email": "user@example.com",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestLoginUser_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestLoginUser_ReturnsOnboardingStatus(t *testing.T) {
	withLoginMockDB(t, func(mock sqlmock.Sqlmock) {
		userID := "11111111-1111-1111-1111-111111111111"
		email := "user@example.com"

		// Create a user
		user := models.User{
			ID:       userID,
			Email:    email,
			Password: "SecurePassword123",
		}
		user.HashPassword()

		// Fetch user query - onboarding_complete = true
		mock.ExpectQuery(`SELECT id, email, COALESCE.full_name`).
			WithArgs(email).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "email", "full_name", "password", "onboarding_complete",
			}).AddRow(
				userID, email, "John Doe", user.Password, true,
			))
	})

	body := map[string]interface{}{
		"email":    "user@example.com",
		"password": "SecurePassword123",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	LoginUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &result)

	user := result["user"].(map[string]interface{})
	if onboarding := user["onboarding_complete"]; onboarding != true {
		t.Fatalf("expected onboarding_complete=true, got %v", onboarding)
	}
}

func TestLogoutUser_ClearsSession(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/logout", nil)
	rr := httptest.NewRecorder()

	LogoutUser(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

// Helper function with login DB factory mock
func withLoginMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	setup(mock)
}
