package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

type ActivityEvent struct {
	ID          string          `json:"id"`
	HouseholdID string          `json:"household_id"`
	UserID      string          `json:"user_id"`
	UserName    string          `json:"user_name"`
	EventType   string          `json:"event_type"`
	EntityID    *string         `json:"entity_id,omitempty"`
	EntityType  *string         `json:"entity_type,omitempty"`
	Amount      *float64        `json:"amount,omitempty"`
	Description string          `json:"description"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Scan implements the sql.Scanner interface for JSONB metadata
func (ae *ActivityEvent) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, &ae.Metadata)
}

// Value implements the driver.Valuer interface for JSONB metadata
func (ae ActivityEvent) Value() (driver.Value, error) {
	if ae.Metadata == nil {
		return json.Marshal(map[string]interface{}{})
	}
	return ae.Metadata, nil
}
