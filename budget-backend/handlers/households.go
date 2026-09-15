package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
)

// householdDBFactory allows swapping DB in tests.
var householdDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// GET /households/me?user_id=
func GetHouseholdForUser(w http.ResponseWriter, r *http.Request) {
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

	rows, err := client.Query(`
		SELECT
			h.id,
			h.name,
			json_agg(json_build_object('user_id', am.user_id, 'role', am.role, 'email', u.email, 'full_name', COALESCE(u.full_name, u.email))) AS members
		FROM household_members hm
		JOIN households h ON hm.household_id = h.id
		JOIN household_members am ON am.household_id = h.id
		LEFT JOIN users u ON am.user_id = u.id
		WHERE hm.user_id = $1
		GROUP BY h.id, h.name
	`, userID)
	if err != nil {
		log.Printf("GetHouseholdForUser query error for user %s: %v", userID, err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"error": "Query error"})
		return
	}
	defer rows.Close()

	if rows.Next() {
		var hhID uuid.UUID
		var name *string
		var members json.RawMessage
		if err := rows.Scan(&hhID, &name, &members); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{
			"household_id": hhID,
			"name":         name,
			"members":      members,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"household_id": nil,
		"name":         nil,
		"members":      []any{},
	})
}

// POST /households
func CreateHousehold(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   string `json:"name"`
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Idempotent: onboarding OB1 may call create on every continue (invite or skip).
	// Never leave the user household-less; return the existing household if present.
	if existing := db.ResolveHouseholdID(client.Raw(), body.UserID); existing != "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"household_id": existing,
			"created":      false,
		})
		return
	}

	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = "Household"
	}

	hhID := uuid.Must(uuid.NewV4())
	_, err = client.Exec(`INSERT INTO households (id, name) VALUES ($1, $2)`, hhID, name)
	if err != nil {
		http.Error(w, "Failed to create household", http.StatusInternalServerError)
		return
	}
	_, err = client.Exec(`INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, 'owner')`, hhID, body.UserID)
	if err != nil {
		http.Error(w, "Failed to add member", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"household_id": hhID,
		"created":      true,
		"name":         name,
	})
}
