package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/entitlements"
)

// GetEntitlements returns household Free|Plus entitlements for the caller.
// GET /auth/entitlements?user_id=
func GetEntitlements(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		validationError(w, "user_id is required")
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	ent, err := entitlements.ResolveForUser(conn.Raw(), userID)
	if err != nil {
		log.Printf("GetEntitlements: %v", err)
		http.Error(w, "Failed to resolve entitlements", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ent)
}

// SetHouseholdPlan sets households.plan for the caller's household (dev/admin).
// No Stripe/IAP — internal flag only. PUT /auth/households/plan
// Body: { "user_id": "...", "plan": "free"|"plus" }
func SetHouseholdPlan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string `json:"user_id"`
		HouseholdID string `json:"household_id"`
		Plan        string `json:"plan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		req.UserID, _ = getUserIDFromRequest(r)
	}
	if req.UserID == "" {
		validationError(w, "user_id is required")
		return
	}
	if !entitlements.IsValidPlan(req.Plan) {
		validationError(w, "plan must be free or plus")
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := strings.TrimSpace(req.HouseholdID)
	if householdID == "" {
		householdID, err = db.EnsureHouseholdForUser(conn.Raw(), req.UserID)
		if err != nil {
			log.Printf("SetHouseholdPlan ensure: %v", err)
			http.Error(w, "Failed to ensure household", http.StatusInternalServerError)
			return
		}
	} else {
		// Caller must be a member of the target household.
		var ok bool
		err = conn.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM household_members WHERE household_id = $1 AND user_id = $2
			)
		`, householdID, req.UserID).Scan(&ok)
		if err != nil || !ok {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	plan := entitlements.NormalizePlan(req.Plan)
	if err := entitlements.SetHouseholdPlan(conn.Raw(), householdID, plan); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Household not found", http.StatusNotFound)
			return
		}
		log.Printf("SetHouseholdPlan: %v", err)
		http.Error(w, "Failed to set plan", http.StatusInternalServerError)
		return
	}

	ent, err := entitlements.ResolveForHousehold(conn.Raw(), householdID)
	if err != nil {
		log.Printf("SetHouseholdPlan resolve: %v", err)
		http.Error(w, "Plan set but resolve failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":       "ok",
		"household_id": householdID,
		"plan":         plan,
		"entitlements": ent,
	})
}

// writeEntitlementJSONError writes a structured Free-gate response.
func writeEntitlementJSONError(w http.ResponseWriter, status int, code, message string, ent entitlements.Entitlements) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":        "entitlement_limit",
		"code":         code,
		"message":      message,
		"plan":         ent.Plan,
		"entitlements": ent,
	})
}

// resolveUserEntitlements is a shared helper for handlers that need Free|Plus gates.
func resolveUserEntitlements(conn *sql.DB, userID string) (entitlements.Entitlements, error) {
	return entitlements.ResolveForUser(conn, userID)
}

// checkBankLinkAllowed returns false after writing 403 when Free household is at 1 bank.
func checkBankLinkAllowed(w http.ResponseWriter, conn *sql.DB, userID string) bool {
	ent, err := resolveUserEntitlements(conn, userID)
	if err != nil {
		log.Printf("bank entitlement resolve: %v", err)
		http.Error(w, "Failed to check entitlements", http.StatusInternalServerError)
		return false
	}
	if entitlements.AllowsBankLink(ent) {
		return true
	}
	writeEntitlementJSONError(w, http.StatusForbidden, "banks_limit",
		"Free plan allows 1 linked bank account. Upgrade the household to Plus for multi-bank.", ent)
	return false
}

// checkAIMessageAllowed returns false after writing 403 when Free weekly cap is hit.
func checkAIMessageAllowed(w http.ResponseWriter, conn *sql.DB, userID string) (entitlements.Entitlements, bool) {
	ent, err := resolveUserEntitlements(conn, userID)
	if err != nil {
		log.Printf("ai entitlement resolve: %v", err)
		http.Error(w, "Failed to check entitlements", http.StatusInternalServerError)
		return ent, false
	}
	if entitlements.AllowsAIMessage(ent) {
		return ent, true
	}
	writeEntitlementJSONError(w, http.StatusForbidden, "ai_message_budget",
		"Free plan allows 10 AI messages per household every 7 days. Upgrade to Plus for full advisor access.", ent)
	return ent, false
}
