package models

import "time"

type PlaidWebhookEvent struct {
	ID                  string    `json:"id"`
	ItemID              string    `json:"item_id"`
	WebhookType         string    `json:"webhook_type"`
	WebhookCode         string    `json:"webhook_code"`
	ErrorCode           *string   `json:"error_code,omitempty"`
	NewTransactions     int       `json:"new_transactions"`
	RemovedTransactions int       `json:"removed_transactions"`
	Processed           bool      `json:"processed"`
	CreatedAt           time.Time `json:"created_at"`
}

type PlaidWebhookRequest struct {
	WebhookType         string `json:"webhook_type"`
	WebhookCode         string `json:"webhook_code"`
	ItemID              string `json:"item_id"`
	NewTransactions     int    `json:"new_transactions,omitempty"`
	RemovedTransactions int    `json:"removed_transactions,omitempty"`
	Error               *struct {
		ErrorType    string `json:"error_type"`
		ErrorCode    string `json:"error_code"`
		ErrorMessage string `json:"error_message"`
	} `json:"error,omitempty"`
}
