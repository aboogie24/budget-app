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
	"github.com/aboogie/budget-backend/db"
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
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email", "accepted_at"}).
				AddRow(targetID, expires, nil, nil))
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
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email", "accepted_at"}).
				AddRow(targetID, expires, nil, nil))
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
		for i := 0; i < 14; i++ {
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
		for i := 0; i < 14; i++ {
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
		for i := 0; i < 15; i++ {
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
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email", "accepted_at"}).
				AddRow(targetID, expires, nil, nil))
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
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email", "accepted_at"}).
				AddRow(targetID, expires, nil, nil))
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(targetID, "member"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(targetID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
		mock.ExpectExec(`UPDATE household_invites\s+SET accepted_at`).
			WithArgs(code, userID).
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
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email", "accepted_at"}).
				AddRow(targetID, expires, nil, nil))
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
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email", "accepted_at"}).
				AddRow(targetID, expires, nil, nil))
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
		for i := 0; i < 13; i++ {
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
		for i := 0; i < 13; i++ {
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

// N2: unknown code → 400 (never already_member); non-UUID code → 400 without hitting the DB.
func TestAcceptHouseholdInvite_UnknownAndGarbageCode400(t *testing.T) {
	const userID = "11111111-1111-1111-1111-111111111111"
	const code = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectBegin()
		mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
			WithArgs(code).
			WillReturnError(sql.ErrNoRows)
		mock.ExpectRollback()
	})
	for _, c := range []string{code, "not-a-uuid"} {
		body := `{"code":"` + c + `"}`
		req := withAuth(httptest.NewRequest(http.MethodPost, "/households/accept", strings.NewReader(body)), userID)
		rr := httptest.NewRecorder()
		AcceptHouseholdInvite(rr, req)
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("code=%s expected 400, got %d body=%s", c, rr.Code, rr.Body.String())
		}
	}
}

// N1: household-scoped routes reject a body/query user_id that is not the session user.
func TestHouseholdScopedRoutes_UserIDSpoofForbidden(t *testing.T) {
	const victim = "99999999-9999-9999-9999-999999999999"
	const attacker = "11111111-1111-1111-1111-111111111111"
	cases := []struct {
		name    string
		handler http.HandlerFunc
		method  string
		target  string
		body    string
	}{
		{"households_create", CreateHousehold, http.MethodPost, "/households", `{"user_id":"` + victim + `"}`},
		{"households_me", GetHouseholdForUser, http.MethodGet, "/households/me?user_id=" + victim, ""},
		{"households_summary", GetHouseholdSummary, http.MethodGet, "/households/summary?user_id=" + victim, ""},
		{"entitlements", GetEntitlements, http.MethodGet, "/entitlements?user_id=" + victim, ""},
		{"sharing_get", GetSharingPreferences, http.MethodGet, "/sharing-preferences?user_id=" + victim, ""},
		{"sharing_post", UpsertSharingPreferences, http.MethodPost, "/sharing-preferences", `{"user_id":"` + victim + `","share_budgets":false}`},
		{"budgets_bootstrap", BootstrapBudgets, http.MethodPost, "/budgets/bootstrap", `{"user_id":"` + victim + `","expenses":[{"name":"Groceries","amount":1}]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// No DB expectations: the handler must reject before any query.
			withHHMockDB(t, func(sqlmock.Sqlmock) {})
			req := withAuth(httptest.NewRequest(tc.method, tc.target, strings.NewReader(tc.body)), attacker)
			rr := httptest.NewRecorder()
			tc.handler(rr, req)
			if rr.Code != http.StatusForbidden {
				t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
			}
		})
	}
}

// N1: no authenticated user → 401 on household-scoped routes.
func TestHouseholdScopedRoutes_NoAuth401(t *testing.T) {
	for name, h := range map[string]http.HandlerFunc{
		"me": GetHouseholdForUser, "summary": GetHouseholdSummary, "entitlements": GetEntitlements, "sharing_get": GetSharingPreferences,
	} {
		t.Run(name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			h(rr, httptest.NewRequest(http.MethodGet, "/x?user_id=u1", nil))
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d", rr.Code)
			}
		})
	}
}

// N1: summary for a household_id the caller does not belong to → 403.
func TestGetHouseholdSummary_NonMemberHouseholdForbidden(t *testing.T) {
	const attacker = "11111111-1111-1111-1111-111111111111"
	const victimHH = "99999999-9999-9999-9999-999999999999"
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT EXISTS\(\s*SELECT 1 FROM household_members WHERE household_id = \$1 AND user_id = \$2`).
			WithArgs(victimHH, attacker).
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	})
	req := withAuth(httptest.NewRequest(http.MethodGet, "/households/summary?household_id="+victimHH, nil), attacker)
	rr := httptest.NewRecorder()
	GetHouseholdSummary(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

// N1: sharing prefs write scoped to a household the caller does not belong to → 403.
func TestUpsertSharingPreferences_NonMemberHouseholdForbidden(t *testing.T) {
	const attacker = "11111111-1111-1111-1111-111111111111"
	const victimHH = "99999999-9999-9999-9999-999999999999"
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	old := sharingDBFactory
	sharingDBFactory = func() (db.DBTX, error) { return &hhMockDB{db: sqlDB}, nil }
	defer func() { sharingDBFactory = old }()
	mock.ExpectQuery(`SELECT EXISTS\(\s*SELECT 1 FROM household_members WHERE household_id = \$1 AND user_id = \$2`).
		WithArgs(victimHH, attacker).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	body := `{"household_id":"` + victimHH + `","share_budgets":false}`
	req := withAuth(httptest.NewRequest(http.MethodPost, "/sharing-preferences", strings.NewReader(body)), attacker)
	rr := httptest.NewRecorder()
	UpsertSharingPreferences(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

// Ensure sql.ErrNoRows still referenced for compile in this file's package tests.
var _ = sql.ErrNoRows
