package models

import (
	"time"
)

type SharingPreferences struct {
	ID                string    `json:"id"`
	UserID            string    `json:"user_id"`
	HouseholdID       *string   `json:"household_id,omitempty"`
	ShareBudgets      bool      `json:"share_budgets"`
	ShareTransactions bool      `json:"share_transactions"`
	ShareDebts        bool      `json:"share_debts"`
	ShareSavings      bool      `json:"share_savings"`
	SharePriorities   bool      `json:"share_priorities"`
	ShareNotes        bool      `json:"share_notes"`
	NotifyPartner     bool      `json:"notify_partner"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
