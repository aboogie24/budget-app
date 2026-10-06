package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/entitlements"
	"github.com/aboogie/budget-backend/internal/households"
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
// C038: allow accept when the user has an empty solo (discard) or non-empty solo
// (migrate with confirm_migrate:true). Bank-cap and multi-member remain blocked.
func AcceptHouseholdInvite(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code           string `json:"code"`
		UserID         string `json:"user_id"`
		ConfirmMigrate *bool  `json:"confirm_migrate"`
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

	confirm := body.ConfirmMigrate != nil && *body.ConfirmMigrate
	result, conflict, err := households.AcceptInvite(client.Raw(), households.AcceptRequest{
		Code:           body.Code,
		UserID:         body.UserID,
		ConfirmMigrate: confirm,
	})
	if conflict != nil {
		writeAcceptConflict(w, conflict)
		return
	}
	if err != nil {
		writeAcceptError(w, err)
		return
	}

	resp := map[string]any{
		"household_id": result.HouseholdID,
		"action":       result.Action,
		"plan":         result.Plan,
	}
	if result.AlreadyMember {
		resp["already_member"] = true
	}
	if ent, err := entitlements.ResolveForHousehold(client.Raw(), result.HouseholdID); err == nil {
		resp["entitlements"] = ent
	} else {
		log.Printf("AcceptHouseholdInvite entitlements: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func writeAcceptConflict(w http.ResponseWriter, c *households.AcceptConflict) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusConflict)
	payload := map[string]any{
		"error":   c.ErrLabel,
		"code":    c.Code,
		"message": c.Message,
	}
	if c.AcceptPreview != nil {
		payload["accept_preview"] = c.AcceptPreview
	}
	if c.Blockers != nil {
		payload["blockers"] = c.Blockers
	}
	_ = json.NewEncoder(w).Encode(payload)
}

func writeAcceptError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, households.ErrInvalidInvite):
		http.Error(w, "Invalid invite", http.StatusBadRequest)
	case errors.Is(err, households.ErrInviteExpired):
		http.Error(w, "Invite expired", http.StatusBadRequest)
	case errors.Is(err, households.ErrInviteWrongEmail):
		http.Error(w, "Invite not intended for this user", http.StatusForbidden)
	case errors.Is(err, households.ErrUserNotFound):
		http.Error(w, "User not found", http.StatusBadRequest)
	default:
		log.Printf("AcceptHouseholdInvite: %v", err)
		http.Error(w, "Failed to join household", http.StatusInternalServerError)
	}
}
