package models

// AINudge represents a proactive financial nudge generated for a user.
type AINudge struct {
	ID          string  `json:"id"`
	UserID      string  `json:"user_id"`
	HouseholdID *string `json:"household_id,omitempty"`
	NudgeType   string  `json:"nudge_type"`
	Title       string  `json:"title"`
	Body        string  `json:"body"`
	ActionType  *string `json:"action_type,omitempty"`
	ActionData  *string `json:"action_data,omitempty"`
	Priority    int     `json:"priority"`
	IsRead      bool    `json:"is_read"`
	ExpiresAt   *string `json:"expires_at,omitempty"`
	CreatedAt   string  `json:"created_at"`
}

// WhatIfRequest is the payload for a what-if simulation.
type WhatIfRequest struct {
	Scenario string  `json:"scenario"` // increase_income, cut_category, extra_debt_payment, increase_savings
	Amount   float64 `json:"amount"`
	Category string  `json:"category,omitempty"` // for cut_category scenario
}

// WhatIfResult is the response from a what-if simulation.
type WhatIfResult struct {
	Scenario       string                 `json:"scenario"`
	CurrentState   map[string]interface{} `json:"current_state"`
	ProjectedState map[string]interface{} `json:"projected_state"`
	Impact         string                 `json:"impact"` // AI-generated summary
}
