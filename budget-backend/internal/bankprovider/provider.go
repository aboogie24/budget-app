package bankprovider

import (
	"database/sql"
	"log"
)

// LinkedAccount represents a linked bank account with provider-specific fields.
type LinkedAccount struct {
	ID              string
	UserID          string
	HouseholdID     string
	Provider        string // "plaid" or "flinks"
	ItemID          string // Plaid item_id or Flinks loginId
	AccessToken     string // Plaid only
	InstitutionName string
	LastCursor      string // Plaid sync cursor
	FlinksRequestID string // Flinks only
	FlinksInstID    string // Flinks institution ID
}

// Provider defines the interface that both Plaid and Flinks implement.
type Provider interface {
	// Name returns the provider identifier ("plaid" or "flinks")
	Name() string

	// SyncTransactions fetches and stores transactions for a linked account.
	// Returns the number of new transactions synced.
	SyncTransactions(conn *sql.DB, account LinkedAccount) (int, error)

	// SyncBalances fetches and stores account balances.
	// Returns the number of accounts updated.
	SyncBalances(conn *sql.DB, account LinkedAccount) (int, error)

	// SyncInvestments fetches and stores investment holdings.
	SyncInvestments(conn *sql.DB, account LinkedAccount) (int, error)

	// SyncLiabilities fetches and stores liabilities/debts.
	SyncLiabilities(conn *sql.DB, account LinkedAccount) (int, error)
}

// SyncLinkedGoalBalances mirrors freshly synced account balances into savings
// goals that designate an account as their fund (linked_balance_id) — e.g.
// "this HYSA is our emergency fund". Call after any balance sync; goal
// progress then tracks real money instead of manual entries.
func SyncLinkedGoalBalances(conn *sql.DB, account LinkedAccount) {
	res, err := conn.Exec(`
		UPDATE savings_goals sg
		SET current_amount = GREATEST(ab.current_balance, 0)
		FROM account_balances ab
		WHERE sg.linked_balance_id = ab.id
		  AND (sg.user_id = $1 OR ($2 <> '' AND sg.household_id::text = $2))
	`, account.UserID, account.HouseholdID)
	if err != nil {
		log.Printf("linked-goal balance sync error: %v", err)
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("linked-goal balance sync: updated %d goal(s) for user %s", n, account.UserID)
	}
}

// SyncLinkedDebtBalances mirrors freshly synced account balances into debts
// that designate a synced account as their source (linked_balance_id) — e.g.
// "this debt IS my synced credit card". Credit balances arrive negative from
// some providers; what's owed is the magnitude. The opening balance ratchets
// up with new charges so "% paid" never reads negative.
func SyncLinkedDebtBalances(conn *sql.DB, account LinkedAccount) {
	res, err := conn.Exec(`
		UPDATE debt_accounts d
		SET balance = ABS(ab.current_balance),
		    original_balance = GREATEST(COALESCE(d.original_balance, 0), ABS(ab.current_balance))
		FROM account_balances ab
		WHERE d.linked_balance_id = ab.id
		  AND (d.user_id = $1 OR ($2 <> '' AND d.household_id::text = $2))
	`, account.UserID, account.HouseholdID)
	if err != nil {
		log.Printf("linked-debt balance sync error: %v", err)
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("linked-debt balance sync: updated %d debt(s) for user %s", n, account.UserID)
	}
}

// GetProvider returns the appropriate provider implementation based on the provider name.
func GetProvider(name string) Provider {
	switch name {
	case "flinks":
		return NewFlinksProvider()
	case "teller":
		return NewTellerProvider()
	case "simplefin":
		return NewSimpleFINProvider()
	default:
		return NewPlaidProvider()
	}
}
