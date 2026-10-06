package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/auth"
)

const (
	sentHH    = "11111111-1111-1111-1111-111111111111"
	sentOther = "99999999-9999-9999-9999-999999999999"
)

func sentInvitesReq(t *testing.T, sessionUser, query string) *http.Request {
	t.Helper()
	t.Setenv("JWT_SECRET", "test-secret-c038b")
	req := httptest.NewRequest(http.MethodGet, "/auth/households/invites/sent"+query, nil)
	if sessionUser != "" {
		tok, err := auth.GenerateToken(sessionUser)
		if err != nil {
			t.Fatalf("GenerateToken: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	return req
}

func expectMembership(mock sqlmock.Sqlmock, hh, user string, ok bool) {
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM household_members WHERE household_id = \$1 AND user_id = \$2\)`).
		WithArgs(hh, user).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(ok))
}

func expectAcceptedCol(mock sqlmock.Sqlmock, exists bool) {
	mock.ExpectQuery(`information_schema\.columns`).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(exists))
}

var sentCols = []string{"code", "household_id", "name", "created_by", "created_at", "expires_at", "invitee_email", "inviter_email"}

func decodeInvites(t *testing.T, rr *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var out []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v body=%s", err, rr.Body.String())
	}
	return out
}

func TestListSentInvites_Unauthenticated401(t *testing.T) {
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "", "?user_id=u1"))
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestListSentInvites_InvalidBearer401(t *testing.T) {
	req := sentInvitesReq(t, "", "")
	req.Header.Set("Authorization", "Bearer not-a-jwt")
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

func TestListSentInvites_UserIDMismatch403(t *testing.T) {
	// No DB expectations: must reject before touching the DB.
	withHHMockDB(t, func(sqlmock.Sqlmock) {})
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "attacker", "?user_id=victim&household_id="+sentHH))
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestListSentInvites_InvalidHouseholdID400(t *testing.T) {
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "u1", "?household_id=nope"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestListSentInvites_NonMemberHousehold403(t *testing.T) {
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		expectMembership(mock, sentOther, "attacker", false)
	})
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "attacker", "?user_id=attacker&household_id="+sentOther))
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestListSentInvites_NoHouseholdEmptyList(t *testing.T) {
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members WHERE user_id = \$1`).
			WithArgs("u1").
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}))
	})
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "u1", "?user_id=u1"))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if got := decodeInvites(t, rr); len(got) != 0 {
		t.Fatalf("expected [], got %v", got)
	}
	if rr.Body.String() != "[]\n" {
		t.Fatalf("expected JSON [], got %q", rr.Body.String())
	}
}

func TestListSentInvites_MemberWithHouseholdID_ShapeAndExpiry(t *testing.T) {
	now := time.Now()
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		expectMembership(mock, sentHH, "u1", true)
		expectAcceptedCol(mock, false)
		mock.ExpectQuery(`FROM household_invites i[\s\S]*WHERE i.household_id = \$1\s+ORDER BY`).
			WithArgs(sentHH).
			WillReturnRows(sqlmock.NewRows(sentCols).
				AddRow("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", sentHH, "Home", "u1", now, now.Add(48*time.Hour), "partner@example.com", "me@example.com").
				AddRow("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", sentHH, "Home", "u2", now.Add(-10*24*time.Hour), now.Add(-3*24*time.Hour), "old@example.com", "partner2@example.com"))
	})
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "u1", "?user_id=u1&household_id="+sentHH))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	got := decodeInvites(t, rr)
	if len(got) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(got))
	}
	for _, k := range []string{"code", "household_id", "household_name", "invitee_email", "inviter_email", "expires_at", "created_by", "created_at", "expired"} {
		if _, ok := got[0][k]; !ok {
			t.Fatalf("missing field %q in %v", k, got[0])
		}
	}
	if got[0]["invitee_email"] != "partner@example.com" || got[0]["expired"] != false {
		t.Fatalf("unexpected first invite %v", got[0])
	}
	// Household-wide: invite created by another member is included; expired is flagged not hidden.
	if got[1]["created_by"] != "u2" || got[1]["expired"] != true {
		t.Fatalf("unexpected second invite %v", got[1])
	}
	if _, ok := got[0]["accept_preview"]; ok {
		t.Fatalf("sent list must not carry accept_preview")
	}
}

func TestListSentInvites_ResolvesHouseholdAndHidesAccepted(t *testing.T) {
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members WHERE user_id = \$1`).
			WithArgs("u1").
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(sentHH))
		expectAcceptedCol(mock, true)
		mock.ExpectQuery(`WHERE i.household_id = \$1\s+AND i.accepted_at IS NULL\s+ORDER BY`).
			WithArgs(sentHH).
			WillReturnRows(sqlmock.NewRows(sentCols))
	})
	rr := httptest.NewRecorder()
	// Dashboard call shape: only user_id.
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "u1", "?user_id=u1"))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	if rr.Body.String() != "[]\n" {
		t.Fatalf("expected [], got %q", rr.Body.String())
	}
}

func TestListSentInvites_NoUserIDParamUsesSession(t *testing.T) {
	withHHMockDB(t, func(mock sqlmock.Sqlmock) {
		expectMembership(mock, sentHH, "u1", true)
		expectAcceptedCol(mock, false)
		mock.ExpectQuery(`FROM household_invites i`).WithArgs(sentHH).WillReturnRows(sqlmock.NewRows(sentCols))
	})
	rr := httptest.NewRecorder()
	ListSentHouseholdInvites(rr, sentInvitesReq(t, "u1", "?household_id="+sentHH))
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
}
