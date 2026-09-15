package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
)

// GET /households/invites?user_id=
func ListHouseholdInvites(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var email string
	if err := client.Raw().QueryRow(`SELECT email FROM users WHERE id=$1`, userID).Scan(&email); err != nil {
		log.Printf("ListHouseholdInvites: user not found for id=%s err=%v", userID, err)
		http.Error(w, "User not found", http.StatusBadRequest)
		return
	}
	log.Printf("ListHouseholdInvites: looking up invites for email=%s (user_id=%s)", email, userID)

	rows, err := client.Query(`
		SELECT i.code, i.household_id, COALESCE(h.name,''), i.created_by, i.expires_at, i.invitee_email, u.email AS inviter_email
		FROM household_invites i
		JOIN households h ON h.id = i.household_id
		LEFT JOIN users u ON u.id = i.created_by
		WHERE LOWER(TRIM(i.invitee_email)) = LOWER(TRIM($1))
		  AND (i.expires_at IS NULL OR i.expires_at > NOW())
	`, email)
	if err != nil {
		log.Printf("ListHouseholdInvites: query error email=%s err=%v", email, err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	invites := make([]map[string]any, 0)
	for rows.Next() {
		var code uuid.UUID
		var householdID uuid.UUID
		var name string
		var createdBy sql.NullString
		var expires time.Time
		var inviteeEmail *string
		var inviterEmail *string
		if err := rows.Scan(&code, &householdID, &name, &createdBy, &expires, &inviteeEmail, &inviterEmail); err != nil {
			log.Printf("ListHouseholdInvites: scan error err=%v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		inv := map[string]any{
			"code":           code,
			"household_id":   householdID,
			"household_name": name,
			"expires_at":     expires,
			"invitee_email":  inviteeEmail,
			"inviter_email":  inviterEmail,
		}
		if createdBy.Valid {
			inv["created_by"] = createdBy.String
		}
		invites = append(invites, inv)
	}
	log.Printf("ListHouseholdInvites: found %d invites for email=%s", len(invites), email)

	json.NewEncoder(w).Encode(invites)
}

// GET /auth/households/summary
// Returns combined financial summary for all members of a household
// Accepts either user_id (resolves household) or household_id directly
func GetHouseholdSummary(w http.ResponseWriter, r *http.Request) {
	householdID := r.URL.Query().Get("household_id")
	userID := r.URL.Query().Get("user_id")

	if householdID == "" && userID == "" {
		http.Error(w, `{"error": "Missing household_id or user_id"}`, http.StatusBadRequest)
		return
	}

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, `{"error": "DB connection error"}`, http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// If only user_id provided, resolve the household_id
	if householdID == "" && userID != "" {
		resolved := db.ResolveHouseholdID(client.Raw(), userID)
		if resolved == "" {
			// User has no household; return personal-only summary
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{
				"household_id":           nil,
				"household_name":         "Personal",
				"member_count":           1,
				"total_income":           0.0,
				"total_expenses":         0.0,
				"net_cash_flow":          0.0,
				"total_debt":             0.0,
				"total_savings_target":   0.0,
				"total_savings_current":  0.0,
				"savings_progress":       0.0,
			})
			return
		}
		householdID = resolved
	}

	// Aggregate using separate subqueries to avoid cross-join multiplication
	query := `
		SELECT
			COALESCE((SELECT SUM(amount) FROM transactions WHERE household_id = $1 AND type = 'income' AND date >= date_trunc('month', CURRENT_DATE)), 0),
			COALESCE((SELECT SUM(amount) FROM transactions WHERE household_id = $1 AND type = 'expense' AND date >= date_trunc('month', CURRENT_DATE)), 0),
			COALESCE((SELECT SUM(balance) FROM debt_accounts WHERE household_id = $1), 0),
			COALESCE((SELECT SUM(target_amount) FROM savings_goals WHERE household_id = $1), 0),
			COALESCE((SELECT SUM(current_amount) FROM savings_goals WHERE household_id = $1), 0)
	`

	var totalIncome, totalExpenses, totalDebt, totalSavingsTarget, totalSavingsCurrent float64
	err = client.Raw().QueryRow(query, householdID).Scan(&totalIncome, &totalExpenses, &totalDebt, &totalSavingsTarget, &totalSavingsCurrent)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("GetHouseholdSummary query error: %v", err)
		http.Error(w, `{"error": "Query error"}`, http.StatusInternalServerError)
		return
	}

	// Get household name and member count
	var hhName string
	var memberCount int
	err = client.Raw().QueryRow(`
		SELECT COALESCE(h.name, 'Household'), COUNT(hm.user_id)
		FROM households h
		LEFT JOIN household_members hm ON hm.household_id = h.id
		WHERE h.id = $1
		GROUP BY h.id, h.name
	`, householdID).Scan(&hhName, &memberCount)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("GetHouseholdSummary household info error: %v", err)
		http.Error(w, `{"error": "Failed to fetch household info"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"household_id":           householdID,
		"household_name":         hhName,
		"member_count":           memberCount,
		"total_income":           totalIncome,
		"total_expenses":         totalExpenses,
		"net_cash_flow":          totalIncome - totalExpenses,
		"total_debt":             totalDebt,
		"total_savings_target":   totalSavingsTarget,
		"total_savings_current":  totalSavingsCurrent,
		"savings_progress":       calculateSavingsProgress(totalSavingsCurrent, totalSavingsTarget),
	})
}

// Helper function to calculate savings progress percentage
func calculateSavingsProgress(current, target float64) float64 {
	if target <= 0 {
		return 0
	}
	progress := (current / target) * 100
	if progress > 100 {
		return 100
	}
	return progress
}
