package db

import (
	"database/sql"
	"errors"
	"log"

	"github.com/gofrs/uuid"
)

// ResolveHouseholdID returns the household_id for a user if one exists in household_members,
// otherwise it falls back to the user's own ID to keep legacy data working.
func ResolveHouseholdID(conn *sql.DB, userID string) string {
	if conn == nil || userID == "" {
		return ""
	}
	var householdID string
	err := conn.QueryRow(`SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1`, userID).Scan(&householdID)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Printf("household lookup error: %v", err)
		}
		return ""
	}
	return householdID
}

// EnsureHouseholdForUser returns an existing household_id or creates a new household+membership.
func EnsureHouseholdForUser(conn *sql.DB, userID string) (string, error) {
	if conn == nil || userID == "" {
		return "", errors.New("missing db or user")
	}
	if existing := ResolveHouseholdID(conn, userID); existing != "" {
		return existing, nil
	}
	newID := uuid.Must(uuid.NewV4()).String()
	if _, err := conn.Exec(`INSERT INTO households (id, name) VALUES ($1,$2)`, newID, "Household"); err != nil {
		log.Printf("ensure household create error: %v", err)
		return "", err
	}
	if _, err := conn.Exec(`INSERT INTO household_members (household_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`, newID, userID); err != nil {
		log.Printf("ensure household member insert error: %v", err)
		return "", err
	}
	return newID, nil
}
