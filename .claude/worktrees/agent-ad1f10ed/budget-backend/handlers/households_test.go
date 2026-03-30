package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
)

// mockDB adapts sqlmock to db.DBTX.
type hhMockDB struct {
	db *sql.DB
}

func (m *hhMockDB) Query(q string, args ...interface{}) (*sql.Rows, error) {
	return m.db.Query(q, args...)
}
func (m *hhMockDB) QueryRow(q string, args ...interface{}) *sql.Row { return m.db.QueryRow(q, args...) }
func (m *hhMockDB) Exec(q string, args ...interface{}) (sql.Result, error) {
	return m.db.Exec(q, args...)
}
func (m *hhMockDB) Close() error { return m.db.Close() }
func (m *hhMockDB) Raw() *sql.DB { return m.db }

func withHHMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { sqlDB.Close() })

	old := householdDBFactory
	householdDBFactory = func() (db.DBTX, error) { return &hhMockDB{db: sqlDB}, nil }
	t.Cleanup(func() { householdDBFactory = old })

	setup(mock)
}

func TestCreateHouseholdInviteSuccess(t *testing.T) {
	body := `{"user_id":"u1","household_id":"11111111-1111-1111-1111-111111111111","invitee_email":"friend@example.com"}`
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM households WHERE id=\$1\)`).
			WithArgs("11111111-1111-1111-1111-111111111111").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

		mock.ExpectExec(`INSERT INTO household_invites`).
			WithArgs(sqlmock.AnyArg(), "11111111-1111-1111-1111-111111111111", "u1", sqlmock.AnyArg(), "friend@example.com").
			WillReturnResult(sqlmock.NewResult(1, 1))
	})

	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateHouseholdInvite(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
}

func TestCreateHouseholdInviteMissingHousehold(t *testing.T) {
	body := `{"user_id":"u1","invitee_email":"friend@example.com"}`
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs("u1").
			WillReturnError(sql.ErrNoRows)
	})

	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateHouseholdInvite(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestCreateHouseholdInviteResolveHouseholdFromMembership(t *testing.T) {
	body := `{"user_id":"u1","invitee_email":"friend@example.com"}`
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs("u1").
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow("22222222-2222-2222-2222-222222222222"))

		mock.ExpectExec(`INSERT INTO household_invites`).
			WithArgs(sqlmock.AnyArg(), "22222222-2222-2222-2222-222222222222", "u1", sqlmock.AnyArg(), "friend@example.com").
			WillReturnResult(sqlmock.NewResult(1, 1))
	})

	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateHouseholdInvite(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
}
