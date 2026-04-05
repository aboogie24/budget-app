package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
)

// GET /auth/linked-accounts?user_id=...&household_id=...
func ListLinkedAccounts(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	householdID := r.URL.Query().Get("household_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	client, err := db.New()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var rows *sql.Rows
	if householdID != "" {
		rows, err = client.Query(`
			SELECT id, user_id, household_id, item_id, institution_name, created_at, updated_at, provider
			FROM linked_accounts
			WHERE user_id = $1 AND (household_id = $2 OR household_id IS NULL)
		`, userID, householdID)
	} else {
		rows, err = client.Query(`
			SELECT id, user_id, household_id, item_id, institution_name, created_at, updated_at, provider
			FROM linked_accounts
			WHERE user_id = $1
		`, userID)
	}
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var (
			id, uid, itemID, inst, provider string
			hh                               *string
			created, updated                 any
		)
		if err := rows.Scan(&id, &uid, &hh, &itemID, &inst, &created, &updated, &provider); err != nil {
			http.Error(w, "scan error", http.StatusInternalServerError)
			return
		}
		out = append(out, map[string]any{
			"id":               id,
			"user_id":          uid,
			"household_id":     hh,
			"item_id":          itemID,
			"institution_name": inst,
			"created_at":       created,
			"updated_at":       updated,
			"provider":         provider,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// DELETE /auth/linked-accounts/{id}
func DeleteLinkedAccount(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	if _, err := uuid.FromString(id); err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	client, err := db.New()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if _, err := client.Exec(`DELETE FROM linked_accounts WHERE id = $1`, id); err != nil {
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
