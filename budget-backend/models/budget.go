package models

import "time"

type Budget struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Name         string    `json:"name"`
	Amount       float64   `json:"amount"`
	Type         string    `json:"type"` // "income" or "expense"
	CategoryID   string    `json:"category_id"`
	CategoryName string    `json:"category_name"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	StartDate    time.Time `json:"start_date"`
}
