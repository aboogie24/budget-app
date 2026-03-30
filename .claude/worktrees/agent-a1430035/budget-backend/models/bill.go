package models

import "time"

// Bill represents a recurring expense obligation (rent, utilities, subscriptions, loan payments).
type Bill struct {
	ID            string  `json:"id"`
	UserID        string  `json:"user_id"`
	HouseholdID   string  `json:"household_id,omitempty"`
	Name          string  `json:"name"`
	AmountDue     float64 `json:"amount_due"`
	DueDay        int     `json:"due_day"`
	Frequency     string  `json:"frequency"`
	Payee         *string `json:"payee,omitempty"`
	CategoryID    *string `json:"category_id,omitempty"`
	DebtAccountID *string `json:"debt_account_id,omitempty"`
	IsAutopay     bool    `json:"is_autopay"`
	IsShared      bool    `json:"is_shared"`
	// Computed fields (populated by handler, not stored)
	Status       string  `json:"status,omitempty"`
	CategoryName *string `json:"category_name,omitempty"`
	DebtName     *string `json:"debt_name,omitempty"`
}

// BillPayment tracks an individual payment event for a billing period.
type BillPayment struct {
	ID            string    `json:"id"`
	BillID        string    `json:"bill_id"`
	UserID        string    `json:"user_id"`
	HouseholdID   string    `json:"household_id,omitempty"`
	AmountPaid    float64   `json:"amount_paid"`
	PaidDate      time.Time `json:"paid_date"`
	TransactionID *string   `json:"transaction_id,omitempty"`
	Source        string    `json:"source"`
	PeriodStart   string    `json:"period_start"`
	PeriodEnd     string    `json:"period_end"`
}
