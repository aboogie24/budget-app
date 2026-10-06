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
)

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
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(soloID))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(soloID))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		for i := 0; i < 6; i++ {
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
		for i := 0; i < 6; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectRollback()
	})

	body := `{"code":"` + code + `","user_id":"` + userID + `"}`
	req := httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body))
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
		// AcceptInvite sets action to migrate_confirmation_required on 409
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

		// BuildAcceptPreview for discard_solo
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(soloID))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		for i := 0; i < 7; i++ {
			mock.ExpectQuery(`SELECT COUNT\(\*\)`).
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		}
	})

	req := httptest.NewRequest(http.MethodGet, "/households/invites?user_id="+userID, nil)
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
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(targetID))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
		mock.ExpectExec(`DELETE FROM household_invites WHERE code`).
			WithArgs(code).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectCommit()
		// entitlements resolve after accept
		mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	body := `{"code":"` + code + `","user_id":"` + userID + `"}`
	req := httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body))
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
}

func TestAcceptHouseholdInvite_InvalidBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	AcceptHouseholdInvite(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// Ensure sql.ErrNoRows still referenced for compile in this file's package tests.
var _ = sql.ErrNoRows
