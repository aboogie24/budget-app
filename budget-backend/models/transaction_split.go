package models

// TransactionSplit represents one piece of a split transaction,
// where the parent transaction's amount is divided across multiple categories.
type TransactionSplit struct {
	ID            string  `json:"id"`
	TransactionID string  `json:"transaction_id"`
	CategoryID    string  `json:"category_id"`
	CategoryName  string  `json:"category_name,omitempty"` // joined
	Amount        float64 `json:"amount"`
	Note          *string `json:"note,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

// SplitRequest is the JSON body for creating or updating splits.
type SplitRequest struct {
	Splits []SplitEntry `json:"splits"`
}

// SplitEntry is a single entry in a split request.
type SplitEntry struct {
	CategoryID string  `json:"category_id"`
	Amount     float64 `json:"amount"`
	Note       string  `json:"note,omitempty"`
}
