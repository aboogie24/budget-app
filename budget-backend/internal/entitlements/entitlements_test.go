package entitlements

import "testing"

func TestBuild_FreeDefaults(t *testing.T) {
	e := Build(PlanFree, "hh1", 0, 3)
	if e.Plan != PlanFree {
		t.Fatalf("plan=%s", e.Plan)
	}
	if e.BanksLimit == nil || *e.BanksLimit != 1 {
		t.Fatalf("banks_limit=%v", e.BanksLimit)
	}
	if e.BanksUnlimited {
		t.Fatal("expected banks not unlimited")
	}
	if e.AIMode != AIModeLight {
		t.Fatalf("ai_mode=%s", e.AIMode)
	}
	if e.Nudges != NudgesInApp {
		t.Fatalf("nudges=%s", e.Nudges)
	}
	if e.AIMessageBudget.Limit != FreeAIMessageLimit || e.AIMessageBudget.WindowDays != FreeAIWindowDays {
		t.Fatalf("budget=%+v", e.AIMessageBudget)
	}
	if e.AIMessageBudget.Used != 3 || e.AIMessageBudget.Remaining != 7 {
		t.Fatalf("used/remaining=%+v", e.AIMessageBudget)
	}
}

func TestBuild_PlusUnlimited(t *testing.T) {
	e := Build(PlanPlus, "hh1", 5, 12)
	if e.Plan != PlanPlus {
		t.Fatalf("plan=%s", e.Plan)
	}
	if e.BanksLimit != nil || !e.BanksUnlimited {
		t.Fatalf("expected unlimited banks, limit=%v unlimited=%v", e.BanksLimit, e.BanksUnlimited)
	}
	if e.AIMode != AIModeFull {
		t.Fatalf("ai_mode=%s", e.AIMode)
	}
	if e.Nudges != NudgesInAppPush {
		t.Fatalf("nudges=%s", e.Nudges)
	}
	if e.AIMessageBudget.Limit != PlusAIMessageLimit || e.AIMessageBudget.WindowDays != PlusAIWindowDays {
		t.Fatalf("budget=%+v", e.AIMessageBudget)
	}
}

func TestAllowsBankLink_FreeCap(t *testing.T) {
	under := Build(PlanFree, "hh", 0, 0)
	at := Build(PlanFree, "hh", 1, 0)
	plus := Build(PlanPlus, "hh", 9, 0)
	if !AllowsBankLink(under) {
		t.Fatal("free with 0 banks should allow link")
	}
	if AllowsBankLink(at) {
		t.Fatal("free with 1 bank must block")
	}
	if !AllowsBankLink(plus) {
		t.Fatal("plus should allow multi-bank")
	}
}

func TestAllowsAIMessage_FreeCap(t *testing.T) {
	ok := Build(PlanFree, "hh", 0, 9)
	block := Build(PlanFree, "hh", 0, 10)
	if !AllowsAIMessage(ok) {
		t.Fatal("9/10 should allow")
	}
	if AllowsAIMessage(block) {
		t.Fatal("10/10 should block")
	}
}

func TestAllowsPushNudges(t *testing.T) {
	if AllowsPushNudges(PlanFree) {
		t.Fatal("free must not push")
	}
	if !AllowsPushNudges(PlanPlus) {
		t.Fatal("plus must allow push")
	}
}

func TestNormalizePlan(t *testing.T) {
	if NormalizePlan("PLUS") != PlanPlus {
		t.Fatal("PLUS")
	}
	if NormalizePlan("") != PlanFree {
		t.Fatal("empty")
	}
	if NormalizePlan("pro") != PlanFree {
		t.Fatal("unknown → free")
	}
}
