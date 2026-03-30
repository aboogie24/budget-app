package models

// SavingsGoal represents a savings target (shared or personal).
type SavingsGoal struct {
	ID            string  `json:"id"`
	UserID        string  `json:"user_id"`
	HouseholdID   string  `json:"household_id,omitempty"`
	Name          string  `json:"name"`
	TargetAmount  float64 `json:"target_amount"`
	CurrentAmount float64 `json:"current_amount"`
	TargetDate    string  `json:"target_date"`
	Priority      int     `json:"priority"`
	IsShared      bool    `json:"is_shared"`
}

// DebtAccount represents a debt to pay down.
type DebtAccount struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	HouseholdID string  `json:"household_id,omitempty"`
	Name       string  `json:"name"`
	Balance    float64 `json:"balance"`
	APR        float64 `json:"apr"`
	MinPayment float64 `json:"min_payment"`
	DueDay     *int    `json:"due_day,omitempty"`
	Strategy   string  `json:"strategy"`
	IsShared   bool    `json:"is_shared"`
	Source     string  `json:"source,omitempty"`
}

// FinancialPriority captures a ranked priority item for the couple.
type FinancialPriority struct {
	ID       string `json:"id"`
	UserID   string `json:"user_id"`
	HouseholdID string `json:"household_id,omitempty"`
	Title    string `json:"title"`
	Rank     int    `json:"rank"`
	Notes    string `json:"notes"`
	IsShared bool   `json:"is_shared"`
}

// Trip represents a shared/personal travel budget.
type Trip struct {
	ID          string  `json:"id"`
	UserID      string  `json:"user_id"`
	HouseholdID string  `json:"household_id,omitempty"`
	Name        string  `json:"name"`
	Destination string  `json:"destination"`
	StartDate   string  `json:"start_date"`
	EndDate     string  `json:"end_date"`
	Budget      float64 `json:"budget"`
	IsShared    bool    `json:"is_shared"`
}

// TripExpense captures a budget item/spend inside a trip.
type TripExpense struct {
	ID       string  `json:"id"`
	TripID   string  `json:"trip_id"`
	UserID   string  `json:"user_id"`
	HouseholdID string `json:"household_id,omitempty"`
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	Note     string  `json:"note"`
	Date     string  `json:"date"`
}
