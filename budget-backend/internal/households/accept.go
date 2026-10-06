package households

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/internal/entitlements"
)

// Accept errors / outcomes.
var (
	ErrInvalidInvite    = errors.New("invalid invite")
	ErrInviteExpired    = errors.New("invite expired")
	ErrInviteWrongEmail = errors.New("invite not intended for this user")
	ErrUserNotFound     = errors.New("user not found")
	ErrMultiMember      = errors.New("blocked_multi_member")
	ErrMigrateConfirm   = errors.New("migrate_confirmation_required")
	ErrBanksLimit       = errors.New("banks_limit_conflict")
)

// AcceptRequest is the POST /auth/households/accept body.
type AcceptRequest struct {
	Code           string
	UserID         string
	ConfirmMigrate bool
}

// AcceptResult is returned on success.
type AcceptResult struct {
	HouseholdID   string
	AlreadyMember bool
	Action        string
	Plan          string
}

// AcceptConflict carries structured 409 payloads.
type AcceptConflict struct {
	Code          string
	ErrLabel      string
	Message       string
	AcceptPreview *AcceptPreview
	Blockers      map[string]any
}

func (c *AcceptConflict) Error() string { return c.Code }

func alreadyMemberResult(tx *sql.Tx, householdID string) (*AcceptResult, *AcceptConflict, error) {
	plan, err := GetPlan(tx, householdID)
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return &AcceptResult{
		HouseholdID:   householdID,
		AlreadyMember: true,
		Action:        ActionAlreadyMember,
		Plan:          plan,
	}, nil, nil
}

// AcceptInvite runs the full C038 accept flow in one transaction.
func AcceptInvite(db *sql.DB, req AcceptRequest) (*AcceptResult, *AcceptConflict, error) {
	if req.Code == "" || req.UserID == "" {
		return nil, nil, ErrInvalidInvite
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = tx.Rollback() }()

	// Soft-read invite (no lock yet) so we can lock households in UUID order first (M5).
	var targetID string
	var expires time.Time
	var inviteeEmail sql.NullString
	err = tx.QueryRow(`
		SELECT household_id, expires_at, invitee_email
		FROM household_invites
		WHERE code = $1
	`, req.Code).Scan(&targetID, &expires, &inviteeEmail)
	if err == sql.ErrNoRows {
		// M4: invite missing/consumed — idempotent if user is already a member (role=member).
		mem, mErr := LookupMembership(tx, req.UserID, true)
		if mErr != nil {
			return nil, nil, mErr
		}
		if mem.HouseholdID != "" && strings.EqualFold(mem.Role, "member") {
			return alreadyMemberResult(tx, mem.HouseholdID)
		}
		return nil, nil, ErrInvalidInvite
	}
	if err != nil {
		return nil, nil, err
	}

	// Peek membership so we can lock solo + target in fixed order before invite FOR UPDATE.
	memPeek, err := LookupMembership(tx, req.UserID, false)
	if err != nil {
		return nil, nil, err
	}
	if err := LockHouseholdsForUpdate(tx, targetID, memPeek.HouseholdID); err != nil {
		return nil, nil, err
	}

	// Re-lock invite row now that household locks are held.
	err = tx.QueryRow(`
		SELECT household_id, expires_at, invitee_email
		FROM household_invites
		WHERE code = $1
		FOR UPDATE
	`, req.Code).Scan(&targetID, &expires, &inviteeEmail)
	if err == sql.ErrNoRows {
		// Race: invite consumed between soft-read and lock (parallel double-accept).
		mem, mErr := LookupMembership(tx, req.UserID, true)
		if mErr != nil {
			return nil, nil, mErr
		}
		if mem.HouseholdID != "" && strings.EqualFold(mem.Role, "member") {
			return alreadyMemberResult(tx, mem.HouseholdID)
		}
		return nil, nil, ErrInvalidInvite
	}
	if err != nil {
		return nil, nil, err
	}
	if !expires.IsZero() && expires.Before(time.Now()) {
		return nil, nil, ErrInviteExpired
	}

	// Email match when set
	if inviteeEmail.Valid && strings.TrimSpace(inviteeEmail.String) != "" {
		var userEmail string
		if err := tx.QueryRow(`SELECT email FROM users WHERE id = $1`, req.UserID).Scan(&userEmail); err != nil {
			if err == sql.ErrNoRows {
				return nil, nil, ErrUserNotFound
			}
			return nil, nil, err
		}
		if strings.ToLower(userEmail) != strings.ToLower(inviteeEmail.String) {
			return nil, nil, ErrInviteWrongEmail
		}
	}

	mem, err := LookupMembership(tx, req.UserID, true)
	if err != nil {
		return nil, nil, err
	}

	// Already on target — idempotent
	if mem.HouseholdID != "" && mem.HouseholdID == targetID {
		if err := DeleteInviteByCode(tx, req.Code); err != nil {
			return nil, nil, err
		}
		return alreadyMemberResult(tx, targetID)
	}

	preview, err := BuildAcceptPreview(tx, req.UserID, targetID)
	if err != nil {
		return nil, nil, err
	}

	// Multi-member block
	if mem.HouseholdID != "" && !mem.IsSolo {
		return nil, &AcceptConflict{
			Code:          ActionBlockedMultiMember,
			ErrLabel:      ActionBlockedMultiMember,
			Message:       "Leave your current household before accepting this invite.",
			AcceptPreview: &preview,
		}, nil
	}

	planSolo := entitlements.PlanFree
	if mem.HouseholdID != "" {
		planSolo, err = GetPlan(tx, mem.HouseholdID)
		if err != nil {
			return nil, nil, err
		}
	}
	planTarget, err := GetPlan(tx, targetID)
	if err != nil {
		return nil, nil, err
	}
	planAfter := MaxPlan(planSolo, planTarget)

	action := ActionJoin
	soloID := mem.HouseholdID

	if soloID != "" {
		// Re-classify emptiness inside the txn
		blockers, err := ClassifySoloEmptiness(tx, req.UserID, soloID)
		if err != nil {
			return nil, nil, err
		}
		preview.Blockers = blockers
		preview.CurrentIsEmpty = blockers.IsEmpty()
		preview.PlanCurrent = planSolo
		preview.PlanTarget = planTarget
		preview.PlanAfterJoin = planAfter

		if blockers.IsEmpty() {
			action = ActionDiscardSolo
		} else {
			soloBanks := blockers.LinkedAccounts
			targetBanks, err := CountHouseholdLinkedAccounts(tx, targetID)
			if err != nil {
				return nil, nil, err
			}
			if BanksLimitConflict(soloBanks, targetBanks, planAfter) {
				preview.Action = ActionBlockedBanksLimit
				return nil, &AcceptConflict{
					Code:          "banks_limit_conflict",
					ErrLabel:      "solo_household_has_data",
					Message:       "Unlink a bank account before joining, or upgrade either household to Plus.",
					AcceptPreview: &preview,
					Blockers: map[string]any{
						"linked_accounts":   soloBanks,
						"target_banks_used": targetBanks,
						"plan_after_join":   planAfter,
					},
				}, nil
			}
			if !req.ConfirmMigrate {
				preview.Action = ActionMigrateConfirmationRequired
				preview.RequiresConfirmMigrate = true
				return nil, &AcceptConflict{
					Code:          "migrate_confirmation_required",
					ErrLabel:      "migrate_confirmation_required",
					Message:       "Accepting this invite moves your existing household data into the partner household. Confirm to continue.",
					AcceptPreview: &preview,
				}, nil
			}
			action = ActionMigrateSolo
		}
	}

	// Execute path
	switch action {
	case ActionJoin:
		if err := JoinAsMember(tx, req.UserID, targetID); err != nil {
			return nil, nil, err
		}
	case ActionDiscardSolo:
		if err := DiscardSpendingAlertsForStarters(tx, req.UserID, soloID); err != nil {
			return nil, nil, fmt.Errorf("discard spending alerts: %w", err)
		}
		if err := DiscardStarterBudgets(tx, req.UserID); err != nil {
			return nil, nil, fmt.Errorf("discard starters: %w", err)
		}
		if err := DeleteOutboundInvites(tx, soloID); err != nil {
			return nil, nil, err
		}
		if err := MoveMembership(tx, req.UserID, soloID, targetID); err != nil {
			return nil, nil, err
		}
		if _, err := tx.Exec(`DELETE FROM sharing_preferences WHERE household_id = $1`, soloID); err != nil {
			return nil, nil, fmt.Errorf("delete sharing_preferences: %w", err)
		}
		if err := DeleteHouseholdIfEmpty(tx, soloID); err != nil {
			return nil, nil, err
		}
	case ActionMigrateSolo:
		if err := DiscardSpendingAlertsForStarters(tx, req.UserID, soloID); err != nil {
			return nil, nil, fmt.Errorf("discard spending alerts: %w", err)
		}
		if err := DiscardStarterBudgets(tx, req.UserID); err != nil {
			return nil, nil, fmt.Errorf("discard starters: %w", err)
		}
		if err := MigrateSoloToHousehold(tx, req.UserID, soloID, targetID); err != nil {
			return nil, nil, err
		}
		if err := DeleteOutboundInvites(tx, soloID); err != nil {
			return nil, nil, err
		}
		if err := MoveMembership(tx, req.UserID, soloID, targetID); err != nil {
			return nil, nil, err
		}
		if _, err := tx.Exec(`DELETE FROM sharing_preferences WHERE household_id = $1`, soloID); err != nil {
			return nil, nil, fmt.Errorf("delete sharing_preferences: %w", err)
		}
		if err := DeleteHouseholdIfEmpty(tx, soloID); err != nil {
			return nil, nil, err
		}
	}

	// Plan resolution: Plus wins
	if planAfter == entitlements.PlanPlus && planTarget != entitlements.PlanPlus {
		if err := SetPlan(tx, targetID, entitlements.PlanPlus); err != nil {
			return nil, nil, err
		}
	}

	if err := DeleteInviteByCode(tx, req.Code); err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}

	return &AcceptResult{
		HouseholdID:   targetID,
		AlreadyMember: false,
		Action:        action,
		Plan:          planAfter,
	}, nil, nil
}
