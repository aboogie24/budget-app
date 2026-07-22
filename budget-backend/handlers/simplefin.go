package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/bankprovider"
	"github.com/aboogie/budget-backend/internal/simplefin"
	"github.com/aboogie/budget-backend/internal/transfers"
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

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// The setup token is ONE-TIME-USE: once claimed, a lost access URL means
	// the user must generate a fresh token. So surface DB-side failures
	// (constraints, connectivity) BEFORE claiming by inserting a placeholder
	// row first, then claim, then attach the access URL — and delete the
	// placeholder if the claim fails.
	accountID := uuid.Must(uuid.NewV4()).String()
	_, err = conn.Exec(`
		INSERT INTO linked_accounts
			(id, user_id, item_id, access_token, institution_name, provider, created_at, updated_at)
		VALUES ($1, $2, $3, 'pending-claim', 'SimpleFIN', 'simplefin', NOW(), NOW())
	`, accountID, userID, accountID)
	if err != nil {
		log.Printf("simplefin: failed to create linked account: %v", err)
		http.Error(w, "Failed to create linked account", http.StatusInternalServerError)
		return
	}

	accessURL, err := simplefin.ClaimSetupToken(req.SetupToken)
	if err != nil {
		_, _ = conn.Exec(`DELETE FROM linked_accounts WHERE id = $1`, accountID)
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

	if _, err = conn.Exec(`
		UPDATE linked_accounts SET access_token = $2, institution_name = $3, updated_at = NOW()
		WHERE id = $1
	`, accountID, accessURL, institution); err != nil {
		// Extremely unlikely (row was just inserted). Keep the row so the
		// claimed access URL isn't orphaned silently; sync will fail visibly
		// on the placeholder and the user can unlink it.
		log.Printf("simplefin: CRITICAL — claimed access URL could not be stored for %s: %v", accountID, err)
		http.Error(w, "Failed to store connection — please unlink the pending account and try a new token", http.StatusInternalServerError)
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
				// Pair internal transfers FIRST — SimpleFIN can't type accounts,
				// so card payments and inter-account moves arrive as fake
				// income/expense rows; pairing reclassifies them before the
				// LLM wastes calls categorizing them.
				if pairs, terr := transfers.DetectPairs(bg.Conn, userID); terr != nil {
					log.Printf("simplefin: post-sync transfer detection failed for %s: %v", linkedID, terr)
				} else if pairs > 0 {
					log.Printf("simplefin: post-sync transfer detection for %s: %d pairs", linkedID, pairs)
				}
				if m, c, a, aerr := RunAICategorization(bg, userID); aerr != nil {
					log.Printf("simplefin: post-sync AI categorization failed for %s: %v", linkedID, aerr)
				} else if m > 0 {
					log.Printf("simplefin: post-sync AI categorization for %s: merchants=%d classified=%d applied=%d", linkedID, m, c, a)
				}
				if d := detectBillPayments(bg.Conn, userID); len(d) > 0 {
					log.Printf("simplefin: post-sync bill payment detection for %s: %d payment(s)", linkedID, len(d))
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
