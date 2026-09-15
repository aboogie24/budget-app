package ai

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseScopeDefaults(t *testing.T) {
	if got := ParseScope("", ""); got != ScopeMe {
		t.Fatalf("solo default: got %q want %q", got, ScopeMe)
	}
	if got := ParseScope("", "hh-1"); got != ScopeHousehold {
		t.Fatalf("couple default: got %q want %q", got, ScopeHousehold)
	}
	if got := ParseScope("me", "hh-1"); got != ScopeMe {
		t.Fatalf("explicit me: got %q", got)
	}
	if got := ParseScope("household", "hh-1"); got != ScopeHousehold {
		t.Fatalf("explicit household: got %q", got)
	}
	if got := ParseScope("personal", "hh-1"); got != ScopeMe {
		t.Fatalf("personal alias: got %q", got)
	}
	// Solo always me even if client asks for household.
	if got := ParseScope("household", ""); got != ScopeMe {
		t.Fatalf("solo force-me: got %q", got)
	}
}

func TestScopeFromInput(t *testing.T) {
	raw, _ := json.Marshal(map[string]string{"scope": "me"})
	if got := ScopeFromInput(raw, "hh"); got != ScopeMe {
		t.Fatalf("got %q", got)
	}
	if got := ScopeFromInput(nil, "hh"); got != ScopeHousehold {
		t.Fatalf("nil input couple default: got %q", got)
	}
}

func TestPartnerShareSubqueryUsesPrefColumn(t *testing.T) {
	q := partnerShareSubquery("share_transactions", "$2", "$1")
	if !strings.Contains(q, "share_transactions") {
		t.Fatalf("missing pref column: %s", q)
	}
	if !strings.Contains(q, "sharing_preferences") {
		t.Fatalf("missing sharing_preferences join: %s", q)
	}
	if !strings.Contains(q, "household_members") {
		t.Fatalf("missing household_members: %s", q)
	}
}

func TestTxScopeWhereMeVsHousehold(t *testing.T) {
	me := txScopeWhere(ScopeMe, "$1", "$2", true)
	if strings.Contains(me, "share_transactions") {
		t.Fatalf("me scope should not include partner share gate: %s", me)
	}
	hh := txScopeWhere(ScopeHousehold, "$1", "$2", true)
	if !strings.Contains(hh, "share_transactions") {
		t.Fatalf("household scope must gate on share_transactions: %s", hh)
	}
	if !strings.Contains(hh, "household_id::text") {
		t.Fatalf("household scope should include household_id rows: %s", hh)
	}
}

func TestBudgetGatesKeepSharePrefs(t *testing.T) {
	b := budgetScopeWhere(ScopeHousehold, "$1", "$2", true)
	if !strings.Contains(b, "share_budgets") || !strings.Contains(b, "is_shared") {
		t.Fatalf("budget gate: %s", b)
	}
}

func TestDebtSavingsHouseholdMatchesSummary(t *testing.T) {
	// Dashboard Household uses GET /auth/households/summary:
	//   SUM(...) FROM debt_accounts/savings_goals WHERE household_id = $1
	d := debtScopeWhere(ScopeHousehold, "$1", "$2", true)
	if strings.Contains(d, "share_debts") || strings.Contains(d, "is_shared") || strings.Contains(d, "user_id") {
		t.Fatalf("household debt must be household_id-only like /auth/households/summary: %s", d)
	}
	if d != "d.household_id::text = $2" {
		t.Fatalf("expected household_id predicate, got %q", d)
	}

	s := savingsScopeWhere(ScopeHousehold, "$1", "$2", true)
	if strings.Contains(s, "share_savings") || strings.Contains(s, "is_shared") || strings.Contains(s, "user_id") {
		t.Fatalf("household savings must be household_id-only like /auth/households/summary: %s", s)
	}
	if s != "g.household_id::text = $2" {
		t.Fatalf("expected household_id predicate, got %q", s)
	}

	meD := debtScopeWhere(ScopeMe, "$1", "$2", true)
	if meD != "d.user_id = $1" {
		t.Fatalf("me debt: %q", meD)
	}
	meS := savingsScopeWhere(ScopeMe, "$1", "$2", true)
	if meS != "g.user_id = $1" {
		t.Fatalf("me savings: %q", meS)
	}
}

func TestDebtSavingsArgsNoPlaceholderGap(t *testing.T) {
	userP, hhP, args := debtSavingsArgs(ScopeHousehold, "u1", "hh1", true)
	if userP != "$1" || hhP != "$1" || len(args) != 1 || args[0] != "hh1" {
		t.Fatalf("household bind: userP=%s hhP=%s args=%v", userP, hhP, args)
	}
	userP, hhP, args = debtSavingsArgs(ScopeMe, "u1", "hh1", true)
	if userP != "$1" || len(args) != 1 || args[0] != "u1" {
		t.Fatalf("me bind: userP=%s hhP=%s args=%v", userP, hhP, args)
	}
}

func TestScopeMetaMentionsSummarySemantics(t *testing.T) {
	meta := scopeMeta(ScopeHousehold, "hh-1")
	note, _ := meta["scope_note"].(string)
	if !strings.Contains(note, "households/summary") && !strings.Contains(note, "household_id-tagged") {
		t.Fatalf("scope_note should describe summary/household_id debt-savings semantics: %s", note)
	}
}
