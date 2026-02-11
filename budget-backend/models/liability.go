package models

import "time"

type Liability struct {
	ID                    string   `json:"id"`
	UserID                string   `json:"user_id"`
	HouseholdID           *string  `json:"household_id,omitempty"`
	LinkedAccountID       *string  `json:"linked_account_id,omitempty"`
	PlaidAccountID        string   `json:"plaid_account_id"`
	LiabilityType         string   `json:"liability_type"` // credit, mortgage, student
	AccountNumber         *string  `json:"account_number,omitempty"`
	LastPaymentAmount     *float64 `json:"last_payment_amount,omitempty"`
	LastPaymentDate       *string  `json:"last_payment_date,omitempty"`
	MinimumPaymentAmount  *float64 `json:"minimum_payment_amount,omitempty"`
	NextPaymentDueDate    *string  `json:"next_payment_due_date,omitempty"`
	IsOverdue             bool     `json:"is_overdue"`
	// Credit card
	LastStatementBalance  *float64 `json:"last_statement_balance,omitempty"`
	// Mortgage
	LoanTerm              *string  `json:"loan_term,omitempty"`
	LoanTypeDescription   *string  `json:"loan_type_description,omitempty"`
	MaturityDate          *string  `json:"maturity_date,omitempty"`
	OriginationDate       *string  `json:"origination_date,omitempty"`
	OriginationPrincipal  *float64 `json:"origination_principal,omitempty"`
	InterestRate          *float64 `json:"interest_rate,omitempty"`
	EscrowBalance         *float64 `json:"escrow_balance,omitempty"`
	HasPMI                *bool    `json:"has_pmi,omitempty"`
	PropertyAddress       *string  `json:"property_address,omitempty"`
	YtdInterestPaid       *float64 `json:"ytd_interest_paid,omitempty"`
	YtdPrincipalPaid      *float64 `json:"ytd_principal_paid,omitempty"`
	// Student loan
	LoanName              *string  `json:"loan_name,omitempty"`
	LoanStatus            *string  `json:"loan_status,omitempty"`
	ExpectedPayoffDate    *string  `json:"expected_payoff_date,omitempty"`
	Guarantor             *string  `json:"guarantor,omitempty"`
	InterestRatePct       *float64 `json:"interest_rate_pct,omitempty"`
	OutstandingInterest   *float64 `json:"outstanding_interest,omitempty"`
	RepaymentPlan         *string  `json:"repayment_plan,omitempty"`
	ServicerAddress       *string  `json:"servicer_address,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}
