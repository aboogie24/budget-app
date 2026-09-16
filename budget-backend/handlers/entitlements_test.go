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
	"github.com/aboogie/budget-backend/internal/entitlements"
)

func withEntMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	cleanup := db.OverridePool(mockSQL)
	t.Cleanup(func() {
		cleanup()
		mockSQL.Close()
	})
	setup(mock)
}

func TestGetEntitlements_FreeHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	hhID := "22222222-2222-2222-2222-222222222222"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.FreeAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	})

	req := httptest.NewRequest(http.MethodGet, "/entitlements?user_id="+userID, nil)
	rr := httptest.NewRecorder()
	GetEntitlements(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var ent entitlements.Entitlements
	if err := json.Unmarshal(rr.Body.Bytes(), &ent); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if ent.Plan != "free" || ent.AIMode != "light" || ent.Nudges != "in_app" {
		t.Fatalf("ent=%+v", ent)
	}
	if ent.BanksLimit == nil || *ent.BanksLimit != 1 {
		t.Fatalf("banks_limit=%v", ent.BanksLimit)
	}
	if ent.AIMessageBudget.Used != 2 || ent.AIMessageBudget.Remaining != 8 {
		t.Fatalf("budget=%+v", ent.AIMessageBudget)
	}
}

func TestGetEntitlements_PlusHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	hhID := "22222222-2222-2222-2222-222222222222"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.PlusAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(4))
	})

	req := httptest.NewRequest(http.MethodGet, "/entitlements?user_id="+userID, nil)
	rr := httptest.NewRecorder()
	GetEntitlements(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var ent entitlements.Entitlements
	_ = json.Unmarshal(rr.Body.Bytes(), &ent)
	if ent.Plan != "plus" || ent.AIMode != "full" || ent.Nudges != "in_app+push" {
		t.Fatalf("ent=%+v", ent)
	}
	if !ent.BanksUnlimited || ent.BanksLimit != nil {
		t.Fatalf("expected unlimited banks: %+v", ent)
	}
}

func TestSetHouseholdPlan_DevFlag(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	hhID := "22222222-2222-2222-2222-222222222222"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectExec(`UPDATE households SET plan`).
			WithArgs("plus", hhID).
			WillReturnResult(sqlmock.NewResult(0, 1))
		// ResolveForHousehold
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.PlusAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	body := `{"user_id":"` + userID + `","plan":"plus"}`
	req := httptest.NewRequest(http.MethodPut, "/households/plan", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	SetHouseholdPlan(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["plan"] != "plus" {
		t.Fatalf("resp=%v", resp)
	}
}

func TestCheckBankLinkAllowed_BlocksFreeAtCap(t *testing.T) {
	userID := "u1"
	hhID := "h1"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.FreeAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	conn, err := db.New()
	if err != nil {
		t.Fatal(err)
	}
	rr := httptest.NewRecorder()
	if checkBankLinkAllowed(rr, conn.Raw(), userID) {
		t.Fatal("expected block")
	}
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code=%d", rr.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &body)
	if body["code"] != "banks_limit" {
		t.Fatalf("body=%v", body)
	}
}

func TestCheckBankLinkAllowed_AllowsPlus(t *testing.T) {
	userID := "u1"
	hhID := "h1"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.PlusAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	})

	conn, _ := db.New()
	rr := httptest.NewRecorder()
	if !checkBankLinkAllowed(rr, conn.Raw(), userID) {
		t.Fatalf("expected allow, body=%s", rr.Body.String())
	}
}

func TestCheckAIMessageAllowed_BlocksFreeAtCap(t *testing.T) {
	userID := "u1"
	hhID := "h1"
	withEntMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).AddRow(hhID))
		mock.ExpectQuery(`SELECT COALESCE\(plan`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
			WithArgs(hhID).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM ai_messages`).
			WithArgs(hhID, entitlements.FreeAIWindowDays).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))
	})

	conn, _ := db.New()
	rr := httptest.NewRecorder()
	_, ok := checkAIMessageAllowed(rr, conn.Raw(), userID)
	if ok {
		t.Fatal("expected block")
	}
	if rr.Code != http.StatusForbidden {
		t.Fatalf("code=%d", rr.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &body)
	if body["code"] != "ai_message_budget" {
		t.Fatalf("body=%v", body)
	}
}

func TestAllowsPushNudges_FreeVsPlus(t *testing.T) {
	if entitlements.AllowsPushNudges("free") {
		t.Fatal("free")
	}
	if !entitlements.AllowsPushNudges("plus") {
		t.Fatal("plus")
	}
	_ = sql.ErrNoRows // silence unused if build tags shift
}
