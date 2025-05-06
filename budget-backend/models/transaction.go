package models

import "time"

type Transaction struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	BudgetID  *string   `json:"budget_id,omitempty"`
	Type      string    `json:"type"` // "income" or "expense"
	Amount    float64   `json:"amount"`
	Note      string    `json:"note"`
	Date      time.Time `json:"date"`
	Frequency string    `json:"frequency"`     // e.g., "monthly", "biweekly"
	DueDay    *int      `json:"due_day"`       // nullable
	Category  *string   `json:"category_name"` // category name
	Color     *string   `json:"color"`         // nullable category color
}
