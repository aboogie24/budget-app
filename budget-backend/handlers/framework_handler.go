package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
)

// ─── Get Framework Level ─────────────────────────────────────

func GetFrameworkLevel(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	assessment := ai.AssessFrameworkLevel(conn.Raw(), userID, householdID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assessment)
}
