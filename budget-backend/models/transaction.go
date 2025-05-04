package models

type Transaction struct {
	ID        string  `json:"id"`
	UserID    string  `json:"user_id"`
	Type      string  `json:"type"`
	Amount    float64 `json:"amount"`
	Category  string  `json:"category"`
	Note      string  `json:"note"`
	Date      string  `json:"date"`
	Frequency string  `json:"frequency"`
	DueDay    *int    `json:"due_day,omitempty"`
}
