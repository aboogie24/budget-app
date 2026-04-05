package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/models"
)

// GetMonthlyReview generates an AI-powered monthly financial review for the authenticated user.
func GetMonthlyReview(w http.ResponseWriter, r *http.Request) {
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

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)
	raw := conn.Raw()

	now := time.Now().UTC()
	lastMonthStart := time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, time.UTC)
	lastMonthEnd := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthLabel := lastMonthStart.Format("January 2006")

	data := make(map[string]interface{})
	data["month"] = monthLabel

	// Total income
	var totalIncome float64
	_ = raw.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = $1 AND type = 'income'
		  AND date >= $2 AND date < $3
	`, userID, lastMonthStart.Format("2006-01-02"), lastMonthEnd.Format("2006-01-02")).Scan(&totalIncome)
	data["total_income"] = totalIncome

	// Total expenses
	var totalExpenses float64
	_ = raw.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND date >= $2 AND date < $3
	`, userID, lastMonthStart.Format("2006-01-02"), lastMonthEnd.Format("2006-01-02")).Scan(&totalExpenses)
	data["total_expenses"] = totalExpenses
	data["net_cash_flow"] = totalIncome - totalExpenses

	// Top 5 category spending
	catRows, err := raw.Query(`
		SELECT COALESCE(c.name, t.category_name, 'Uncategorized') as category,
		       SUM(t.amount) as total
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1 AND t.type = 'expense'
		  AND t.date >= $2 AND t.date < $3
		GROUP BY category
		ORDER BY total DESC
		LIMIT 5
	`, userID, lastMonthStart.Format("2006-01-02"), lastMonthEnd.Format("2006-01-02"))
	if err == nil {
		defer catRows.Close()
		var categories []map[string]interface{}
		for catRows.Next() {
			var cat string
			var total float64
			if err := catRows.Scan(&cat, &total); err != nil {
				continue
			}
			categories = append(categories, map[string]interface{}{
				"category": cat,
				"amount":   total,
			})
		}
		data["top_categories"] = categories
	}

	// Debt paydown progress
	debtQuery := `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1`
	debtArgs := []interface{}{userID}
	if householdID != "" {
		debtQuery = `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1 OR household_id = $2`
		debtArgs = append(debtArgs, householdID)
	}
	var totalDebt float64
	_ = raw.QueryRow(debtQuery, debtArgs...).Scan(&totalDebt)
	data["total_debt"] = totalDebt

	// Debt payments last month
	var debtPayments float64
	_ = raw.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND (LOWER(category_name) LIKE '%debt%' OR LOWER(category_name) LIKE '%payment%')
		  AND date >= $2 AND date < $3
	`, userID, lastMonthStart.Format("2006-01-02"), lastMonthEnd.Format("2006-01-02")).Scan(&debtPayments)
	data["debt_payments"] = debtPayments

	// Savings growth
	savingsQuery := `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1`
	savingsArgs := []interface{}{userID}
	if householdID != "" {
		savingsQuery = `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1 OR household_id = $2`
		savingsArgs = append(savingsArgs, householdID)
	}
	var totalSavings float64
	_ = raw.QueryRow(savingsQuery, savingsArgs...).Scan(&totalSavings)
	data["total_savings"] = totalSavings

	// Milestones reached last month
	milestoneQuery := `
		SELECT pm.title FROM plan_milestones pm
		JOIN financial_plans fp ON fp.id = pm.plan_id
		WHERE fp.created_by = $1
		  AND pm.status = 'reached'
		  AND pm.completed_at >= $2 AND pm.completed_at < $3
	`
	milestoneArgs := []interface{}{userID, lastMonthStart.Format("2006-01-02"), lastMonthEnd.Format("2006-01-02")}
	if householdID != "" {
		milestoneQuery = `
			SELECT pm.title FROM plan_milestones pm
			JOIN financial_plans fp ON fp.id = pm.plan_id
			WHERE (fp.created_by = $1 OR fp.household_id = $4)
			  AND pm.status = 'reached'
			  AND pm.completed_at >= $2 AND pm.completed_at < $3
		`
		milestoneArgs = append(milestoneArgs, householdID)
	}
	msRows, err := raw.Query(milestoneQuery, milestoneArgs...)
	if err == nil {
		defer msRows.Close()
		var milestones []string
		for msRows.Next() {
			var title string
			if err := msRows.Scan(&title); err != nil {
				continue
			}
			milestones = append(milestones, title)
		}
		data["milestones_reached"] = milestones
	}

	// Framework level
	assessment := ai.AssessFrameworkLevel(raw, userID, householdID)
	data["framework_level"] = assessment.Level
	data["framework_level_name"] = assessment.LevelName
	data["framework_completed_pct"] = assessment.CompletedPct

	// Get user's name for personalization
	var userName string
	_ = raw.QueryRow(`SELECT COALESCE(full_name, email) FROM users WHERE id = $1`, userID).Scan(&userName)
	data["user_name"] = userName

	// Generate AI review
	client := getAIClient()
	if !client.IsAvailable() {
		http.Error(w, "AI service unavailable", http.StatusServiceUnavailable)
		return
	}

	dataJSON, _ := json.Marshal(data)

	resp, err := client.SendMessage(models.ClaudeRequest{
		System: `You are a supportive, knowledgeable financial coach for the CoupleFlow budgeting app.
Write a friendly monthly financial review based on the provided data.

Guidelines:
- Address the user by name if available
- Start with a brief overall assessment (positive tone)
- Highlight wins (income > expenses, debt paydown, milestones reached)
- Note areas for improvement without being judgmental
- Give 1-2 specific, actionable suggestions for next month
- Keep it concise — about 200-300 words
- Use plain text, no markdown headers or bullet formatting
- Be warm and encouraging`,
		MaxTokens: 800,
		Messages: []models.ClaudeMessage{
			{Role: "user", Content: fmt.Sprintf("Generate a monthly financial review for %s based on this data:\n%s", monthLabel, string(dataJSON))},
		},
	})
	if err != nil {
		log.Printf("monthly review: AI error: %v", err)
		http.Error(w, "AI generation failed", http.StatusInternalServerError)
		return
	}

	var reviewText string
	for _, block := range resp.Content {
		if block.Type == "text" {
			reviewText = block.Text
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"review_text": reviewText,
		"month":       monthLabel,
		"data":        data,
	})
}
