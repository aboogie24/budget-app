package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/categories"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

func CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var tx models.Transaction
	if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validation
	if tx.UserID == "" {
		validationError(w, "User ID is required")
		return
	}
	if tx.Amount <= 0 {
		validationError(w, "Amount must be greater than zero")
		return
	}
	if !isValidBudgetType(tx.Type) {
		validationError(w, "Type must be 'income' or 'expense'")
		return
	}
	if tx.Date.IsZero() {
		validationError(w, "Date is required")
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if tx.HouseholdID == nil || *tx.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(dbClient.Conn, tx.UserID); hh != "" {
			tx.HouseholdID = &hh
		}
	}

	// Normalize empty strings to nil for UUID/nullable columns
	if tx.CategoryID != nil && *tx.CategoryID == "" {
		tx.CategoryID = nil
	}
	if tx.HouseholdID != nil && *tx.HouseholdID == "" {
		tx.HouseholdID = nil
	}
	if tx.BudgetID != nil && *tx.BudgetID == "" {
		tx.BudgetID = nil
	}
	if tx.Source != nil && *tx.Source == "" {
		tx.Source = nil
	}

	// Set default currency if not provided
	if tx.Currency == "" {
		tx.Currency = "USD"
	}

	_, err = dbClient.Exec(`
		INSERT INTO transactions (id, user_id, household_id, budget_id, category_id, type, amount, currency, category_name, note, date, frequency, due_day, source)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		tx.ID, tx.UserID, tx.HouseholdID, tx.BudgetID, tx.CategoryID, tx.Type, tx.Amount, tx.Currency, tx.Category, tx.Note, tx.Date, tx.Frequency, tx.DueDay, tx.Source)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			// Unique-violation from the manual-dedupe index: a near-simultaneous
			// retry of the same entry. Treat as success — the original insert won.
			log.Printf("CreateTransaction dedupe skip: user=%s amount=%.2f note=%q", tx.UserID, tx.Amount, tx.Note)
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"status": "duplicate"})
			return
		}
		log.Printf("CreateTransaction insert error: %v", err)
		http.Error(w, "Failed to insert transaction", http.StatusInternalServerError)
		return
	}

	// Notify household partner for significant transactions
	if tx.HouseholdID != nil && *tx.HouseholdID != "" && tx.Amount >= 50 {
		var userName string
		_ = dbClient.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, tx.UserID).Scan(&userName)
		if userName == "" {
			userName = "Your partner"
		}
		note := tx.Note
		if note == "" && tx.Category != nil {
			note = *tx.Category
		}
		SendHouseholdNotification(
			*tx.HouseholdID, tx.UserID,
			"New Transaction",
			fmt.Sprintf("%s added a $%.2f %s: %s", userName, tx.Amount, tx.Type, note),
			map[string]string{"screen": "/(tabs)/budget"},
		)
	}

	// Check if this transaction caused the budget to exceed its threshold
	if tx.BudgetID != nil && *tx.BudgetID != "" && tx.Type == "expense" && tx.HouseholdID != nil && *tx.HouseholdID != "" {
		checkBudgetThresholdAfterTransaction(dbClient, *tx.BudgetID, *tx.HouseholdID, tx.Date)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func GetTransactions(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	fmt.Print("Getting Transactions for User: {userID}")

	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// rows, err := dbClient.Query(`
	// 	SELECT id, user_id, type, amount, category, note, date, frequency, due_day
	// 	FROM transactions WHERE user_id = $1
	// `, userID)
	log.Printf("User_ID: %v", userID)
	hh := db.ResolveHouseholdID(dbClient.Conn, userID)

	var rows *sql.Rows
	if hh == "" {
		rows, err = dbClient.Query(`
			SELECT
				t.id,          -- 1
				t.user_id,     -- 2
				t.household_id,
				t.budget_id,   -- 4
				t.category_id, -- 5
				t.type,        -- 6
				t.amount,      -- 7
				t.currency,    -- 8
				t.note,        -- 9
				t.date,        -- 10
				t.frequency,   -- 11
				t.due_day,     -- 12
				COALESCE(c.name, t.category_name), -- 13
				c.color,       -- 14
				t.source,      -- 15
				t.match_confidence, -- 16
				t.matched_rule_id,  -- 17
				COALESCE(t.user_verified, false) -- 18
			FROM transactions t
			LEFT JOIN categories c ON t.category_id = c.id
			WHERE t.household_id IS NULL AND t.user_id = $1
		`, userID)
	} else {
		rows, err = dbClient.Query(`
			SELECT
				t.id,          -- 1
				t.user_id,     -- 2
				t.household_id,
				t.budget_id,   -- 4
				t.category_id, -- 5
				t.type,        -- 6
				t.amount,      -- 7
				t.currency,    -- 8
				t.note,        -- 9
				t.date,        -- 10
				t.frequency,   -- 11
				t.due_day,     -- 12
				COALESCE(c.name, t.category_name), -- 13
				c.color,       -- 14
				t.source,      -- 15
				t.match_confidence, -- 16
				t.matched_rule_id,  -- 17
				COALESCE(t.user_verified, false) -- 18
			FROM transactions t
			LEFT JOIN categories c ON t.category_id = c.id
			WHERE t.user_id = $2
			   OR t.household_id::text = $1
			   OR (t.household_id IS NOT NULL AND t.user_id IN (
			       SELECT hm.user_id FROM household_members hm
			       LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			           AND (sp.household_id::text = $1 OR sp.household_id IS NULL)
			       WHERE hm.household_id::text = $1
			         AND hm.user_id != $2
			         AND COALESCE(sp.share_transactions, true) = true
			   ))
		`, hh, userID)
	}

	if err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Print(`Database query error`)
		return
	}
	defer rows.Close()

	var transactions []models.Transaction
	log.Print("Updating transaction model from database")
	columns, _ := rows.Columns()
	log.Printf("Columes returned: %v", columns)
	rowCount := 0
	for rows.Next() {
		var t models.Transaction
		var hh, freq, note sql.NullString
		rowCount++
		log.Print("Scanning")
		err := rows.Scan(
			&t.ID,              // 1
			&t.UserID,          // 2
			&hh,                // 3 household_id
			&t.BudgetID,        // 4
			&t.CategoryID,      // 5
			&t.Type,            // 6
			&t.Amount,          // 7
			&t.Currency,        // 8 currency
			&note,              // 9 note
			&t.Date,            // 10
			&freq,              // 11 frequency
			&t.DueDay,          // 12
			&t.Category,        // 13
			&t.Color,           // 14
			&t.Source,          // 15
			&t.MatchConfidence, // 16
			&t.MatchedRuleID,   // 17
			&t.UserVerified,    // 18
		)
		if hh.Valid {
			val := hh.String
			t.HouseholdID = &val
		}
		t.Frequency = freq.String
		t.Note = note.String

		if err != nil {
			http.Error(w, "Failed to scan row", http.StatusInternalServerError)
			log.Printf("Failed to scan: %v", err)
			return
		}
		log.Print("Scan worked")
		transactions = append(transactions, t)
	}
	log.Printf("Total rows processed: %d", rowCount)

	json.NewEncoder(w).Encode(transactions)
}

func UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if id == "" {
		http.Error(w, "Missing transaction ID", http.StatusBadRequest)
		return
	}

	var tx models.Transaction
	if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validation
	if tx.UserID == "" {
		validationError(w, "User ID is required")
		return
	}
	if tx.Amount <= 0 {
		validationError(w, "Amount must be greater than zero")
		return
	}
	if !isValidBudgetType(tx.Type) {
		validationError(w, "Type must be 'income' or 'expense'")
		return
	}
	if tx.Date.IsZero() {
		validationError(w, "Date is required")
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if !ownershipCheck(w, dbClient.Conn, "transactions", id, tx.UserID) {
		return
	}

	// Normalize empty strings to nil for UUID/nullable columns
	if tx.CategoryID != nil && *tx.CategoryID == "" {
		tx.CategoryID = nil
	}
	if tx.BudgetID != nil && *tx.BudgetID == "" {
		tx.BudgetID = nil
	}

	// Set default currency if not provided
	if tx.Currency == "" {
		tx.Currency = "USD"
	}

	// Execute UPDATE query — when user sets a category, mark as verified
	_, err = dbClient.Exec(`
		UPDATE transactions
		SET amount = $1, note = $2, category_id = $3, category_name = $4, type = $5, date = $6,
		    frequency = $7, due_day = $8, budget_id = $9, currency = $10,
		    user_verified = CASE WHEN $3 IS NOT NULL THEN true ELSE user_verified END,
		    match_confidence = CASE WHEN $3 IS NOT NULL THEN 'exact' ELSE match_confidence END
		WHERE id = $11
	`, tx.Amount, tx.Note, tx.CategoryID, tx.Category, tx.Type, tx.Date, tx.Frequency, tx.DueDay, tx.BudgetID, tx.Currency, id)
	if err != nil {
		log.Printf("UpdateTransaction update error: %v", err)
		http.Error(w, "Failed to update transaction", http.StatusInternalServerError)
		return
	}

	// Fetch the updated transaction with category join
	var hh, freq, note sql.NullString
	var catID sql.NullString

	err = dbClient.QueryRow(`
		SELECT
			t.id,
			t.user_id,
			t.household_id,
			t.budget_id,
			t.category_id,
			t.type,
			t.amount,
			t.currency,
			t.note,
			t.date,
			t.frequency,
			t.due_day,
			COALESCE(c.name, t.category_name),
			c.color,
			t.source,
			t.match_confidence,
			t.matched_rule_id,
			COALESCE(t.user_verified, false)
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.id = $1
	`, id).Scan(
		&tx.ID,
		&tx.UserID,
		&hh,
		&tx.BudgetID,
		&catID,
		&tx.Type,
		&tx.Amount,
		&tx.Currency,
		&note,
		&tx.Date,
		&freq,
		&tx.DueDay,
		&tx.Category,
		&tx.Color,
		&tx.Source,
		&tx.MatchConfidence,
		&tx.MatchedRuleID,
		&tx.UserVerified,
	)
	if err != nil {
		log.Printf("UpdateTransaction fetch error: %v", err)
		http.Error(w, "Failed to fetch updated transaction", http.StatusInternalServerError)
		return
	}

	if hh.Valid {
		val := hh.String
		tx.HouseholdID = &val
	}
	if catID.Valid {
		val := catID.String
		tx.CategoryID = &val
	}
	tx.Frequency = freq.String
	tx.Note = note.String

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tx)
}

func DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if id == "" {
		http.Error(w, "Missing transaction ID", http.StatusBadRequest)
		return
	}
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if !ownershipCheck(w, dbClient.Conn, "transactions", id, userID) {
		return
	}

	_, err = dbClient.Exec("DELETE FROM transactions WHERE id = $1", id)
	if err != nil {
		http.Error(w, "Failed to delete transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// BackfillTransactionCategories resolves category_id for all transactions that
// have a category_name but no category_id. This is a one-time management endpoint.
// POST /auth/transactions/backfill-categories
func BackfillTransactionCategories(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

	rows, err := dbClient.Query(`
		SELECT id, user_id, household_id, category_name, note
		FROM transactions
		WHERE category_id IS NULL AND category_name IS NOT NULL AND category_name != ''
		  AND (user_id = $1 OR household_id::text = $2)
	`, userID, hhID)
	if err != nil {
		log.Printf("BackfillTransactionCategories query error: %v", err)
		http.Error(w, "Failed to query transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type backfillRow struct {
		id          string
		userID      string
		householdID *string
		catName     string
		note        string
	}

	var pending []backfillRow
	for rows.Next() {
		var br backfillRow
		var hh, note sql.NullString
		if err := rows.Scan(&br.id, &br.userID, &hh, &br.catName, &note); err != nil {
			log.Printf("BackfillTransactionCategories scan error: %v", err)
			continue
		}
		if hh.Valid {
			br.householdID = &hh.String
		}
		br.note = note.String
		pending = append(pending, br)
	}

	updated := 0
	for _, br := range pending {
		hhForResolver := ""
		if br.householdID != nil {
			hhForResolver = *br.householdID
		}
		// Use category_name as a pseudo Plaid category, and note as merchant name
		merchantName := br.note
		plaidCats := []string{br.catName}

		catID, conf, ruleID, resolveErr := categories.ResolveCategory(dbClient.Conn, br.userID, hhForResolver, merchantName, plaidCats)
		if resolveErr != nil {
			log.Printf("BackfillTransactionCategories resolve error for tx %s: %v", br.id, resolveErr)
			continue
		}
		if catID == "" {
			continue
		}

		var matchedRuleID *string
		if ruleID != nil {
			matchedRuleID = ruleID
		}

		_, err := dbClient.Exec(`
			UPDATE transactions
			SET category_id = $1, match_confidence = $2, matched_rule_id = $3
			WHERE id = $4
		`, catID, conf, matchedRuleID, br.id)
		if err != nil {
			log.Printf("BackfillTransactionCategories update error for tx %s: %v", br.id, err)
			continue
		}
		updated++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_pending": len(pending),
		"updated":       updated,
	})
}

// checkBudgetThresholdAfterTransaction checks if a budget has exceeded its alert threshold
// after a transaction is created. If so, sends a push notification to all household members.
func checkBudgetThresholdAfterTransaction(dbClient db.DBTX, budgetID, householdID string, txDate time.Time) {
	// Get budget info
	var budgetName string
	var budgetAmount float64
	err := dbClient.QueryRow(
		`SELECT name, amount FROM budgets WHERE id = $1`,
		budgetID,
	).Scan(&budgetName, &budgetAmount)
	if err != nil {
		log.Printf("checkBudgetThreshold budget lookup error: %v", err)
		return
	}

	// Get the configured threshold for this budget (default to 80%)
	var threshold int = 80
	err = dbClient.QueryRow(
		`SELECT COALESCE(threshold_percent, 80) FROM spending_alerts WHERE budget_id = $1 AND is_enabled = true`,
		budgetID,
	).Scan(&threshold)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("checkBudgetThreshold alert lookup error: %v", err)
		// Fall through with default 80%
	}

	// Calculate spending for this budget for the current month
	monthStart := time.Date(txDate.Year(), txDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	var spent float64
	err = dbClient.QueryRow(
		`SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE budget_id = $1 AND type = 'expense' AND date >= $2 AND date < $3`,
		budgetID, monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02"),
	).Scan(&spent)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("checkBudgetThreshold spending query error: %v", err)
		return
	}

	// Calculate percent used
	percentUsed := 0
	if budgetAmount > 0 {
		percentUsed = int((spent / budgetAmount) * 100)
	}

	// Only send notification if we've exceeded the threshold
	if percentUsed < threshold {
		return
	}

	// Send notification to all household members
	var title, body string
	if percentUsed >= 100 {
		title = "Over Budget"
		body = fmt.Sprintf("%s is at %d%% ($%.0f of $%.0f)", budgetName, percentUsed, spent, budgetAmount)
	} else {
		title = "Budget Alert"
		body = fmt.Sprintf("%s is at %d%% ($%.0f of $%.0f)", budgetName, percentUsed, spent, budgetAmount)
	}

	SendHouseholdNotification(householdID, "", title, body, map[string]string{
		"screen":    "/(tabs)/budget",
		"budget_id": budgetID,
	})
}

// setTransactionCategoryRequest is the body for PATCH /auth/transactions/{id}/category.
type setTransactionCategoryRequest struct {
	UserID     string `json:"user_id"`
	CategoryID string `json:"category_id"`
}

// SetTransactionCategory assigns a category to a single transaction and marks
// it verified. It is a lightweight alternative to UpdateTransaction (which
// requires the full transaction body) for the common "pick a category" action.
// PATCH /auth/transactions/{id}/category
func SetTransactionCategory(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if id == "" {
		http.Error(w, "Missing transaction ID", http.StatusBadRequest)
		return
	}

	var req setTransactionCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		validationError(w, "User ID is required")
		return
	}
	if req.CategoryID == "" {
		validationError(w, "Category ID is required")
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if !ownershipCheck(w, dbClient.Conn, "transactions", id, req.UserID) {
		return
	}

	// Assign the category and mark verified — same semantics as
	// UpdateTransaction when a category is set. The join to categories both
	// resolves the name and validates the category exists. RETURNING also
	// yields the normalized merchant, which drives the learning step below.
	var categoryName string
	var merchantNorm sql.NullString
	err = dbClient.QueryRow(`
		UPDATE transactions t
		SET category_id = $1,
		    category_name = c.name,
		    user_verified = true,
		    match_confidence = 'exact',
		    updated_at = NOW()
		FROM categories c
		WHERE t.id = $2 AND c.id = $1
		RETURNING c.name, t.merchant_normalized
	`, req.CategoryID, id).Scan(&categoryName, &merchantNorm)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Transaction or category not found", http.StatusNotFound)
			return
		}
		log.Printf("SetTransactionCategory update error: %v", err)
		http.Error(w, "Failed to update transaction category", http.StatusInternalServerError)
		return
	}

	// Learn from the edit: turn this choice into a merchant rule (shared with
	// the household), then re-apply it to the user's other unverified
	// transactions from the same merchant. Verified transactions are left
	// untouched — the user already decided those.
	learned := false
	retroCount := 0
	if merchantNorm.Valid && merchantNorm.String != "" {
		var householdID *string
		if hh := db.ResolveHouseholdID(dbClient.Conn, req.UserID); hh != "" {
			householdID = &hh
		}
		upsertMerchantRule(dbClient, req.UserID, householdID, merchantNorm.String, req.CategoryID, false)
		learned = true

		res, rerr := dbClient.Exec(`
			UPDATE transactions
			SET category_id = $1, category_name = $2, match_confidence = 'exact',
			    user_verified = true, updated_at = NOW()
			WHERE user_id = $3 AND merchant_normalized = $4
			  AND COALESCE(user_verified, false) = false
		`, req.CategoryID, categoryName, req.UserID, merchantNorm.String)
		if rerr != nil {
			log.Printf("SetTransactionCategory retroactive update: %v", rerr)
		} else if n, _ := res.RowsAffected(); n > 0 {
			retroCount = int(n)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                id,
		"category_id":       req.CategoryID,
		"category_name":     categoryName,
		"user_verified":     true,
		"learned":           learned,
		"retroactive_count": retroCount,
	})
}

// RecategorizeTransactions re-runs merchant normalization and the category
// resolver over the caller's existing bank-synced transactions. It is the
// one-time backfill for the categorization rework: merchant_normalized is
// (re)written for every bank transaction, and the category is re-resolved only
// for transactions the user has not verified — user choices are never
// overwritten.
// POST /auth/transactions/recategorize
func RecategorizeTransactions(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

	rows, err := dbClient.Query(`
		SELECT id, COALESCE(note, ''), COALESCE(user_verified, false)
		FROM transactions
		WHERE user_id = $1 AND source IN ('bank', 'flinks', 'teller')
	`, userID)
	if err != nil {
		log.Printf("recategorize: query error: %v", err)
		http.Error(w, "Failed to load transactions", http.StatusInternalServerError)
		return
	}

	type txRow struct {
		id       string
		note     string
		verified bool
	}
	var txs []txRow
	for rows.Next() {
		var t txRow
		if err := rows.Scan(&t.id, &t.note, &t.verified); err == nil {
			txs = append(txs, t)
		}
	}
	rows.Close()

	normalized, recategorized := 0, 0
	for _, t := range txs {
		merchant := categories.NormalizeMerchant(t.note, "")

		var merchantArg interface{}
		if merchant != "" {
			merchantArg = merchant
		}
		if _, err := dbClient.Exec(
			`UPDATE transactions SET merchant_normalized = $1 WHERE id = $2`,
			merchantArg, t.id); err != nil {
			log.Printf("recategorize: set merchant for %s: %v", t.id, err)
			continue
		}
		normalized++

		// Never overwrite a category the user verified.
		if t.verified || merchant == "" {
			continue
		}
		catID, conf, ruleID, resolveErr := categories.ResolveCategory(dbClient.Conn, userID, hhID, merchant, nil)
		if resolveErr != nil || catID == "" {
			continue
		}
		var confArg, ruleArg interface{}
		if conf != "" {
			confArg = conf
		}
		if ruleID != nil {
			ruleArg = *ruleID
		}
		// An exact match is a user-created/confirmed rule — mark it verified.
		verified := conf == "exact"
		if _, err := dbClient.Exec(`
			UPDATE transactions
			SET category_id = $1, match_confidence = $2, matched_rule_id = $3,
			    user_verified = $4, updated_at = NOW()
			WHERE id = $5 AND COALESCE(user_verified, false) = false
		`, catID, confArg, ruleArg, verified, t.id); err != nil {
			log.Printf("recategorize: update category for %s: %v", t.id, err)
			continue
		}
		recategorized++
	}

	log.Printf("recategorize: user=%s normalized=%d recategorized=%d", userID, normalized, recategorized)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{
		"normalized":    normalized,
		"recategorized": recategorized,
	})
}

// verifyTransactionRequest is the body for PATCH /auth/transactions/{id}/verify.
type verifyTransactionRequest struct {
	UserID string `json:"user_id"`
}

// VerifyTransaction marks a transaction's category as user-confirmed. It backs
// the review screen's confirm / confirm-all actions — a lightweight alternative
// to UpdateTransaction, which requires the full transaction body.
// PATCH /auth/transactions/{id}/verify
func VerifyTransaction(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	if id == "" {
		http.Error(w, "Missing transaction ID", http.StatusBadRequest)
		return
	}

	var req verifyTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		validationError(w, "User ID is required")
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if !ownershipCheck(w, dbClient.Conn, "transactions", id, req.UserID) {
		return
	}

	res, err := dbClient.Exec(`
		UPDATE transactions SET user_verified = true, updated_at = NOW() WHERE id = $1
	`, id)
	if err != nil {
		log.Printf("VerifyTransaction error: %v", err)
		http.Error(w, "Failed to verify transaction", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "user_verified": true})
}
