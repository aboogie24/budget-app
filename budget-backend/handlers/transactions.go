package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
)

func CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var tx models.Transaction
	if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`
		INSERT INTO transactions (id, user_id, type, amount, category, note, date, frequency, due_day)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		tx.ID, tx.UserID, tx.Type, tx.Amount, tx.Category, tx.Note, tx.Date, tx.Frequency, tx.DueDay)
	if err != nil {
		http.Error(w, "Failed to insert transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
