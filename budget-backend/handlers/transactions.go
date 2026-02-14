package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
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

	_, err = dbClient.Exec(`
		INSERT INTO transactions (id, user_id, household_id, category_id, type, amount, category_name, note, date, frequency, due_day, source)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		tx.ID, tx.UserID, tx.HouseholdID, tx.CategoryID, tx.Type, tx.Amount, tx.Category, tx.Note, tx.Date, tx.Frequency, tx.DueDay, tx.Source)
	if err != nil {
		http.Error(w, "Failed to insert transaction", http.StatusInternalServerError)
		return
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
				t.note,        -- 8
				t.date,        -- 9
				t.frequency,   -- 10
				t.due_day,     -- 11
				COALESCE(c.name, t.category_name), -- 12
				c.color,       -- 13
				t.source       -- 14
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
				t.note,        -- 8
				t.date,        -- 9
				t.frequency,   -- 10
				t.due_day,     -- 11
				COALESCE(c.name, t.category_name), -- 12
				c.color,       -- 13
				t.source       -- 14
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
			&t.ID,         // 1
			&t.UserID,     // 2
			&hh,           // 3 household_id
			&t.BudgetID,   // 4
			&t.CategoryID, // 5
			&t.Type,       // 6
			&t.Amount,     // 7
			&note,         // 8 note
			&t.Date,       // 9
			&freq,         // 10 frequency
			&t.DueDay,     // 11
			&t.Category,   // 12
			&t.Color,      // 13
			&t.Source,     // 14
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

func DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	// Expecting URL format: /transactions/{id}
	segments := strings.Split(r.URL.Path, "/")
	if len(segments) < 3 {
		http.Error(w, "Missing transaction ID", http.StatusBadRequest)
		return
	}
	id := segments[2]

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	_, err = dbClient.Exec("DELETE FROM transactions WHERE id = $1", id)
	if err != nil {
		http.Error(w, "Failed to delete transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
