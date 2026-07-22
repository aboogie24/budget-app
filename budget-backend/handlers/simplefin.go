package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/bankprovider"
	"github.com/aboogie/budget-backend/internal/simplefin"
	"github.com/gofrs/uuid"
)

// SimpleFINConnect claims a user-supplied SimpleFIN setup token, stores the
// resulting access URL as a linked account, and kicks off the initial sync +
// AI categorization in the background — the same post-link behavior as Teller.
// POST /auth/simplefin/connect  {"setup_token": "..."}
func SimpleFINConnect(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	var req struct {
		SetupToken string `json:"setup_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SetupToken == "" {
		http.Error(w, "setup_token is required", http.StatusBadRequest)
		return
	}

	// Claim BEFORE touching the database — the token is one-time-use, so a
	// failed claim should leave no trace.
	accessURL, err := simplefin.ClaimSetupToken(req.SetupToken)
	if err != nil {
		log.Printf("simplefin: claim failed for user %s: %v", userID, err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	// Probe the connection and grab an institution label for the account row.
	institution := "SimpleFIN"
	if set, perr := simplefin.FetchAccounts(accessURL, time.Now(), true); perr != nil {
		log.Printf("simplefin: post-claim probe failed (non-fatal): %v", perr)
	} else if len(set.Accounts) > 0 {
		institution = set.InstitutionFor(set.Accounts[0])
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	accountID := uuid.Must(uuid.NewV4()).String()
	_, err = conn.Exec(`
		INSERT INTO linked_accounts
			(id, user_id, item_id, access_token, institution_name, provider, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'simplefin', NOW(), NOW())
	`, accountID, userID, accountID, accessURL, institution)
	if err != nil {
		log.Printf("simplefin: failed to create linked account: %v", err)
		http.Error(w, "Failed to create linked account", http.StatusInternalServerError)
		return
	}
	log.Printf("simplefin: linked account created id=%s user=%s institution=%s", accountID, userID, institution)

	// Initial sync + auto AI categorization in the background.
	go func(linkedID, access string) {
		bg, err := db.New()
		if err != nil {
			log.Printf("simplefin: initial sync DB error: %v", err)
			return
		}
		defer bg.Close()

		householdID := db.ResolveHouseholdID(bg.Conn, userID)
		acct := bankprovider.LinkedAccount{
			ID:          linkedID,
			UserID:      userID,
			HouseholdID: householdID,
			Provider:    "simplefin",
			AccessToken: access,
		}
		provider := bankprovider.NewSimpleFINProvider()

		if synced, serr := provider.SyncTransactions(bg.Conn, acct); serr != nil {
			log.Printf("simplefin: initial transaction sync failed for %s: %v", linkedID, serr)
		} else {
			log.Printf("simplefin: initial sync completed, %d transactions for %s", synced, linkedID)
			if synced > 0 {
				if m, c, a, aerr := RunAICategorization(bg, userID); aerr != nil {
					log.Printf("simplefin: post-sync AI categorization failed for %s: %v", linkedID, aerr)
				} else if m > 0 {
					log.Printf("simplefin: post-sync AI categorization for %s: merchants=%d classified=%d applied=%d", linkedID, m, c, a)
				}
			}
		}
		if updated, berr := provider.SyncBalances(bg.Conn, acct); berr != nil {
			log.Printf("simplefin: initial balance sync failed for %s: %v", linkedID, berr)
		} else {
			log.Printf("simplefin: initial balance sync completed, %d accounts for %s", updated, linkedID)
		}
	}(accountID, accessURL)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":          accountID,
		"provider":    "simplefin",
		"institution": institution,
		"status":      "linked",
	})
}
