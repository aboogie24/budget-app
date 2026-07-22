package bankprovider

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/internal/categories"
	"github.com/aboogie/budget-backend/internal/simplefin"
	"github.com/gofrs/uuid"
)

// SimpleFINProvider implements the Provider interface for SimpleFIN Bridge.
// The linked account's AccessToken IS the SimpleFIN access URL (with embedded
// basic-auth credentials) obtained by claiming the user's setup token.
type SimpleFINProvider struct{}

// NewSimpleFINProvider creates a new SimpleFINProvider instance.
func NewSimpleFINProvider() *SimpleFINProvider { return &SimpleFINProvider{} }

func (s *SimpleFINProvider) Name() string { return "simplefin" }

// SyncTransactions pulls transactions for every account behind the SimpleFIN
// connection and upserts them, running the deterministic categorizer inline —
// same shape as the Teller provider.
func (s *SimpleFINProvider) SyncTransactions(conn *sql.DB, account LinkedAccount) (int, error) {
	if account.AccessToken == "" {
		return 0, fmt.Errorf("simplefin: linked account has no access url")
	}

	// One day inside the bridge's 90-day range limit: asking for exactly 90
	// days (plus time-of-day) trips its "range exceeds limit and was capped"
	// warning on every sync.
	start := time.Now().AddDate(0, 0, -(transactionLookbackDays - 1))
	set, err := simplefin.FetchAccounts(account.AccessToken, start, false)
	if err != nil {
		return 0, fmt.Errorf("simplefin fetch accounts: %w", err)
	}
	for _, e := range append(set.Errors, set.ErrList...) {
		log.Printf("simplefin: bridge warning: %s", e)
	}

	synced := 0
	for _, acct := range set.Accounts {
		// SimpleFIN exposes no account type, so credit-card payments can't be
		// distinguished from income here; the cross-account transfer detector
		// pairs them after sync (same approach as unlabeled Plaid accounts).
		for _, tx := range acct.Transactions {
			amt, perr := strconv.ParseFloat(tx.Amount, 64)
			if perr != nil {
				log.Printf("simplefin: skipping transaction %s — bad amount %q: %v", tx.ID, tx.Amount, perr)
				continue
			}
			txType := "expense"
			if amt > 0 {
				txType = "income"
			}
			amount := math.Abs(amt)

			// Posted is 0 while pending; fall back to transacted_at, then now.
			epoch := tx.Posted
			if epoch == 0 {
				epoch = tx.TransactedAt
			}
			txDate := time.Now().UTC()
			if epoch > 0 {
				txDate = time.Unix(epoch, 0).UTC()
			}

			merchantNorm := categories.NormalizeMerchant(tx.Description, "")
			var resolvedCatID, matchConfidence, matchedRuleID *string
			catID, conf, ruleID, resolveErr := categories.ResolveCategory(
				conn, account.UserID, account.HouseholdID, merchantNorm, nil)
			if resolveErr != nil {
				log.Printf("simplefin: category resolve error (non-fatal): %v", resolveErr)
			}
			if catID != "" {
				resolvedCatID = &catID
			}
			if conf != "" {
				matchConfidence = &conf
			}
			if ruleID != nil {
				matchedRuleID = ruleID
			}
			userVerified := conf == "exact"

			// External id is scoped per bridge account so the same id from two
			// different accounts can't collide.
			externalID := acct.ID + ":" + tx.ID

			_, err := conn.Exec(`
				INSERT INTO transactions
					(id, user_id, household_id, type, amount, category_id, note, date,
					 source, external_id, merchant_normalized, match_confidence, matched_rule_id, user_verified, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'simplefin', $9, $10, $11, $12, $13, NOW())
				ON CONFLICT (user_id, source, external_id) WHERE external_id IS NOT NULL
				DO UPDATE SET
					type = EXCLUDED.type,
					amount = EXCLUDED.amount,
					note = EXCLUDED.note,
					date = EXCLUDED.date,
					merchant_normalized = EXCLUDED.merchant_normalized,
					updated_at = NOW()
			`,
				uuid.Must(uuid.NewV4()).String(),
				account.UserID,
				nilIfEmpty(account.HouseholdID),
				txType,
				amount,
				resolvedCatID,
				tx.Description,
				txDate,
				nilIfEmpty(externalID),
				nilIfEmpty(merchantNorm),
				matchConfidence,
				matchedRuleID,
				userVerified,
			)
			if err != nil {
				log.Printf("simplefin: failed to upsert transaction %s: %v", tx.ID, err)
				continue
			}
			synced++
		}
	}

	log.Printf("simplefin: synced %d transactions for linked account %s", synced, account.ID)
	return synced, nil
}

// SyncBalances upserts a balance row per account behind the connection.
func (s *SimpleFINProvider) SyncBalances(conn *sql.DB, account LinkedAccount) (int, error) {
	if account.AccessToken == "" {
		return 0, fmt.Errorf("simplefin: linked account has no access url")
	}

	set, err := simplefin.FetchAccounts(account.AccessToken, time.Now(), true)
	if err != nil {
		return 0, fmt.Errorf("simplefin fetch balances: %w", err)
	}

	updated := 0
	for _, acct := range set.Accounts {
		current, perr := strconv.ParseFloat(acct.Balance, 64)
		if perr != nil {
			log.Printf("simplefin: skipping balance for %s — bad amount %q", acct.ID, acct.Balance)
			continue
		}
		var availablePtr *float64
		if avail, aerr := strconv.ParseFloat(acct.AvailableBalance, 64); aerr == nil {
			availablePtr = &avail
		}

		// SimpleFIN has no account type; a negative balance almost always
		// means a credit/loan account — good enough for net-worth bucketing.
		acctType := "depository"
		if current < 0 {
			acctType = "credit"
		}

		currency := acct.Currency
		if strings.HasPrefix(currency, "http") || currency == "" {
			currency = "USD" // custom-currency URLs aren't ISO codes
		}

		_, err = conn.Exec(`
			INSERT INTO account_balances
				(id, user_id, household_id, linked_account_id, plaid_account_id,
				 name, type, subtype, current_balance, available_balance,
				 iso_currency_code, institution_name, mask, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
			ON CONFLICT (user_id, plaid_account_id) DO UPDATE SET
				current_balance = EXCLUDED.current_balance,
				available_balance = EXCLUDED.available_balance,
				name = EXCLUDED.name,
				type = EXCLUDED.type,
				institution_name = EXCLUDED.institution_name,
				updated_at = NOW()
		`,
			uuid.Must(uuid.NewV4()).String(),
			account.UserID,
			nilIfEmpty(account.HouseholdID),
			account.ID,
			acct.ID, // SimpleFIN account id stored in the plaid_account_id column
			acct.Name,
			acctType,
			nil,
			current,
			availablePtr,
			currency,
			nilIfEmpty(set.InstitutionFor(acct)),
			nil,
		)
		if err != nil {
			log.Printf("simplefin: failed to upsert balance for %s: %v", acct.ID, err)
			continue
		}
		updated++
	}

	log.Printf("simplefin: updated %d balances for linked account %s", updated, account.ID)
	SyncLinkedGoalBalances(conn, account)
	return updated, nil
}

// SyncInvestments is a no-op — SimpleFIN has no investment data.
func (s *SimpleFINProvider) SyncInvestments(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, nil
}

// SyncLiabilities is a no-op — SimpleFIN has no liability data.
func (s *SimpleFINProvider) SyncLiabilities(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, nil
}
