package households

import (
	"database/sql"
	"errors"
	"fmt"
	"sort"

	"github.com/lib/pq"
)

// DiscardSpendingAlertsForStarters removes alerts tied to the user's starter budgets only
// (spending_alerts.budget_id has no ON DELETE CASCADE, so they must go before the budgets).
// N4: never delete by household here — on the migrate path the solo's real-budget alerts
// (e.g. "Vacation fund") must survive and be re-pointed by MigrateSoloToHousehold.
func DiscardSpendingAlertsForStarters(q Querier, userID string) error {
	_, err := q.Exec(`
		DELETE FROM spending_alerts
		WHERE budget_id IN (
		        SELECT id FROM budgets
		        WHERE user_id = $1
		          AND category_id IS NULL
		          AND LOWER(TRIM(name)) = ANY($2)
		   )
	`, userID, pq.Array(StarterBudgetNameList()))
	return err
}

// DiscardSoloSpendingAlerts removes any remaining alerts scoped to the solo household.
// Discard path only (solo is empty, so these can only reference starter/system budgets);
// required because spending_alerts.household_id has no ON DELETE CASCADE.
func DiscardSoloSpendingAlerts(q Querier, soloID string) error {
	_, err := q.Exec(`DELETE FROM spending_alerts WHERE household_id = $1`, soloID)
	return err
}

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

func repointByUserOrHousehold(q Querier, table, userID, soloID, targetID string) error {
	_, err := q.Exec(fmt.Sprintf(`
		UPDATE %s SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
		   OR user_id = $3
	`, table), targetID, soloID, userID)
	if err != nil {
		return fmt.Errorf("migrate %s: %w", table, err)
	}
	return nil
}

// MigrateSoloToHousehold re-points solo/user-scoped rows to target.
// Caller must already have discarded starters and validated eligibility.
func MigrateSoloToHousehold(q Querier, userID, soloID, targetID string) error {
	if _, err := q.Exec(`
		UPDATE budgets SET household_id = $1
		WHERE user_id = $2 AND (household_id = $3 OR household_id IS NULL)
	`, targetID, userID, soloID); err != nil {
		return fmt.Errorf("migrate budgets: %w", err)
	}

	if _, err := q.Exec(`
		UPDATE transactions SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND user_id = $3)
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate transactions: %w", err)
	}

	for _, table := range []string{
		"linked_accounts",
		"debt_accounts",
		"savings_goals",
		"bills",
		"properties",
		"categories",
		"financial_priorities",
		"trips",
		"investment_holdings",
		"liabilities",
		"bill_payments",
		"account_balances",
		"category_mapping_rules",
		"advisor_memories",
	} {
		if err := repointByUserOrHousehold(q, table, userID, soloID, targetID); err != nil {
			return err
		}
	}

	// financial_plans uses created_by rather than user_id
	if _, err := q.Exec(`
		UPDATE financial_plans SET household_id = $1
		WHERE household_id = $2
		   OR (household_id IS NULL AND created_by = $3)
		   OR created_by = $3
	`, targetID, soloID, userID); err != nil {
		return fmt.Errorf("migrate financial_plans: %w", err)
	}

	// spending_alerts: household-scoped only (no user_id)
	if _, err := q.Exec(`
		UPDATE spending_alerts SET household_id = $1 WHERE household_id = $2
	`, targetID, soloID); err != nil {
		return fmt.Errorf("migrate spending_alerts: %w", err)
	}

	if _, err := q.Exec(`
		UPDATE ai_conversations SET household_id = $1
		WHERE user_id = $2 AND (household_id = $3 OR household_id IS NULL)
	`, targetID, userID, soloID); err != nil {
		return fmt.Errorf("migrate ai_conversations: %w", err)
	}

	if _, err := q.Exec(`
		UPDATE sharing_preferences SET household_id = $1
		WHERE user_id = $2 AND (household_id = $3 OR household_id IS NULL)
	`, targetID, userID, soloID); err != nil {
		return fmt.Errorf("migrate sharing_preferences: %w", err)
	}

	return nil
}

// ErrHouseholdGone is returned by LockHouseholdsForUpdate when a household row no longer
// exists (deleted by a concurrent, already-committed accept). Callers restart the accept.
var ErrHouseholdGone = errors.New("household no longer exists")

// LockHouseholdsForUpdate locks household rows in ascending UUID order to avoid deadlocks.
func LockHouseholdsForUpdate(q Querier, ids ...string) error {
	seen := map[string]struct{}{}
	var uniq []string
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniq = append(uniq, id)
	}
	sort.Strings(uniq)
	for _, id := range uniq {
		var locked string
		if err := q.QueryRow(`SELECT id FROM households WHERE id = $1 FOR UPDATE`, id).Scan(&locked); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return fmt.Errorf("lock household %s: %w", id, ErrHouseholdGone)
			}
			return fmt.Errorf("lock household %s: %w", id, err)
		}
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

// ConsumeInvite tombstones the invite (accepted_at/accepted_by) instead of deleting it, so a
// later re-accept of the same code can be answered idempotently only for that invite's
// household (N2). Tombstones are removed with their household (ON DELETE CASCADE).
func ConsumeInvite(q Querier, code, userID string) error {
	_, err := q.Exec(`
		UPDATE household_invites
		SET accepted_at = NOW(), accepted_by = $2
		WHERE code = $1
	`, code, userID)
	return err
}
