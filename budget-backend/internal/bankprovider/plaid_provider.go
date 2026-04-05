package bankprovider

import (
	"database/sql"
	"fmt"
)

// PlaidProvider implements the Provider interface for Plaid.
type PlaidProvider struct{}

// NewPlaidProvider creates a new PlaidProvider instance.
func NewPlaidProvider() *PlaidProvider {
	return &PlaidProvider{}
}

func (p *PlaidProvider) Name() string { return "plaid" }

func (p *PlaidProvider) SyncTransactions(conn *sql.DB, account LinkedAccount) (int, error) {
	// TODO: Refactor existing Plaid sync logic from handlers/plaid.go into here
	// For now, the existing Plaid handlers work directly
	return 0, fmt.Errorf("use existing Plaid handlers directly")
}

func (p *PlaidProvider) SyncBalances(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, fmt.Errorf("use existing Plaid handlers directly")
}

func (p *PlaidProvider) SyncInvestments(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, fmt.Errorf("use existing Plaid handlers directly")
}

func (p *PlaidProvider) SyncLiabilities(conn *sql.DB, account LinkedAccount) (int, error) {
	return 0, fmt.Errorf("use existing Plaid handlers directly")
}
