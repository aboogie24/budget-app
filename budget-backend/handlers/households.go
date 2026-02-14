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
			json_agg(json_build_object('user_id', am.user_id, 'role', am.role, 'email', u.email)) AS members
		FROM household_members hm
		JOIN households h ON hm.household_id = h.id
		JOIN household_members am ON am.household_id = h.id
		LEFT JOIN users u ON am.user_id = u.id
		WHERE hm.user_id = $1
		GROUP BY h.id, h.name
	`, userID)
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
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

	http.Error(w, "No household", http.StatusNotFound)
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

	// Prevent multiple households per user
	var existing uuid.UUID
	err = client.Raw().QueryRow(`SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1`, body.UserID).Scan(&existing)
	if err == nil && existing != uuid.Nil {
		http.Error(w, "User already in a household", http.StatusBadRequest)
		return
	}

	hhID := uuid.Must(uuid.NewV4())
	_, err = client.Exec(`INSERT INTO households (id, name) VALUES ($1, $2)`, hhID, body.Name)
	if err != nil {
		http.Error(w, "Failed to create household", http.StatusInternalServerError)
		return
	}
	_, err = client.Exec(`INSERT INTO household_members (household_id, user_id, role) VALUES ($1, $2, 'owner')`, hhID, body.UserID)
	if err != nil {
		http.Error(w, "Failed to add member", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"household_id": hhID})
}

// POST /households/{id}/invites
func CreateHouseholdInvite(w http.ResponseWriter, r *http.Request) {
	var body struct {
		HouseholdID  string `json:"household_id"`
		UserID       string `json:"user_id"`
		InviteeEmail string `json:"invitee_email"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	// Allow query params as fallback to keep older clients working
	if body.UserID == "" {
		body.UserID = r.URL.Query().Get("user_id")
	}
	if body.HouseholdID == "" {
		body.HouseholdID = r.URL.Query().Get("household_id")
	}
	if body.InviteeEmail == "" {
		body.InviteeEmail = r.URL.Query().Get("invitee_email")
	}
	if body.UserID == "" || body.InviteeEmail == "" {
		log.Printf("CreateHouseholdInvite missing fields user_id=%s invitee=%s", body.UserID, body.InviteeEmail)
		http.Error(w, "Missing user_id or invitee_email", http.StatusBadRequest)
		return
	}
	hhID := body.HouseholdID
	userID := body.UserID

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Creator must already be in a household if none provided
	var householdUUID uuid.UUID
	if hhID != "" {
		parsed, err := uuid.FromString(hhID)
		if err == nil {
			var exists bool
			_ = client.Raw().QueryRow(`SELECT EXISTS(SELECT 1 FROM households WHERE id=$1)`, parsed).Scan(&exists)
			if exists {
				householdUUID = parsed
			}
		}
	}
	if householdUUID == uuid.Nil {
		if resolved := db.ResolveHouseholdID(client.Raw(), userID); resolved != "" {
			if parsed, err := uuid.FromString(resolved); err == nil {
				householdUUID = parsed
			}
		}
	}
	if householdUUID == uuid.Nil {
		log.Printf("CreateHouseholdInvite no household found for user=%s provided_hh=%s", userID, hhID)
		http.Error(w, "Creator must belong to a household (provide household_id or join one)", http.StatusBadRequest)
		return
	}

	code := uuid.Must(uuid.NewV4())
	expires := time.Now().Add(7 * 24 * time.Hour)
	_, err = client.Exec(`INSERT INTO household_invites (code, household_id, created_by, expires_at, invitee_email) VALUES ($1,$2,$3,$4,LOWER($5))`,
		code, householdUUID, userID, expires, body.InviteeEmail)
	if err != nil {
		log.Printf("CreateHouseholdInvite insert error: %v", err)
		http.Error(w, "Failed to create invite", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"code": code, "expires_at": expires, "household_id": householdUUID, "invitee_email": body.InviteeEmail})
}

// POST /households/accept
func AcceptHouseholdInvite(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code   string `json:"code"`
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" || body.UserID == "" {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Prevent joining multiple households
	var existing uuid.UUID
	err = client.Raw().QueryRow(`SELECT household_id FROM household_members WHERE user_id = $1 LIMIT 1`, body.UserID).Scan(&existing)
	if err == nil && existing != uuid.Nil {
		http.Error(w, "User already in a household", http.StatusBadRequest)
		return
	}

	var hhID string
	var expires time.Time
	var inviteeEmail *string
	err = client.Raw().QueryRow(`SELECT household_id, expires_at, invitee_email FROM household_invites WHERE code = $1`, body.Code).Scan(&hhID, &expires, &inviteeEmail)
	if err != nil {
		http.Error(w, "Invalid invite", http.StatusBadRequest)
		return
	}
	if !expires.IsZero() && expires.Before(time.Now()) {
		http.Error(w, "Invite expired", http.StatusBadRequest)
		return
	}

	// Enforce invitee email match when present
	if inviteeEmail != nil && *inviteeEmail != "" {
		var userEmail string
		if err := client.Raw().QueryRow(`SELECT email FROM users WHERE id = $1`, body.UserID).Scan(&userEmail); err != nil {
			http.Error(w, "User not found", http.StatusBadRequest)
			return
		}
		if strings.ToLower(userEmail) != strings.ToLower(*inviteeEmail) {
			http.Error(w, "Invite not intended for this user", http.StatusForbidden)
			return
		}
	}

	_, err = client.Exec(`INSERT INTO household_members (household_id, user_id, role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`, hhID, body.UserID)
	if err != nil {
		http.Error(w, "Failed to join household", http.StatusInternalServerError)
		return
	}

	// Delete the accepted invite so it no longer appears in pending lists
	_, _ = client.Exec(`DELETE FROM household_invites WHERE code = $1`, body.Code)

	json.NewEncoder(w).Encode(map[string]any{"household_id": hhID})
}

// GET /households/invites?user_id=
func ListHouseholdInvites(w http.ResponseWriter, r *http.Request) {
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

	var email string
	if err := client.Raw().QueryRow(`SELECT email FROM users WHERE id=$1`, userID).Scan(&email); err != nil {
		log.Printf("ListHouseholdInvites: user not found for id=%s err=%v", userID, err)
		http.Error(w, "User not found", http.StatusBadRequest)
		return
	}
	log.Printf("ListHouseholdInvites: looking up invites for email=%s (user_id=%s)", email, userID)

	rows, err := client.Query(`
		SELECT i.code, i.household_id, COALESCE(h.name,''), i.created_by, i.expires_at, i.invitee_email, u.email AS inviter_email
		FROM household_invites i
		JOIN households h ON h.id = i.household_id
		LEFT JOIN users u ON u.id = i.created_by
		WHERE LOWER(TRIM(i.invitee_email)) = LOWER(TRIM($1))
		  AND (i.expires_at IS NULL OR i.expires_at > NOW())
	`, email)
	if err != nil {
		log.Printf("ListHouseholdInvites: query error email=%s err=%v", email, err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	invites := make([]map[string]any, 0)
	for rows.Next() {
		var code uuid.UUID
		var householdID uuid.UUID
		var name string
		var createdBy sql.NullString
		var expires time.Time
		var inviteeEmail *string
		var inviterEmail *string
		if err := rows.Scan(&code, &householdID, &name, &createdBy, &expires, &inviteeEmail, &inviterEmail); err != nil {
			log.Printf("ListHouseholdInvites: scan error err=%v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		inv := map[string]any{
			"code":           code,
			"household_id":   householdID,
			"household_name": name,
			"expires_at":     expires,
			"invitee_email":  inviteeEmail,
			"inviter_email":  inviterEmail,
		}
		if createdBy.Valid {
			inv["created_by"] = createdBy.String
		}
		invites = append(invites, inv)
	}
	log.Printf("ListHouseholdInvites: found %d invites for email=%s", len(invites), email)

	json.NewEncoder(w).Encode(invites)
}
