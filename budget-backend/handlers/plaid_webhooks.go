package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
	"github.com/plaid/plaid-go/v20/plaid"
)

// HandlePlaidWebhook - POST /webhooks/plaid (public, no auth)
// Receives webhook events from Plaid and triggers appropriate sync actions
func HandlePlaidWebhook(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.PlaidWebhookRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("Failed to decode webhook body: %v", err)
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		dbClient, err := db.New()
		if err != nil {
			log.Printf("DB connection error: %v", err)
			// Still return 200 to Plaid to avoid retries
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "received"})
			return
		}
		defer dbClient.Close()

		// Log the webhook event
		eventID := uuid.Must(uuid.NewV4()).String()
		var errorCode *string
		if req.Error != nil {
			errorCode = &req.Error.ErrorCode
		}

		_, err = dbClient.Exec(`
			INSERT INTO plaid_webhook_events (id, item_id, webhook_type, webhook_code, error_code, new_transactions, removed_transactions)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`,
			eventID,
			req.ItemID,
			req.WebhookType,
			req.WebhookCode,
			errorCode,
			req.NewTransactions,
			req.RemovedTransactions,
		)
		if err != nil {
			log.Printf("Failed to log webhook event: %v", err)
		}

		// Return 200 OK immediately (Plaid requires fast responses)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "received"})

		// Do heavy processing in a goroutine to avoid blocking Plaid webhook
		go processWebhookAsync(dbClient, client, req)
	}
}

// processWebhookAsync handles the actual webhook logic in the background
func processWebhookAsync(dbClient *db.DB, client *models.Client, req models.PlaidWebhookRequest) {
	ctx := context.Background()

	// Look up the linked account by item_id
	var linkedAccountID string
	var accessToken string
	var userID string
	var householdID *string
	var lastCursor string

	err := dbClient.QueryRow(`
		SELECT id, access_token, user_id, household_id, last_cursor
		FROM linked_accounts
		WHERE item_id = $1
	`, req.ItemID).Scan(&linkedAccountID, &accessToken, &userID, &householdID, &lastCursor)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Webhook received for unknown item_id: %s", req.ItemID)
		} else {
			log.Printf("Failed to look up linked account: %v", err)
		}
		return
	}

	switch req.WebhookType {
	case "TRANSACTIONS":
		handleTransactionsWebhook(ctx, dbClient, client, linkedAccountID, accessToken, userID, householdID, lastCursor, req)
	case "ITEM":
		handleItemWebhook(dbClient, linkedAccountID, req)
	case "HOLDINGS":
		handleHoldingsWebhook(ctx, dbClient, client, accessToken, userID, householdID)
	case "LIABILITIES":
		handleLiabilitiesWebhook(ctx, dbClient, client, accessToken, userID, householdID)
	default:
		log.Printf("Unknown webhook type: %s", req.WebhookType)
	}

	// Mark event as processed
	_, err = dbClient.Exec(`
		UPDATE plaid_webhook_events
		SET processed = true
		WHERE item_id = $1 AND webhook_code = $2 AND created_at > NOW() - INTERVAL '1 minute'
		LIMIT 1
	`, req.ItemID, req.WebhookCode)
	if err != nil {
		log.Printf("Failed to mark webhook as processed: %v", err)
	}

	// Update last_webhook_at timestamp
	_, err = dbClient.Exec(`
		UPDATE linked_accounts
		SET last_webhook_at = NOW()
		WHERE item_id = $1
	`, req.ItemID)
	if err != nil {
		log.Printf("Failed to update webhook timestamp: %v", err)
	}
}

// handleTransactionsWebhook processes transaction-related webhooks
func handleTransactionsWebhook(ctx context.Context, dbClient *db.DB, client *models.Client,
	linkedAccountID, accessToken, userID string, householdID *string, lastCursor string,
	req models.PlaidWebhookRequest) {

	switch req.WebhookCode {
	case "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE", "SYNC_UPDATES_AVAILABLE":
		// Perform incremental transaction sync
		cursor := lastCursor
		hasMore := true

		for hasMore {
			syncReq := plaid.NewTransactionsSyncRequest(accessToken)
			if cursor != "" {
				syncReq.SetCursor(cursor)
			}

			resp, _, err := client.API.PlaidApi.TransactionsSync(ctx).
				TransactionsSyncRequest(*syncReq).
				Execute()
			if err != nil {
				log.Printf("Plaid sync failed for item %s: %v", req.ItemID, err)
				return
			}

			added := resp.GetAdded()
			modified := resp.GetModified()

			// Process added transactions
			for _, tx := range added {
				insertTransaction(dbClient, tx, userID, householdID)
			}

			// Process modified transactions
			for _, tx := range modified {
				// For modified transactions, update or insert
				insertTransaction(dbClient, tx, userID, householdID)
			}

			// Get removed transaction IDs
			removed := resp.GetRemoved()
			for _, txID := range removed {
				// Mark as removed or delete from the appropriate place
				// For now we log it, but in production you might want a soft delete
				log.Printf("Transaction removed: %s", txID)
			}

			cursor = resp.GetNextCursor()
			hasMore = resp.GetHasMore()
		}

		// Save the new cursor
		_, err := dbClient.Exec(`
			UPDATE linked_accounts
			SET last_cursor = $1
			WHERE item_id = $2
		`, cursor, req.ItemID)
		if err != nil {
			log.Printf("Failed to update cursor for item %s: %v", req.ItemID, err)
		}

	case "TRANSACTIONS_REMOVED":
		// Handle removed transactions
		log.Printf("Transactions removed for item %s", req.ItemID)
	default:
		log.Printf("Unknown transaction webhook code: %s", req.WebhookCode)
	}
}

// handleItemWebhook processes item-related webhooks
func handleItemWebhook(dbClient *db.DB, linkedAccountID string, req models.PlaidWebhookRequest) {
	switch req.WebhookCode {
	case "ERROR":
		errorCode := ""
		if req.Error != nil {
			errorCode = req.Error.ErrorCode
		}
		_, err := dbClient.Exec(`
			UPDATE linked_accounts
			SET item_status = $1, error_code = $2
			WHERE id = $3
		`, "error", errorCode, linkedAccountID)
		if err != nil {
			log.Printf("Failed to update item status to error: %v", err)
		}

	case "PENDING_EXPIRATION":
		_, err := dbClient.Exec(`
			UPDATE linked_accounts
			SET item_status = $1
			WHERE id = $2
		`, "pending_expiration", linkedAccountID)
		if err != nil {
			log.Printf("Failed to update item status to pending_expiration: %v", err)
		}

	case "USER_PERMISSION_REVOKED":
		_, err := dbClient.Exec(`
			UPDATE linked_accounts
			SET item_status = $1
			WHERE id = $2
		`, "revoked", linkedAccountID)
		if err != nil {
			log.Printf("Failed to update item status to revoked: %v", err)
		}

	case "WEBHOOK_UPDATE_ACKNOWLEDGED":
		// No action needed
		log.Printf("Webhook update acknowledged for item")

	default:
		log.Printf("Unknown item webhook code: %s", req.WebhookCode)
	}
}

// handleHoldingsWebhook processes holdings-related webhooks
func handleHoldingsWebhook(ctx context.Context, dbClient *db.DB, client *models.Client,
	accessToken, userID string, householdID *string) {
	log.Printf("Processing holdings sync for user: %s", userID)

	// Fetch investment holdings and store them
	holdingsReq := plaid.NewInvestmentsHoldingsGetRequest(accessToken)
	resp, _, err := client.API.PlaidApi.InvestmentsHoldingsGet(ctx).
		InvestmentsHoldingsGetRequest(*holdingsReq).
		Execute()
	if err != nil {
		log.Printf("Failed to get investment holdings: %v", err)
		return
	}

	holdings := resp.GetHoldings()
	for _, holding := range holdings {
		holdingID := uuid.Must(uuid.NewV4()).String()
		_, err := dbClient.Exec(`
			INSERT INTO investment_holdings (id, user_id, household_id, institution_value, cost_basis, quantity, security_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT DO NOTHING
		`,
			holdingID,
			userID,
			householdID,
			holding.GetInstitutionValue(),
			holding.GetCostBasis(),
			holding.GetQuantity(),
			holding.GetSecurityId(),
		)
		if err != nil {
			log.Printf("Failed to insert investment holding: %v", err)
		}
	}
}

// handleLiabilitiesWebhook processes liabilities-related webhooks
func handleLiabilitiesWebhook(ctx context.Context, dbClient *db.DB, client *models.Client,
	accessToken, userID string, householdID *string) {
	log.Printf("Processing liabilities sync for user: %s", userID)

	// Fetch liabilities and store them
	liabilitiesReq := plaid.NewLiabilitiesGetRequest(accessToken)
	resp, _, err := client.API.PlaidApi.LiabilitiesGet(ctx).
		LiabilitiesGetRequest(*liabilitiesReq).
		Execute()
	if err != nil {
		log.Printf("Failed to get liabilities: %v", err)
		return
	}

	liabs := resp.GetLiabilities()
	for _, cc := range liabs.GetCredit() {
		liabilityID := uuid.Must(uuid.NewV4()).String()
		aprRate := 0.0
		if aprs := cc.GetAprs(); len(aprs) > 0 {
			aprRate = aprs[0].GetAprPercentage()
		}
		_, err := dbClient.Exec(`
			INSERT INTO liabilities (id, user_id, household_id, account_name, balance, interest_rate, type)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT DO NOTHING
		`,
			liabilityID,
			userID,
			householdID,
			cc.GetAccountId(),
			cc.GetLastPaymentAmount(),
			aprRate,
			"credit",
		)
		if err != nil {
			log.Printf("Failed to insert liability: %v", err)
		}
	}
}

// insertTransaction inserts or updates a single transaction
func insertTransaction(dbClient *db.DB, tx plaid.Transaction, userID string, householdID *string) {
	txID := uuid.Must(uuid.NewV4()).String()
	txType := "expense"
	amount := tx.GetAmount()

	// Plaid amounts: positive = money leaving account (expense),
	// negative = money entering (income/refund).
	if amount < 0 {
		txType = "income"
		amount = -amount
	}

	catName := ""
	if cats := tx.GetCategory(); len(cats) > 0 {
		catName = cats[0]
	}

	source := "bank"
	date := time.Now()
	if txDate := tx.GetDate(); txDate != "" {
		// Parse the date if it's in the expected format
		if parsed, err := time.Parse("2006-01-02", txDate); err == nil {
			date = parsed
		}
	}

	_, err := dbClient.Exec(`
		INSERT INTO transactions (id, user_id, household_id, type, amount, category_name, note, date, source, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		ON CONFLICT DO NOTHING
	`,
		txID,
		userID,
		householdID,
		txType,
		amount,
		catName,
		tx.GetName(),
		date,
		source,
	)
	if err != nil {
		log.Printf("Failed to insert transaction: %v", err)
	}
}
