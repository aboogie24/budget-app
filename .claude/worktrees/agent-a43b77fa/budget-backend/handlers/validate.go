package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// validationError writes a 400 response with a JSON body.
func validationError(w http.ResponseWriter, msg string) {
	http.Error(w, msg, http.StatusBadRequest)
}

func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

func isValidBudgetType(t string) bool {
	t = strings.ToLower(t)
	return t == "income" || t == "expense"
}

func isValidFrequency(f string) bool {
	switch strings.ToLower(f) {
	case "", "one-time", "weekly", "biweekly", "monthly", "1st-15th":
		return true
	}
	return false
}

// ownershipCheck verifies the requesting user owns the resource (or is in the same household).
// table must be a trusted constant — never pass user input.
// Returns true if the user is authorized, false otherwise (and writes an HTTP error).
func ownershipCheck(w http.ResponseWriter, conn *sql.DB, table, resourceID, userID string) bool {
	var ownerID string
	var hhID sql.NullString
	err := conn.QueryRow(
		`SELECT user_id, household_id FROM `+table+` WHERE id = $1`, resourceID,
	).Scan(&ownerID, &hhID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Not found", http.StatusNotFound)
		} else {
			http.Error(w, "DB error", http.StatusInternalServerError)
		}
		return false
	}
	// Direct owner
	if ownerID == userID {
		return true
	}
	// Same household
	if hhID.Valid && hhID.String != "" {
		var memberCount int
		_ = conn.QueryRow(
			`SELECT COUNT(*) FROM household_members WHERE household_id = $1 AND user_id = $2`,
			hhID.String, userID,
		).Scan(&memberCount)
		if memberCount > 0 {
			return true
		}
	}
	http.Error(w, "Forbidden", http.StatusForbidden)
	return false
}
