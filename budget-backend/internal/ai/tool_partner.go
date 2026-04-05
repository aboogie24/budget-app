package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

// getPartnerStatus returns the partner's pending reviews, shared goals, and shared debts.
func getPartnerStatus(conn *sql.DB, userID, householdID string) (string, error) {
	if householdID == "" {
		return `{"error":"No household found. You need to be in a household to view partner status."}`, nil
	}

	result := map[string]interface{}{}

	// Find partner user ID and name
	var partnerID, partnerName string
	err := conn.QueryRow(`
		SELECT hm.user_id, COALESCE(u.full_name, u.email, 'Partner')
		FROM household_members hm
		JOIN users u ON u.id = hm.user_id
		WHERE hm.household_id = $1 AND hm.user_id != $2
		LIMIT 1
	`, householdID, userID).Scan(&partnerID, &partnerName)
	if err != nil {
		if err == sql.ErrNoRows {
			return `{"error":"No partner found in your household."}`, nil
		}
		return "", fmt.Errorf("query partner: %w", err)
	}
	result["partner_name"] = partnerName

	// Count pending plan approvals for the partner
	var pendingApprovals int
	err = conn.QueryRow(`
		SELECT COUNT(*)
		FROM plan_approvals
		WHERE user_id = $1 AND status = 'pending'
	`, partnerID).Scan(&pendingApprovals)
	if err != nil {
		log.Printf("getPartnerStatus pending approvals error: %v", err)
	}
	result["pending_plan_reviews"] = pendingApprovals

	// List shared savings goals with progress
	savingsRows, err := conn.Query(`
		SELECT id, name, COALESCE(current_amount, 0), COALESCE(target_amount, 0)
		FROM savings_goals
		WHERE (user_id = $1 OR user_id = $2) AND is_shared = true
		ORDER BY created_at DESC
	`, userID, partnerID)
	if err != nil {
		log.Printf("getPartnerStatus shared savings error: %v", err)
	} else {
		defer savingsRows.Close()
		var sharedSavings []map[string]interface{}
		for savingsRows.Next() {
			var id, name string
			var current, target float64
			if err := savingsRows.Scan(&id, &name, &current, &target); err != nil {
				continue
			}
			pct := 0.0
			if target > 0 {
				pct = (current / target) * 100
			}
			sharedSavings = append(sharedSavings, map[string]interface{}{
				"id":               id,
				"name":             name,
				"current_amount":   current,
				"target_amount":    target,
				"progress_percent": fmt.Sprintf("%.1f", pct),
			})
		}
		if sharedSavings == nil {
			sharedSavings = []map[string]interface{}{}
		}
		result["shared_savings_goals"] = sharedSavings
	}

	// List shared debts
	debtRows, err := conn.Query(`
		SELECT id, name, balance, COALESCE(apr, 0), COALESCE(min_payment, 0)
		FROM debt_accounts
		WHERE (user_id = $1 OR user_id = $2) AND is_shared = true
		ORDER BY balance DESC
	`, userID, partnerID)
	if err != nil {
		log.Printf("getPartnerStatus shared debts error: %v", err)
	} else {
		defer debtRows.Close()
		var sharedDebts []map[string]interface{}
		for debtRows.Next() {
			var id, name string
			var balance, apr, minPayment float64
			if err := debtRows.Scan(&id, &name, &balance, &apr, &minPayment); err != nil {
				continue
			}
			sharedDebts = append(sharedDebts, map[string]interface{}{
				"id":              id,
				"name":            name,
				"balance":         balance,
				"apr":             apr,
				"minimum_payment": minPayment,
			})
		}
		if sharedDebts == nil {
			sharedDebts = []map[string]interface{}{}
		}
		result["shared_debts"] = sharedDebts
	}

	out, _ := json.Marshal(result)
	return string(out), nil
}
