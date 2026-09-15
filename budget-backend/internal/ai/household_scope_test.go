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

func TestBudgetDebtSavingsGates(t *testing.T) {
	b := budgetScopeWhere(ScopeHousehold, "$1", "$2", true)
	if !strings.Contains(b, "share_budgets") || !strings.Contains(b, "is_shared") {
		t.Fatalf("budget gate: %s", b)
	}
	d := debtScopeWhere(ScopeHousehold, "$1", "$2", true)
	if !strings.Contains(d, "share_debts") {
		t.Fatalf("debt gate: %s", d)
	}
	s := savingsScopeWhere(ScopeHousehold, "$1", "$2", true)
	if !strings.Contains(s, "share_savings") {
		t.Fatalf("savings gate: %s", s)
	}
}
