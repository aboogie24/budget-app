package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
)

// bootstrapExpenseItem is one starter expense budget from OB2.
type bootstrapExpenseItem struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
}

// bootstrapBudgetsRequest is the body for POST /auth/budgets/bootstrap.
// Explicit skip is client-side — do not invent silent zero budgets.
type bootstrapBudgetsRequest struct {
	UserID   string                 `json:"user_id"`
	Income   *float64               `json:"income,omitempty"`
	Expenses []bootstrapExpenseItem `json:"expenses"`
}

type bootstrapBudgetResult struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Amount      float64 `json:"amount"`
	Type        string  `json:"type"`
	HouseholdID string  `json:"household_id"`
	IsShared    bool    `json:"is_shared"`
	Created     bool    `json:"created"`
}

// BootstrapBudgets creates starter income/expense budgets for first-run OB2.
// Budgets are attached to the user's household and marked shared so a partner
// joining later sees them. Idempotent by (user_id, type, lower(name)).
// POST /auth/budgets/bootstrap
func BootstrapBudgets(w http.ResponseWriter, r *http.Request) {
	var req bootstrapBudgetsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		validationError(w, "user_id is required")
		return
	}

	hasIncome := req.Income != nil && *req.Income > 0
	expenses := make([]bootstrapExpenseItem, 0, len(req.Expenses))
	for _, e := range req.Expenses {
		name := strings.TrimSpace(e.Name)
		if name == "" || e.Amount <= 0 {
			continue
		}
		expenses = append(expenses, bootstrapExpenseItem{Name: name, Amount: e.Amount})
	}
	if !hasIncome && len(expenses) == 0 {
		validationError(w, "Provide at least one expense (name + amount > 0) or a positive income; skip is client-side")
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Ensure household exists even if OB1 create was skipped — never household-less.
	hhID, err := db.EnsureHouseholdForUser(dbClient.Conn, req.UserID)
	if err != nil || hhID == "" {
		log.Printf("BootstrapBudgets ensure household: %v", err)
		http.Error(w, "Failed to ensure household", http.StatusInternalServerError)
		return
	}

	now := time.Now().UTC()
	results := make([]bootstrapBudgetResult, 0, len(expenses)+1)

	upsert := func(name, typ string, amount float64) error {
		var existingID string
		err := dbClient.QueryRow(`
			SELECT id FROM budgets
			WHERE user_id = $1 AND type = $2 AND LOWER(name) = LOWER($3)
			LIMIT 1
		`, req.UserID, typ, name).Scan(&existingID)

		created := false
		id := existingID
		if err == sql.ErrNoRows {
			id = uuid.Must(uuid.NewV4()).String()
			_, err = dbClient.Exec(`
				INSERT INTO budgets (
					id, user_id, household_id, name, amount, type, category_id,
					created_at, updated_at, start_date, frequency, is_shared
				) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, 'monthly', TRUE)
			`, id, req.UserID, hhID, name, amount, typ, now, now, now)
			if err != nil {
				return err
			}
			created = true
		} else if err != nil {
			return err
		} else {
			// Idempotent re-call: refresh amount + share/household binding.
			_, err = dbClient.Exec(`
				UPDATE budgets
				SET amount = $1, household_id = $2, is_shared = TRUE, updated_at = $3, updated_by = $4
				WHERE id = $5
			`, amount, hhID, now, req.UserID, id)
			if err != nil {
				return err
			}
		}

		results = append(results, bootstrapBudgetResult{
			ID:          id,
			Name:        name,
			Amount:      amount,
			Type:        typ,
			HouseholdID: hhID,
			IsShared:    true,
			Created:     created,
		})
		return nil
	}

	for _, e := range expenses {
		if err := upsert(e.Name, "expense", e.Amount); err != nil {
			log.Printf("BootstrapBudgets expense %q: %v", e.Name, err)
			http.Error(w, "Failed to create starter budgets", http.StatusInternalServerError)
			return
		}
	}
	if hasIncome {
		if err := upsert("Take-home", "income", *req.Income); err != nil {
			log.Printf("BootstrapBudgets income: %v", err)
			http.Error(w, "Failed to create starter budgets", http.StatusInternalServerError)
			return
		}
	}

	createdCount := 0
	for _, b := range results {
		if b.Created {
			createdCount++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"household_id":  hhID,
		"budgets":       results,
		"created_count": createdCount,
		"total":         len(results),
	})
}
