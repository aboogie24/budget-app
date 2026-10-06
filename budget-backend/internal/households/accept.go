package households

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/internal/entitlements"
	"github.com/gofrs/uuid"
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

// errAcceptRestart signals that state read before the household locks went stale
// (a concurrent accept committed first). The whole accept is retried from scratch.
var errAcceptRestart = errors.New("accept: concurrent update, restart")

// maxAcceptAttempts bounds restarts after ErrHouseholdGone / stale membership (N5).
const maxAcceptAttempts = 3

// StatusForAcceptError maps an AcceptInvite error to an HTTP status (400/403/500).
func StatusForAcceptError(err error) int {
	switch {
	case errors.Is(err, ErrInvalidInvite), errors.Is(err, ErrInviteExpired), errors.Is(err, ErrUserNotFound):
		return 400
	case errors.Is(err, ErrInviteWrongEmail):
		return 403
	default:
		return 500
	}
}

// inviteRow is a household_invites row as seen by accept.
type inviteRow struct {
	HouseholdID  string
	Expires      time.Time
	InviteeEmail sql.NullString
	AcceptedAt   sql.NullTime
}

func readInvite(tx *sql.Tx, code string, forUpdate bool) (inviteRow, error) {
	var inv inviteRow
	var expires sql.NullTime
	query := `
		SELECT household_id, expires_at, invitee_email, accepted_at
		FROM household_invites
		WHERE code = $1`
	if forUpdate {
		query += ` FOR UPDATE`
	}
	err := tx.QueryRow(query, code).Scan(&inv.HouseholdID, &expires, &inv.InviteeEmail, &inv.AcceptedAt)
	if expires.Valid {
		inv.Expires = expires.Time
	}
	return inv, err
}

// isMemberOf reports whether userID is a member of householdID.
func isMemberOf(q Querier, userID, householdID string) (bool, error) {
	var ok bool
	err := q.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM household_members WHERE user_id = $1 AND household_id = $2)
	`, userID, householdID).Scan(&ok)
	return ok, err
}

// resolveConsumedInvite answers a re-accept of an already-accepted (tombstoned) invite:
// 200 already_member only if the user is a member of that invite's household, else 400.
func resolveConsumedInvite(tx *sql.Tx, userID string, inv inviteRow) (*AcceptResult, *AcceptConflict, error) {
	ok, err := isMemberOf(tx, userID, inv.HouseholdID)
	if err != nil {
		return nil, nil, err
	}
	if !ok {
		return nil, nil, ErrInvalidInvite
	}
	return alreadyMemberResult(tx, inv.HouseholdID)
}

// AcceptInvite runs the full C038 accept flow in one transaction. If a concurrent accept
// commits first (household row deleted under us, or membership moved), the flow restarts
// with fresh reads instead of surfacing a 500 (N5).
func AcceptInvite(db *sql.DB, req AcceptRequest) (*AcceptResult, *AcceptConflict, error) {
	if strings.TrimSpace(req.Code) == "" || req.UserID == "" {
		return nil, nil, ErrInvalidInvite
	}
	// N2: household_invites.code is UUID; a non-UUID code is simply an invalid invite (400),
	// never a pq "invalid input syntax for type uuid" 500.
	parsed, err := uuid.FromString(strings.TrimSpace(req.Code))
	if err != nil {
		return nil, nil, ErrInvalidInvite
	}
	req.Code = parsed.String()

	for attempt := 1; attempt <= maxAcceptAttempts; attempt++ {
		res, conflict, err := acceptOnce(db, req)
		if errors.Is(err, errAcceptRestart) {
			continue
		}
		return res, conflict, err
	}
	// Still racing after several fresh attempts: the invite is no longer acceptable as-is.
	return nil, nil, ErrInvalidInvite
}

func acceptOnce(db *sql.DB, req AcceptRequest) (*AcceptResult, *AcceptConflict, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = tx.Rollback() }()

	// Soft-read invite (no lock yet) so we can lock households in UUID order first (M5).
	inv, err := readInvite(tx, req.Code, false)
	if err == sql.ErrNoRows {
		// N2: unknown, revoked, or cascade-deleted code → 400. Never infer already_member
		// from whatever household the user happens to be in.
		return nil, nil, ErrInvalidInvite
	}
	if err != nil {
		return nil, nil, err
	}
	if inv.AcceptedAt.Valid {
		return resolveConsumedInvite(tx, req.UserID, inv)
	}
	targetID := inv.HouseholdID

	// Peek membership so we can lock solo + target in fixed order before invite FOR UPDATE.
	memPeek, err := LookupMembership(tx, req.UserID, false)
	if err != nil {
		return nil, nil, err
	}
	if err := LockHouseholdsForUpdate(tx, targetID, memPeek.HouseholdID); err != nil {
		if errors.Is(err, ErrHouseholdGone) {
			// A concurrent accept deleted the solo (or the target went away). Re-read all.
			return nil, nil, errAcceptRestart
		}
		return nil, nil, err
	}

	// Re-lock invite row now that household locks are held.
	inv, err = readInvite(tx, req.Code, true)
	if err == sql.ErrNoRows {
		return nil, nil, ErrInvalidInvite
	}
	if err != nil {
		return nil, nil, err
	}
	if inv.AcceptedAt.Valid {
		// Race: invite consumed between soft-read and lock (parallel double-accept).
		return resolveConsumedInvite(tx, req.UserID, inv)
	}
	targetID = inv.HouseholdID
	if !inv.Expires.IsZero() && inv.Expires.Before(time.Now()) {
		return nil, nil, ErrInviteExpired
	}

	// Email match when set
	if inv.InviteeEmail.Valid && strings.TrimSpace(inv.InviteeEmail.String) != "" {
		var userEmail string
		if err := tx.QueryRow(`SELECT email FROM users WHERE id = $1`, req.UserID).Scan(&userEmail); err != nil {
			if err == sql.ErrNoRows {
				return nil, nil, ErrUserNotFound
			}
			return nil, nil, err
		}
		if strings.ToLower(userEmail) != strings.ToLower(inv.InviteeEmail.String) {
			return nil, nil, ErrInviteWrongEmail
		}
	}

	mem, err := LookupMembership(tx, req.UserID, true)
	if err != nil {
		return nil, nil, err
	}
	if mem.HouseholdID != memPeek.HouseholdID {
		// Membership moved after the unlocked peek: our household locks cover the wrong rows.
		return nil, nil, errAcceptRestart
	}

	// Already on target — idempotent
	if mem.HouseholdID != "" && mem.HouseholdID == targetID {
		if err := ConsumeInvite(tx, req.Code, req.UserID); err != nil {
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
		if err := DiscardSpendingAlertsForStarters(tx, req.UserID); err != nil {
			return nil, nil, fmt.Errorf("discard spending alerts: %w", err)
		}
		if err := DiscardSoloSpendingAlerts(tx, soloID); err != nil {
			return nil, nil, fmt.Errorf("discard solo spending alerts: %w", err)
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
		// N4: only starter-budget alerts; real-budget alerts are re-pointed by the migrate.
		if err := DiscardSpendingAlertsForStarters(tx, req.UserID); err != nil {
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

	if err := ConsumeInvite(tx, req.Code, req.UserID); err != nil {
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
