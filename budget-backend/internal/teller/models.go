package teller

// Account is a bank account returned by GET /accounts.
// Teller does not include a balance here — balances are a separate endpoint.
type Account struct {
	ID           string            `json:"id"`
	EnrollmentID string            `json:"enrollment_id"`
	Name         string            `json:"name"`
	Type         string            `json:"type"`    // "depository" | "credit"
	Subtype      string            `json:"subtype"` // checking, savings, credit_card, ...
	Currency     string            `json:"currency"`
	LastFour     string            `json:"last_four"`
	Status       string            `json:"status"` // "open" | "closed"
	Institution  Institution       `json:"institution"`
	Links        map[string]string `json:"links"`
}

// Institution identifies the financial institution behind an account.
type Institution struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// Balance is the response from GET /accounts/{id}/balances.
// Amounts are returned as strings and must be parsed.
type Balance struct {
	AccountID string `json:"account_id"`
	Ledger    string `json:"ledger"`    // total/posted balance
	Available string `json:"available"` // available balance
}

// Transaction is a single entry from GET /accounts/{id}/transactions.
type Transaction struct {
	ID             string             `json:"id"`
	AccountID      string             `json:"account_id"`
	Amount         string             `json:"amount"` // signed amount as a string
	Date           string             `json:"date"`   // YYYY-MM-DD
	Description    string             `json:"description"`
	Status         string             `json:"status"` // "posted" | "pending"
	Type           string             `json:"type"`   // card_payment, atm, transfer, ...
	RunningBalance *string            `json:"running_balance"`
	Details        TransactionDetails `json:"details"`
	Links          map[string]string  `json:"links"`
}

// TransactionDetails holds Teller's enrichment of a transaction.
type TransactionDetails struct {
	ProcessingStatus string       `json:"processing_status"`
	Category         string       `json:"category"` // dining, groceries, income, ...
	Counterparty     Counterparty `json:"counterparty"`
}

// Counterparty is the processed merchant/person on a transaction.
type Counterparty struct {
	Name string `json:"name"`
	Type string `json:"type"` // "organization" | "person"
}

// apiError is Teller's error envelope for non-2xx responses.
type apiError struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}
