package households

import (
	"fmt"

	"github.com/lib/pq"
)

// DiscardStarterBudgets deletes onboarding starter budgets for the user (category_id IS NULL).
func DiscardStarterBudgets(q Querier, userID string) error {
	_, err := q.Exec(`
		DELETE FROM budgets
		WHERE user_id = $1
		  AND category_id IS NULL
		  AND LOWER(TRIM(name)) = ANY($2)
	`, userID, pq.Array(StarterBudgetNameList()))
	return err
}

// MigrateSoloToHousehold re-points solo/user-scoped rows to target and cleans solo.
// Caller must already have discarded starters and validated eligibility.
func MigrateSoloToHousehold(q Querier, userID, soloID, targetID string) error {
	// Non-starter budgets: re-point household_id
	if _, err := q.Exec(`
		UPDATE budgets SET household_id = $1
		WHERE user_id = $2 AND (household_id = $3 OR household_id IS NULL)
	`, targetID, userID, soloID); err != nil {
		return fmt.Errorf("migrate budgets: %w", err)
	}

	// Transactions
	if _, err := q.Exec(`
		UPDATE transactions SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate transactions: %w", err)
	}

	// Linked banks
	if _, err := q.Exec(`
		UPDATE linked_accounts SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
		   OR user_id = $3
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate linked_accounts: %w", err)
	}

	// Debts
	if _, err := q.Exec(`
		UPDATE debt_accounts SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
		   OR user_id = $3
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate debt_accounts: %w", err)
	}

	// Savings
	if _, err := q.Exec(`
		UPDATE savings_goals SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
		   OR user_id = $3
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate savings_goals: %w", err)
	}

	// Bills
	if _, err := q.Exec(`
		UPDATE bills SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
		   OR user_id = $3
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate bills: %w", err)
	}

	// Properties
	if _, err := q.Exec(`
		UPDATE properties SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
		   OR user_id = $3
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate properties: %w", err)
	}

	// AI conversations
	if _, err := q.Exec(`
		UPDATE ai_conversations SET household_id = $1
		WHERE user_id = $2 AND (household_id = $3 OR household_id IS NULL)
	`, targetID, userID, soloID); err != nil {
		return fmt.Errorf("migrate ai_conversations: %w", err)
	}

	// Sharing preferences — re-point to target
	if _, err := q.Exec(`
		UPDATE sharing_preferences SET household_id = $1
		WHERE user_id = $2 AND (household_id = $3 OR household_id IS NULL)
	`, targetID, userID, soloID); err != nil {
		return fmt.Errorf("migrate sharing_preferences: %w", err)
	}

	return nil
}

// DeleteOutboundInvites removes invites issued from a dying solo household.
func DeleteOutboundInvites(q Querier, soloID string) error {
	_, err := q.Exec(`DELETE FROM household_invites WHERE household_id = $1`, soloID)
	return err
}

// MoveMembership deletes solo membership, inserts target membership as member.
func MoveMembership(q Querier, userID, soloID, targetID string) error {
	if _, err := q.Exec(`
		DELETE FROM household_members WHERE user_id = $1 AND household_id = $2
	`, userID, soloID); err != nil {
		return fmt.Errorf("delete solo membership: %w", err)
	}
	if _, err := q.Exec(`
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, 'member')
		ON CONFLICT DO NOTHING
	`, targetID, userID); err != nil {
		return fmt.Errorf("insert target membership: %w", err)
	}
	return nil
}

// DeleteHouseholdIfEmpty hard-deletes a household with zero members.
func DeleteHouseholdIfEmpty(q Querier, householdID string) error {
	_, err := q.Exec(`
		DELETE FROM households
		WHERE id = $1
		  AND NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = $1)
	`, householdID)
	return err
}

// JoinAsMember inserts membership on target (no prior solo).
func JoinAsMember(q Querier, userID, targetID string) error {
	_, err := q.Exec(`
		INSERT INTO household_members (household_id, user_id, role)
		VALUES ($1, $2, 'member')
		ON CONFLICT DO NOTHING
	`, targetID, userID)
	return err
}

// DeleteInviteByCode removes the consumed invite.
func DeleteInviteByCode(q Querier, code string) error {
	_, err := q.Exec(`DELETE FROM household_invites WHERE code = $1`, code)
	return err
}

// CleanupSoloAfterMove discards leftovers and deletes the empty solo household.
func CleanupSoloAfterMove(q Querier, userID, soloID string) error {
	if err := DiscardStarterBudgets(q, userID); err != nil {
		return err
	}
	if err := DeleteOutboundInvites(q, soloID); err != nil {
		return err
	}
	// Drop any leftover solo-scoped sharing prefs that did not re-point
	_, _ = q.Exec(`DELETE FROM sharing_preferences WHERE household_id = $1`, soloID)
	return DeleteHouseholdIfEmpty(q, soloID)
}
