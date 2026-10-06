package households

import "github.com/aboogie/budget-backend/internal/entitlements"

// Accept actions for accept_preview (C038 / C037).
const (
	ActionJoin                        = "join"
	ActionAlreadyMember               = "already_member"
	ActionDiscardSolo                 = "discard_solo"
	ActionMigrateSolo                 = "migrate_solo"
	ActionMigrateConfirmationRequired = "migrate_confirmation_required"
	ActionBlockedBanksLimit           = "blocked_banks_limit"
	ActionBlockedMultiMember          = "blocked_multi_member"
)

// AcceptPreview is attached to GET invites and 409 accept responses.
type AcceptPreview struct {
	CurrentHouseholdID     *string      `json:"current_household_id"`
	CurrentIsSolo          bool         `json:"current_is_solo"`
	CurrentIsEmpty         bool         `json:"current_is_empty"`
	RequiresConfirmMigrate bool         `json:"requires_confirm_migrate"`
	Action                 string       `json:"action"`
	Blockers               DataBlockers `json:"blockers"`
	PlanCurrent            string       `json:"plan_current"`
	PlanTarget             string       `json:"plan_target"`
	PlanAfterJoin          string       `json:"plan_after_join"`
}

// BuildAcceptPreview classifies what accept would do for userID against targetID.
func BuildAcceptPreview(q Querier, userID, targetID string) (AcceptPreview, error) {
	preview := AcceptPreview{
		PlanCurrent:   entitlements.PlanFree,
		PlanTarget:    entitlements.PlanFree,
		PlanAfterJoin: entitlements.PlanFree,
		Blockers:      DataBlockers{},
	}

	mem, err := LookupMembership(q, userID, false)
	if err != nil {
		return preview, err
	}

	planTarget, err := GetPlan(q, targetID)
	if err != nil {
		// Target missing → still return a preview with free defaults
		planTarget = entitlements.PlanFree
	}
	preview.PlanTarget = planTarget

	if mem.HouseholdID == "" {
		preview.Action = ActionJoin
		preview.PlanAfterJoin = planTarget
		preview.CurrentIsEmpty = true
		return preview, nil
	}

	hh := mem.HouseholdID
	preview.CurrentHouseholdID = &hh

	if mem.HouseholdID == targetID {
		preview.Action = ActionAlreadyMember
		preview.CurrentIsSolo = mem.IsSolo
		preview.CurrentIsEmpty = true
		preview.PlanCurrent = planTarget
		preview.PlanAfterJoin = planTarget
		return preview, nil
	}

	planCurrent, err := GetPlan(q, mem.HouseholdID)
	if err != nil {
		planCurrent = entitlements.PlanFree
	}
	preview.PlanCurrent = planCurrent
	preview.PlanAfterJoin = MaxPlan(planCurrent, planTarget)

	if !mem.IsSolo {
		preview.Action = ActionBlockedMultiMember
		preview.CurrentIsSolo = false
		preview.CurrentIsEmpty = false
		return preview, nil
	}

	preview.CurrentIsSolo = true
	blockers, err := ClassifySoloEmptiness(q, userID, mem.HouseholdID)
	if err != nil {
		return preview, err
	}
	preview.Blockers = blockers
	preview.CurrentIsEmpty = blockers.IsEmpty()

	if blockers.IsEmpty() {
		preview.Action = ActionDiscardSolo
		return preview, nil
	}

	soloBanks := blockers.LinkedAccounts
	targetBanks, err := CountHouseholdLinkedAccounts(q, targetID)
	if err != nil {
		return preview, err
	}
	if BanksLimitConflict(soloBanks, targetBanks, preview.PlanAfterJoin) {
		preview.Action = ActionBlockedBanksLimit
		return preview, nil
	}

	preview.Action = ActionMigrateSolo
	preview.RequiresConfirmMigrate = true
	return preview, nil
}
