package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
)

var sharingDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// GET /auth/sharing-preferences?user_id=...&household_id=...
func GetSharingPreferences(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	householdID := r.URL.Query().Get("household_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	client, err := sharingDBFactory()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Try lookup; if not found, return defaults.
	row := client.QueryRow(`
		SELECT id, user_id, household_id, share_budgets, share_transactions, share_debts,
		       share_savings, share_priorities, share_notes, notify_partner, created_at, updated_at
		FROM sharing_preferences
		WHERE user_id = $1 AND (household_id = $2 OR ($2 = '' AND household_id IS NULL))
		LIMIT 1
	`, userID, householdID)

	var pref models.SharingPreferences
	var hh sql.NullString
	if err := row.Scan(
		&pref.ID,
		&pref.UserID,
		&hh,
		&pref.ShareBudgets,
		&pref.ShareTransactions,
		&pref.ShareDebts,
		&pref.ShareSavings,
		&pref.SharePriorities,
		&pref.ShareNotes,
		&pref.NotifyPartner,
		&pref.CreatedAt,
		&pref.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			pref = models.SharingPreferences{
				ID:                "",
				UserID:            userID,
				ShareBudgets:      true,
				ShareTransactions: true,
				ShareDebts:        true,
				ShareSavings:      true,
				SharePriorities:   true,
				ShareNotes:        true,
				NotifyPartner:     true,
			}
		} else {
			http.Error(w, "query error", http.StatusInternalServerError)
			return
		}
	}
	if hh.Valid {
		pref.HouseholdID = &hh.String
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pref)
}

// POST /auth/sharing-preferences
func UpsertSharingPreferences(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID            string  `json:"user_id"`
		HouseholdID       *string `json:"household_id"`
		ShareBudgets      *bool   `json:"share_budgets"`
		ShareTransactions *bool   `json:"share_transactions"`
		ShareDebts        *bool   `json:"share_debts"`
		ShareSavings      *bool   `json:"share_savings"`
		SharePriorities   *bool   `json:"share_priorities"`
		ShareNotes        *bool   `json:"share_notes"`
		NotifyPartner     *bool   `json:"notify_partner"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	client, err := sharingDBFactory()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Existing row?
	row := client.QueryRow(`
		SELECT id FROM sharing_preferences WHERE user_id = $1 AND (household_id = $2 OR ($2 = '' AND household_id IS NULL)) LIMIT 1
	`, body.UserID, nullableString(body.HouseholdID))

	var existingID string
	_ = row.Scan(&existingID)

	now := time.Now()
	if existingID == "" {
		newID := uuid.Must(uuid.NewV4()).String()
		_, err = client.Exec(`
			INSERT INTO sharing_preferences 
				(id, user_id, household_id, share_budgets, share_transactions, share_debts, share_savings, share_priorities, share_notes, notify_partner, created_at, updated_at)
			VALUES
				($1,$2,$3,COALESCE($4, TRUE),COALESCE($5, TRUE),COALESCE($6, TRUE),COALESCE($7, TRUE),COALESCE($8, TRUE),COALESCE($9, TRUE),COALESCE($10, TRUE),$11,$11)
		`,
			newID,
			body.UserID,
			nullableString(body.HouseholdID),
			body.ShareBudgets,
			body.ShareTransactions,
			body.ShareDebts,
			body.ShareSavings,
			body.SharePriorities,
			body.ShareNotes,
			body.NotifyPartner,
			now,
		)
		if err != nil {
			http.Error(w, "insert error", http.StatusInternalServerError)
			return
		}
		existingID = newID
	} else {
		_, err = client.Exec(`
			UPDATE sharing_preferences SET
				share_budgets = COALESCE($2, share_budgets),
				share_transactions = COALESCE($3, share_transactions),
				share_debts = COALESCE($4, share_debts),
				share_savings = COALESCE($5, share_savings),
				share_priorities = COALESCE($6, share_priorities),
				share_notes = COALESCE($7, share_notes),
				notify_partner = COALESCE($8, notify_partner),
				updated_at = $9
			WHERE id = $1
		`,
			existingID,
			body.ShareBudgets,
			body.ShareTransactions,
			body.ShareDebts,
			body.ShareSavings,
			body.SharePriorities,
			body.ShareNotes,
			body.NotifyPartner,
			now,
		)
		if err != nil {
			http.Error(w, "update error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"id": existingID, "updated_at": now})
}

func nullableString(val *string) interface{} {
	if val == nil {
		return nil
	}
	if *val == "" {
		return nil
	}
	return *val
}
