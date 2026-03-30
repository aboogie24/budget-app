package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
)

// GetSupportedCurrencies returns a static list of common currencies
func GetSupportedCurrencies(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	currencies := []models.Currency{
		{Code: "USD", Name: "US Dollar", Symbol: "$"},
		{Code: "EUR", Name: "Euro", Symbol: "€"},
		{Code: "GBP", Name: "British Pound", Symbol: "£"},
		{Code: "CAD", Name: "Canadian Dollar", Symbol: "CA$"},
		{Code: "AUD", Name: "Australian Dollar", Symbol: "A$"},
		{Code: "JPY", Name: "Japanese Yen", Symbol: "¥"},
		{Code: "MXN", Name: "Mexican Peso", Symbol: "MX$"},
		{Code: "BRL", Name: "Brazilian Real", Symbol: "R$"},
		{Code: "INR", Name: "Indian Rupee", Symbol: "₹"},
		{Code: "NGN", Name: "Nigerian Naira", Symbol: "₦"},
		{Code: "CHF", Name: "Swiss Franc", Symbol: "CHF"},
		{Code: "KRW", Name: "South Korean Won", Symbol: "₩"},
		{Code: "CNY", Name: "Chinese Yuan", Symbol: "¥"},
	}

	json.NewEncoder(w).Encode(currencies)
}

// GetUserCurrency returns the user's default currency
func GetUserCurrency(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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

	// First try to get from household default
	var householdCurrency string
	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)
	if hhID != "" {
		err = dbClient.QueryRow(`
			SELECT COALESCE(default_currency, 'USD')
			FROM households
			WHERE id::text = $1
		`, hhID).Scan(&householdCurrency)
		if err == nil && householdCurrency != "" {
			json.NewEncoder(w).Encode(map[string]string{
				"currency": householdCurrency,
				"source":   "household",
			})
			return
		}
	}

	// Fall back to user default
	var userCurrency string
	err = dbClient.QueryRow(`
		SELECT COALESCE(default_currency, 'USD')
		FROM users
		WHERE id = $1
	`, userID).Scan(&userCurrency)
	if err != nil {
		http.Error(w, "Failed to fetch user currency", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"currency": userCurrency,
		"source":   "user",
	})
}

// SetUserCurrency updates the user's default currency
func SetUserCurrency(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Currency string `json:"currency"`
		UserID   string `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Currency == "" {
		http.Error(w, "Currency is required", http.StatusBadRequest)
		return
	}

	if req.UserID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Check if user is in a household
	hhID := db.ResolveHouseholdID(dbClient.Conn, req.UserID)

	if hhID != "" {
		// Update household default currency
		_, err = dbClient.Exec(`
			UPDATE households
			SET default_currency = $1
			WHERE id::text = $2
		`, req.Currency, hhID)
		if err != nil {
			log.Printf("SetUserCurrency error updating household: %v", err)
			http.Error(w, "Failed to update currency", http.StatusInternalServerError)
			return
		}
	} else {
		// Update user default currency
		_, err = dbClient.Exec(`
			UPDATE users
			SET default_currency = $1
			WHERE id = $2
		`, req.Currency, req.UserID)
		if err != nil {
			log.Printf("SetUserCurrency error updating user: %v", err)
			http.Error(w, "Failed to update currency", http.StatusInternalServerError)
			return
		}
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":   "ok",
		"currency": req.Currency,
	})
}
