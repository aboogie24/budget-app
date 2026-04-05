package models

import "time"

// FinancialPlan represents a debt payoff, savings, or combined financial plan.
type FinancialPlan struct {
	ID                  string    `json:"id"`
	HouseholdID         string    `json:"household_id,omitempty"`
	CreatedBy           string    `json:"created_by"`
	Name                string    `json:"name"`
	PlanType            string    `json:"plan_type"`     // debt_payoff, savings, combined
	Status              string    `json:"status"`        // draft, active, paused, completed
	FrameworkLevel      string    `json:"framework_level,omitempty"`
	MonthlyContribution float64   `json:"monthly_contribution"`
	StartDate           string    `json:"start_date,omitempty"`
	ProjectedEndDate    string    `json:"projected_end_date,omitempty"`
	AIAnalysis          string    `json:"ai_analysis,omitempty"`  // JSONB stored as string
	Scenarios           string    `json:"scenarios,omitempty"`    // JSONB stored as string
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`

	// Populated on read — not stored in financial_plans table.
	Milestones  []PlanMilestone  `json:"milestones,omitempty"`
	Allocations []PlanAllocation `json:"allocations,omitempty"`
	Approvals   []PlanApproval   `json:"approvals,omitempty"`
}

// PlanApproval represents a household member's approval or rejection of a plan.
type PlanApproval struct {
	ID          string     `json:"id"`
	PlanID      string     `json:"plan_id"`
	UserID      string     `json:"user_id"`
	UserName    string     `json:"user_name,omitempty"`
	Status      string     `json:"status"` // pending, approved, rejected
	Feedback    *string    `json:"feedback,omitempty"`
	RespondedAt *time.Time `json:"responded_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// PlanMilestone represents a milestone target within a financial plan.
type PlanMilestone struct {
	ID           string     `json:"id"`
	PlanID       string     `json:"plan_id"`
	Title        string     `json:"title"`
	TargetAmount float64    `json:"target_amount"`
	TargetDate   string     `json:"target_date,omitempty"`
	Status       string     `json:"status"` // pending, reached, skipped
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

// PlanAllocation describes how monthly contributions are split across targets.
type PlanAllocation struct {
	ID            string  `json:"id"`
	PlanID        string  `json:"plan_id"`
	TargetID      string  `json:"target_id"`
	TargetType    string  `json:"target_type"` // debt, savings_goal
	MonthlyAmount float64 `json:"monthly_amount"`
	PriorityOrder int     `json:"priority_order"`
}

// CreatePlanRequest is the payload for creating a new financial plan.
type CreatePlanRequest struct {
	Name                string   `json:"name"`
	PlanType            string   `json:"plan_type"`
	MonthlyContribution float64  `json:"monthly_contribution"`
	GoalIDs             []string `json:"goal_ids"`
}

// DebtInfo is a simplified debt record used by the calculators.
type DebtInfo struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Balance    float64 `json:"balance"`
	APR        float64 `json:"apr"`
	MinPayment float64 `json:"min_payment"`
}

// DebtPayoffSchedule is the per-debt payoff projection.
type DebtPayoffSchedule struct {
	DebtID        string       `json:"debt_id"`
	DebtName      string       `json:"debt_name"`
	Months        []MonthEntry `json:"months"`
	TotalInterest float64      `json:"total_interest"`
	PayoffDate    string       `json:"payoff_date"`
}

// MonthEntry is one month in a debt payoff simulation.
type MonthEntry struct {
	Month            int     `json:"month"`
	Payment          float64 `json:"payment"`
	Principal        float64 `json:"principal"`
	Interest         float64 `json:"interest"`
	RemainingBalance float64 `json:"remaining_balance"`
}

// SavingsProjection is the per-goal savings projection.
type SavingsProjection struct {
	GoalID     string         `json:"goal_id"`
	GoalName   string         `json:"goal_name"`
	Months     []SavingsMonth `json:"months"`
	TargetDate string         `json:"target_date,omitempty"`
}

// SavingsMonth is one month in a savings projection.
type SavingsMonth struct {
	Month        int     `json:"month"`
	Contribution float64 `json:"contribution"`
	Interest     float64 `json:"interest"`
	Balance      float64 `json:"balance"`
}

// CashFlowAnalysis is the result of analyzing recent transactions.
type CashFlowAnalysis struct {
	AvgMonthlyIncome   float64                  `json:"avg_monthly_income"`
	AvgMonthlyExpenses float64                  `json:"avg_monthly_expenses"`
	AvgMonthlySurplus  float64                  `json:"avg_monthly_surplus"`
	CategoryBreakdown  []CategorySpend          `json:"category_breakdown"`
	MonthsAnalyzed     int                      `json:"months_analyzed"`
}

// CategorySpend is a single category's spending summary.
type CategorySpend struct {
	Category       string  `json:"category"`
	Total          float64 `json:"total"`
	MonthlyAverage float64 `json:"monthly_average"`
}

// PlanSnapshot captures a point-in-time picture of financial state for a plan.
type PlanSnapshot struct {
	ID              string  `json:"id"`
	PlanID          string  `json:"plan_id"`
	SnapshotDate    string  `json:"snapshot_date"`
	FinancialState  any     `json:"financial_state"`
	ProgressMetrics any     `json:"progress_metrics"`
	AIReviewSummary *string `json:"ai_review_summary,omitempty"`
	CreatedAt       string  `json:"created_at"`
}

// FrameworkAssessment is the deterministic result of evaluating a user's CoupleFlow level.
type FrameworkAssessment struct {
	Level        int               `json:"level"`
	LevelName    string            `json:"level_name"`
	Criteria     []CriterionStatus `json:"criteria"`
	CompletedPct float64           `json:"completed_pct"`
	NextSteps    []string          `json:"next_steps"`
}

// CriterionStatus tracks whether a single framework criterion is met.
type CriterionStatus struct {
	Name   string `json:"name"`
	Met    bool   `json:"met"`
	Detail string `json:"detail,omitempty"`
}
