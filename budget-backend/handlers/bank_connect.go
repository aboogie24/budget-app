package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/bankprovider"
)

// recordSyncFailure persists provider-specific lifecycle errors on
// linked_accounts so the UI can surface a Reconnect affordance. Today only
// Teller's "enrollment.disconnected.*" responses are mapped; other failures
// remain transient.
func recordSyncFailure(conn *sql.DB, accountID, provider string, syncErr error) {
	if syncErr == nil {
		return
	}
	if provider == "teller" && bankprovider.IsTellerReauthError(syncErr) {
		// Extract just the Teller code (e.g. enrollment.disconnected.user_action.web_login_required)
		// from the wrapped error message for storage.
		msg := syncErr.Error()
		code := msg
		if idx := strings.Index(msg, "enrollment.disconnected"); idx >= 0 {
			tail := msg[idx:]
			end := len(tail)
			for i, r := range tail {
				if r == ' ' || r == ')' || r == '\n' {
					end = i
					break
				}
			}
			code = tail[:end]
		}
		if _, err := conn.Exec(`
			UPDATE linked_accounts
			SET item_status = 'login_required', error_code = $1, updated_at = NOW()
			WHERE id = $2
		`, code, accountID); err != nil {
			log.Printf("recordSyncFailure: failed to flag account %s: %v", accountID, err)
		}
	}
}

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
		recordSyncFailure(dbClient.Conn, acct.ID, acct.Provider, err)
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

// SyncAllBankAccounts iterates every linked account for the user and
// dispatches each to its provider for transaction sync. Errors on individual
// accounts are logged and skipped so one bad account doesn't fail the batch.
// POST /auth/bank/sync-all
func SyncAllBankAccounts(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	rows, err := dbClient.Query(`
		SELECT id, user_id, household_id, item_id, access_token, institution_name,
		       provider, flinks_request_id, flinks_institution_id
		FROM linked_accounts
		WHERE user_id = $1
	`, userID)
	if err != nil {
		log.Printf("sync-all: list linked accounts error: %v", err)
		http.Error(w, "Failed to list accounts", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type result struct {
		AccountID string `json:"account_id"`
		Provider  string `json:"provider"`
		Synced    int    `json:"synced"`
		Error     string `json:"error,omitempty"`
	}

	var (
		results       []result
		totalSynced   int
		perProvider   = map[string]int{}
		accounts      []bankprovider.LinkedAccount
	)

	for rows.Next() {
		var acct bankprovider.LinkedAccount
		var accessToken, householdID, flinksReqID, flinksInstID *string
		if err := rows.Scan(
			&acct.ID, &acct.UserID, &householdID, &acct.ItemID, &accessToken,
			&acct.InstitutionName, &acct.Provider, &flinksReqID, &flinksInstID,
		); err != nil {
			log.Printf("sync-all: scan error: %v", err)
			continue
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
		accounts = append(accounts, acct)
	}

	for _, acct := range accounts {
		provider := bankprovider.GetProvider(acct.Provider)
		synced, syncErr := provider.SyncTransactions(dbClient.Conn, acct)
		res := result{AccountID: acct.ID, Provider: acct.Provider, Synced: synced}
		if syncErr != nil {
			recordSyncFailure(dbClient.Conn, acct.ID, acct.Provider, syncErr)
			log.Printf("sync-all: account %s (provider=%s) error: %v", acct.ID, acct.Provider, syncErr)
			res.Error = syncErr.Error()
		} else {
			totalSynced += synced
			perProvider[acct.Provider] += synced
		}
		results = append(results, res)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"synced":       totalSynced,
		"per_provider": perProvider,
		"accounts":     results,
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

	// Add Teller if configured
	if os.Getenv("TELLER_APPLICATION_ID") != "" {
		providers = append(providers, map[string]interface{}{
			"name":        "teller",
			"label":       "Teller",
			"description": "Connect to US banks and credit unions",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(providers)
}
