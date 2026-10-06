package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/internal/households"
	"github.com/aboogie/budget-backend/middleware"
)

func withAuth(req *http.Request, userID string) *http.Request {
	return middleware.WithAuthenticatedUserID(req, userID)
}

func TestAcceptHouseholdInvite_MigrateConfirmRequired(t *testing.T) {
	const (
		userID   = "11111111-1111-1111-1111-111111111111"
		soloID   = "22222222-2222-2222-2222-222222222222"
		targetID = "33333333-3333-3333-3333-333333333333"
		code     = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	)
	expires := time.Now().Add(24 * time.Hour)

	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectBegin()
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
				AddRow(targetID, expires, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT id FROM households WHERE id`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(soloID))
		mock.ExpectQuery(`SELECT id FROM households WHERE id`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(targetID))
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
				AddRow(targetID, expires, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		for i := 0; i < 10; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		for i := 0; i < 10; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectRollback()
	})

	body := `{"code":"` + code + `","user_id":"` + userID + `"}`
	req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body)), userID)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["code"] != "migrate_confirmation_required" {
		t.Fatalf("code=%v", resp["code"])
	}
	preview, ok := resp["accept_preview"].(map[string]any)
	if !ok {
		t.Fatalf("missing accept_preview: %v", resp)
	}
	if preview["action"] != households.ActionMigrateConfirmationRequired &&
		preview["action"] != households.ActionMigrateSolo {
		if preview["requires_confirm_migrate"] != true {
			t.Fatalf("preview=%v", preview)
		}
	}
}

func TestListHouseholdInvites_IncludesAcceptPreview(t *testing.T) {
	const (
		userID   = "11111111-1111-1111-1111-111111111111"
		soloID   = "22222222-2222-2222-2222-222222222222"
		targetID = "33333333-3333-3333-3333-333333333333"
		code     = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	)
	expires := time.Now().Add(24 * time.Hour)
	email := "b@example.com"

	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT email FROM users`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"email"}).AddRow(email))
		mock.ExpectQuery(`SELECT i.code, i.household_id`).
			WithArgs(email).
			WillReturnRows(sqlmock.NewRows([]string{
				"code", "household_id", "name", "created_by", "expires_at", "invitee_email", "inviter_email",
			}).AddRow(code, targetID, "A's house", "owner1", expires, email, "a@example.com"))

		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		for i := 0; i < 11; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
	})

	req := withAuth(httptest.NewRequest(http.MethodGet, "/households/invites?user_id="+userID, nil), userID)
	rr := httptest.NewRecorder()
	ListHouseholdInvites(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var invites []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &invites); err != nil {
		t.Fatal(err)
	}
	if len(invites) != 1 {
		t.Fatalf("len=%d", len(invites))
	}
	preview, ok := invites[0]["accept_preview"].(map[string]any)
	if !ok {
		t.Fatalf("missing accept_preview: %v", invites[0])
	}
	if preview["action"] != households.ActionDiscardSolo {
		t.Fatalf("action=%v want discard_solo", preview["action"])
	}
	if preview["current_is_solo"] != true {
		t.Fatalf("current_is_solo=%v", preview["current_is_solo"])
	}
}

func TestAcceptHouseholdInvite_AlreadyMember(t *testing.T) {
	const (
		userID   = "11111111-1111-1111-1111-111111111111"
		targetID = "33333333-3333-3333-3333-333333333333"
		code     = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	)
	expires := time.Now().Add(24 * time.Hour)

	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectBegin()
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
				AddRow(targetID, expires, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(targetID, "member"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
		mock.ExpectQuery(`SELECT id FROM households WHERE id`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(targetID))
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
				AddRow(targetID, expires, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(targetID, "member"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
		mock.ExpectExec(`DELETE FROM household_invites WHERE code`).
			WithArgs(code).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectCommit()
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	body := `{"code":"` + code + `","user_id":"` + userID + `"}`
	req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body)), userID)
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["already_member"] != true {
		t.Fatalf("resp=%v", resp)
	}
	if _, ok := resp["entitlements"]; !ok {
		t.Fatalf("missing entitlements: %v", resp)
	}
}

func TestAcceptHouseholdInvite_InvalidBody(t *testing.T) {
	req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(`{}`)), "u1")
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestAcceptHouseholdInvite_UserIDMismatchForbidden(t *testing.T) {
	body := `{"code":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","user_id":"victim"}`
	req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body)), "attacker")
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestAcceptHouseholdInvite_BanksLimitBodyShape(t *testing.T) {
	const (
		userID   = "11111111-1111-1111-1111-111111111111"
		soloID   = "22222222-2222-2222-2222-222222222222"
		targetID = "33333333-3333-3333-3333-333333333333"
		code     = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	)
	expires := time.Now().Add(24 * time.Hour)

	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectBegin()
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
				AddRow(targetID, expires, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT id FROM households WHERE id`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(soloID))
		mock.ExpectQuery(`SELECT id FROM households WHERE id`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(targetID))
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
				AddRow(targetID, expires, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		// preview
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		for i := 0; i < 9; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		// reclassify
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		for i := 0; i < 9; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectRollback()
	})

	body := `{"code":"` + code + `","user_id":"` + userID + `","confirm_migrate":true}`
	req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body)), userID)
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp["code"] != "banks_limit_conflict" {
		t.Fatalf("code=%v", resp["code"])
	}
	blockers, ok := resp["blockers"].(map[string]any)
	if !ok {
		t.Fatalf("missing blockers: %v", resp)
	}
	for _, key := range []string{"linked_accounts", "target_banks_used", "plan_after_join"} {
		if _, ok := blockers[key]; !ok {
			t.Fatalf("blockers missing %s: %v", key, blockers)
		}
	}
}

func TestAcceptHouseholdInvite_NonBooleanConfirmMigrate409(t *testing.T) {
	const userID = "11111111-1111-1111-1111-111111111111"
	body := `{"code":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","user_id":"` + userID + `","confirm_migrate":"true"}`
	req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body)), userID)
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestListHouseholdInvites_UserIDMismatchForbidden(t *testing.T) {
	req := withAuth(httptest.NewRequest(http.MethodGet, "/households/invites?user_id=victim", nil), "attacker")
	rr := httptest.NewRecorder()
	ListHouseholdInvites(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}
}

// Ensure sql.ErrNoRows still referenced for compile in this file's package tests.
var _ = sql.ErrNoRows
