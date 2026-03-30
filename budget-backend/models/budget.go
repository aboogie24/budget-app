package models

import "time"

type Budget struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Name         string    `json:"name"`
	Amount       float64   `json:"amount"`
	Currency     string    `json:"currency"` // currency code (e.g., "USD")
	Type         string    `json:"type"` // "income" or "expense"
	CategoryID   *string   `json:"category_id,omitempty"`
	CategoryName string    `json:"category_name,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	StartDate    time.Time `json:"start_date"`
	Frequency    string    `json:"frequency,omitempty"`
	HouseholdID  *string   `json:"household_id,omitempty"`
	IsShared     bool      `json:"is_shared"`
}
