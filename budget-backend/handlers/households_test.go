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
	"github.com/aboogie/budget-backend/middleware"
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
		mock.ExpectQuery(`SELECT EXISTS\(\s*SELECT 1 FROM household_members WHERE household_id = \$1 AND user_id = \$2`).
			WithArgs("11111111-1111-1111-1111-111111111111", "u1").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

		mock.ExpectExec(`INSERT INTO household_invites`).
			WithArgs(sqlmock.AnyArg(), "11111111-1111-1111-1111-111111111111", "u1", sqlmock.AnyArg(), "friend@example.com").
			WillReturnResult(sqlmock.NewResult(1, 1))
	})

	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = middleware.WithAuthenticatedUserID(req, "u1")
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
	req = middleware.WithAuthenticatedUserID(req, "u1")
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
	req = middleware.WithAuthenticatedUserID(req, "u1")
	rr := httptest.NewRecorder()

	CreateHouseholdInvite(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestCreateHouseholdInvite_UserIDMismatchForbidden(t *testing.T) {
	body := `{"user_id":"victim","invitee_email":"friend@example.com","household_id":"11111111-1111-1111-1111-111111111111"}`
	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = middleware.WithAuthenticatedUserID(req, "attacker")
	rr := httptest.NewRecorder()
	CreateHouseholdInvite(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

// C038 N1: caller may not invite into a household they do not belong to.
func TestCreateHouseholdInvite_NonMemberHouseholdForbidden(t *testing.T) {
	victimHH := "99999999-9999-9999-9999-999999999999"
	body := `{"household_id":"` + victimHH + `","invitee_email":"attacker@example.com"}`
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM households WHERE id=\$1\)`).
			WithArgs(victimHH).
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
		mock.ExpectQuery(`SELECT EXISTS\(\s*SELECT 1 FROM household_members WHERE household_id = \$1 AND user_id = \$2`).
			WithArgs(victimHH, "attacker").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	})
	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req = middleware.WithAuthenticatedUserID(req, "attacker")
	rr := httptest.NewRecorder()
	CreateHouseholdInvite(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

// Stale/unknown household_id falls back to the caller's own (session) household.
func TestCreateHouseholdInvite_UnknownHouseholdFallsBackToSession(t *testing.T) {
	stale := "88888888-8888-8888-8888-888888888888"
	own := "22222222-2222-2222-2222-222222222222"
	body := `{"household_id":"` + stale + `","invitee_email":"friend@example.com"}`
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM households WHERE id=\$1\)`).
			WithArgs(stale).
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs("u1").
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(own))
		mock.ExpectExec(`INSERT INTO household_invites`).
			WithArgs(sqlmock.AnyArg(), own, "u1", sqlmock.AnyArg(), "friend@example.com").
			WillReturnResult(sqlmock.NewResult(1, 1))
	})
	req := httptest.NewRequest(http.MethodPost, "/households/invite", strings.NewReader(body))
	req = middleware.WithAuthenticatedUserID(req, "u1")
	rr := httptest.NewRecorder()
	CreateHouseholdInvite(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
}
