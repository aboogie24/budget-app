package handlers

import (
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

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	_, err = dbClient.Exec(`
		INSERT INTO transactions (id, user_id, type, amount, category, note, date, frequency, due_day)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		tx.ID, tx.UserID, tx.Type, tx.Amount, tx.Category, tx.Note, tx.Date, tx.Frequency, tx.DueDay)
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
	rows, err := dbClient.Query(`
		SELECT 
			t.id,          -- 1
			t.user_id,     -- 2
			t.budget_id,   -- 3
			t.type,        -- 4
			t.amount,      -- 5
			t.note,        -- 6
			t.date,        -- 7
			t.frequency,   -- 8
			t.due_day,     -- 9
			c.name,        -- 10 = category name
			c.color        -- 11
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
	`, userID)

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
		rowCount++
		log.Print("Scanning")
		columns, _ := rows.Columns()
		log.Printf("Columes returned: %v", columns)
		err := rows.Scan(
			&t.ID,     // 1
			&t.UserID, // 2
			&t.BudgetID,
			&t.Type,      // 3
			&t.Amount,    // 4
			&t.Note,      // 5
			&t.Date,      // 6
			&t.Frequency, // 7
			&t.DueDay,    // 8
			&t.Category,  // 9
			&t.Color,     // 10
		)

		if err != nil {
			http.Error(w, "Failed to scan row", http.StatusInternalServerError)
			log.Printf("Failed to scan", err)
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
