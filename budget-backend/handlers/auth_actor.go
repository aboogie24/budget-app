package handlers

import (
	"database/sql"
	"net/http"

	"github.com/aboogie/budget-backend/middleware"
)

// resolveSessionActor binds household-scoped routes to the authenticated session/JWT user
// (C038 N1). A body/query user_id is never trusted: if present it must equal the
// authenticated user (else 403); missing auth → 401. Returns the actor id.
func resolveSessionActor(w http.ResponseWriter, r *http.Request, claimedUserID string) (string, bool) {
	authUID := middleware.AuthenticatedUserID(r)
	if authUID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return "", false
	}
	if claimedUserID != "" && claimedUserID != authUID {
		http.Error(w, "user_id does not match authenticated user", http.StatusForbidden)
		return "", false
	}
	return authUID, true
}

// resolveInviteActor is kept for the invite handlers; same contract as resolveSessionActor.
func resolveInviteActor(w http.ResponseWriter, r *http.Request, claimedUserID string) (string, bool) {
	return resolveSessionActor(w, r, claimedUserID)
}

// isHouseholdMember reports whether userID is a member of householdID.
func isHouseholdMember(conn *sql.DB, householdID, userID string) (bool, error) {
	var ok bool
	err := conn.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM household_members WHERE household_id = $1 AND user_id = $2)
	`, householdID, userID).Scan(&ok)
	return ok, err
}

// requireHouseholdMember writes 403 (or 500 on DB error) and returns false unless userID
// is a member of householdID. Never trust a client-supplied household_id without this.
func requireHouseholdMember(w http.ResponseWriter, conn *sql.DB, householdID, userID string) bool {
	ok, err := isHouseholdMember(conn, householdID, userID)
	if err != nil {
		http.Error(w, "Failed to verify household membership", http.StatusInternalServerError)
		return false
	}
	if !ok {
		http.Error(w, "Not a member of this household", http.StatusForbidden)
		return false
	}
	return true
}
