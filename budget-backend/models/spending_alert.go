package models

import "time"

type SpendingAlert struct {
	ID               string    `json:"id"`
	HouseholdID      string    `json:"household_id"`
	BudgetID         string    `json:"budget_id"`
	AlertType        string    `json:"alert_type"`
	ThresholdPercent int       `json:"threshold_percent"`
	IsEnabled        bool      `json:"is_enabled"`
	CreatedAt        time.Time `json:"created_at"`
}

type AlertCheckResult struct {
	BudgetID        string  `json:"budget_id"`
	BudgetName      string  `json:"budget_name"`
	BudgetAmount    float64 `json:"budget_amount"`
	SpentAmount     float64 `json:"spent_amount"`
	PercentUsed     int     `json:"percent_used"`
	ThresholdPercent int    `json:"threshold_percent"`
	OverThreshold   bool    `json:"over_threshold"`
}

type CheckBudgetThresholdsResponse struct {
	Alerts []AlertCheckResult `json:"alerts"`
}
