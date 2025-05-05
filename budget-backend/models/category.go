package models

type Category struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	UserID *string `json:"user_id,omitempty"`
	Type   string  `json:"type"` // income or expense
}
