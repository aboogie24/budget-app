package models

import "github.com/gofrs/uuid"

type Category struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	UserID          *uuid.UUID `json:"user_id,omitempty"`
	HouseholdID     *uuid.UUID `json:"household_id,omitempty"`
	BudgetID        *uuid.UUID `json:"budget_id,omitempty"`
	Type            string     `json:"type"` // income or expense
	Color           *string    `json:"color,omitempty"`
	LimitAmount     *float64   `json:"limit_amount,omitempty"`
	RolloverEnabled *bool      `json:"rollover_enabled,omitempty"`
	ParentID        *string    `json:"parent_id,omitempty"`
	Icon            *string    `json:"icon,omitempty"`
	SortOrder       int        `json:"sort_order"`
	Subcategories   []Category `json:"subcategories,omitempty"`
}
