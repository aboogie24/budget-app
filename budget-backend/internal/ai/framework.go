package ai

import (
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/aboogie/budget-backend/models"
)

// levelNames maps level number to the CoupleFlow level name.
var levelNames = map[int]string{
	1: "Foundation",
	2: "Attack Debt",
	3: "Build Security",
	4: "Grow Wealth",
	5: "Dream Big",
}

// AssessFrameworkLevel evaluates the user's current CoupleFlow level using
// deterministic queries against real financial data. No AI is involved.
func AssessFrameworkLevel(conn *sql.DB, userID, householdID string) models.FrameworkAssessment {
	l1 := assessLevel1(conn, userID, householdID)
	l2 := assessLevel2(conn, userID, householdID)
	l3 := assessLevel3(conn, userID, householdID)
	l4 := assessLevel4(conn, userID, householdID)
	l5 := assessLevel5(conn, userID, householdID)

	levels := [][]models.CriterionStatus{l1, l2, l3, l4, l5}

	// Determine the highest fully completed level.
	highestComplete := 0
	for i, criteria := range levels {
		allMet := true
		for _, c := range criteria {
			if !c.Met {
				allMet = false
				break
			}
		}
		if allMet {
			highestComplete = i + 1
		} else {
			break
		}
	}

	// Special case: if user has no attack debts, level 2 can be skipped.
	// Users with only structured debts (e.g., mortgage) can advance past Level 2.
	if highestComplete == 1 && !hasAttackDebts(conn, userID, householdID) {
		// Re-evaluate: skip level 2, check level 3+
		allL3 := allCriteriaMet(l3)
		if allL3 {
			highestComplete = 3
			allL4 := allCriteriaMet(l4)
			if allL4 {
				highestComplete = 4
				if allCriteriaMet(l5) {
					highestComplete = 5
				}
			}
		} else {
			highestComplete = 2 // no debts means level 2 is effectively complete
		}
	}

	// Current working level is the next one after highest complete (capped at 5).
	currentLevel := highestComplete + 1
	if currentLevel > 5 {
		currentLevel = 5
	}

	// Build criteria list for the current working level.
	currentCriteria := levels[currentLevel-1]

	// Build next steps from unmet criteria in current level.
	var nextSteps []string
	for _, c := range currentCriteria {
		if !c.Met {
			nextSteps = append(nextSteps, c.Name)
		}
	}
	if len(nextSteps) == 0 {
		nextSteps = []string{"All criteria met! Ready for the next level."}
	}

	// Calculate completion percentage for current level.
	met := 0
	for _, c := range currentCriteria {
		if c.Met {
			met++
		}
	}
	pct := 0.0
	if len(currentCriteria) > 0 {
		pct = float64(met) / float64(len(currentCriteria)) * 100
	}

	return models.FrameworkAssessment{
		Level:        currentLevel,
		LevelName:    levelNames[currentLevel],
		Criteria:     currentCriteria,
		CompletedPct: pct,
		NextSteps:    nextSteps,
	}
}

func allCriteriaMet(criteria []models.CriterionStatus) bool {
	for _, c := range criteria {
		if !c.Met {
			return false
		}
	}
	return true
}

func hasAttackDebts(conn *sql.DB, userID, householdID string) bool {
	var count int
	query := `SELECT COUNT(*) FROM debt_accounts WHERE user_id = $1 AND COALESCE(debt_category, 'attack') = 'attack'`
	args := []interface{}{userID}
	if householdID != "" {
		query = `SELECT COUNT(*) FROM debt_accounts WHERE (user_id = $1 OR household_id = $2) AND COALESCE(debt_category, 'attack') = 'attack'`
		args = append(args, householdID)
	}
	err := conn.QueryRow(query, args...).Scan(&count)
	if err != nil {
		log.Printf("hasAttackDebts error: %v", err)
		return false
	}
	return count > 0
}

// ─── Level 1: Foundation ─────────────────────────────────────

func assessLevel1(conn *sql.DB, userID, householdID string) []models.CriterionStatus {
	var criteria []models.CriterionStatus

	// 1. Has transactions in last 30 days (tracking expenses)
	var txCount int
	err := conn.QueryRow(`
		SELECT COUNT(*) FROM transactions
		WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
	`, userID).Scan(&txCount)
	if err != nil {
		log.Printf("framework L1 tx query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Track income & expenses",
		Met:    txCount > 0,
		Detail: fmt.Sprintf("%d transactions in last 30 days", txCount),
	})

	// 2. Has at least 1 budget
	var budgetCount int
	err = conn.QueryRow(`SELECT COUNT(*) FROM budgets WHERE user_id = $1`, userID).Scan(&budgetCount)
	if err != nil {
		log.Printf("framework L1 budget query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Create a joint budget",
		Met:    budgetCount > 0,
		Detail: fmt.Sprintf("%d budget(s) created", budgetCount),
	})

	// 3. Has emergency savings >= $1,000
	var emergencyAmount float64
	q := `SELECT COALESCE(MAX(current_amount), 0) FROM savings_goals
	      WHERE user_id = $1 AND LOWER(name) LIKE '%emergency%'`
	args := []interface{}{userID}
	if householdID != "" {
		q = `SELECT COALESCE(MAX(current_amount), 0) FROM savings_goals
		     WHERE (user_id = $1 OR household_id = $2) AND LOWER(name) LIKE '%emergency%'`
		args = append(args, householdID)
	}
	err = conn.QueryRow(q, args...).Scan(&emergencyAmount)
	if err != nil {
		log.Printf("framework L1 emergency query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Build $1K starter emergency fund",
		Met:    emergencyAmount >= 1000,
		Detail: fmt.Sprintf("$%.0f in emergency savings", emergencyAmount),
	})

	// 4. All debts have min_payment tracked
	var debtsWithoutMin int
	dq := `SELECT COUNT(*) FROM debt_accounts WHERE user_id = $1 AND (min_payment IS NULL OR min_payment <= 0)`
	dArgs := []interface{}{userID}
	if householdID != "" {
		dq = `SELECT COUNT(*) FROM debt_accounts WHERE (user_id = $1 OR household_id = $2) AND (min_payment IS NULL OR min_payment <= 0)`
		dArgs = append(dArgs, householdID)
	}
	err = conn.QueryRow(dq, dArgs...).Scan(&debtsWithoutMin)
	if err != nil {
		log.Printf("framework L1 debt min query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Pay all minimums on time",
		Met:    debtsWithoutMin == 0,
		Detail: fmt.Sprintf("%d debts missing minimum payment info", debtsWithoutMin),
	})

	return criteria
}

// ─── Level 2: Attack Debt ────────────────────────────────────

func assessLevel2(conn *sql.DB, userID, householdID string) []models.CriterionStatus {
	var criteria []models.CriterionStatus

	// 1. Has attack debt accounts with APR set
	var debtsWithAPR int
	q := `SELECT COUNT(*) FROM debt_accounts WHERE user_id = $1 AND apr > 0 AND COALESCE(debt_category, 'attack') = 'attack'`
	args := []interface{}{userID}
	if householdID != "" {
		q = `SELECT COUNT(*) FROM debt_accounts WHERE (user_id = $1 OR household_id = $2) AND apr > 0 AND COALESCE(debt_category, 'attack') = 'attack'`
		args = append(args, householdID)
	}
	err := conn.QueryRow(q, args...).Scan(&debtsWithAPR)
	if err != nil {
		log.Printf("framework L2 apr query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "List all debts with rates",
		Met:    debtsWithAPR > 0,
		Detail: fmt.Sprintf("%d debts with APR tracked", debtsWithAPR),
	})

	// 2. Has a debt_payoff plan active or completed
	var debtPlanCount int
	pq := `SELECT COUNT(*) FROM financial_plans
	       WHERE created_by = $1 AND plan_type = 'debt_payoff' AND status IN ('active', 'completed')`
	pArgs := []interface{}{userID}
	if householdID != "" {
		pq = `SELECT COUNT(*) FROM financial_plans
		      WHERE (created_by = $1 OR household_id = $2) AND plan_type = 'debt_payoff' AND status IN ('active', 'completed')`
		pArgs = append(pArgs, householdID)
	}
	err = conn.QueryRow(pq, pArgs...).Scan(&debtPlanCount)
	if err != nil {
		log.Printf("framework L2 plan query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Choose payoff strategy (avalanche/snowball)",
		Met:    debtPlanCount > 0,
		Detail: fmt.Sprintf("%d debt payoff plan(s)", debtPlanCount),
	})

	// 3. Total debt decreased — compare current total vs 3 months ago snapshot or just check if any balance = 0
	var totalDebt float64
	tq := `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1`
	tArgs := []interface{}{userID}
	if householdID != "" {
		tq = `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1 OR household_id = $2`
		tArgs = append(tArgs, householdID)
	}
	_ = conn.QueryRow(tq, tArgs...).Scan(&totalDebt)

	// Check for payments toward debt in last 3 months as a proxy for "debt decreased"
	var debtPayments float64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = $1 AND LOWER(category_name) LIKE '%debt%'
		AND date >= CURRENT_DATE - INTERVAL '3 months'
	`, userID).Scan(&debtPayments)
	if err != nil {
		log.Printf("framework L2 debt payment query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Allocate extra payments to debt",
		Met:    debtPayments > 0,
		Detail: fmt.Sprintf("$%.0f in debt payments last 3 months", debtPayments),
	})

	// 4. At least 1 attack debt paid off (balance = 0)
	var paidOff int
	poq := `SELECT COUNT(*) FROM debt_accounts WHERE user_id = $1 AND balance = 0 AND COALESCE(debt_category, 'attack') = 'attack'`
	poArgs := []interface{}{userID}
	if householdID != "" {
		poq = `SELECT COUNT(*) FROM debt_accounts WHERE (user_id = $1 OR household_id = $2) AND balance = 0 AND COALESCE(debt_category, 'attack') = 'attack'`
		poArgs = append(poArgs, householdID)
	}
	err = conn.QueryRow(poq, poArgs...).Scan(&paidOff)
	if err != nil {
		log.Printf("framework L2 paid off query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Celebrate payoffs",
		Met:    paidOff > 0,
		Detail: fmt.Sprintf("%d debt(s) fully paid off", paidOff),
	})

	return criteria
}

// ─── Level 3: Build Security ─────────────────────────────────

func assessLevel3(conn *sql.DB, userID, householdID string) []models.CriterionStatus {
	var criteria []models.CriterionStatus

	// 1. Emergency fund >= 3 months of average expenses
	var emergencyAmount float64
	eq := `SELECT COALESCE(MAX(current_amount), 0) FROM savings_goals
	       WHERE user_id = $1 AND LOWER(name) LIKE '%emergency%'`
	eArgs := []interface{}{userID}
	if householdID != "" {
		eq = `SELECT COALESCE(MAX(current_amount), 0) FROM savings_goals
		      WHERE (user_id = $1 OR household_id = $2) AND LOWER(name) LIKE '%emergency%'`
		eArgs = append(eArgs, householdID)
	}
	_ = conn.QueryRow(eq, eArgs...).Scan(&emergencyAmount)

	var avgMonthlyExpenses float64
	_ = conn.QueryRow(`
		SELECT COALESCE(SUM(amount) / GREATEST(COUNT(DISTINCT DATE_TRUNC('month', date)), 1), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'expense' AND date >= CURRENT_DATE - INTERVAL '6 months'
	`, userID).Scan(&avgMonthlyExpenses)

	threeMonths := avgMonthlyExpenses * 3
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Emergency fund covers 3-6 months expenses",
		Met:    threeMonths > 0 && emergencyAmount >= threeMonths,
		Detail: fmt.Sprintf("$%.0f saved vs $%.0f needed (3 months)", emergencyAmount, threeMonths),
	})

	// 2. Has 2+ savings goals (proxy for "automate savings")
	var savingsCount int
	sq := `SELECT COUNT(*) FROM savings_goals WHERE user_id = $1`
	sArgs := []interface{}{userID}
	if householdID != "" {
		sq = `SELECT COUNT(*) FROM savings_goals WHERE user_id = $1 OR household_id = $2`
		sArgs = append(sArgs, householdID)
	}
	_ = conn.QueryRow(sq, sArgs...).Scan(&savingsCount)
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Automate savings",
		Met:    savingsCount >= 2,
		Detail: fmt.Sprintf("%d savings goal(s) set up", savingsCount),
	})

	// 3. Has investment holdings (proxy for "start retirement contributions")
	var holdingCount int
	err := conn.QueryRow(`SELECT COUNT(*) FROM investment_holdings WHERE user_id = $1`, userID).Scan(&holdingCount)
	if err != nil {
		log.Printf("framework L3 holdings query error: %v", err)
	}
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Start retirement contributions",
		Met:    holdingCount > 0,
		Detail: fmt.Sprintf("%d investment holding(s)", holdingCount),
	})

	return criteria
}

// ─── Level 4: Grow Wealth ────────────────────────────────────

func assessLevel4(conn *sql.DB, userID, householdID string) []models.CriterionStatus {
	var criteria []models.CriterionStatus

	// 1. Has investment holdings
	var holdingCount int
	_ = conn.QueryRow(`SELECT COUNT(*) FROM investment_holdings WHERE user_id = $1`, userID).Scan(&holdingCount)
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Open investment accounts",
		Met:    holdingCount > 0,
		Detail: fmt.Sprintf("%d investment holding(s)", holdingCount),
	})

	// 2. Multiple savings goals on track (current >= 50% of target)
	var onTrack int
	oq := `SELECT COUNT(*) FROM savings_goals
	       WHERE user_id = $1 AND target_amount > 0 AND current_amount >= target_amount * 0.5`
	oArgs := []interface{}{userID}
	if householdID != "" {
		oq = `SELECT COUNT(*) FROM savings_goals
		      WHERE (user_id = $1 OR household_id = $2) AND target_amount > 0 AND current_amount >= target_amount * 0.5`
		oArgs = append(oArgs, householdID)
	}
	_ = conn.QueryRow(oq, oArgs...).Scan(&onTrack)
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Multiple savings goals on track",
		Met:    onTrack >= 2,
		Detail: fmt.Sprintf("%d goal(s) at 50%%+ of target", onTrack),
	})

	// 3. Has a combined type financial plan active
	var combinedPlans int
	cq := `SELECT COUNT(*) FROM financial_plans
	       WHERE created_by = $1 AND plan_type = 'combined' AND status = 'active'`
	cArgs := []interface{}{userID}
	if householdID != "" {
		cq = `SELECT COUNT(*) FROM financial_plans
		      WHERE (created_by = $1 OR household_id = $2) AND plan_type = 'combined' AND status = 'active'`
		cArgs = append(cArgs, householdID)
	}
	_ = conn.QueryRow(cq, cArgs...).Scan(&combinedPlans)
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Active combined financial plan",
		Met:    combinedPlans > 0,
		Detail: fmt.Sprintf("%d active combined plan(s)", combinedPlans),
	})

	return criteria
}

// ─── Level 5: Dream Big ──────────────────────────────────────

func assessLevel5(conn *sql.DB, userID, householdID string) []models.CriterionStatus {
	var criteria []models.CriterionStatus

	// 1. Positive net worth: total savings + balances > total debt
	var totalSavings float64
	sq := `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1`
	sArgs := []interface{}{userID}
	if householdID != "" {
		sq = `SELECT COALESCE(SUM(current_amount), 0) FROM savings_goals WHERE user_id = $1 OR household_id = $2`
		sArgs = append(sArgs, householdID)
	}
	_ = conn.QueryRow(sq, sArgs...).Scan(&totalSavings)

	var totalBalance float64
	_ = conn.QueryRow(`SELECT COALESCE(SUM(current_balance), 0) FROM account_balances WHERE user_id = $1`, userID).Scan(&totalBalance)

	var totalDebt float64
	dq := `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1`
	dArgs := []interface{}{userID}
	if householdID != "" {
		dq = `SELECT COALESCE(SUM(balance), 0) FROM debt_accounts WHERE user_id = $1 OR household_id = $2`
		dArgs = append(dArgs, householdID)
	}
	_ = conn.QueryRow(dq, dArgs...).Scan(&totalDebt)

	netWorth := totalSavings + totalBalance - totalDebt
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Positive and growing net worth",
		Met:    netWorth > 0,
		Detail: fmt.Sprintf("Net worth: $%.0f", netWorth),
	})

	// 2. Multiple completed plans
	var completedPlans int
	cpq := `SELECT COUNT(*) FROM financial_plans WHERE created_by = $1 AND status = 'completed'`
	cpArgs := []interface{}{userID}
	if householdID != "" {
		cpq = `SELECT COUNT(*) FROM financial_plans WHERE (created_by = $1 OR household_id = $2) AND status = 'completed'`
		cpArgs = append(cpArgs, householdID)
	}
	_ = conn.QueryRow(cpq, cpArgs...).Scan(&completedPlans)
	criteria = append(criteria, models.CriterionStatus{
		Name:   "Multiple completed financial plans",
		Met:    completedPlans >= 2,
		Detail: fmt.Sprintf("%d completed plan(s)", completedPlans),
	})

	// 3. Has discretionary savings goals (travel, vacation, etc.)
	var dreamGoals int
	dgq := `SELECT COUNT(*) FROM savings_goals
	        WHERE user_id = $1 AND (LOWER(name) LIKE '%travel%' OR LOWER(name) LIKE '%vacation%'
	        OR LOWER(name) LIKE '%dream%' OR LOWER(name) LIKE '%fun%' OR LOWER(name) LIKE '%gift%')`
	dgArgs := []interface{}{userID}
	if householdID != "" {
		dgq = `SELECT COUNT(*) FROM savings_goals
		       WHERE (user_id = $1 OR household_id = $2) AND (LOWER(name) LIKE '%travel%' OR LOWER(name) LIKE '%vacation%'
		       OR LOWER(name) LIKE '%dream%' OR LOWER(name) LIKE '%fun%' OR LOWER(name) LIKE '%gift%')`
		dgArgs = append(dgArgs, householdID)
	}
	_ = conn.QueryRow(dgq, dgArgs...).Scan(&dreamGoals)

	// Also check for non-emergency, non-standard savings as a broader match
	if dreamGoals == 0 {
		var nonEssentialGoals int
		neq := `SELECT COUNT(*) FROM savings_goals
		        WHERE user_id = $1 AND LOWER(name) NOT LIKE '%emergency%' AND LOWER(name) NOT LIKE '%retire%'`
		neArgs := []interface{}{userID}
		if householdID != "" {
			neq = `SELECT COUNT(*) FROM savings_goals
			       WHERE (user_id = $1 OR household_id = $2) AND LOWER(name) NOT LIKE '%emergency%' AND LOWER(name) NOT LIKE '%retire%'`
			neArgs = append(neArgs, householdID)
		}
		_ = conn.QueryRow(neq, neArgs...).Scan(&nonEssentialGoals)
		dreamGoals = nonEssentialGoals
	}

	_ = strings.ToLower // ensure strings import is used

	criteria = append(criteria, models.CriterionStatus{
		Name:   "Fund dream goals",
		Met:    dreamGoals > 0,
		Detail: fmt.Sprintf("%d discretionary savings goal(s)", dreamGoals),
	})

	return criteria
}
