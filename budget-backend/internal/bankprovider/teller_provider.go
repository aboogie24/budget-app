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
	"github.com/aboogie/budget-backend/internal/teller"
	"github.com/gofrs/uuid"
)

// transactionLookbackDays bounds how far back the initial/on-demand sync pulls.
const transactionLookbackDays = 90

// IsTellerReauthError reports whether err looks like a Teller "enrollment
// disconnected" response — meaning the user must re-authenticate via Teller
// Connect before this enrollment will pull data again.
func IsTellerReauthError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	// Teller returns codes like enrollment.disconnected.user_action.web_login_required
	// (and a few sibling action types). The "enrollment.disconnected" prefix is
	// the stable signal that the user needs to reconnect.
	return strings.Contains(msg, "enrollment.disconnected")
}

// TellerProvider implements the Provider interface for Teller.
type TellerProvider struct {
	client *teller.Client
}

// NewTellerProvider creates a new TellerProvider instance.
func NewTellerProvider() *TellerProvider {
	return &TellerProvider{client: teller.NewClient()}
}

func (t *TellerProvider) Name() string { return "teller" }

// SyncTransactions fetches transactions for every account behind the linked
// enrollment and upserts them into the transactions table.
func (t *TellerProvider) SyncTransactions(conn *sql.DB, account LinkedAccount) (int, error) {
	if !t.client.IsAvailable() {
		return 0, fmt.Errorf("teller client not configured")
	}

	accounts, err := t.client.ListAccounts(account.AccessToken)
	if err != nil {
		return 0, fmt.Errorf("teller list accounts: %w", err)
	}

	startDate := time.Now().AddDate(0, 0, -transactionLookbackDays).Format("2006-01-02")
	synced := 0

	for _, acct := range accounts {
		txns, err := t.client.ListTransactions(account.AccessToken, acct.ID, startDate)
		if err != nil {
			log.Printf("teller: list transactions for account %s failed (non-fatal): %v", acct.ID, err)
			continue
		}

		isCreditAccount := strings.EqualFold(acct.Type, "credit")

		for _, tx := range txns {
			amt, perr := strconv.ParseFloat(tx.Amount, 64)
			if perr != nil {
				log.Printf("teller: skipping transaction %s — bad amount %q: %v", tx.ID, tx.Amount, perr)
				continue
			}
			// Sign convention by account type:
			//   depository (checking/savings): positive = income, negative = expense
			//   credit: negative = purchase (expense), positive = payment landing on
			//     the card — that's a transfer from another account, NOT income.
			//     We mark it type='transfer' so it stays visible but is excluded
			//     from income/expense aggregates. The cross-account pair detector
			//     will link it to the matching outbound row when both sides exist.
			txType := "expense"
			switch {
			case isCreditAccount && amt > 0:
				txType = "transfer"
			case !isCreditAccount && amt > 0:
				txType = "income"
			}
			amount := math.Abs(amt)

			txDate := time.Now()
			if parsed, derr := time.Parse("2006-01-02", tx.Date); derr == nil {
				txDate = parsed
			}

			// Canonical merchant key — prefers Teller's processed counterparty
			// name, falls back to cleaning the raw description.
			merchantNorm := categories.NormalizeMerchant(tx.Description, tx.Details.Counterparty.Name)
			var cats []string
			if tx.Details.Category != "" {
				cats = []string{tx.Details.Category}
			}

			var resolvedCatID, matchConfidence, matchedRuleID *string
			catID, conf, ruleID, resolveErr := categories.ResolveCategory(
				conn, account.UserID, account.HouseholdID, merchantNorm, cats)
			if resolveErr != nil {
				log.Printf("teller: category resolve error (non-fatal): %v", resolveErr)
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
			// An exact match comes from a rule the user created or confirmed —
			// trust it. Lower-confidence matches are applied but left unverified
			// so they surface in the review queue.
			userVerified := conf == "exact"

			// Upsert on (user_id, source, external_id): a pending transaction
			// is updated in place when it later posts. Category fields are set
			// only on insert so user re-categorization survives a re-sync.
			_, err := conn.Exec(`
				INSERT INTO transactions
					(id, user_id, household_id, type, amount, category_id, note, date,
					 source, external_id, merchant_normalized, match_confidence, matched_rule_id, user_verified, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'teller', $9, $10, $11, $12, $13, NOW())
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
				nilIfEmpty(tx.ID),
				nilIfEmpty(merchantNorm),
				matchConfidence,
				matchedRuleID,
				userVerified,
			)
			if err != nil {
				log.Printf("teller: failed to upsert transaction %s: %v", tx.ID, err)
				continue
			}
			synced++
		}
	}

	log.Printf("teller: synced %d transactions for linked account %s", synced, account.ID)
	return synced, nil
}

// SyncBalances fetches the current balance for every account behind the linked
// enrollment and upserts it into account_balances.
func (t *TellerProvider) SyncBalances(conn *sql.DB, account LinkedAccount) (int, error) {
	if !t.client.IsAvailable() {
		return 0, fmt.Errorf("teller client not configured")
	}

	accounts, err := t.client.ListAccounts(account.AccessToken)
	if err != nil {
		return 0, fmt.Errorf("teller list accounts: %w", err)
	}

	updated := 0
	for _, acct := range accounts {
		bal, err := t.client.GetBalance(account.AccessToken, acct.ID)
		if err != nil {
			log.Printf("teller: get balance for account %s failed (non-fatal): %v", acct.ID, err)
			continue
		}

		current, _ := strconv.ParseFloat(bal.Ledger, 64)
		var availablePtr *float64
		if available, perr := strconv.ParseFloat(bal.Available, 64); perr == nil {
			availablePtr = &available
		}

		var mask *string
		if acct.LastFour != "" {
			mask = &acct.LastFour
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
				subtype = EXCLUDED.subtype,
				institution_name = EXCLUDED.institution_name,
				updated_at = NOW()
		`,
			uuid.Must(uuid.NewV4()).String(),
			account.UserID,
			nilIfEmpty(account.HouseholdID),
			account.ID,
			acct.ID, // Teller account ID stored in the plaid_account_id column
			acct.Name,
			mapTellerAccountType(acct.Type),
			nilIfEmpty(acct.Subtype),
			current,
			availablePtr,
			defaultIfEmpty(acct.Currency, "USD"),
			nilIfEmpty(acct.Institution.Name),
			mask,
		)
		if err != nil {
			log.Printf("teller: failed to upsert account balance for %s: %v", acct.ID, err)
			continue
		}
		updated++
	}

	log.Printf("teller: synced %d account balances for linked account %s", updated, account.ID)
	SyncLinkedGoalBalances(conn, account)
	return updated, nil
}

// SyncInvestments is a no-op — Teller does not expose investment data.
func (t *TellerProvider) SyncInvestments(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, nil
}

// SyncLiabilities is a no-op — Teller has no loan/liability detail endpoint.
// Credit-card accounts still sync as balances and transactions.
func (t *TellerProvider) SyncLiabilities(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, nil
}

// mapTellerAccountType maps a Teller account type to the app's account type.
func mapTellerAccountType(tellerType string) string {
	switch strings.ToLower(tellerType) {
	case "credit":
		return "credit"
	case "depository":
		return "depository"
	default:
		return "depository"
	}
}
