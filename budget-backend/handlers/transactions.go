package handlers

import (
	"encoding/json"
	"fmt"
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

	rows, err := dbClient.Query(`
		SELECT id, user_id, type, amount, category, note, date, frequency, due_day
		FROM transactions WHERE user_id = $1
	`, userID)

	if err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var transactions []models.Transaction

	for rows.Next() {
		var t models.Transaction
		err := rows.Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Note, &t.Date, &t.Frequency, &t.DueDay)
		if err != nil {
			http.Error(w, "Failed to scan row", http.StatusInternalServerError)
			return
		}
		transactions = append(transactions, t)
	}

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
