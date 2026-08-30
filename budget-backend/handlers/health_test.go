package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
)

func healthMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()
	mockSQL, mock, err := sqlmock.New(sqlmock.MonitorPingsOption(true))
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	cleanup := db.OverridePool(mockSQL)
	t.Cleanup(func() {
		cleanup()
		mockSQL.Close()
	})
	return mock
}

func TestHealthCheck_OK(t *testing.T) {
	mock := healthMockDB(t)
	mock.ExpectPing()

	rr := httptest.NewRecorder()
	HealthCheck(rr, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["status"] != "ok" || resp["version"] != Version {
		t.Fatalf("unexpected body: %v", resp)
	}
}

func TestHealthCheck_DatabaseDown(t *testing.T) {
	mock := healthMockDB(t)
	mock.ExpectPing().WillReturnError(fmt.Errorf("connection refused"))

	rr := httptest.NewRecorder()
	HealthCheck(rr, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp map[string]string
	json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["status"] != "degraded" {
		t.Fatalf("unexpected body: %v", resp)
	}
}
