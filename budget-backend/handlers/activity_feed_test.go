package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
)

func TestGetActivityFeed_ReturnsPaginatedEvents(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withActivityFeedMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// GetActivityFeed query
		rows := sqlmock.NewRows([]string{
			"id", "household_id", "user_id", "user_name", "event_type",
			"entity_id", "entity_type", "amount", "description", "metadata", "created_at",
		}).AddRow(
			"ae1", householdID, userID, "John Doe", "budget_created",
			"b1", "budget", 500.0, "Created budget: Groceries", sql.NullString{}, time.Now(),
		).AddRow(
			"ae2", householdID, userID, "John Doe", "transaction_added",
			"tx1", "transaction", 25.50, "Added transaction", sql.NullString{}, time.Now(),
		)

		mock.ExpectQuery(`FROM activity_events ae`).
			WithArgs(householdID, 50, 0).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/activity-feed?user_id="+userID+"&limit=50&offset=0", nil)
	rr := httptest.NewRecorder()

	GetActivityFeed(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var events []map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &events); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}

	if events[0]["event_type"] != "budget_created" {
		t.Fatalf("expected event_type=budget_created, got %v", events[0]["event_type"])
	}
}

func TestGetActivityFeed_MissingUserID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/activity-feed", nil)
	rr := httptest.NewRecorder()

	GetActivityFeed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetActivityFeed_UserNotInHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withActivityFeedMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/activity-feed?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetActivityFeed(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetActivityFeed_WithDefaultPagination(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withActivityFeedMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// GetActivityFeed query with default limit=50, offset=0
		rows := sqlmock.NewRows([]string{
			"id", "household_id", "user_id", "user_name", "event_type",
			"entity_id", "entity_type", "amount", "description", "metadata", "created_at",
		})

		mock.ExpectQuery(`FROM activity_events ae`).
			WithArgs(householdID, 50, 0).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/auth/activity-feed?user_id="+userID, nil)
	rr := httptest.NewRecorder()

	GetActivityFeed(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

func TestRecordActivityEvent_ValidRecording(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"

	withActivityFeedMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// INSERT activity event
		mock.ExpectExec(`INSERT INTO activity_events`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	body := map[string]interface{}{
		"user_id":    userID,
		"event_type": "budget_created",
		"entity_id":  "b1",
		"entity_type": "budget",
		"amount":     500.0,
		"description": "Created budget: Groceries",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/activity-feed", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RecordActivityEvent(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["status"] != "ok" {
		t.Fatalf("expected status=ok, got %v", result["status"])
	}
}

func TestRecordActivityEvent_MissingUserID(t *testing.T) {
	body := map[string]interface{}{
		"event_type":  "budget_created",
		"description": "Created budget",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/activity-feed", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RecordActivityEvent(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordActivityEvent_MissingEventType(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"user_id":     userID,
		"description": "Created budget",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/activity-feed", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RecordActivityEvent(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordActivityEvent_MissingDescription(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	body := map[string]interface{}{
		"user_id":    userID,
		"event_type": "budget_created",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/activity-feed", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RecordActivityEvent(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordActivityEvent_UserNotInHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	withActivityFeedMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
	})

	body := map[string]interface{}{
		"user_id":     userID,
		"event_type":  "budget_created",
		"description": "Created budget",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/auth/activity-feed", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RecordActivityEvent(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestRecordActivityEvent_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/auth/activity-feed", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	RecordActivityEvent(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// Helper function with activity feed DB factory mock
func withActivityFeedMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	oldFactory := activityFeedDBFactory
	activityFeedDBFactory = func() (db.DBTX, error) { return &mockDB{db: mockSQL}, nil }
	t.Cleanup(func() { activityFeedDBFactory = oldFactory })

	setup(mock)
}
