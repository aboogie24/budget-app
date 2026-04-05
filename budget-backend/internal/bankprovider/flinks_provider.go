package bankprovider

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/internal/categories"
	"github.com/aboogie/budget-backend/internal/flinks"
	"github.com/gofrs/uuid"
)

// FlinksProvider implements the Provider interface for Flinks.
type FlinksProvider struct {
	client *flinks.Client
}

// NewFlinksProvider creates a new FlinksProvider instance.
func NewFlinksProvider() *FlinksProvider {
	return &FlinksProvider{
		client: flinks.NewClient(),
	}
}

func (f *FlinksProvider) Name() string { return "flinks" }

func (f *FlinksProvider) SyncTransactions(conn *sql.DB, account LinkedAccount) (int, error) {
	if !f.client.IsAvailable() {
		return 0, fmt.Errorf("flinks client not configured")
	}

	// Step 1: Authorize with the loginId (stored as ItemID)
	requestId, err := f.client.Authorize(account.ItemID)
	if err != nil {
		return 0, fmt.Errorf("flinks authorize: %w", err)
	}

	// Step 2: Fetch full account detail with transactions
	detail, err := f.client.GetAccountsDetail(requestId)
	if err != nil {
		return 0, fmt.Errorf("flinks get accounts detail: %w", err)
	}

	// Step 3: Map and insert transactions
	synced := 0
	for _, acct := range detail.Accounts {
		for _, tx := range acct.Transactions {
			txID := uuid.Must(uuid.NewV4()).String()

			txType := "expense"
			amount := tx.Debit
			if tx.Credit > 0 {
				txType = "income"
				amount = tx.Credit
			}

			// Parse ISO date
			txDate := time.Now()
			if tx.Date != "" {
				// Try common ISO formats
				for _, layout := range []string{
					"2006-01-02T15:04:05",
					"2006-01-02",
					time.RFC3339,
				} {
					if parsed, err := time.Parse(layout, tx.Date); err == nil {
						txDate = parsed
						break
					}
				}
			}

			// Resolve category using mapping rules
			var resolvedCatID *string
			var matchConfidence *string
			var matchedRuleID *string
			merchantName := tx.Description
			plaidCats := []string{} // Flinks doesn't provide Plaid-style categories
			catID, conf, ruleID, resolveErr := categories.ResolveCategory(conn, account.UserID, account.HouseholdID, merchantName, plaidCats)
			if resolveErr != nil {
				log.Printf("flinks: category resolve error (non-fatal): %v", resolveErr)
			}
			if catID != "" {
				resolvedCatID = &catID
			}
			if conf != "" && conf != "low" {
				matchConfidence = &conf
			}
			if ruleID != nil {
				matchedRuleID = ruleID
			}

			source := "flinks"
			_, err := conn.Exec(`
				INSERT INTO transactions (id, user_id, household_id, type, amount, category_id, note, date, source, match_confidence, matched_rule_id, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
				ON CONFLICT DO NOTHING
			`,
				txID,
				account.UserID,
				nilIfEmpty(account.HouseholdID),
				txType,
				amount,
				resolvedCatID,
				tx.Description,
				txDate,
				source,
				matchConfidence,
				matchedRuleID,
			)
			if err != nil {
				log.Printf("flinks: failed to insert transaction: %v", err)
				continue
			}
			synced++
		}
	}

	// Step 4: Update the flinks_request_id on the linked account
	_, err = conn.Exec(`
		UPDATE linked_accounts SET flinks_request_id = $1, updated_at = NOW()
		WHERE id = $2
	`, requestId, account.ID)
	if err != nil {
		log.Printf("flinks: failed to update flinks_request_id: %v", err)
	}

	log.Printf("flinks: synced %d transactions for account %s", synced, account.ID)
	return synced, nil
}

func (f *FlinksProvider) SyncBalances(conn *sql.DB, account LinkedAccount) (int, error) {
	if !f.client.IsAvailable() {
		return 0, fmt.Errorf("flinks client not configured")
	}

	// Step 1: Authorize
	requestId, err := f.client.Authorize(account.ItemID)
	if err != nil {
		return 0, fmt.Errorf("flinks authorize: %w", err)
	}

	// Step 2: Fetch account summary (balances only, faster)
	summary, err := f.client.GetAccountsSummary(requestId)
	if err != nil {
		return 0, fmt.Errorf("flinks get accounts summary: %w", err)
	}

	// Step 3: Map and upsert account balances
	updated := 0
	for _, acct := range summary.Accounts {
		balanceID := uuid.Must(uuid.NewV4()).String()

		// Map Flinks category to app account type
		accountType := mapFlinksCategory(acct.Category)

		// Extract last 4 of account number for mask
		var mask *string
		if len(acct.AccountNumber) >= 4 {
			last4 := acct.AccountNumber[len(acct.AccountNumber)-4:]
			mask = &last4
		}

		var availableBalance *float64
		if acct.Balance.Available > 0 {
			availableBalance = &acct.Balance.Available
		}

		// Upsert: match on linked_account_id + plaid_account_id (using flinks account ID)
		_, err := conn.Exec(`
			INSERT INTO account_balances (id, user_id, household_id, linked_account_id, plaid_account_id,
				name, type, current_balance, available_balance, iso_currency_code, mask, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
			ON CONFLICT (plaid_account_id) DO UPDATE SET
				current_balance = EXCLUDED.current_balance,
				available_balance = EXCLUDED.available_balance,
				name = EXCLUDED.name,
				updated_at = NOW()
		`,
			balanceID,
			account.UserID,
			nilIfEmpty(account.HouseholdID),
			account.ID,
			acct.Id, // flinks account ID stored in plaid_account_id column
			acct.Title,
			accountType,
			acct.Balance.Current,
			availableBalance,
			defaultIfEmpty(acct.Currency, "CAD"),
			mask,
		)
		if err != nil {
			log.Printf("flinks: failed to upsert account balance: %v", err)
			continue
		}
		updated++
	}

	// Update the flinks_request_id
	_, err = conn.Exec(`
		UPDATE linked_accounts SET flinks_request_id = $1, updated_at = NOW()
		WHERE id = $2
	`, requestId, account.ID)
	if err != nil {
		log.Printf("flinks: failed to update flinks_request_id: %v", err)
	}

	log.Printf("flinks: synced %d account balances for account %s", updated, account.ID)
	return updated, nil
}

func (f *FlinksProvider) SyncInvestments(conn *sql.DB, account LinkedAccount) (int, error) {
	// Flinks investment support can be added later
	return 0, nil
}

func (f *FlinksProvider) SyncLiabilities(conn *sql.DB, account LinkedAccount) (int, error) {
	// Flinks liability support can be added later
	return 0, nil
}

// mapFlinksCategory maps a Flinks account category to the app's account type.
func mapFlinksCategory(category string) string {
	switch strings.ToLower(category) {
	case "operationaccount", "operations":
		return "depository"
	case "creditcard", "credit card":
		return "credit"
	case "savings":
		return "depository"
	case "loan":
		return "loan"
	case "investment":
		return "investment"
	default:
		return "depository"
	}
}

// nilIfEmpty returns nil if the string is empty, otherwise a pointer to the string.
func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// defaultIfEmpty returns the value if non-empty, otherwise the fallback.
func defaultIfEmpty(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
