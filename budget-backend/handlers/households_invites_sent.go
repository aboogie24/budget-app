package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/gofrs/uuid"
)

// sentInvitesAuthUserID returns the authenticated user id for the request from the
// session cookie, falling back to the Bearer JWT (same order as RequireAuth).
//
// C038b: self-contained so this PR does not depend on C038 (#13). Once #13 is on
// main this can be swapped for middleware.AuthenticatedUserID / resolveSessionActor;
// helper names are deliberately distinct so both PRs compile together.
func sentInvitesAuthUserID(r *http.Request) string {
	if session, err := middleware.GetSession(nil, r); err == nil && session != nil {
		if uid, ok := session.Values["user_id"].(string); ok && uid != "" {
			return uid
		}
	}
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token := strings.TrimSpace(authHeader[len("bearer "):])
		if uid, err := auth.ValidateToken(token); err == nil && uid != "" {
			return uid
		}
	}
	return ""
}

// inviteAcceptedColumnExists reports whether household_invites.accepted_at exists
// (added by C038 #13). Before #13, accepted invites are hard-deleted, so every
// remaining row is unconsumed; after #13, consumed rows are tombstoned and must be hidden.
func inviteAcceptedColumnExists(conn *sql.DB) (bool, error) {
	var ok bool
	err := conn.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM information_schema.columns
			WHERE table_name = 'household_invites' AND column_name = 'accepted_at'
		)
	`).Scan(&ok)
	return ok, err
}

// GET /auth/households/invites/sent[?user_id=&household_id=]
//
// Lists outbound (unconsumed) invites for the caller's household, household-wide
// (any member's invites), newest first. Expired invites are included with
// "expired": true because the household-setup screen renders an "Expired" chip.
//
//   - Caller is always the session/JWT user. user_id (optional, legacy) must match → else 403.
//   - household_id (optional) must be a household the caller belongs to → else 403.
//   - No household_id: resolve the caller's household; none → 200 [].
//   - Consumed invites (accepted_at IS NOT NULL, once C038 is applied) are hidden.
func ListSentHouseholdInvites(w http.ResponseWriter, r *http.Request) {
	userID := sentInvitesAuthUserID(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claimed := r.URL.Query().Get("user_id"); claimed != "" && claimed != userID {
		http.Error(w, "user_id does not match authenticated user", http.StatusForbidden)
		return
	}
	householdID := strings.TrimSpace(r.URL.Query().Get("household_id"))
	if householdID != "" {
		if _, err := uuid.FromString(householdID); err != nil {
			http.Error(w, "Invalid household_id", http.StatusBadRequest)
			return
		}
	}

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()
	conn := client.Raw()

	writeJSON := func(v any) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(v)
	}

	if householdID != "" {
		var member bool
		if err := conn.QueryRow(`
			SELECT EXISTS(SELECT 1 FROM household_members WHERE household_id = $1 AND user_id = $2)
		`, householdID, userID).Scan(&member); err != nil {
			log.Printf("ListSentHouseholdInvites: membership check error user=%s hh=%s err=%v", userID, householdID, err)
			http.Error(w, "Failed to verify household membership", http.StatusInternalServerError)
			return
		}
		if !member {
			http.Error(w, "Not a member of this household", http.StatusForbidden)
			return
		}
	} else {
		householdID = db.ResolveHouseholdID(conn, userID)
		if householdID == "" {
			// No household yet (onboarding): nothing sent. Friendlier than 404 for the UI.
			writeJSON([]map[string]any{})
			return
		}
	}

	hasAccepted, err := inviteAcceptedColumnExists(conn)
	if err != nil {
		log.Printf("ListSentHouseholdInvites: schema check error err=%v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	query := `
		SELECT i.code, i.household_id, COALESCE(h.name,''), i.created_by, i.created_at, i.expires_at, i.invitee_email, u.email AS inviter_email
		FROM household_invites i
		JOIN households h ON h.id = i.household_id
		LEFT JOIN users u ON u.id = i.created_by
		WHERE i.household_id = $1`
	if hasAccepted {
		query += `
		  AND i.accepted_at IS NULL`
	}
	query += `
		ORDER BY i.created_at DESC NULLS LAST`

	rows, err := client.Query(query, householdID)
	if err != nil {
		log.Printf("ListSentHouseholdInvites: query error hh=%s err=%v", householdID, err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	now := time.Now()
	invites := make([]map[string]any, 0)
	for rows.Next() {
		var (
			code, hhID   uuid.UUID
			name         string
			createdBy    sql.NullString
			createdAt    sql.NullTime
			expires      sql.NullTime
			inviteeEmail *string
			inviterEmail *string
		)
		if err := rows.Scan(&code, &hhID, &name, &createdBy, &createdAt, &expires, &inviteeEmail, &inviterEmail); err != nil {
			log.Printf("ListSentHouseholdInvites: scan error err=%v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		inv := map[string]any{
			"code":           code,
			"household_id":   hhID,
			"household_name": name,
			"invitee_email":  inviteeEmail,
			"inviter_email":  inviterEmail,
			"expires_at":     nil,
			"expired":        false,
		}
		if createdBy.Valid {
			inv["created_by"] = createdBy.String
		}
		if createdAt.Valid {
			inv["created_at"] = createdAt.Time
		}
		if expires.Valid {
			inv["expires_at"] = expires.Time
			inv["expired"] = expires.Time.Before(now)
		}
		invites = append(invites, inv)
	}
	if err := rows.Err(); err != nil {
		log.Printf("ListSentHouseholdInvites: rows error err=%v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	writeJSON(invites)
}
