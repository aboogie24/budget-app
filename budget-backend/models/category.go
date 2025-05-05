package models

import "github.com/gofrs/uuid"

type Category struct {
	ID     uuid.UUID  `json:"id"`
	Name   string     `json:"name"`
	UserID *uuid.UUID `json:"user_id,omitempty"`
	Type   string     `json:"type"` // income or expense
	Color  *string    `json:"color,omitempty"`
}
