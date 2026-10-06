package households

import "strings"

// StarterBudgetNames is the onboarding bootstrap set (case-insensitive).
// Source: budget-app/utils/onboarding.ts DEFAULT_STARTER_EXPENSES + "Take-home".
var StarterBudgetNames = map[string]struct{}{
	"rent/housing": {},
	"groceries":    {},
	"dining out":   {},
	"fun/misc":     {},
	"transport":    {},
	"take-home":    {},
}

// IsStarterBudgetName reports whether name matches a discardable starter budget.
func IsStarterBudgetName(name string) bool {
	_, ok := StarterBudgetNames[strings.ToLower(strings.TrimSpace(name))]
	return ok
}

// StarterBudgetNameList returns sorted names for SQL ANY($1) usage.
func StarterBudgetNameList() []string {
	return []string{
		"rent/housing",
		"groceries",
		"dining out",
		"fun/misc",
		"transport",
		"take-home",
	}
}
