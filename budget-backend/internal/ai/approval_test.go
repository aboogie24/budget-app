package ai

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestMutatingToolsCoverAllWriteTools(t *testing.T) {
	// Every write tool wired in ExecuteTool must be in MutatingTools, or it
	// would execute without user approval.
	for _, name := range []string{
		"create_savings_goal", "update_savings_goal", "create_budget",
		"log_transaction", "create_financial_plan", "create_category",
		"assign_transaction_category", "upsert_category_rule",
	} {
		if !MutatingTools[name] {
			t.Errorf("write tool %q missing from MutatingTools — it would bypass approval", name)
		}
	}
	for _, name := range []string{"get_financial_snapshot", "web_search", "remember_fact", "assess_savings_goal"} {
		if MutatingTools[name] {
			t.Errorf("read-only tool %q should not require approval", name)
		}
	}
}

func TestSummarizeAction(t *testing.T) {
	cases := []struct {
		tool  string
		input string
		want  string
	}{
		{"create_savings_goal", `{"name":"Jamaica","target_amount":4200,"target_date":"2026-12-01"}`, `Create savings goal "Jamaica" with a $4200 target by 2026-12-01`},
		{"assign_transaction_category", `{"merchant":"starbucks","category_name":"Dining Out"}`, `Categorize all "starbucks" transactions as "Dining Out"`},
		{"upsert_category_rule", `{"merchant":"starbucks","category_name":"Dining Out"}`, `Rule: always categorize "starbucks" as "Dining Out"`},
		{"log_transaction", `{"type":"expense","amount":45.5,"note":"dinner"}`, `Log expense of $45.50 — "dinner"`},
	}
	for _, tc := range cases {
		got := SummarizeAction(tc.tool, json.RawMessage(tc.input))
		if got != tc.want {
			t.Errorf("%s: got %q want %q", tc.tool, got, tc.want)
		}
	}
	if s := SummarizeAction("future_tool", json.RawMessage(`{}`)); !strings.Contains(s, "future_tool") {
		t.Errorf("unknown tool fallback should name the tool, got %q", s)
	}
}
