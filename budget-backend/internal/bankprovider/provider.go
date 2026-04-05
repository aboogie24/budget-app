package bankprovider

import "database/sql"

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

// GetProvider returns the appropriate provider implementation based on the provider name.
func GetProvider(name string) Provider {
	switch name {
	case "flinks":
		return NewFlinksProvider()
	default:
		return NewPlaidProvider()
	}
}
