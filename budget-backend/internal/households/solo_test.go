package households

import (
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/internal/entitlements"
	"github.com/lib/pq"
)

func TestIsStarterBudgetName(t *testing.T) {
	cases := []struct {
		name string
		want bool
	}{
		{"Rent/housing", true},
		{"  GROCERIES ", true},
		{"Take-home", true},
		{"Dining out", true},
		{"Fun/misc", true},
		{"Transport", true},
		{"Custom vacation", false},
		{"", false},
	}
	for _, tc := range cases {
		if got := IsStarterBudgetName(tc.name); got != tc.want {
			t.Errorf("IsStarterBudgetName(%q)=%v want %v", tc.name, got, tc.want)
		}
	}
}

func TestMaxPlan(t *testing.T) {
	cases := []struct{ a, b, want string }{
		{"free", "free", "free"},
		{"plus", "free", "plus"},
		{"free", "plus", "plus"},
		{"plus", "plus", "plus"},
		{"", "free", "free"},
		{"PLUS", "free", "plus"},
	}
	for _, tc := range cases {
		if got := MaxPlan(tc.a, tc.b); got != tc.want {
			t.Errorf("MaxPlan(%q,%q)=%q want %q", tc.a, tc.b, got, tc.want)
		}
	}
}

func TestBanksLimitConflict(t *testing.T) {
	cases := []struct {
		name         string
		solo, target int
		planAfter    string
		want         bool
	}{
		{"free both one", 1, 1, "free", true},
		{"free solo one target zero", 1, 0, "free", false},
		{"free solo zero", 0, 1, "free", false},
		{"plus both one", 1, 1, "plus", false},
		{"free solo two target zero", 2, 0, "free", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := BanksLimitConflict(tc.solo, tc.target, tc.planAfter)
			if got != tc.want {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}

func TestClassifySoloEmptiness_Empty(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	userID, soloID := "u1", "solo1"
	for i := 0; i < 11; i++ {
		mock.ExpectQuery(`SELECT COUNT\(\*\)`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	}

	b, err := ClassifySoloEmptiness(db, userID, soloID)
	if err != nil {
		t.Fatal(err)
	}
	if !b.IsEmpty() {
		t.Fatalf("expected empty, got %+v", b)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestClassifySoloEmptiness_HasTxn(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	for i := 0; i < 10; i++ {
		mock.ExpectQuery(`SELECT COUNT\(\*\)`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	}

	b, err := ClassifySoloEmptiness(db, "u1", "solo1")
	if err != nil {
		t.Fatal(err)
	}
	if b.IsEmpty() || b.Transactions != 1 {
		t.Fatalf("expected non-empty with 1 txn, got %+v", b)
	}
}

func expectEmptinessAllZero(mock sqlmock.Sqlmock) {
	for i := 0; i < 11; i++ {
		mock.ExpectQuery(`SELECT COUNT\(\*\)`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	}
}

func expectEmptinessWithBanks(mock sqlmock.Sqlmock, banks int) {
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(banks))
	for i := 0; i < 9; i++ {
		mock.ExpectQuery(`SELECT COUNT\(\*\)`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	}
}

func expectEmptinessWithTxns(mock sqlmock.Sqlmock, txns int) {
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM transactions`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(txns))
	for i := 0; i < 10; i++ {
		mock.ExpectQuery(`SELECT COUNT\(\*\)`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	}
}

func TestBuildAcceptPreview_Table(t *testing.T) {
	const (
		userID   = "11111111-1111-1111-1111-111111111111"
		soloID   = "22222222-2222-2222-2222-222222222222"
		targetID = "33333333-3333-3333-3333-333333333333"
		otherID  = "44444444-4444-4444-4444-444444444444"
	)

	tests := []struct {
		name        string
		setup       func(sqlmock.Sqlmock)
		wantAction  string
		wantConfirm bool
	}{
		{
			name: "join_no_household",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnError(sql.ErrNoRows)
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
			},
			wantAction: ActionJoin,
		},
		{
			name: "already_member",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(targetID, "member"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
			},
			wantAction: ActionAlreadyMember,
		},
		{
			name: "discard_solo",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessAllZero(mock)
			},
			wantAction: ActionDiscardSolo,
		},
		{
			name: "migrate_solo",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessWithTxns(mock, 1)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
			},
			wantAction:  ActionMigrateSolo,
			wantConfirm: true,
		},
		{
			name: "blocked_banks_limit",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessWithBanks(mock, 1)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
			},
			wantAction: ActionBlockedBanksLimit,
		},
		{
			name: "blocked_multi_member",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(otherID, "owner"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(otherID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).
					WithArgs(otherID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
			},
			wantAction: ActionBlockedMultiMember,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			tc.setup(mock)
			preview, err := BuildAcceptPreview(db, userID, targetID)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if preview.Action != tc.wantAction {
				t.Fatalf("action=%s want %s preview=%+v", preview.Action, tc.wantAction, preview)
			}
			if preview.RequiresConfirmMigrate != tc.wantConfirm {
				t.Fatalf("requires_confirm=%v want %v", preview.RequiresConfirmMigrate, tc.wantConfirm)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func expectHouseholdLocks(mock sqlmock.Sqlmock, ids ...string) {
	uniq := append([]string{}, ids...)
	// sort like LockHouseholdsForUpdate
	for i := 0; i < len(uniq); i++ {
		for j := i + 1; j < len(uniq); j++ {
			if uniq[j] < uniq[i] {
				uniq[i], uniq[j] = uniq[j], uniq[i]
			}
		}
	}
	seen := map[string]bool{}
	for _, id := range uniq {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		mock.ExpectQuery(`SELECT id FROM households WHERE id`).
			WithArgs(id).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(id))
	}
}

func expectAcceptInviteLockSequence(mock sqlmock.Sqlmock, code, targetID, userID, memHH, role string, memberCount int, expires time.Time, inviteeEmail any) {
	expectAcceptInviteLockSequenceOpts(mock, code, targetID, userID, memHH, role, memberCount, expires, inviteeEmail, true)
}

func expectAcceptInviteLockSequenceOpts(mock sqlmock.Sqlmock, code, targetID, userID, memHH, role string, memberCount int, expires time.Time, inviteeEmail any, lockMember bool) {
	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
		WithArgs(code).
		WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
			AddRow(targetID, expires, inviteeEmail))
	if memHH == "" {
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
		expectHouseholdLocks(mock, targetID)
	} else {
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(memHH, role))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(memHH).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(memberCount))
		expectHouseholdLocks(mock, targetID, memHH)
	}
	mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
		WithArgs(code).
		WillReturnRows(sqlmock.NewRows([]string{"household_id", "expires_at", "invitee_email"}).
			AddRow(targetID, expires, inviteeEmail))
	if !lockMember {
		return
	}
	if memHH == "" {
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)
	} else {
		mock.ExpectQuery(`SELECT household_id`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(memHH, role))
		mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
			WithArgs(memHH).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(memberCount))
	}
}

func TestAcceptInvite_Table(t *testing.T) {
	const (
		userID   = "11111111-1111-1111-1111-111111111111"
		soloID   = "22222222-2222-2222-2222-222222222222"
		targetID = "33333333-3333-3333-3333-333333333333"
		otherID  = "44444444-4444-4444-4444-444444444444"
		code     = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
	)
	expires := time.Now().Add(24 * time.Hour)

	type want struct {
		statusOK      bool
		alreadyMember bool
		action        string
		conflictCode  string
		errIs         error
	}

	tests := []struct {
		name    string
		confirm bool
		setup   func(sqlmock.Sqlmock)
		want    want
	}{
		{
			name: "empty_discard",
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequence(mock, code, targetID, userID, soloID, "owner", 1, expires, nil)
				// BuildAcceptPreview
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
				expectEmptinessAllZero(mock)
				// plans again in accept
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessAllZero(mock)
				mock.ExpectExec(`DELETE FROM spending_alerts`).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(`DELETE FROM budgets`).
					WithArgs(userID, pq.Array(StarterBudgetNameList())).
					WillReturnResult(sqlmock.NewResult(0, 3))
				mock.ExpectExec(`DELETE FROM household_invites WHERE household_id`).
					WithArgs(soloID).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(`DELETE FROM household_members`).
					WithArgs(userID, soloID).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`INSERT INTO household_members`).
					WithArgs(targetID, userID).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`DELETE FROM sharing_preferences`).
					WithArgs(soloID).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(`DELETE FROM households`).
					WithArgs(soloID).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`DELETE FROM household_invites WHERE code`).
					WithArgs(code).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectCommit()
			},
			want: want{statusOK: true, action: ActionDiscardSolo},
		},
		{
			name:    "migrate_with_confirm",
			confirm: true,
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequence(mock, code, targetID, userID, soloID, "owner", 1, expires, nil)
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(soloID, "owner"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
				expectEmptinessWithTxns(mock, 2)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessWithTxns(mock, 2)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
				mock.ExpectExec(`DELETE FROM spending_alerts`).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(`DELETE FROM budgets`).
					WillReturnResult(sqlmock.NewResult(0, 0))
				// migrate updates: budgets, txns, 14 user/hh tables, financial_plans, spending_alerts, ai, sharing = 20
				for i := 0; i < 20; i++ {
					mock.ExpectExec(`UPDATE`).
						WillReturnResult(sqlmock.NewResult(0, 1))
				}
				mock.ExpectExec(`DELETE FROM household_invites WHERE household_id`).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(`DELETE FROM household_members`).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`INSERT INTO household_members`).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`DELETE FROM sharing_preferences`).
					WillReturnResult(sqlmock.NewResult(0, 0))
				mock.ExpectExec(`DELETE FROM households`).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`UPDATE households SET plan`).
					WithArgs(entitlements.PlanPlus, targetID).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectExec(`DELETE FROM household_invites WHERE code`).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectCommit()
			},
			want: want{statusOK: true, action: ActionMigrateSolo},
		},
		{
			name:    "migrate_without_confirm",
			confirm: false,
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequence(mock, code, targetID, userID, soloID, "owner", 1, expires, nil)
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
				expectEmptinessWithTxns(mock, 1)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessWithTxns(mock, 1)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
				mock.ExpectRollback()
			},
			want: want{conflictCode: "migrate_confirmation_required"},
		},
		{
			name:    "banks_limit_conflict",
			confirm: true,
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequence(mock, code, targetID, userID, soloID, "owner", 1, expires, nil)
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
				expectEmptinessWithBanks(mock, 1)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(soloID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				expectEmptinessWithBanks(mock, 1)
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM linked_accounts la`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
				mock.ExpectRollback()
			},
			want: want{conflictCode: "banks_limit_conflict"},
		},
		{
			name: "already_member",
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequence(mock, code, targetID, userID, targetID, "member", 2, expires, nil)
				mock.ExpectExec(`DELETE FROM household_invites WHERE code`).
					WithArgs(code).
					WillReturnResult(sqlmock.NewResult(0, 1))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectCommit()
			},
			want: want{statusOK: true, alreadyMember: true, action: ActionAlreadyMember},
		},
		{
			name: "multi_member_409",
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequence(mock, code, targetID, userID, otherID, "owner", 2, expires, nil)
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(otherID, "owner"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(otherID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(otherID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("free"))
				mock.ExpectRollback()
			},
			want: want{conflictCode: ActionBlockedMultiMember},
		},
		{
			name: "unknown_code_400",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectBegin()
				mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
					WithArgs(code).
					WillReturnError(sql.ErrNoRows)
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnError(sql.ErrNoRows)
				mock.ExpectRollback()
			},
			want: want{errIs: ErrInvalidInvite},
		},
		{
			name: "reaccept_consumed_invite_already_member",
			setup: func(mock sqlmock.Sqlmock) {
				mock.ExpectBegin()
				mock.ExpectQuery(`SELECT household_id, expires_at, invitee_email`).
					WithArgs(code).
					WillReturnError(sql.ErrNoRows)
				mock.ExpectQuery(`SELECT household_id`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"household_id", "role"}).AddRow(targetID, "member"))
				mock.ExpectQuery(`SELECT COUNT\(\*\) FROM household_members`).
					WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
				mock.ExpectQuery(`SELECT COALESCE\(plan`).WithArgs(targetID).
					WillReturnRows(sqlmock.NewRows([]string{"plan"}).AddRow("plus"))
				mock.ExpectCommit()
			},
			want: want{statusOK: true, alreadyMember: true, action: ActionAlreadyMember},
		},
		{
			name: "expired_400",
			setup: func(mock sqlmock.Sqlmock) {
				past := time.Now().Add(-time.Hour)
				expectAcceptInviteLockSequenceOpts(mock, code, targetID, userID, soloID, "owner", 1, past, nil, false)
				mock.ExpectRollback()
			},
			want: want{errIs: ErrInviteExpired},
		},
		{
			name: "email_mismatch_403",
			setup: func(mock sqlmock.Sqlmock) {
				expectAcceptInviteLockSequenceOpts(mock, code, targetID, userID, soloID, "owner", 1, expires, "other@example.com", false)
				mock.ExpectQuery(`SELECT email FROM users`).
					WithArgs(userID).
					WillReturnRows(sqlmock.NewRows([]string{"email"}).AddRow("b@example.com"))
				mock.ExpectRollback()
			},
			want: want{errIs: ErrInviteWrongEmail},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			tc.setup(mock)

			result, conflict, err := AcceptInvite(db, AcceptRequest{
				Code:           code,
				UserID:         userID,
				ConfirmMigrate: tc.confirm,
			})
			if tc.want.errIs != nil {
				if !errors.Is(err, tc.want.errIs) {
					t.Fatalf("err=%v want %v conflict=%v result=%v", err, tc.want.errIs, conflict, result)
				}
			} else if tc.want.conflictCode != "" {
				if conflict == nil {
					t.Fatalf("expected conflict %s, err=%v result=%v", tc.want.conflictCode, err, result)
				}
				if conflict.Code != tc.want.conflictCode {
					t.Fatalf("conflict code=%s want %s", conflict.Code, tc.want.conflictCode)
				}
				if conflict.AcceptPreview == nil {
					t.Fatal("expected accept_preview on conflict")
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected err: %v", err)
				}
				if conflict != nil {
					t.Fatalf("unexpected conflict: %+v", conflict)
				}
				if result == nil {
					t.Fatal("nil result")
				}
				if result.AlreadyMember != tc.want.alreadyMember {
					t.Fatalf("already_member=%v want %v", result.AlreadyMember, tc.want.alreadyMember)
				}
				if result.Action != tc.want.action {
					t.Fatalf("action=%s want %s", result.Action, tc.want.action)
				}
				if result.HouseholdID != targetID {
					t.Fatalf("household_id=%s", result.HouseholdID)
				}
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
