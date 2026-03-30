package models

import "time"

type InvestmentHolding struct {
	ID               string   `json:"id"`
	UserID           string   `json:"user_id"`
	HouseholdID      *string  `json:"household_id,omitempty"`
	LinkedAccountID  *string  `json:"linked_account_id,omitempty"`
	PlaidAccountID   string   `json:"plaid_account_id"`
	PlaidSecurityID  string   `json:"plaid_security_id"`
	SecurityName     *string  `json:"security_name,omitempty"`
	TickerSymbol     *string  `json:"ticker_symbol,omitempty"`
	SecurityType     *string  `json:"security_type,omitempty"`
	Quantity         float64  `json:"quantity"`
	InstitutionPrice float64  `json:"institution_price"`
	InstitutionValue float64  `json:"institution_value"`
	CostBasis        *float64 `json:"cost_basis,omitempty"`
	IsoCurrencyCode  string   `json:"iso_currency_code"`
	PriceAsOf        *string  `json:"price_as_of,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
