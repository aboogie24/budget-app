package ai

import "testing"

func TestGetToolDefinitionsForMode_LightExcludesWritesAndSearch(t *testing.T) {
	tools := GetToolDefinitionsForMode("light")
	names := map[string]bool{}
	for _, tool := range tools {
		names[tool.Name] = true
	}
	for _, need := range []string{"get_financial_snapshot", "get_debts", "get_savings_goals", "get_spending_by_category", "get_bills", "remember_fact"} {
		if !names[need] {
			t.Fatalf("light missing %s", need)
		}
	}
	for _, ban := range []string{"create_budget", "log_transaction", "create_financial_plan", "web_search", "create_savings_goal"} {
		if names[ban] {
			t.Fatalf("light must not include %s", ban)
		}
	}
}

func TestGetToolDefinitionsForMode_FullIncludesMutations(t *testing.T) {
	tools := GetToolDefinitionsForMode("full")
	names := map[string]bool{}
	for _, tool := range tools {
		names[tool.Name] = true
	}
	if !names["create_budget"] {
		t.Fatal("full should include create_budget")
	}
}
