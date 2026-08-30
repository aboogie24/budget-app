package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/gorilla/mux"
)

// GetAdvisorMemories returns the facts the AI advisor remembers that are visible
// to the current user: shared household facts plus the user's own private facts.
// Powers the "what your advisor remembers" settings screen.
func GetAdvisorMemories(w http.ResponseWriter, r *http.Request) {
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

	items, err := ai.LoadAdvisorMemories(conn.Raw(), userID, householdID)
	if err != nil {
		log.Printf("GetAdvisorMemories load error: %v", err)
		http.Error(w, "Failed to load memories", http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []ai.MemoryItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"memories": items})
}

// DeleteAdvisorMemory removes a remembered fact. A user may delete their own
// private facts and any shared fact in their household, but never a partner's
// private fact.
func DeleteAdvisorMemory(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	memoryID := mux.Vars(r)["id"]
	if memoryID == "" {
		http.Error(w, "Missing memory ID", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	var hh interface{}
	if householdID != "" {
		hh = householdID
	}

	result, err := conn.Exec(`
		DELETE FROM advisor_memories
		WHERE id = $1
		  AND (user_id = $2 OR (scope = 'shared' AND household_id = $3))
	`, memoryID, userID, hh)
	if err != nil {
		log.Printf("DeleteAdvisorMemory error: %v", err)
		http.Error(w, "Delete failed", http.StatusInternalServerError)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
