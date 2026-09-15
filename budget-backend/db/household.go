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
	// PK is (household_id, user_id), so ON CONFLICT DO NOTHING would not catch a
	// concurrent insert with a different household_id and would leave this row orphaned.
	// Insert only when the user has no membership yet; otherwise drop the unused household.
	res, err := conn.Exec(`
		INSERT INTO household_members (household_id, user_id, role)
		SELECT $1, $2, 'owner'
		WHERE NOT EXISTS (SELECT 1 FROM household_members WHERE user_id = $2)
	`, newID, userID)
	if err != nil {
		log.Printf("ensure household member insert error: %v", err)
		_, _ = conn.Exec(`DELETE FROM households WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = $1)`, newID)
		return "", err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		_, _ = conn.Exec(`DELETE FROM households WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = $1)`, newID)
		if existing := ResolveHouseholdID(conn, userID); existing != "" {
			return existing, nil
		}
		return "", errors.New("failed to attach household membership")
	}
	return newID, nil
}
