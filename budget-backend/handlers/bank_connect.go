package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/bankprovider"
)

type syncBankRequest struct {
	AccountID string `json:"account_id"`
}

// SyncBankAccount looks up a linked account, determines its provider, and
// delegates the sync to the appropriate provider implementation.
// POST /auth/bank/sync
func SyncBankAccount(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	var req syncBankRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.AccountID == "" {
		http.Error(w, "Missing account_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Look up the linked account and its provider
	var acct bankprovider.LinkedAccount
	var accessToken *string
	var householdID *string
	var flinksReqID, flinksInstID *string

	err = dbClient.QueryRow(`
		SELECT id, user_id, household_id, item_id, access_token, institution_name,
		       provider, flinks_request_id, flinks_institution_id
		FROM linked_accounts
		WHERE id = $1 AND user_id = $2
	`, req.AccountID, userID).Scan(
		&acct.ID, &acct.UserID, &householdID, &acct.ItemID, &accessToken,
		&acct.InstitutionName, &acct.Provider, &flinksReqID, &flinksInstID,
	)
	if err != nil {
		http.Error(w, "Account not found", http.StatusNotFound)
		return
	}

	if householdID != nil {
		acct.HouseholdID = *householdID
	}
	if accessToken != nil {
		acct.AccessToken = *accessToken
	}
	if flinksReqID != nil {
		acct.FlinksRequestID = *flinksReqID
	}
	if flinksInstID != nil {
		acct.FlinksInstID = *flinksInstID
	}

	provider := bankprovider.GetProvider(acct.Provider)

	synced, err := provider.SyncTransactions(dbClient.Conn, acct)
	if err != nil {
		log.Printf("bank sync error for account %s (provider=%s): %v", acct.ID, acct.Provider, err)
		http.Error(w, "Sync failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"synced":   synced,
		"provider": acct.Provider,
	})
}

// GetBankProviders returns the list of available bank connection providers.
// GET /auth/bank/providers
func GetBankProviders(w http.ResponseWriter, r *http.Request) {
	providers := []map[string]interface{}{
		{
			"name":        "plaid",
			"label":       "Plaid",
			"description": "Connect to 12,000+ US financial institutions",
		},
	}

	// Add Flinks if env vars are configured
	if os.Getenv("FLINKS_INSTANCE_ID") != "" {
		providers = append(providers, map[string]interface{}{
			"name":        "flinks",
			"label":       "Flinks",
			"description": "Connect to 15,000+ North American institutions",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providers)
}
