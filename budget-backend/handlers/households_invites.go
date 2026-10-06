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

	userID, ok := resolveInviteActor(w, r, body.UserID)
	if !ok {
		return
	}
	if body.InviteeEmail == "" {
		log.Printf("CreateHouseholdInvite missing invitee_email user_id=%s", userID)
		http.Error(w, "Missing invitee_email", http.StatusBadRequest)
		return
	}
	hhID := body.HouseholdID

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// N1: the invite's household is the caller's own household. A client-supplied
	// household_id is only honored if the caller is a member of it; if it names an existing
	// household the caller does not belong to → 403. A stale/unknown id (e.g. a solo deleted
	// by a C038 accept) falls back to the caller's session membership.
	var householdUUID uuid.UUID
	if hhID != "" {
		if parsed, err := uuid.FromString(hhID); err == nil {
			var exists bool
			if err := client.Raw().QueryRow(`SELECT EXISTS(SELECT 1 FROM households WHERE id=$1)`, parsed).Scan(&exists); err != nil {
				log.Printf("CreateHouseholdInvite household lookup error: %v", err)
				http.Error(w, "Failed to create invite", http.StatusInternalServerError)
				return
			}
			if exists {
				if !requireHouseholdMember(w, client.Raw(), parsed.String(), userID) {
					log.Printf("CreateHouseholdInvite forbidden: user=%s not member of household=%s", userID, parsed)
					return
				}
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
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	var code, claimedUserID string
	if v, ok := raw["code"]; ok {
		_ = json.Unmarshal(v, &code)
	}
	if v, ok := raw["user_id"]; ok {
		_ = json.Unmarshal(v, &claimedUserID)
	}
	if code == "" {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	userID, ok := resolveInviteActor(w, r, claimedUserID)
	if !ok {
		return
	}

	confirm := false
	if v, ok := raw["confirm_migrate"]; ok && string(v) != "null" {
		var b bool
		if err := json.Unmarshal(v, &b); err != nil {
			// Spec: not boolean-true → 409 migrate_confirmation_required
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error":   "migrate_confirmation_required",
				"code":    "migrate_confirmation_required",
				"message": "Accepting this invite moves your existing household data into the partner household. Confirm to continue.",
			})
			return
		}
		confirm = b
	}

	client, err := householdDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	result, conflict, err := households.AcceptInvite(client.Raw(), households.AcceptRequest{
		Code:           code,
		UserID:         userID,
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
		http.Error(w, "Failed to join household", households.StatusForAcceptError(err))
	}
}
