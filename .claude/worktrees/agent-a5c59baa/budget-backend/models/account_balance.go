package models

import "time"

type AccountBalance struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	HouseholdID      *string   `json:"household_id,omitempty"`
	LinkedAccountID  *string   `json:"linked_account_id,omitempty"`
	PlaidAccountID   string    `json:"plaid_account_id"`
	Name             string    `json:"name"`
	OfficialName     *string   `json:"official_name,omitempty"`
	Type             string    `json:"type"`
	Subtype          *string   `json:"subtype,omitempty"`
	CurrentBalance   float64   `json:"current_balance"`
	AvailableBalance *float64  `json:"available_balance,omitempty"`
	IsoCurrencyCode  string    `json:"iso_currency_code"`
	InstitutionName  *string   `json:"institution_name,omitempty"`
	Mask             *string   `json:"mask,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
