package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestCreateHousehold_CreatesWhenMissing(t *testing.T) {
	body := `{"user_id":"u1","name":"Our money"}`
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs("u1").
			WillReturnError(sql.ErrNoRows)
		mock.ExpectExec(`INSERT INTO households`).
			WithArgs(sqlmock.AnyArg(), "Our money").
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectExec(`INSERT INTO household_members`).
			WithArgs(sqlmock.AnyArg(), "u1").
			WillReturnResult(sqlmock.NewResult(1, 1))
	})

	req := httptest.NewRequest(http.MethodPost, "/households", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	CreateHousehold(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["created"] != true {
		t.Fatalf("expected created=true, got %v", resp["created"])
	}
	if resp["household_id"] == nil || resp["household_id"] == "" {
		t.Fatalf("expected household_id, got %v", resp["household_id"])
	}
}

func TestCreateHousehold_IdempotentWhenExists(t *testing.T) {
	body := `{"user_id":"u1","name":"Ignored"}`
	existing := "22222222-2222-2222-2222-222222222222"
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs("u1").
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(existing))
	})

	req := httptest.NewRequest(http.MethodPost, "/households", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	CreateHousehold(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["created"] != false {
		t.Fatalf("expected created=false, got %v", resp["created"])
	}
	if resp["household_id"] != existing {
		t.Fatalf("expected household_id=%s, got %v", existing, resp["household_id"])
	}
}
