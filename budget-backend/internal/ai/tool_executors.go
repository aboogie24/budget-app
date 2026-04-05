package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/aboogie/budget-backend/models"
)

// calculateDebtPayoffTool fetches the user's debts and runs the payoff calculator.
// Supports debt_category filter: "attack" (default), "structured", or "all".
func calculateDebtPayoffTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		Strategy     string  `json:"strategy"`
		ExtraPayment float64 `json:"extra_payment"`
		DebtCategory string  `json:"debt_category"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("parse input: %w", err)
	}
	if params.Strategy == "" {
		params.Strategy = "avalanche"
	}
	if params.DebtCategory == "" {
		params.DebtCategory = "attack"
	}

	// Build query with category filter
	query := `SELECT id, name, balance, COALESCE(apr, 0), COALESCE(min_payment, 0), COALESCE(debt_category, 'attack')
		FROM debt_accounts WHERE user_id = $1`
	args := []interface{}{userID}
	if params.DebtCategory != "all" {
		query += ` AND debt_category = $2`
		args = append(args, params.DebtCategory)
	}
	query += ` ORDER BY apr DESC`

	rows, err := conn.Query(query, args...)
	if err != nil {
		return "", fmt.Errorf("query debts: %w", err)
	}
	defer rows.Close()

	var attackDebts, structuredDebts []models.DebtInfo
	for rows.Next() {
		var d models.DebtInfo
		var category string
		if err := rows.Scan(&d.ID, &d.Name, &d.Balance, &d.APR, &d.MinPayment, &category); err != nil {
			continue
		}
		if category == "structured" {
			structuredDebts = append(structuredDebts, d)
		} else {
			attackDebts = append(attackDebts, d)
		}
	}

	response := map[string]interface{}{
		"strategy":      params.Strategy,
		"extra_payment": params.ExtraPayment,
		"debt_category": params.DebtCategory,
	}

	// Attack debts get the aggressive payoff simulation
	if len(attackDebts) > 0 {
		schedules := CalculateDebtPayoff(attackDebts, params.Strategy, params.ExtraPayment)
		var totalInterest float64
		latestPayoff := ""
		for _, s := range schedules {
			totalInterest += s.TotalInterest
			if s.PayoffDate > latestPayoff {
				latestPayoff = s.PayoffDate
			}
		}
		response["attack_schedules"] = schedules
		response["attack_total_interest"] = totalInterest
		response["attack_debt_free_date"] = latestPayoff
		response["attack_debt_count"] = len(attackDebts)
	}

	// Structured debts get standard amortization (no extra payments)
	if len(structuredDebts) > 0 {
		amortization := CalculateStructuredDebtAmortization(structuredDebts)
		response["structured_schedules"] = amortization
		response["structured_debt_count"] = len(structuredDebts)
	}

	if len(attackDebts) == 0 && len(structuredDebts) == 0 {
		return `{"message":"No debt accounts found.","schedules":[]}`, nil
	}

	result, _ := json.Marshal(response)
	return string(result), nil
}

// projectSavingsTool fetches savings goal(s) and runs the projection calculator.
func projectSavingsTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		GoalID        string  `json:"goal_id"`
		MonthlyAmount float64 `json:"monthly_amount"`
		AnnualRate    float64 `json:"annual_rate"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("parse input: %w", err)
	}
	if params.AnnualRate == 0 {
		params.AnnualRate = 0.05
	}

	var query string
	var args []interface{}
	if params.GoalID != "" {
		query = `SELECT id, name, COALESCE(current_amount, 0), COALESCE(target_amount, 0), COALESCE(target_date, '')
		         FROM savings_goals WHERE id = $1 AND user_id = $2`
		args = []interface{}{params.GoalID, userID}
	} else {
		query = `SELECT id, name, COALESCE(current_amount, 0), COALESCE(target_amount, 0), COALESCE(target_date, '')
		         FROM savings_goals WHERE user_id = $1 ORDER BY created_at DESC`
		args = []interface{}{userID}
	}

	rows, err := conn.Query(query, args...)
	if err != nil {
		return "", fmt.Errorf("query goals: %w", err)
	}
	defer rows.Close()

	var projections []models.SavingsProjection
	for rows.Next() {
		var id, name, targetDate string
		var current, target float64
		if err := rows.Scan(&id, &name, &current, &target, &targetDate); err != nil {
			continue
		}
		proj := ProjectSavings(params.MonthlyAmount, current, target, params.AnnualRate)
		proj.GoalID = id
		proj.GoalName = name
		if proj.TargetDate == "" && targetDate != "" {
			proj.TargetDate = targetDate
		}
		projections = append(projections, proj)
	}

	if len(projections) == 0 {
		return `{"message":"No savings goals found.","projections":[]}`, nil
	}

	result, _ := json.Marshal(map[string]interface{}{
		"monthly_amount": params.MonthlyAmount,
		"annual_rate":    params.AnnualRate,
		"projections":    projections,
	})
	return string(result), nil
}

// createFinancialPlanTool creates a financial_plan row plus plan_allocations, milestones, and AI analysis.
func createFinancialPlanTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		Name                string   `json:"name"`
		PlanType            string   `json:"plan_type"`
		MonthlyContribution float64  `json:"monthly_contribution"`
		GoalIDs             []string `json:"goal_ids"`
		Milestones          []struct {
			Title        string  `json:"title"`
			TargetAmount float64 `json:"target_amount"`
			TargetDate   string  `json:"target_date"`
		} `json:"milestones"`
		AIAnalysis       string `json:"ai_analysis"`
		ProjectedEndDate string `json:"projected_end_date"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("parse input: %w", err)
	}
	if params.Name == "" {
		params.Name = "Financial Plan"
	}
	if params.PlanType == "" {
		params.PlanType = "combined"
	}

	var hhArg interface{}
	if householdID != "" {
		hhArg = householdID
	}

	// Build ai_analysis JSONB
	var aiAnalysisArg interface{}
	if params.AIAnalysis != "" {
		aiJSON, _ := json.Marshal(map[string]string{"summary": params.AIAnalysis})
		aiAnalysisArg = string(aiJSON)
	}

	// Build projected_end_date
	var endDateArg interface{}
	if params.ProjectedEndDate != "" {
		endDateArg = params.ProjectedEndDate
	}

	// Insert the plan
	var planID string
	err := conn.QueryRow(`
		INSERT INTO financial_plans (household_id, created_by, name, plan_type, monthly_contribution, start_date, projected_end_date, ai_analysis)
		VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6::date, COALESCE($7::jsonb, '{}'))
		RETURNING id
	`, hhArg, userID, params.Name, params.PlanType, params.MonthlyContribution, endDateArg, aiAnalysisArg).Scan(&planID)
	if err != nil {
		log.Printf("createFinancialPlanTool: insert error: %v", err)
		return "", fmt.Errorf("create plan: %w", err)
	}

	// Create milestones
	milestonesCreated := 0
	for _, ms := range params.Milestones {
		if ms.Title == "" {
			continue
		}
		var targetDateArg interface{}
		if ms.TargetDate != "" {
			targetDateArg = ms.TargetDate
		}
		_, err := conn.Exec(`
			INSERT INTO plan_milestones (plan_id, title, target_amount, target_date)
			VALUES ($1, $2, $3, $4::date)
		`, planID, ms.Title, ms.TargetAmount, targetDateArg)
		if err != nil {
			log.Printf("createFinancialPlanTool: milestone insert error: %v", err)
			continue
		}
		milestonesCreated++
	}

	// Create allocations for each goal ID
	allocations := []map[string]interface{}{}
	perGoalAmount := 0.0
	if len(params.GoalIDs) > 0 {
		perGoalAmount = params.MonthlyContribution / float64(len(params.GoalIDs))
	}

	for i, goalID := range params.GoalIDs {
		targetType := resolveTargetType(conn, userID, goalID)
		if targetType == "" {
			log.Printf("createFinancialPlanTool: goal %s not found for user %s, skipping", goalID, userID)
			continue
		}

		var allocID string
		err := conn.QueryRow(`
			INSERT INTO plan_allocations (plan_id, target_id, target_type, monthly_amount, priority_order)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, planID, goalID, targetType, perGoalAmount, i+1).Scan(&allocID)
		if err != nil {
			log.Printf("createFinancialPlanTool: allocation insert error: %v", err)
			continue
		}

		allocations = append(allocations, map[string]interface{}{
			"id":             allocID,
			"target_id":      goalID,
			"target_type":    targetType,
			"monthly_amount": perGoalAmount,
			"priority_order": i + 1,
		})
	}

	result, _ := json.Marshal(map[string]interface{}{
		"id":                   planID,
		"name":                 params.Name,
		"plan_type":            params.PlanType,
		"status":               "draft",
		"monthly_contribution": params.MonthlyContribution,
		"allocations":          allocations,
		"milestones_created":   milestonesCreated,
		"has_ai_analysis":      params.AIAnalysis != "",
		"projected_end_date":   params.ProjectedEndDate,
		"message":              fmt.Sprintf("Created plan '%s' with %d allocations and %d milestones.", params.Name, len(allocations), milestonesCreated),
	})
	return string(result), nil
}

// resolveTargetType checks whether a goal ID is a debt_account or savings_goal.
func resolveTargetType(conn *sql.DB, userID, goalID string) string {
	var exists bool
	err := conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM debt_accounts WHERE id = $1 AND user_id = $2)`, goalID, userID).Scan(&exists)
	if err == nil && exists {
		return "debt"
	}
	err = conn.QueryRow(`SELECT EXISTS(SELECT 1 FROM savings_goals WHERE id = $1 AND user_id = $2)`, goalID, userID).Scan(&exists)
	if err == nil && exists {
		return "savings_goal"
	}
	return ""
}
