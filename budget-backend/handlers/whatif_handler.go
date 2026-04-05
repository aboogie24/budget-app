package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/models"
)

// SimulateWhatIf runs a financial what-if simulation using existing calculators
// and generates a natural language summary via AI.
func SimulateWhatIf(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.WhatIfRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, "Amount must be positive", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Raw(), userID)

	result := models.WhatIfResult{
		Scenario:       req.Scenario,
		CurrentState:   make(map[string]interface{}),
		ProjectedState: make(map[string]interface{}),
	}

	// Get current cash flow
	cashFlow, err := ai.AnalyzeCashFlow(conn.Raw(), userID)
	if err != nil {
		log.Printf("what-if: cash flow error: %v", err)
	}
	result.CurrentState["monthly_income"] = cashFlow.AvgMonthlyIncome
	result.CurrentState["monthly_expenses"] = cashFlow.AvgMonthlyExpenses
	result.CurrentState["monthly_surplus"] = cashFlow.AvgMonthlySurplus

	// Get current debts
	debts := loadDebts(conn, userID, householdID)
	var totalDebt float64
	for _, d := range debts {
		totalDebt += d.Balance
	}
	result.CurrentState["total_debt"] = totalDebt

	// Get current savings
	var totalSavings float64
	savingsQuery := `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1`
	savingsArgs := []interface{}{userID}
	if householdID != "" {
		savingsQuery = `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1 OR household_id = $2`
		savingsArgs = append(savingsArgs, householdID)
	}
	_ = conn.QueryRow(savingsQuery, savingsArgs...).Scan(&totalSavings)
	result.CurrentState["total_savings"] = totalSavings

	switch req.Scenario {
	case "increase_income":
		result = simulateIncreaseIncome(result, req, debts, cashFlow, totalSavings)
	case "cut_category":
		result = simulateCutCategory(result, req, debts, cashFlow, totalSavings)
	case "extra_debt_payment":
		result = simulateExtraDebtPayment(result, req, debts, cashFlow)
	case "increase_savings":
		result = simulateIncreaseSavings(result, req, cashFlow, totalSavings)
	default:
		http.Error(w, "Unknown scenario. Use: increase_income, cut_category, extra_debt_payment, increase_savings", http.StatusBadRequest)
		return
	}

	// Generate AI summary
	client := getAIClient()
	if client.IsAvailable() {
		summary, err := generateWhatIfSummary(client, result, req)
		if err != nil {
			log.Printf("what-if: AI summary error: %v", err)
			result.Impact = formatFallbackSummary(result, req)
		} else {
			result.Impact = summary
		}
	} else {
		result.Impact = formatFallbackSummary(result, req)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func loadDebts(conn *db.DB, userID, householdID string) []models.DebtInfo {
	query := `SELECT id, name, balance, COALESCE(apr, 0), COALESCE(min_payment, 0) FROM debt_accounts WHERE user_id = $1 AND balance > 0`
	args := []interface{}{userID}
	if householdID != "" {
		query = `SELECT id, name, balance, COALESCE(apr, 0), COALESCE(min_payment, 0) FROM debt_accounts WHERE (user_id = $1 OR household_id = $2) AND balance > 0`
		args = append(args, householdID)
	}

	rows, err := conn.Query(query, args...)
	if err != nil {
		log.Printf("what-if: load debts error: %v", err)
		return nil
	}
	defer rows.Close()

	var debts []models.DebtInfo
	for rows.Next() {
		var d models.DebtInfo
		if err := rows.Scan(&d.ID, &d.Name, &d.Balance, &d.APR, &d.MinPayment); err != nil {
			continue
		}
		debts = append(debts, d)
	}
	return debts
}

func simulateIncreaseIncome(result models.WhatIfResult, req models.WhatIfRequest, debts []models.DebtInfo, cashFlow models.CashFlowAnalysis, totalSavings float64) models.WhatIfResult {
	newSurplus := cashFlow.AvgMonthlySurplus + req.Amount
	result.ProjectedState["monthly_income"] = cashFlow.AvgMonthlyIncome + req.Amount
	result.ProjectedState["monthly_surplus"] = newSurplus

	// Project debt payoff with extra going to debt
	if len(debts) > 0 {
		currentSchedule := ai.CalculateDebtPayoff(debts, "avalanche", 0)
		projectedSchedule := ai.CalculateDebtPayoff(debts, "avalanche", req.Amount)
		result.CurrentState["debt_payoff_months"] = maxPayoffMonths(currentSchedule)
		result.ProjectedState["debt_payoff_months"] = maxPayoffMonths(projectedSchedule)
	}

	// Project savings growth over 12 months
	result.ProjectedState["savings_in_12_months"] = math.Round((totalSavings+req.Amount*12)*100) / 100

	return result
}

func simulateCutCategory(result models.WhatIfResult, req models.WhatIfRequest, debts []models.DebtInfo, cashFlow models.CashFlowAnalysis, totalSavings float64) models.WhatIfResult {
	result.ProjectedState["category"] = req.Category
	result.ProjectedState["monthly_savings_from_cut"] = req.Amount
	newSurplus := cashFlow.AvgMonthlySurplus + req.Amount
	result.ProjectedState["monthly_surplus"] = newSurplus
	result.ProjectedState["monthly_expenses"] = cashFlow.AvgMonthlyExpenses - req.Amount

	// Find current category spending
	for _, cat := range cashFlow.CategoryBreakdown {
		if cat.Category == req.Category {
			result.CurrentState["category_spending"] = cat.MonthlyAverage
			result.ProjectedState["category_spending"] = math.Max(0, cat.MonthlyAverage-req.Amount)
			break
		}
	}

	// Project savings growth
	result.ProjectedState["extra_savings_12_months"] = math.Round(req.Amount*12*100) / 100

	return result
}

func simulateExtraDebtPayment(result models.WhatIfResult, req models.WhatIfRequest, debts []models.DebtInfo, cashFlow models.CashFlowAnalysis) models.WhatIfResult {
	if len(debts) == 0 {
		result.ProjectedState["message"] = "No debts found"
		return result
	}

	currentSchedule := ai.CalculateDebtPayoff(debts, "avalanche", 0)
	projectedSchedule := ai.CalculateDebtPayoff(debts, "avalanche", req.Amount)

	currentMonths := maxPayoffMonths(currentSchedule)
	projectedMonths := maxPayoffMonths(projectedSchedule)

	var currentInterest, projectedInterest float64
	for _, s := range currentSchedule {
		currentInterest += s.TotalInterest
	}
	for _, s := range projectedSchedule {
		projectedInterest += s.TotalInterest
	}

	result.CurrentState["debt_payoff_months"] = currentMonths
	result.CurrentState["total_interest"] = math.Round(currentInterest*100) / 100
	result.ProjectedState["debt_payoff_months"] = projectedMonths
	result.ProjectedState["total_interest"] = math.Round(projectedInterest*100) / 100
	result.ProjectedState["interest_saved"] = math.Round((currentInterest-projectedInterest)*100) / 100
	result.ProjectedState["months_saved"] = currentMonths - projectedMonths
	result.ProjectedState["extra_monthly_payment"] = req.Amount

	return result
}

func simulateIncreaseSavings(result models.WhatIfResult, req models.WhatIfRequest, cashFlow models.CashFlowAnalysis, totalSavings float64) models.WhatIfResult {
	result.ProjectedState["monthly_contribution"] = req.Amount
	result.ProjectedState["monthly_surplus"] = cashFlow.AvgMonthlySurplus - req.Amount

	// Project with 4.5% APY (typical HYSA rate)
	projection := ai.ProjectSavings(req.Amount, totalSavings, 0, 0.045)
	if len(projection.Months) >= 12 {
		result.ProjectedState["balance_in_12_months"] = projection.Months[11].Balance
	}
	if len(projection.Months) >= 60 {
		result.ProjectedState["balance_in_5_years"] = projection.Months[59].Balance
	}
	result.CurrentState["current_savings"] = totalSavings
	result.ProjectedState["annual_contribution"] = math.Round(req.Amount*12*100) / 100

	return result
}

func maxPayoffMonths(schedules []models.DebtPayoffSchedule) int {
	max := 0
	for _, s := range schedules {
		if len(s.Months) > max {
			max = len(s.Months)
		}
	}
	return max
}

func generateWhatIfSummary(client *ai.Client, result models.WhatIfResult, req models.WhatIfRequest) (string, error) {
	dataJSON, _ := json.Marshal(map[string]interface{}{
		"scenario":        req.Scenario,
		"amount":          req.Amount,
		"category":        req.Category,
		"current_state":   result.CurrentState,
		"projected_state": result.ProjectedState,
	})

	resp, err := client.SendMessage(models.ClaudeRequest{
		System: `You are a friendly financial advisor. Given a what-if scenario and its calculated results,
write a brief, encouraging 2-3 sentence summary of the impact. Be specific with numbers.
Do not use markdown formatting. Address the user directly with "you".`,
		MaxTokens: 300,
		Messages: []models.ClaudeMessage{
			{Role: "user", Content: fmt.Sprintf("Summarize this what-if scenario result:\n%s", string(dataJSON))},
		},
	})
	if err != nil {
		return "", err
	}

	for _, block := range resp.Content {
		if block.Type == "text" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("no text in AI response")
}

func formatFallbackSummary(result models.WhatIfResult, req models.WhatIfRequest) string {
	switch req.Scenario {
	case "extra_debt_payment":
		if ms, ok := result.ProjectedState["months_saved"]; ok {
			saved, _ := result.ProjectedState["interest_saved"]
			return fmt.Sprintf("Adding $%.0f/month to debt payments could save you %v months and $%.0f in interest.", req.Amount, ms, saved)
		}
	case "increase_income":
		return fmt.Sprintf("An extra $%.0f/month in income would increase your monthly surplus significantly.", req.Amount)
	case "cut_category":
		return fmt.Sprintf("Cutting $%.0f/month from %s would save you $%.0f over a year.", req.Amount, req.Category, req.Amount*12)
	case "increase_savings":
		return fmt.Sprintf("Saving an extra $%.0f/month could grow your savings substantially over time.", req.Amount)
	}
	return "Simulation complete. See the projected state for details."
}
