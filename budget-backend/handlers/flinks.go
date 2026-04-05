package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/bankprovider"
	"github.com/aboogie/budget-backend/internal/flinks"
	"github.com/gofrs/uuid"
)

// flinksConnectRequest is the body for POST /auth/flinks/connect.
type flinksConnectRequest struct {
	LoginID     string `json:"login_id"`
	Institution string `json:"institution"`
}

// FlinksAuthorizeToken generates a single-use token for Flinks Connect.
// POST /auth/flinks/authorize-token
func FlinksAuthorizeToken(w http.ResponseWriter, r *http.Request) {
	client := flinks.NewClient()
	if !client.IsAvailable() {
		http.Error(w, "Flinks not configured", http.StatusServiceUnavailable)
		return
	}

	token, err := client.GenerateAuthorizeToken()
	if err != nil {
		log.Printf("flinks: failed to generate authorize token: %v", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Build the Flinks Connect URL based on environment
	instanceID := os.Getenv("FLINKS_INSTANCE_ID")
	flinksEnv := os.Getenv("FLINKS_ENV")
	var connectBase string
	if flinksEnv == "production" {
		connectBase = "https://" + instanceID + "-iframe.private.fin.ag/v2/"
	} else {
		connectBase = "https://" + instanceID + "-iframe.private.fin.ag/v2/"
	}
	connectURL := connectBase + "?authorizeToken=" + token + "&demo=" + func() string { if flinksEnv == "sandbox" { return "true" } else { return "false" } }() + "&language=en"

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"authorize_token": token,
		"connect_url":     connectURL,
	})
}

// FlinksConnect stores the loginId after the user completes Flinks Connect,
// then triggers an initial sync.
// POST /auth/flinks/connect
func FlinksConnect(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	var req flinksConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.LoginID == "" {
		http.Error(w, "Missing login_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Check if this loginId already exists for this user
	var existingID string
	err = dbClient.QueryRow(`
		SELECT id FROM linked_accounts
		WHERE user_id = $1 AND item_id = $2 AND provider = 'flinks'
	`, userID, req.LoginID).Scan(&existingID)

	if err == nil {
		// Already exists, return it
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"id":       existingID,
			"status":   "already_linked",
			"provider": "flinks",
		})
		return
	}

	// Create a new linked account
	accountID := uuid.Must(uuid.NewV4()).String()
	institution := req.Institution
	if institution == "" {
		institution = "Unknown Institution"
	}

	_, err = dbClient.Exec(`
		INSERT INTO linked_accounts (id, user_id, item_id, institution_name, provider, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'flinks', NOW(), NOW())
	`, accountID, userID, req.LoginID, institution)
	if err != nil {
		log.Printf("flinks: failed to create linked account: %v", err)
		http.Error(w, "Failed to create linked account", http.StatusInternalServerError)
		return
	}

	log.Printf("flinks: linked account created id=%s user=%s institution=%s", accountID, userID, institution)

	// Trigger initial sync in background
	go func() {
		provider := bankprovider.NewFlinksProvider()
		acct := bankprovider.LinkedAccount{
			ID:              accountID,
			UserID:          userID,
			Provider:        "flinks",
			ItemID:          req.LoginID,
			InstitutionName: institution,
		}

		synced, err := provider.SyncTransactions(dbClient.Conn, acct)
		if err != nil {
			log.Printf("flinks: initial transaction sync failed for account %s: %v", accountID, err)
		} else {
			log.Printf("flinks: initial sync completed, %d transactions for account %s", synced, accountID)
		}

		updated, err := provider.SyncBalances(dbClient.Conn, acct)
		if err != nil {
			log.Printf("flinks: initial balance sync failed for account %s: %v", accountID, err)
		} else {
			log.Printf("flinks: initial balance sync completed, %d accounts for account %s", updated, accountID)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":       accountID,
		"status":   "linked",
		"provider": "flinks",
	})
}

// FlinksWebhook handles Flinks webhook callbacks.
// POST /webhooks/flinks (public, no auth)
func FlinksWebhook(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		log.Printf("flinks webhook: failed to decode body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("flinks webhook received: %+v", payload)

	// Return 200 OK immediately
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "received"})

	// Try to trigger a sync if we can identify the loginId
	loginId, ok := payload["LoginId"].(string)
	if !ok || loginId == "" {
		log.Printf("flinks webhook: no LoginId found, skipping sync")
		return
	}

	go func() {
		dbClient, err := db.New()
		if err != nil {
			log.Printf("flinks webhook: DB connection error: %v", err)
			return
		}
		defer dbClient.Close()

		var acct bankprovider.LinkedAccount
		var householdID, accessToken, flinksReqID, flinksInstID *string

		err = dbClient.QueryRow(`
			SELECT id, user_id, household_id, item_id, access_token, institution_name,
			       flinks_request_id, flinks_institution_id
			FROM linked_accounts
			WHERE item_id = $1 AND provider = 'flinks'
		`, loginId).Scan(
			&acct.ID, &acct.UserID, &householdID, &acct.ItemID, &accessToken,
			&acct.InstitutionName, &flinksReqID, &flinksInstID,
		)
		if err != nil {
			log.Printf("flinks webhook: no linked account found for loginId=%s: %v", loginId, err)
			return
		}

		if householdID != nil {
			acct.HouseholdID = *householdID
		}
		if flinksReqID != nil {
			acct.FlinksRequestID = *flinksReqID
		}
		if flinksInstID != nil {
			acct.FlinksInstID = *flinksInstID
		}
		acct.Provider = "flinks"

		provider := bankprovider.NewFlinksProvider()

		synced, err := provider.SyncTransactions(dbClient.Conn, acct)
		if err != nil {
			log.Printf("flinks webhook: transaction sync failed for account %s: %v", acct.ID, err)
		} else {
			log.Printf("flinks webhook: synced %d transactions for account %s", synced, acct.ID)
		}

		updated, err := provider.SyncBalances(dbClient.Conn, acct)
		if err != nil {
			log.Printf("flinks webhook: balance sync failed for account %s: %v", acct.ID, err)
		} else {
			log.Printf("flinks webhook: synced %d balances for account %s", updated, acct.ID)
		}
	}()
}
