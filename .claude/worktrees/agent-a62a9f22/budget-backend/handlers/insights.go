package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/aboogie/budget-backend/db"
)

// GetSpendingInsights returns aggregated spending data for a user:
//   - Spending broken down by category for the requested month
//   - Month-over-month totals (current vs previous)
//   - Daily spending for the requested month
func GetSpendingInsights(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")
	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)
	now := time.Now().UTC()
	if month == 0 {
		month = int(now.Month())
	}
	if year == 0 {
		year = now.Year()
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

	curStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	curEnd := curStart.AddDate(0, 1, 0)
	prevStart := curStart.AddDate(0, -1, 0)

	// Build a WHERE clause that scopes to household or user.
	scopeWhere := "t.user_id = $3"
	args := []any{prevStart, curEnd, userID}
	if hhID != "" {
		scopeWhere = "(t.household_id = $3 OR (t.household_id IS NULL AND t.user_id = $4))"
		args = []any{prevStart, curEnd, hhID, userID}
	}

	// Fetch transactions for current + previous month in one query.
	query := `
		SELECT
			t.type,
			t.amount,
			t.date,
			COALESCE(c.name, t.category_name, '') AS cat_name,
			COALESCE(c.color, '') AS cat_color
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.date >= $1 AND t.date < $2
		  AND ` + scopeWhere

	rows, err := dbClient.Query(query, args...)
	if err != nil {
		log.Printf("insights query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type categoryBreakdown struct {
		Name    string  `json:"name"`
		Color   string  `json:"color"`
		Amount  float64 `json:"amount"`
		Percent float64 `json:"percent"`
	}

	type dailySpend struct {
		Date   string  `json:"date"`
		Amount float64 `json:"amount"`
	}

	catTotals := map[string]*categoryBreakdown{}
	dailyTotals := map[string]float64{}
	var curIncome, curExpenses, prevIncome, prevExpenses float64

	for rows.Next() {
		var txType string
		var amount float64
		var date time.Time
		var catName, catColor string
		if err := rows.Scan(&txType, &amount, &date, &catName, &catColor); err != nil {
			log.Printf("insights scan error: %v", err)
			continue
		}

		isCurrent := !date.Before(curStart) && date.Before(curEnd)
		isPrevious := !date.Before(prevStart) && date.Before(curStart)

		if txType == "expense" {
			if isCurrent {
				curExpenses += amount

				// Category breakdown (current month only)
				key := catName
				if key == "" {
					key = "Uncategorized"
				}
				if catTotals[key] == nil {
					catTotals[key] = &categoryBreakdown{Name: key, Color: catColor}
				}
				catTotals[key].Amount += amount

				// Daily totals
				dayKey := date.Format("2006-01-02")
				dailyTotals[dayKey] += amount
			} else if isPrevious {
				prevExpenses += amount
			}
		} else if txType == "income" {
			if isCurrent {
				curIncome += amount
			} else if isPrevious {
				prevIncome += amount
			}
		}
	}

	// Build category list and compute percentages.
	var categories []categoryBreakdown
	for _, c := range catTotals {
		if curExpenses > 0 {
			c.Percent = (c.Amount / curExpenses) * 100
		}
		categories = append(categories, *c)
	}
	// Sort by amount descending.
	for i := 0; i < len(categories); i++ {
		for j := i + 1; j < len(categories); j++ {
			if categories[j].Amount > categories[i].Amount {
				categories[i], categories[j] = categories[j], categories[i]
			}
		}
	}

	// Build daily spend array for the current month.
	var daily []dailySpend
	daysInMonth := curEnd.AddDate(0, 0, -1).Day()
	for d := 1; d <= daysInMonth; d++ {
		dayKey := time.Date(year, time.Month(month), d, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
		daily = append(daily, dailySpend{Date: dayKey, Amount: dailyTotals[dayKey]})
	}

	// Month-over-month change.
	expenseChange := 0.0
	if prevExpenses > 0 {
		expenseChange = ((curExpenses - prevExpenses) / prevExpenses) * 100
	}
	incomeChange := 0.0
	if prevIncome > 0 {
		incomeChange = ((curIncome - prevIncome) / prevIncome) * 100
	}

	if categories == nil {
		categories = []categoryBreakdown{}
	}
	if daily == nil {
		daily = []dailySpend{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"month":          month,
		"year":           year,
		"income":         curIncome,
		"expenses":       curExpenses,
		"net":            curIncome - curExpenses,
		"prev_income":    prevIncome,
		"prev_expenses":  prevExpenses,
		"income_change":  incomeChange,
		"expense_change": expenseChange,
		"categories":     categories,
		"daily_spending": daily,
	})
}

// GetTopMerchants returns the top spending categories (used as a quick "top merchants" view).
func GetTopMerchants(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit == 0 {
		limit = 5
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

	scopeWhere := "t.user_id = $1"
	args := []any{userID}
	if hhID != "" {
		scopeWhere = "(t.household_id = $1 OR (t.household_id IS NULL AND t.user_id = $2))"
		args = []any{hhID, userID}
	}

	query := `
		SELECT COALESCE(c.name, t.category_name, 'Uncategorized') AS cat, SUM(t.amount) AS total, COUNT(*) AS cnt
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.type = 'expense' AND ` + scopeWhere + `
		GROUP BY cat
		ORDER BY total DESC
		LIMIT ` + strconv.Itoa(limit)

	rows, err := dbClient.Query(query, args...)
	if err != nil {
		log.Printf("top merchants query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type topCategory struct {
		Name         string  `json:"name"`
		TotalSpent   float64 `json:"total_spent"`
		Transactions int     `json:"transactions"`
	}
	var results []topCategory
	for rows.Next() {
		var tc topCategory
		if err := rows.Scan(&tc.Name, &tc.TotalSpent, &tc.Transactions); err == nil {
			results = append(results, tc)
		}
	}
	if results == nil {
		results = []topCategory{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
