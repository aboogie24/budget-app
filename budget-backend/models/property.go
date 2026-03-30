package models

import "time"

type Property struct {
	ID            string   `json:"id"`
	UserID        string   `json:"user_id"`
	HouseholdID   string   `json:"household_id,omitempty"`
	StreetAddress string   `json:"street_address"`
	City          string   `json:"city"`
	State         string   `json:"state"`
	ZipCode       string   `json:"zip_code"`
	Zestimate     *float64 `json:"zestimate,omitempty"`
	ManualValue   *float64 `json:"manual_value,omitempty"`
	ZillowURL     *string  `json:"zillow_url,omitempty"`
	ZPID          *string  `json:"zpid,omitempty"`
	DebtAccountID *string  `json:"debt_account_id,omitempty"`
	LastFetchedAt *time.Time `json:"last_fetched_at,omitempty"`
	IsShared      bool     `json:"is_shared"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	// Joined fields (not stored in properties table)
	DebtName    *string  `json:"debt_name,omitempty"`
	DebtBalance *float64 `json:"debt_balance,omitempty"`
}

// EffectiveValue returns manual_value if set, else zestimate, else 0.
func (p Property) EffectiveValue() float64 {
	if p.ManualValue != nil && *p.ManualValue > 0 {
		return *p.ManualValue
	}
	if p.Zestimate != nil {
		return *p.Zestimate
	}
	return 0
}
