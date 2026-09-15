package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
)

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
