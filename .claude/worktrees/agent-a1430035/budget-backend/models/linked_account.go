package models

import "time"

type LinkedAccount struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	HouseholdID     *string   `json:"household_id,omitempty"`
	ItemID          string    `json:"item_id"`
	AccessToken     string    `json:"access_token"`
	InstitutionName string    `json:"institution_name,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
