package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// SplitTransaction creates splits for a transaction (POST /auth/transactions/{id}/split).
// Validation: sum of splits must equal transaction amount (within $0.01), at least 2 splits,
// all category_id values must be valid, and the user must own the transaction.
func SplitTransaction(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	txID := mux.Vars(r)["id"]
	if txID == "" {
		http.Error(w, "Missing transaction ID", http.StatusBadRequest)
		return
	}

	var req models.SplitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Splits) < 2 {
		validationError(w, "At least 2 splits are required")
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Verify ownership and get transaction amount.
	var txAmount float64
	var txOwner string
	err = dbClient.QueryRow(`SELECT user_id, amount FROM transactions WHERE id = $1`, txID).Scan(&txOwner, &txAmount)
	if err == sql.ErrNoRows {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("SplitTransaction: query error: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	if txOwner != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Validate split amounts sum to transaction amount (within $0.01 tolerance).
	var splitSum float64
	for _, s := range req.Splits {
		if s.Amount <= 0 {
			validationError(w, "Each split amount must be greater than zero")
			return
		}
		if s.CategoryID == "" {
			validationError(w, "Each split must have a category_id")
			return
		}
		splitSum += s.Amount
	}
	if math.Abs(splitSum-txAmount) > 0.01 {
		validationError(w, "Sum of split amounts must equal the transaction amount")
		return
	}

	// Validate all category IDs exist.
	for _, s := range req.Splits {
		var exists bool
		err = dbClient.QueryRow(`SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)`, s.CategoryID).Scan(&exists)
		if err != nil || !exists {
			validationError(w, "Invalid category_id: "+s.CategoryID)
			return
		}
	}

	// Begin transaction.
	tx, err := dbClient.Conn.Begin()
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Delete existing splits (idempotent for re-split).
	if _, err := tx.Exec(`DELETE FROM transaction_splits WHERE transaction_id = $1`, txID); err != nil {
		log.Printf("SplitTransaction: delete existing splits: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Insert new splits and track the largest.
	var largestAmount float64
	var largestCategoryID string
	for _, s := range req.Splits {
		var note *string
		if s.Note != "" {
			note = &s.Note
		}
		if _, err := tx.Exec(`
			INSERT INTO transaction_splits (transaction_id, category_id, amount, note)
			VALUES ($1, $2, $3, $4)
		`, txID, s.CategoryID, s.Amount, note); err != nil {
			log.Printf("SplitTransaction: insert split: %v", err)
			http.Error(w, "Internal error", http.StatusInternalServerError)
			return
		}
		if s.Amount > largestAmount {
			largestAmount = s.Amount
			largestCategoryID = s.CategoryID
		}
	}

	// Update the parent transaction.
	if _, err := tx.Exec(`
		UPDATE transactions SET is_split = true, category_id = $2, user_verified = true
		WHERE id = $1
	`, txID, largestCategoryID); err != nil {
		log.Printf("SplitTransaction: update transaction: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("SplitTransaction: commit: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Return the created splits.
	splits, err := fetchSplits(dbClient, txID)
	if err != nil {
		log.Printf("SplitTransaction: fetch result: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(splits)
}

// GetTransactionSplits returns splits for a transaction (GET /auth/transactions/{id}/split).
func GetTransactionSplits(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	txID := mux.Vars(r)["id"]

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Verify ownership.
	var txOwner string
	err = dbClient.QueryRow(`SELECT user_id FROM transactions WHERE id = $1`, txID).Scan(&txOwner)
	if err == sql.ErrNoRows {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	if txOwner != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	splits, err := fetchSplits(dbClient, txID)
	if err != nil {
		log.Printf("GetTransactionSplits: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(splits)
}

// UpdateTransactionSplits replaces all splits for a transaction (PUT /auth/transactions/{id}/split).
// Same validation as SplitTransaction.
func UpdateTransactionSplits(w http.ResponseWriter, r *http.Request) {
	// Reuse the same logic as creating splits (delete + re-insert).
	SplitTransaction(w, r)
}

// DeleteTransactionSplits removes all splits and reverts to a single-category transaction
// (DELETE /auth/transactions/{id}/split).
func DeleteTransactionSplits(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	txID := mux.Vars(r)["id"]

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Verify ownership.
	var txOwner string
	err = dbClient.QueryRow(`SELECT user_id FROM transactions WHERE id = $1`, txID).Scan(&txOwner)
	if err == sql.ErrNoRows {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	if txOwner != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	txn, err := dbClient.Conn.Begin()
	if err != nil {
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer txn.Rollback()

	if _, err := txn.Exec(`DELETE FROM transaction_splits WHERE transaction_id = $1`, txID); err != nil {
		log.Printf("DeleteTransactionSplits: delete: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	if _, err := txn.Exec(`UPDATE transactions SET is_split = false WHERE id = $1`, txID); err != nil {
		log.Printf("DeleteTransactionSplits: update: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	if err := txn.Commit(); err != nil {
		log.Printf("DeleteTransactionSplits: commit: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// fetchSplits is a helper that loads splits for a transaction with category names joined.
func fetchSplits(dbClient *db.DB, txID string) ([]models.TransactionSplit, error) {
	rows, err := dbClient.Query(`
		SELECT ts.id, ts.transaction_id, ts.category_id, COALESCE(c.name, ''),
		       ts.amount, ts.note, ts.created_at
		FROM transaction_splits ts
		LEFT JOIN categories c ON ts.category_id = c.id
		WHERE ts.transaction_id = $1
		ORDER BY ts.amount DESC
	`, txID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var splits []models.TransactionSplit
	for rows.Next() {
		var s models.TransactionSplit
		if err := rows.Scan(&s.ID, &s.TransactionID, &s.CategoryID, &s.CategoryName,
			&s.Amount, &s.Note, &s.CreatedAt); err != nil {
			return nil, err
		}
		splits = append(splits, s)
	}
	if splits == nil {
		splits = []models.TransactionSplit{}
	}
	return splits, nil
}
