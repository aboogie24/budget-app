// Package entitlements implements CoupleFlow household Free|Plus plan gates (C031).
// Source of truth is households.plan — not per-user Settings chrome. No billing rails.
package entitlements

import "strings"

const (
	PlanFree = "free"
	PlanPlus = "plus"

	AIModeLight = "light"
	AIModeFull  = "full"

	NudgesInApp     = "in_app"
	NudgesInAppPush = "in_app+push"

	// FreeAIMessageLimit is household user messages per rolling FreeAIWindowDays (C029).
	FreeAIMessageLimit = 10
	FreeAIWindowDays   = 7

	// PlusAIMessageLimit is a high soft abuse ceiling (C029 ~200 / household / mo).
	PlusAIMessageLimit = 200
	PlusAIWindowDays   = 30

	FreeBanksLimit = 1
)

// AIMessageBudget is the rolling household chat budget exposed to clients.
type AIMessageBudget struct {
	Limit      int `json:"limit"`
	Used       int `json:"used"`
	Remaining  int `json:"remaining"`
	WindowDays int `json:"window_days"`
}

// Entitlements is the API contract for Free vs Plus capability.
type Entitlements struct {
	Plan            string          `json:"plan"`
	HouseholdID     string          `json:"household_id,omitempty"`
	BanksLimit      *int            `json:"banks_limit"` // null = unlimited
	BanksUnlimited  bool            `json:"banks_unlimited"`
	BanksUsed       int             `json:"banks_used"`
	AIMode          string          `json:"ai_mode"`
	AIMessageBudget AIMessageBudget `json:"ai_message_budget"`
	Nudges          string          `json:"nudges"`
}

// NormalizePlan maps unknown/empty values to free.
func NormalizePlan(plan string) string {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case PlanPlus:
		return PlanPlus
	default:
		return PlanFree
	}
}

// IsValidPlan reports whether plan is an accepted write value.
func IsValidPlan(plan string) bool {
	p := strings.ToLower(strings.TrimSpace(plan))
	return p == PlanFree || p == PlanPlus
}

// Build constructs entitlements from a resolved household plan and usage counters.
func Build(plan, householdID string, banksUsed, aiUsed int) Entitlements {
	plan = NormalizePlan(plan)
	e := Entitlements{
		Plan:        plan,
		HouseholdID: householdID,
		BanksUsed:   banksUsed,
	}
	if plan == PlanPlus {
		e.BanksLimit = nil
		e.BanksUnlimited = true
		e.AIMode = AIModeFull
		e.Nudges = NudgesInAppPush
		e.AIMessageBudget = budget(PlusAIMessageLimit, aiUsed, PlusAIWindowDays)
		return e
	}
	limit := FreeBanksLimit
	e.BanksLimit = &limit
	e.BanksUnlimited = false
	e.AIMode = AIModeLight
	e.Nudges = NudgesInApp
	e.AIMessageBudget = budget(FreeAIMessageLimit, aiUsed, FreeAIWindowDays)
	return e
}

func budget(limit, used, windowDays int) AIMessageBudget {
	if used < 0 {
		used = 0
	}
	rem := limit - used
	if rem < 0 {
		rem = 0
	}
	return AIMessageBudget{
		Limit:      limit,
		Used:       used,
		Remaining:  rem,
		WindowDays: windowDays,
	}
}

// AllowsBankLink is true when Plus or Free under the 1-account cap.
func AllowsBankLink(e Entitlements) bool {
	if e.BanksUnlimited || e.BanksLimit == nil {
		return true
	}
	return e.BanksUsed < *e.BanksLimit
}

// AllowsAIMessage is true when under the household rolling message budget.
func AllowsAIMessage(e Entitlements) bool {
	return e.AIMessageBudget.Remaining > 0
}

// AllowsPushNudges is true only on Plus.
func AllowsPushNudges(plan string) bool {
	return NormalizePlan(plan) == PlanPlus
}

// IsLightAI is true for Free (read-only tools + weekly cap).
func IsLightAI(plan string) bool {
	return NormalizePlan(plan) == PlanFree
}
