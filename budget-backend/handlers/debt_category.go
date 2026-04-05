package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/gorilla/mux"
)

// UpdateDebtCategory toggles a debt between "attack" and "structured".
// PUT /auth/debts/{id}/category
func UpdateDebtCategory(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	debtID := mux.Vars(r)["id"]
	if debtID == "" {
		http.Error(w, "Missing debt ID", http.StatusBadRequest)
		return
	}

	var body struct {
		DebtCategory string `json:"debt_category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if body.DebtCategory != "attack" && body.DebtCategory != "structured" {
		http.Error(w, "debt_category must be 'attack' or 'structured'", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Verify ownership
	var ownerID string
	err = conn.QueryRow(`SELECT user_id FROM debt_accounts WHERE id = $1`, debtID).Scan(&ownerID)
	if err != nil {
		http.Error(w, "Debt not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		// Check household access
		userHH := db.ResolveHouseholdID(conn.Raw(), userID)
		var debtHH string
		_ = conn.QueryRow(`SELECT COALESCE(household_id::text, '') FROM debt_accounts WHERE id = $1`, debtID).Scan(&debtHH)
		if userHH == "" || userHH != debtHH {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
	}

	_, err = conn.Exec(`UPDATE debt_accounts SET debt_category = $1 WHERE id = $2`, body.DebtCategory, debtID)
	if err != nil {
		log.Printf("UpdateDebtCategory error: %v", err)
		http.Error(w, "Update failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":            debtID,
		"debt_category": body.DebtCategory,
		"updated":       true,
	})
}

// ListDebtsByCategory returns all debts grouped by category.
// GET /auth/debts/grouped
func ListDebtsByCategory(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT id, name, balance, COALESCE(apr, 0), COALESCE(min_payment, 0),
		       COALESCE(debt_category, 'attack'), COALESCE(liability_type, 'other'),
		       COALESCE(source, 'manual')
		FROM debt_accounts
		WHERE user_id = $1
		ORDER BY debt_category, balance DESC
	`, userID)
	if err != nil {
		log.Printf("ListDebtsByCategory query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type DebtSummary struct {
		ID            string  `json:"id"`
		Name          string  `json:"name"`
		Balance       float64 `json:"balance"`
		APR           float64 `json:"apr"`
		MinPayment    float64 `json:"min_payment"`
		DebtCategory  string  `json:"debt_category"`
		LiabilityType string  `json:"liability_type"`
		Source        string  `json:"source"`
	}

	attack := []DebtSummary{}
	structured := []DebtSummary{}
	var attackTotal, structuredTotal float64

	for rows.Next() {
		var d DebtSummary
		if err := rows.Scan(&d.ID, &d.Name, &d.Balance, &d.APR, &d.MinPayment, &d.DebtCategory, &d.LiabilityType, &d.Source); err != nil {
			continue
		}
		if d.DebtCategory == "structured" {
			structured = append(structured, d)
			structuredTotal += d.Balance
		} else {
			attack = append(attack, d)
			attackTotal += d.Balance
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"attack":           attack,
		"structured":       structured,
		"attack_total":     attackTotal,
		"structured_total": structuredTotal,
		"total_debt":       attackTotal + structuredTotal,
	})
}
