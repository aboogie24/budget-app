package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"

	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

func CreateBudget(w http.ResponseWriter, r *http.Request) {
	var budget models.Budget
	if err := json.NewDecoder(r.Body).Decode(&budget); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	// Validation
	if budget.Name == "" {
		validationError(w, "Budget name is required")
		return
	}
	if budget.Amount <= 0 {
		validationError(w, "Amount must be greater than zero")
		return
	}
	if budget.UserID == "" {
		validationError(w, "User ID is required")
		return
	}
	if !isValidBudgetType(budget.Type) {
		validationError(w, "Type must be 'income' or 'expense'")
		return
	}
	if !isValidFrequency(budget.Frequency) {
		validationError(w, "Invalid frequency value")
		return
	}

	if budget.ID == "" {
		budget.ID = uuid.Must(uuid.NewV4()).String()
	}
	budget.CreatedAt = time.Now()
	budget.UpdatedAt = time.Now()
	if budget.Frequency == "" {
		budget.Frequency = "monthly"
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if budget.HouseholdID == nil || *budget.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(dbClient.Conn, budget.UserID); hh != "" {
			budget.HouseholdID = &hh
		} else {
			// Normalize empty household IDs to NULL so personal budgets are queryable
			budget.HouseholdID = nil
		}
	}
	// If household still empty, treat as personal (household_id NULL)

	_, err = dbClient.Exec(`
		INSERT INTO budgets (
			id, user_id, household_id, name, amount, type, category_id, created_at, updated_at, start_date, frequency, is_shared
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, budget.ID, budget.UserID, budget.HouseholdID, budget.Name, budget.Amount, budget.Type, budget.CategoryID, budget.CreatedAt, budget.UpdatedAt, budget.StartDate, budget.Frequency, budget.IsShared)
	if err != nil {
		http.Error(w, "Failed to create budget", http.StatusInternalServerError)
		return
	}
	if budget.CategoryID != nil && *budget.CategoryID != "" {
		_, _ = dbClient.Exec(`DELETE FROM budget_categories WHERE category_id = $1`, *budget.CategoryID)
		_, _ = dbClient.Exec(`
			INSERT INTO budget_categories (budget_id, category_id)
			VALUES ($1, $2)
			ON CONFLICT (category_id) DO UPDATE SET budget_id = EXCLUDED.budget_id
		`, budget.ID, *budget.CategoryID)
	}
	json.NewEncoder(w).Encode(budget)
}

func GetBudgetsByUser(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["user_id"]
	UserUUID, err := uuid.FromString(userID)
	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")
	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)

	// Default to the current month/year when not provided (Atoi yields 0 on empty)
	if month == 0 || year == 0 {
		now := time.Now().UTC()
		if month == 0 {
			month = int(now.Month())
		}
		if year == 0 {
			year = now.Year()
		}
	}

	log.Print("Getting budget by user: ", UserUUID)
	log.Printf("Month: %v and Year %v", month, year)

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()
	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

	rows, err := func() (*sql.Rows, error) {
		if hhID == "" {
			// Return all budgets owned by this user regardless of household_id
			return dbClient.Query(`
				SELECT
					b.id, b.user_id, b.household_id, b.name, b.amount, b.type,
					b.category_id, c.name AS category_name,
					b.created_at, b.updated_at, b.start_date, b.frequency, b.is_shared
				FROM budgets b
				LEFT JOIN categories c ON b.category_id = c.id
				WHERE b.user_id = $1
			`, userID)
		}
		// Include budgets in the household OR owned by the user (covers older data)
		return dbClient.Query(`
			SELECT
				b.id, b.user_id, b.household_id, b.name, b.amount, b.type,
				b.category_id, c.name AS category_name,
				b.created_at, b.updated_at, b.start_date, b.frequency, b.is_shared
			FROM budgets b
			LEFT JOIN categories c ON b.category_id = c.id
			WHERE b.user_id = $2
			   OR (b.is_shared = true AND b.user_id IN (
			       SELECT hm.user_id FROM household_members hm
			       LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			           AND (sp.household_id::text = $1 OR sp.household_id IS NULL)
			       WHERE hm.household_id::text = $1
			         AND hm.user_id != $2
			         AND COALESCE(sp.share_budgets, true) = true
			   ))
		`, hhID, userID)
	}()
	if err != nil {
		http.Error(w, "Failed to fetch budgets", http.StatusInternalServerError)
		log.Printf("Failed to fetch budgets: %v", err)
		return
	}
	defer rows.Close()

	var budgets []models.Budget
	for rows.Next() {
		var b models.Budget
		var hh sql.NullString
		var catID sql.NullString
		var catName sql.NullString
		var start sql.NullTime
		if err := rows.Scan(&b.ID, &b.UserID, &hh, &b.Name, &b.Amount, &b.Type, &catID, &catName, &b.CreatedAt, &b.UpdatedAt, &start, &b.Frequency, &b.IsShared); err == nil {
			if hh.Valid {
				val := hh.String
				b.HouseholdID = &val
			}
			if catID.Valid {
				val := catID.String
				b.CategoryID = &val
			}
			if catName.Valid {
				b.CategoryName = catName.String
			} else {
				b.CategoryName = ""
			}
			if start.Valid {
				b.StartDate = start.Time
			}
			budgets = append(budgets, b)
		} else {
			log.Printf("Scan budget row error: %v", err)
		}
	}

	// ✅ Always return valid JSON
	w.Header().Set("Content-Type", "application/json")
	log.Printf("Budgets returned: %d for user %s (month %d year %d)", len(budgets), userID, month, year)
	json.NewEncoder(w).Encode(budgets)

}

func UpdateBudget(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var budget models.Budget
	if err := json.NewDecoder(r.Body).Decode(&budget); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if budget.UserID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}
	budget.UpdatedAt = time.Now()
	if budget.Frequency == "" {
		budget.Frequency = "monthly"
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if !householdAccessCheck(w, dbClient.Conn, "budgets", id, budget.UserID) {
		return
	}

	if budget.HouseholdID == nil || *budget.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(dbClient.Conn, budget.UserID); hh != "" {
			budget.HouseholdID = &hh
		} else {
			budget.HouseholdID = nil
		}
	}

	_, err = dbClient.Exec(`
		UPDATE budgets
		SET name = $1, amount = $2, type = $3, category_id = $4, updated_at = $5, start_date = $6, frequency = $7, household_id = $8, is_shared = $9, updated_by = $11
		WHERE id = $10
	`, budget.Name, budget.Amount, budget.Type, budget.CategoryID, budget.UpdatedAt, budget.StartDate, budget.Frequency, budget.HouseholdID, budget.IsShared, id, budget.UserID)
	if err != nil {
		http.Error(w, "Failed to update budget", http.StatusInternalServerError)
		return
	}
	if budget.CategoryID != nil && *budget.CategoryID != "" {
		_, _ = dbClient.Exec(`DELETE FROM budget_categories WHERE category_id = $1`, *budget.CategoryID)
		_, _ = dbClient.Exec(`
			INSERT INTO budget_categories (budget_id, category_id)
			VALUES ($1, $2)
			ON CONFLICT (category_id) DO UPDATE SET budget_id = EXCLUDED.budget_id
		`, id, *budget.CategoryID)
	}

	// Record activity event for shared budgets
	if budget.IsShared {
		hhID := db.ResolveHouseholdID(dbClient.Conn, budget.UserID)
		if hhID != "" {
			_ = RecordActivity(dbClient, hhID, budget.UserID, "budget_updated", id, "budget", budget.Amount, fmt.Sprintf("Updated budget: %s", budget.Name))
		}
	}

	budget.ID = id
	json.NewEncoder(w).Encode(budget)
}

// GetBudgetByID returns a single budget by ID.
func GetBudgetByID(w http.ResponseWriter, r *http.Request) {
	budgetID := mux.Vars(r)["id"]
	if budgetID == "" {
		http.Error(w, "Missing budget ID", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	var b struct {
		ID          string  `json:"id"`
		UserID      string  `json:"user_id"`
		HouseholdID *string `json:"household_id,omitempty"`
		Name        string  `json:"name"`
		Amount      float64 `json:"amount"`
		Type        string  `json:"type"`
		CategoryID  *string `json:"category_id,omitempty"`
		CatName     *string `json:"category_name,omitempty"`
		Frequency   string  `json:"frequency"`
		IsShared    bool    `json:"is_shared"`
		StartDate   *string `json:"start_date,omitempty"`
		Source      *string `json:"source,omitempty"`
	}

	err = dbClient.QueryRow(`
		SELECT b.id, b.user_id, b.household_id::text, b.name, b.amount, b.type,
		       b.category_id::text, COALESCE(c.name, ''), COALESCE(b.frequency, 'monthly'),
		       COALESCE(b.is_shared, false), b.start_date::text, b.source
		FROM budgets b
		LEFT JOIN categories c ON b.category_id = c.id
		WHERE b.id = $1
	`, budgetID).Scan(&b.ID, &b.UserID, &b.HouseholdID, &b.Name, &b.Amount, &b.Type,
		&b.CategoryID, &b.CatName, &b.Frequency, &b.IsShared, &b.StartDate, &b.Source)
	if err != nil {
		log.Printf("GetBudgetByID error: %v", err)
		http.Error(w, "Budget not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(b)
}

// GetBudgetSummary returns budget-vs-actual spending per category for a
// given month/year. One endpoint replaces three separate frontend calls.
func GetBudgetSummary(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["user_id"]
	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")
	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)
	if month == 0 || year == 0 {
		now := time.Now().UTC()
		if month == 0 {
			month = int(now.Month())
		}
		if year == 0 {
			year = now.Year()
		}
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)

	// 1. Fetch budgets.
	budgetQuery := `
		SELECT
			b.id, b.user_id, b.household_id, b.name, b.amount, b.type,
			b.category_id, COALESCE(c.name, '') AS category_name,
			b.start_date, b.frequency, b.is_shared
		FROM budgets b
		LEFT JOIN categories c ON b.category_id = c.id
	`
	var budgetRows *sql.Rows
	if hhID == "" {
		budgetRows, err = dbClient.Query(budgetQuery+" WHERE b.user_id = $1", userID)
	} else {
		budgetRows, err = dbClient.Query(budgetQuery+`
			WHERE b.user_id = $2
			   OR (b.is_shared = true AND b.user_id IN (
			       SELECT hm.user_id FROM household_members hm
			       LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			           AND (sp.household_id::text = $1 OR sp.household_id IS NULL)
			       WHERE hm.household_id::text = $1
			         AND hm.user_id != $2
			         AND COALESCE(sp.share_budgets, true) = true
			   ))
		`, hhID, userID)
	}
	if err != nil {
		http.Error(w, "Failed to fetch budgets", http.StatusInternalServerError)
		log.Printf("budget summary: fetch budgets: %v", err)
		return
	}
	defer budgetRows.Close()

	type budgetInfo struct {
		ID           string
		UserID       string
		HouseholdID  *string
		Name         string
		Amount       float64
		Type         string
		CategoryID   *string
		CategoryName string
		StartDate    *time.Time
		Frequency    string
		IsShared     bool
	}

	var budgetList []budgetInfo
	for budgetRows.Next() {
		var b budgetInfo
		var hh, catID, catName, freq sql.NullString
		var start sql.NullTime
		if err := budgetRows.Scan(&b.ID, &b.UserID, &hh, &b.Name, &b.Amount, &b.Type, &catID, &catName, &start, &freq, &b.IsShared); err != nil {
			log.Printf("budget summary: scan budget: %v", err)
			continue
		}
		if hh.Valid {
			val := hh.String
			b.HouseholdID = &val
		}
		if catID.Valid {
			val := catID.String
			b.CategoryID = &val
		}
		if catName.Valid {
			b.CategoryName = catName.String
		}
		if start.Valid {
			b.StartDate = &start.Time
		}
		if freq.Valid {
			b.Frequency = freq.String
		} else {
			b.Frequency = "monthly"
		}
		budgetList = append(budgetList, b)
	}

	// 2. Fetch budget_categories join table.
	catRows, err := dbClient.Query(`
		SELECT bc.budget_id, c.id, c.name
		FROM budget_categories bc
		JOIN categories c ON c.id = bc.category_id
	`)
	if err != nil {
		http.Error(w, "Failed to fetch budget categories", http.StatusInternalServerError)
		log.Printf("budget summary: fetch cats: %v", err)
		return
	}
	defer catRows.Close()

	type catInfo struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	budgetCats := map[string][]catInfo{}
	for catRows.Next() {
		var budgetID, catID, catName string
		if err := catRows.Scan(&budgetID, &catID, &catName); err == nil {
			budgetCats[budgetID] = append(budgetCats[budgetID], catInfo{ID: catID, Name: catName})
		}
	}

	// 3. Fetch expense transactions in this month.
	// Exclude bill-sourced transactions — bills are tracked separately via bill_payments.
	// JOIN categories to get parent_id so subcategory spending rolls up to parent budgets.
	// Non-split transactions use their own category_id; split transactions contribute
	// via transaction_splits rows so each split's category is counted individually.
	txQueryNonSplit := `
		SELECT COALESCE(t.category_id::text, ''), COALESCE(c.parent_id::text, ''), t.amount
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE COALESCE(t.is_split, false) = false
		  AND t.type = 'expense'
		  AND t.date >= $1 AND t.date < $2
		  AND COALESCE(t.source, '') != 'bill'
	`
	txQuerySplit := `
		SELECT ts.category_id::text, COALESCE(c.parent_id::text, ''), ts.amount
		FROM transaction_splits ts
		JOIN transactions t ON ts.transaction_id = t.id
		LEFT JOIN categories c ON ts.category_id = c.id
		WHERE t.is_split = true
		  AND t.type = 'expense'
		  AND t.date >= $1 AND t.date < $2
		  AND COALESCE(t.source, '') != 'bill'
	`
	var txRows *sql.Rows
	if hhID == "" {
		txRows, err = dbClient.Query(
			txQueryNonSplit+" AND t.user_id = $3"+
				" UNION ALL "+
				txQuerySplit+" AND t.user_id = $3",
			monthStart, monthEnd, userID)
	} else {
		userFilter := `
			AND (t.user_id = $4
			   OR t.household_id::text = $3
			   OR (t.household_id IS NOT NULL AND t.user_id IN (
			       SELECT hm.user_id FROM household_members hm
			       LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			           AND (sp.household_id::text = $3 OR sp.household_id IS NULL)
			       WHERE hm.household_id::text = $3
			         AND hm.user_id != $4
			         AND COALESCE(sp.share_transactions, true) = true
			   )))`
		txRows, err = dbClient.Query(
			txQueryNonSplit+userFilter+
				" UNION ALL "+
				txQuerySplit+userFilter,
			monthStart, monthEnd, hhID, userID)
	}
	if err != nil {
		http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
		log.Printf("budget summary: fetch txns: %v", err)
		return
	}
	defer txRows.Close()

	spentByCategory := map[string]float64{}
	var totalSpentAll float64
	for txRows.Next() {
		var catID, parentID string
		var amt float64
		if err := txRows.Scan(&catID, &parentID, &amt); err == nil {
			spentByCategory[catID] += amt
			// Roll up subcategory spending to the parent category so parent-level budgets
			// accumulate spending from all their children.
			if parentID != "" {
				spentByCategory[parentID] += amt
			}
			totalSpentAll += amt
		}
	}

	// 3b. Fetch income transactions in this month (for income budget tracking).
	// JOIN categories to get parent_id for subcategory rollup, same as expenses.
	// Handle splits the same way as expenses.
	earnedByCategory := map[string]float64{}
	incNonSplit := `
		SELECT COALESCE(t.category_id::text, ''), COALESCE(c.parent_id::text, ''), t.amount
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE COALESCE(t.is_split, false) = false
		  AND t.type = 'income'
		  AND t.date >= $1 AND t.date < $2
	`
	incSplit := `
		SELECT ts.category_id::text, COALESCE(c.parent_id::text, ''), ts.amount
		FROM transaction_splits ts
		JOIN transactions t ON ts.transaction_id = t.id
		LEFT JOIN categories c ON ts.category_id = c.id
		WHERE t.is_split = true
		  AND t.type = 'income'
		  AND t.date >= $1 AND t.date < $2
	`
	var incTxRows *sql.Rows
	if hhID == "" {
		incTxRows, err = dbClient.Query(
			incNonSplit+" AND t.user_id = $3"+
				" UNION ALL "+
				incSplit+" AND t.user_id = $3",
			monthStart, monthEnd, userID)
	} else {
		incTxRows, err = dbClient.Query(
			incNonSplit+" AND (t.user_id = $3 OR t.household_id::text = $4)"+
				" UNION ALL "+
				incSplit+" AND (t.user_id = $3 OR t.household_id::text = $4)",
			monthStart, monthEnd, userID, hhID)
	}
	if err != nil {
		log.Printf("budget summary: fetch income txns: %v", err)
	} else {
		defer incTxRows.Close()
		for incTxRows.Next() {
			var catID, parentID string
			var amt float64
			if err := incTxRows.Scan(&catID, &parentID, &amt); err == nil {
				earnedByCategory[catID] += amt
				if parentID != "" {
					earnedByCategory[parentID] += amt
				}
			}
		}
	}

	// 4. Fetch bills to include as budgeted expenses.
	billQuery := `
		SELECT b.id, b.name, b.amount_due, b.frequency,
		       b.category_id, COALESCE(c.name, ''), COALESCE(b.household_id::text, '')
		FROM bills b
		LEFT JOIN categories c ON b.category_id = c.id
	`
	var billRows *sql.Rows
	if hhID == "" {
		billRows, err = dbClient.Query(billQuery+" WHERE b.user_id = $1", userID)
	} else {
		billRows, err = dbClient.Query(billQuery+`
			WHERE b.user_id = $2
			   OR (b.is_shared = true AND b.user_id IN (
			       SELECT hm.user_id FROM household_members hm
			       LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			           AND (sp.household_id::text = $1 OR sp.household_id IS NULL)
			       WHERE hm.household_id::text = $1
			         AND hm.user_id != $2
			         AND COALESCE(sp.share_budgets, true) = true
			   ))
		`, hhID, userID)
	}
	if err != nil {
		log.Printf("budget summary: fetch bills: %v", err)
		billRows = nil // non-fatal, continue without bills
	}

	type billEntry struct {
		ID          string
		Name        string
		AmountDue   float64
		Frequency   string
		CategoryID  *string
		CatName     string
		HouseholdID string
	}
	var billList []billEntry
	if billRows != nil {
		defer billRows.Close()
		for billRows.Next() {
			var be billEntry
			var catID sql.NullString
			if err := billRows.Scan(&be.ID, &be.Name, &be.AmountDue, &be.Frequency, &catID, &be.CatName, &be.HouseholdID); err != nil {
				log.Printf("budget summary: scan bill: %v", err)
				continue
			}
			if catID.Valid {
				be.CategoryID = &catID.String
			}
			billList = append(billList, be)
		}
	}

	// Look up how much was paid for each bill this month.
	billPaid := map[string]float64{}
	for _, be := range billList {
		var paid float64
		_ = dbClient.QueryRow(`
			SELECT COALESCE(SUM(amount_paid), 0) FROM bill_payments
			WHERE bill_id = $1 AND paid_date >= $2 AND paid_date < $3
		`, be.ID, monthStart, monthEnd).Scan(&paid)
		billPaid[be.ID] = paid
	}

	// 5. Build the response.
	type subcategorySummary struct {
		ID               string  `json:"id"`
		Name             string  `json:"name"`
		Color            string  `json:"color"`
		Icon             string  `json:"icon"`
		Spent            float64 `json:"spent"`
		TransactionCount int     `json:"transaction_count"`
		HasUnverified    bool    `json:"has_unverified"`
		UnverifiedCount  int     `json:"unverified_count"`
	}
	type categorySummary struct {
		ID               string               `json:"id"`
		Name             string               `json:"name"`
		Color            string               `json:"color"`
		Icon             string               `json:"icon"`
		Spent            float64              `json:"spent"`
		TransactionCount int                  `json:"transaction_count"`
		HasUnverified    bool                 `json:"has_unverified"`
		UnverifiedCount  int                  `json:"unverified_count"`
		Subcategories    []subcategorySummary  `json:"subcategories"`
	}
	type budgetSummary struct {
		ID              string            `json:"id"`
		Name            string            `json:"name"`
		Type            string            `json:"type"`
		Amount          float64           `json:"budgeted"`
		Spent           float64           `json:"spent"`
		Remaining       float64           `json:"remaining"`
		Percent         int               `json:"percent"`
		Frequency       string            `json:"frequency"`
		HouseholdID     *string           `json:"household_id,omitempty"`
		IsShared        bool              `json:"is_shared"`
		Categories      []categorySummary `json:"categories"`
		Source          string            `json:"source,omitempty"`
		TotalUnverified int               `json:"total_unverified"`
	}

	// 5a. Collect all category IDs referenced in spending to look up details.
	allCatIDs := map[string]bool{}
	for catID := range spentByCategory {
		if catID != "" {
			allCatIDs[catID] = true
		}
	}
	for catID := range earnedByCategory {
		if catID != "" {
			allCatIDs[catID] = true
		}
	}
	// Also include categories from budget_categories join table.
	for _, cats := range budgetCats {
		for _, c := range cats {
			allCatIDs[c.ID] = true
		}
	}
	// And from budget.CategoryID.
	for _, b := range budgetList {
		if b.CategoryID != nil && *b.CategoryID != "" {
			allCatIDs[*b.CategoryID] = true
		}
	}

	// Look up category details (name, color, icon, parent_id).
	type catDetail struct {
		ID       string
		Name     string
		Color    string
		Icon     string
		ParentID string
	}
	catDetails := map[string]catDetail{}
	if len(allCatIDs) > 0 {
		catIDSlice := make([]string, 0, len(allCatIDs))
		for id := range allCatIDs {
			catIDSlice = append(catIDSlice, id)
		}
		catDetailRows, catErr := dbClient.Query(`
			SELECT id, name, COALESCE(color, '#7c3aed'), COALESCE(icon, ''), COALESCE(parent_id::text, '')
			FROM categories WHERE id = ANY($1)
		`, pq.Array(catIDSlice))
		if catErr != nil {
			log.Printf("budget summary: fetch cat details: %v", catErr)
		} else {
			defer catDetailRows.Close()
			for catDetailRows.Next() {
				var cd catDetail
				if err := catDetailRows.Scan(&cd.ID, &cd.Name, &cd.Color, &cd.Icon, &cd.ParentID); err == nil {
					catDetails[cd.ID] = cd
				}
			}
		}
	}

	// 5b. Query transaction counts per category for this month.
	txCountByCategory := map[string]int{}
	if len(allCatIDs) > 0 {
		catIDSlice := make([]string, 0, len(allCatIDs))
		for id := range allCatIDs {
			catIDSlice = append(catIDSlice, id)
		}
		countRows, countErr := dbClient.Query(`
			SELECT COALESCE(category_id::text, ''), COUNT(*)
			FROM transactions
			WHERE category_id = ANY($1) AND date >= $2 AND date < $3
			GROUP BY category_id
		`, pq.Array(catIDSlice), monthStart, monthEnd)
		if countErr != nil {
			log.Printf("budget summary: fetch tx counts: %v", countErr)
		} else {
			defer countRows.Close()
			for countRows.Next() {
				var cid string
				var cnt int
				if err := countRows.Scan(&cid, &cnt); err == nil {
					txCountByCategory[cid] = cnt
				}
			}
		}
	}

	// 5c. Query unverified transaction counts per category.
	unverifiedByCategory := map[string]int{}
	globalTotalUnverified := 0
	if len(allCatIDs) > 0 {
		catIDSlice := make([]string, 0, len(allCatIDs))
		for id := range allCatIDs {
			catIDSlice = append(catIDSlice, id)
		}
		uvRows, uvErr := dbClient.Query(`
			SELECT category_id::text, COUNT(*)
			FROM transactions
			WHERE user_verified = false AND category_id = ANY($1) AND date >= $2 AND date < $3
			GROUP BY category_id
		`, pq.Array(catIDSlice), monthStart, monthEnd)
		if uvErr != nil {
			log.Printf("budget summary: fetch unverified counts: %v", uvErr)
		} else {
			defer uvRows.Close()
			for uvRows.Next() {
				var cid string
				var cnt int
				if err := uvRows.Scan(&cid, &cnt); err == nil {
					unverifiedByCategory[cid] = cnt
					globalTotalUnverified += cnt
				}
			}
		}
	}

	// Helper to build a subcategory summary.
	buildSubcatSummary := func(catID string, isIncome bool) subcategorySummary {
		cd := catDetails[catID]
		var spent float64
		if isIncome {
			spent = earnedByCategory[catID]
		} else {
			spent = spentByCategory[catID]
		}
		uvCount := unverifiedByCategory[catID]
		return subcategorySummary{
			ID:               catID,
			Name:             cd.Name,
			Color:            cd.Color,
			Icon:             cd.Icon,
			Spent:            spent,
			TransactionCount: txCountByCategory[catID],
			HasUnverified:    uvCount > 0,
			UnverifiedCount:  uvCount,
		}
	}

	// Helper: given a parent category ID, find all child categories that have spending.
	childrenOf := func(parentID string, isIncome bool) []subcategorySummary {
		var subs []subcategorySummary
		spending := spentByCategory
		if isIncome {
			spending = earnedByCategory
		}
		for cid := range spending {
			if cid == "" || cid == parentID {
				continue
			}
			cd, ok := catDetails[cid]
			if !ok {
				continue
			}
			if cd.ParentID == parentID {
				subs = append(subs, buildSubcatSummary(cid, isIncome))
			}
		}
		return subs
	}

	countOccurrences := func(startDate *time.Time, freq string) int {
		if startDate != nil && startDate.After(monthEnd) {
			return 0
		}
		switch freq {
		case "weekly":
			return 4
		case "biweekly":
			return 2
		case "1st-15th":
			return 2
		default:
			return 1
		}
	}

	var summaries []budgetSummary
	var totalIncome, totalBudgeted float64

	for _, b := range budgetList {
		occ := countOccurrences(b.StartDate, b.Frequency)
		effective := b.Amount * float64(occ)

		if b.Type == "income" {
			totalIncome += effective
		} else {
			totalBudgeted += effective
		}

		cats := budgetCats[b.ID]
		if b.CategoryID != nil && *b.CategoryID != "" {
			found := false
			for _, c := range cats {
				if c.ID == *b.CategoryID {
					found = true
					break
				}
			}
			if !found {
				cats = append(cats, catInfo{ID: *b.CategoryID, Name: b.CategoryName})
			}
		}

		isIncome := b.Type == "income"

		var spent float64
		var budgetUnverified int
		var catSummaries []categorySummary
		for _, c := range cats {
			var catSpent float64
			if isIncome {
				catSpent = earnedByCategory[c.ID]
			} else {
				catSpent = spentByCategory[c.ID]
			}
			cd := catDetails[c.ID]
			uvCount := unverifiedByCategory[c.ID]
			budgetUnverified += uvCount

			subs := childrenOf(c.ID, isIncome)
			if subs == nil {
				subs = []subcategorySummary{}
			}

			cs := categorySummary{
				ID:               c.ID,
				Name:             c.Name,
				Color:            cd.Color,
				Icon:             cd.Icon,
				Spent:            catSpent,
				TransactionCount: txCountByCategory[c.ID],
				HasUnverified:    uvCount > 0,
				UnverifiedCount:  uvCount,
				Subcategories:    subs,
			}
			// Use parent-level spent (already rolled up) for budget total.
			spent += cs.Spent
			catSummaries = append(catSummaries, cs)
		}

		remaining := effective - spent
		if remaining < 0 {
			remaining = 0
		}
		pct := 0
		if effective > 0 {
			pct = int(spent / effective * 100)
			if pct > 100 {
				pct = 100
			}
		}

		if catSummaries == nil {
			catSummaries = []categorySummary{}
		}

		summaries = append(summaries, budgetSummary{
			ID:              b.ID,
			Name:            b.Name,
			Type:            b.Type,
			Amount:          effective,
			Spent:           spent,
			Remaining:       remaining,
			Percent:         pct,
			Frequency:       b.Frequency,
			HouseholdID:     b.HouseholdID,
			IsShared:        b.IsShared,
			Categories:      catSummaries,
			TotalUnverified: budgetUnverified,
		})
	}

	// Add bills as budget entries.
	for _, be := range billList {
		occ := countOccurrences(nil, be.Frequency)
		effective := be.AmountDue * float64(occ)
		spent := billPaid[be.ID]

		remaining := effective - spent
		if remaining < 0 {
			remaining = 0
		}
		pct := 0
		if effective > 0 {
			pct = int(spent / effective * 100)
			if pct > 100 {
				pct = 100
			}
		}

		totalBudgeted += effective

		var catSummaries []categorySummary
		if be.CategoryID != nil && *be.CategoryID != "" {
			cd := catDetails[*be.CategoryID]
			uvCount := unverifiedByCategory[*be.CategoryID]
			catSummaries = []categorySummary{{
				ID:               *be.CategoryID,
				Name:             be.CatName,
				Color:            cd.Color,
				Icon:             cd.Icon,
				Spent:            spent,
				TransactionCount: txCountByCategory[*be.CategoryID],
				HasUnverified:    uvCount > 0,
				UnverifiedCount:  uvCount,
				Subcategories:    []subcategorySummary{},
			}}
		} else {
			catSummaries = []categorySummary{}
		}

		var hhPtr *string
		if be.HouseholdID != "" {
			hhPtr = &be.HouseholdID
		}

		summaries = append(summaries, budgetSummary{
			ID:          "bill-" + be.ID,
			Name:        be.Name,
			Type:        "expense",
			Amount:      effective,
			Spent:       spent,
			Remaining:   remaining,
			Percent:     pct,
			Frequency:   be.Frequency,
			HouseholdID: hhPtr,
			Categories:  catSummaries,
			Source:      "bill",
		})
	}

	if summaries == nil {
		summaries = []budgetSummary{}
	}

	totalRemaining := totalIncome - totalBudgeted
	if totalRemaining < 0 {
		totalRemaining = 0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"month":            month,
		"year":             year,
		"total_income":     totalIncome,
		"total_budgeted":   totalBudgeted,
		"total_spent":      totalSpentAll,
		"total_remaining":  totalRemaining,
		"total_unverified": globalTotalUnverified,
		"budgets":          summaries,
	})
}

func DeleteBudget(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
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

	if !ownershipCheck(w, dbClient.Conn, "budgets", id, userID) {
		return
	}

	_, err = dbClient.Exec("DELETE FROM budgets WHERE id = $1", id)
	if err != nil {
		http.Error(w, "Failed to delete budget", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
