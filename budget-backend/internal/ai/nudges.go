package ai

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/aboogie/budget-backend/models"
)

// GenerateNudges uses deterministic Go logic (no AI) to check financial data
// and generate contextual nudges for the user.
func GenerateNudges(conn *sql.DB, userID, householdID string) []models.AINudge {
	var nudges []models.AINudge

	now := time.Now().UTC()
	var hhPtr *string
	if householdID != "" {
		hhPtr = &householdID
	}

	// 1. Spending alert: expenses in last 7 days > avg weekly expenses * 1.3
	nudges = append(nudges, checkSpendingAlert(conn, userID, hhPtr, now)...)

	// 2. Savings tip: savings goal < 50% progress with target_date within 3 months
	nudges = append(nudges, checkSavingsTips(conn, userID, householdID, hhPtr, now)...)

	// 3. Debt progress: debt balance decreased in last 30 days
	nudges = append(nudges, checkDebtProgress(conn, userID, householdID, hhPtr, now)...)

	// 4. Milestone reminder: plan milestone target_date within 7 days and status='pending'
	nudges = append(nudges, checkMilestoneReminders(conn, userID, householdID, hhPtr, now)...)

	// 5. Budget overspend: category spending > 90% of limit with days remaining
	nudges = append(nudges, checkBudgetOverspend(conn, userID, hhPtr, now)...)

	// 6. No budget: user has 0 budgets
	nudges = append(nudges, checkNoBudget(conn, userID, hhPtr)...)

	// 7. Framework level up: current level fully complete
	nudges = append(nudges, checkFrameworkLevelUp(conn, userID, householdID, hhPtr)...)

	// 8. Debt category suggestion: debts where classification may be wrong based on APR
	nudges = append(nudges, checkDebtCategorySuggestion(conn, userID, hhPtr)...)

	// 9. Debt reclassification: high-rate debts marked as structured
	nudges = append(nudges, checkDebtReclassification(conn, userID, hhPtr)...)

	// 10. Structured debt milestones: celebrate when structured debt hits 50%/75% paid
	nudges = append(nudges, checkStructuredDebtMilestones(conn, userID, hhPtr)...)

	// 11. Categorization review: unverified auto-categorized transactions
	nudges = append(nudges, checkCategorizationReview(conn, userID, hhPtr)...)

	return nudges
}

// SaveNudges persists nudges to the database, deduplicating and cleaning up expired ones.
func SaveNudges(conn *sql.DB, nudges []models.AINudge) error {
	// Delete expired nudges
	_, err := conn.Exec(`DELETE FROM ai_nudges WHERE expires_at IS NOT NULL AND expires_at < NOW()`)
	if err != nil {
		log.Printf("nudges: delete expired error: %v", err)
	}

	// Delete nudges older than 7 days
	_, err = conn.Exec(`DELETE FROM ai_nudges WHERE created_at < NOW() - INTERVAL '7 days'`)
	if err != nil {
		log.Printf("nudges: delete old error: %v", err)
	}

	for _, n := range nudges {
		// Check for duplicate: same user_id + nudge_type + title in last 24 hours
		var exists bool
		err := conn.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM ai_nudges
				WHERE user_id = $1 AND nudge_type = $2 AND title = $3
				  AND created_at > NOW() - INTERVAL '24 hours'
			)
		`, n.UserID, n.NudgeType, n.Title).Scan(&exists)
		if err != nil {
			log.Printf("nudges: duplicate check error: %v", err)
			continue
		}
		if exists {
			continue
		}

		_, err = conn.Exec(`
			INSERT INTO ai_nudges (user_id, household_id, nudge_type, title, body, action_type, action_data, priority, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`, n.UserID, n.HouseholdID, n.NudgeType, n.Title, n.Body, n.ActionType, n.ActionData, n.Priority, n.ExpiresAt)
		if err != nil {
			log.Printf("nudges: insert error: %v", err)
		}
	}

	return nil
}

// --- Individual nudge checks ---

func checkSpendingAlert(conn *sql.DB, userID string, hhPtr *string, now time.Time) []models.AINudge {
	// Average weekly expenses over the last 8 weeks (excluding current week)
	var avgWeekly float64
	err := conn.QueryRow(`
		SELECT COALESCE(SUM(amount) / GREATEST(COUNT(DISTINCT DATE_TRUNC('week', date)), 1), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND date >= $2 AND date < $3
	`, userID,
		now.AddDate(0, 0, -63).Format("2006-01-02"),
		now.AddDate(0, 0, -7).Format("2006-01-02"),
	).Scan(&avgWeekly)
	if err != nil || avgWeekly == 0 {
		return nil
	}

	// Expenses in the last 7 days
	var recentSpend float64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND date >= $2
	`, userID, now.AddDate(0, 0, -7).Format("2006-01-02")).Scan(&recentSpend)
	if err != nil || recentSpend == 0 {
		return nil
	}

	if recentSpend > avgWeekly*1.3 {
		pct := int(math.Round((recentSpend/avgWeekly - 1) * 100))
		actionType := "navigate_to"
		actionData := "/(tabs)/transactions"
		return []models.AINudge{{
			UserID:      userID,
			HouseholdID: hhPtr,
			NudgeType:   "spending_alert",
			Title:       "Spending is up this week",
			Body:        fmt.Sprintf("You're spending %d%% more than usual this week ($%.0f vs $%.0f avg).", pct, recentSpend, avgWeekly),
			ActionType:  &actionType,
			ActionData:  &actionData,
			Priority:    3,
		}}
	}
	return nil
}

func checkSavingsTips(conn *sql.DB, userID, householdID string, hhPtr *string, now time.Time) []models.AINudge {
	threeMonthsOut := now.AddDate(0, 3, 0).Format("2006-01-02")

	query := `
		SELECT name, current_amount, target_amount, target_date
		FROM savings_goals
		WHERE user_id = $1
		  AND target_amount > 0
		  AND current_amount < target_amount * 0.5
		  AND target_date IS NOT NULL AND target_date != ''
		  AND target_date <= $2
	`
	args := []interface{}{userID, threeMonthsOut}
	if householdID != "" {
		query = `
			SELECT name, current_amount, target_amount, target_date
			FROM savings_goals
			WHERE (user_id = $1 OR household_id = $3)
			  AND target_amount > 0
			  AND current_amount < target_amount * 0.5
			  AND target_date IS NOT NULL AND target_date != ''
			  AND target_date <= $2
		`
		args = append(args, householdID)
	}

	rows, err := conn.Query(query, args...)
	if err != nil {
		log.Printf("nudges: savings tip query error: %v", err)
		return nil
	}
	defer rows.Close()

	var nudges []models.AINudge
	actionType := "navigate_to"
	actionData := "/(tabs)/savings"
	for rows.Next() {
		var name string
		var current, target float64
		var targetDate sql.NullString
		if err := rows.Scan(&name, &current, &target, &targetDate); err != nil {
			continue
		}
		pct := int(math.Round(current / target * 100))
		nudges = append(nudges, models.AINudge{
			UserID:      userID,
			HouseholdID: hhPtr,
			NudgeType:   "savings_tip",
			Title:       fmt.Sprintf("Your %s goal is behind schedule", name),
			Body:        fmt.Sprintf("At %d%% of target ($%.0f / $%.0f) with deadline approaching. Consider increasing contributions.", pct, current, target),
			ActionType:  &actionType,
			ActionData:  &actionData,
			Priority:    4,
		})
	}
	return nudges
}

func checkDebtProgress(conn *sql.DB, userID, householdID string, hhPtr *string, now time.Time) []models.AINudge {
	// Sum of debt payments in last 30 days (transactions categorized as debt)
	query := `
		SELECT da.name, COALESCE(SUM(t.amount), 0) as paid
		FROM debt_accounts da
		LEFT JOIN transactions t ON t.user_id = da.user_id
		  AND LOWER(t.note) LIKE '%' || LOWER(da.name) || '%'
		  AND t.type = 'expense'
		  AND t.date >= $2
		WHERE da.user_id = $1
		GROUP BY da.id, da.name
		HAVING COALESCE(SUM(t.amount), 0) > 0
	`
	args := []interface{}{userID, now.AddDate(0, 0, -30).Format("2006-01-02")}

	// Also check direct debt payment transactions
	queryAlt := `
		SELECT da.name, da.balance
		FROM debt_accounts da
		WHERE da.user_id = $1 AND da.balance > 0
	`
	altArgs := []interface{}{userID}
	if householdID != "" {
		queryAlt = `
			SELECT da.name, da.balance
			FROM debt_accounts da
			WHERE (da.user_id = $1 OR da.household_id = $2) AND da.balance > 0
		`
		altArgs = append(altArgs, householdID)
	}

	// Simpler approach: look for debt payment transactions in last 30 days
	var totalDebtPayments float64
	err := conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND (LOWER(category_name) LIKE '%debt%' OR LOWER(category_name) LIKE '%payment%' OR LOWER(note) LIKE '%debt%')
		  AND date >= $2
	`, userID, now.AddDate(0, 0, -30).Format("2006-01-02")).Scan(&totalDebtPayments)

	// Suppress unused variable warnings
	_ = query
	_ = args
	_ = queryAlt
	_ = altArgs

	if err != nil || totalDebtPayments <= 0 {
		return nil
	}

	actionType := "navigate_to"
	actionData := "/(tabs)/debts"
	return []models.AINudge{{
		UserID:      userID,
		HouseholdID: hhPtr,
		NudgeType:   "debt_progress",
		Title:       "Great progress on your debt!",
		Body:        fmt.Sprintf("You paid down $%.0f on debt this month. Keep it up!", totalDebtPayments),
		ActionType:  &actionType,
		ActionData:  &actionData,
		Priority:    5,
	}}
}

func checkMilestoneReminders(conn *sql.DB, userID, householdID string, hhPtr *string, now time.Time) []models.AINudge {
	sevenDaysOut := now.AddDate(0, 0, 7).Format("2006-01-02")
	today := now.Format("2006-01-02")

	query := `
		SELECT pm.title, pm.target_date, fp.name
		FROM plan_milestones pm
		JOIN financial_plans fp ON fp.id = pm.plan_id
		WHERE fp.created_by = $1
		  AND pm.status = 'pending'
		  AND pm.target_date IS NOT NULL
		  AND pm.target_date >= $2
		  AND pm.target_date <= $3
	`
	args := []interface{}{userID, today, sevenDaysOut}
	if householdID != "" {
		query = `
			SELECT pm.title, pm.target_date, fp.name
			FROM plan_milestones pm
			JOIN financial_plans fp ON fp.id = pm.plan_id
			WHERE (fp.created_by = $1 OR fp.household_id = $4)
			  AND pm.status = 'pending'
			  AND pm.target_date IS NOT NULL
			  AND pm.target_date >= $2
			  AND pm.target_date <= $3
		`
		args = append(args, householdID)
	}

	rows, err := conn.Query(query, args...)
	if err != nil {
		log.Printf("nudges: milestone query error: %v", err)
		return nil
	}
	defer rows.Close()

	var nudges []models.AINudge
	actionType := "navigate_to"
	actionData := "/(tabs)/plans"
	for rows.Next() {
		var title, targetDate, planName string
		if err := rows.Scan(&title, &targetDate, &planName); err != nil {
			continue
		}
		nudges = append(nudges, models.AINudge{
			UserID:      userID,
			HouseholdID: hhPtr,
			NudgeType:   "milestone_reminder",
			Title:       fmt.Sprintf("Milestone due this week: %s", title),
			Body:        fmt.Sprintf("Your milestone \"%s\" in plan \"%s\" is due by %s.", title, planName, targetDate),
			ActionType:  &actionType,
			ActionData:  &actionData,
			Priority:    2,
		})
	}
	return nudges
}

func checkBudgetOverspend(conn *sql.DB, userID string, hhPtr *string, now time.Time) []models.AINudge {
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd := monthStart.AddDate(0, 1, 0)
	daysInMonth := monthEnd.Sub(monthStart).Hours() / 24
	daysRemaining := int(monthEnd.Sub(now).Hours() / 24)

	rows, err := conn.Query(`
		SELECT b.name, b.amount,
		       COALESCE(SUM(t.amount), 0) AS spent
		FROM budgets b
		LEFT JOIN budget_categories bc ON bc.budget_id = b.id
		LEFT JOIN transactions t ON t.category_id = bc.category_id
			AND t.type = 'expense'
			AND t.date >= $2 AND t.date < $3
		WHERE b.user_id = $1 AND b.type = 'expense' AND b.amount > 0
		GROUP BY b.id, b.name, b.amount
	`, userID, monthStart.Format("2006-01-02"), monthEnd.Format("2006-01-02"))
	if err != nil {
		log.Printf("nudges: budget overspend query error: %v", err)
		return nil
	}
	defer rows.Close()

	_ = daysInMonth // used conceptually for context

	var nudges []models.AINudge
	actionType := "navigate_to"
	actionData := "/(tabs)/budget"
	for rows.Next() {
		var name string
		var budgeted, spent float64
		if err := rows.Scan(&name, &budgeted, &spent); err != nil {
			continue
		}
		pct := int(math.Round(spent / budgeted * 100))
		if pct >= 90 && daysRemaining > 0 {
			nudges = append(nudges, models.AINudge{
				UserID:      userID,
				HouseholdID: hhPtr,
				NudgeType:   "spending_alert",
				Title:       fmt.Sprintf("Budget alert: %s", name),
				Body:        fmt.Sprintf("You've used %d%% of your %s budget ($%.0f of $%.0f) with %d days left.", pct, name, spent, budgeted, daysRemaining),
				ActionType:  &actionType,
				ActionData:  &actionData,
				Priority:    3,
			})
		}
	}
	return nudges
}

func checkNoBudget(conn *sql.DB, userID string, hhPtr *string) []models.AINudge {
	var count int
	err := conn.QueryRow(`SELECT COUNT(*) FROM budgets WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		log.Printf("nudges: budget count query error: %v", err)
		return nil
	}
	if count == 0 {
		actionType := "navigate_to"
		actionData := "/(tabs)/budget"
		return []models.AINudge{{
			UserID:      userID,
			HouseholdID: hhPtr,
			NudgeType:   "general",
			Title:       "Create a budget to start tracking",
			Body:        "Create a budget to start tracking your spending and reach your financial goals faster.",
			ActionType:  &actionType,
			ActionData:  &actionData,
			Priority:    6,
		}}
	}
	return nil
}

func checkFrameworkLevelUp(conn *sql.DB, userID, householdID string, hhPtr *string) []models.AINudge {
	assessment := AssessFrameworkLevel(conn, userID, householdID)

	// If all criteria in current level are met, user is ready to level up
	if assessment.CompletedPct >= 100 && assessment.Level < 5 {
		nextLevel := assessment.Level + 1
		nextName, ok := levelNames[nextLevel]
		if !ok {
			nextName = "the next level"
		}
		actionType := "navigate_to"
		actionData := "/(tabs)/framework"
		return []models.AINudge{{
			UserID:      userID,
			HouseholdID: hhPtr,
			NudgeType:   "general",
			Title:       fmt.Sprintf("Ready to level up to %s!", nextName),
			Body:        fmt.Sprintf("You've completed all %s criteria. Time to move on to %s!", assessment.LevelName, nextName),
			ActionType:  &actionType,
			ActionData:  &actionData,
			Priority:    2,
		}}
	}
	return nil
}

// ─── Debt Category Suggestion ────────────────────────────────
// Nudge when a newly synced (non-manual) debt has no explicit category set
// and the default might not be right based on APR.

func checkDebtCategorySuggestion(conn *sql.DB, userID string, hhPtr *string) []models.AINudge {
	// Find debts added in the last 7 days that still have the default category
	// but where APR suggests a different classification
	rows, err := conn.Query(`
		SELECT id, name, COALESCE(apr, 0), COALESCE(debt_category, 'attack'), COALESCE(liability_type, 'other')
		FROM debt_accounts
		WHERE user_id = $1
		  AND created_at > NOW() - INTERVAL '7 days'
		  AND COALESCE(source, 'manual') != 'manual'
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		log.Printf("nudges: debt category suggestion query error: %v", err)
		return nil
	}
	defer rows.Close()

	var nudges []models.AINudge
	actionType := "navigate_to"
	actionData := "/debts"

	for rows.Next() {
		var id, name, category, liabType string
		var apr float64
		if err := rows.Scan(&id, &name, &apr, &category, &liabType); err != nil {
			continue
		}

		// Suggest "structured" if APR is low (<4%) and currently attack
		if apr > 0 && apr < 4 && category == "attack" {
			nudges = append(nudges, models.AINudge{
				UserID:      userID,
				HouseholdID: hhPtr,
				NudgeType:   "debt_category_suggestion",
				Title:       fmt.Sprintf("Classify \"%s\" as structured?", name),
				Body:        fmt.Sprintf("This debt has a low %0.1f%% APR. You might want to keep it as structured and invest the difference instead.", apr),
				ActionType:  &actionType,
				ActionData:  &actionData,
				Priority:    4,
			})
		}
		// Suggest "attack" if APR is high (>6%) and currently structured
		if apr > 6 && category == "structured" {
			nudges = append(nudges, models.AINudge{
				UserID:      userID,
				HouseholdID: hhPtr,
				NudgeType:   "debt_category_suggestion",
				Title:       fmt.Sprintf("Should \"%s\" be an attack debt?", name),
				Body:        fmt.Sprintf("At %0.1f%% APR, paying this off aggressively could save you significant interest.", apr),
				ActionType:  &actionType,
				ActionData:  &actionData,
				Priority:    3,
			})
		}
	}
	return nudges
}

// ─── Debt Reclassification ───────────────────────────────────
// Nudge when a debt classified as "structured" has a high APR (>5%)
// suggesting the couple should re-evaluate.

func checkDebtReclassification(conn *sql.DB, userID string, hhPtr *string) []models.AINudge {
	rows, err := conn.Query(`
		SELECT name, COALESCE(apr, 0), COALESCE(liability_type, 'other')
		FROM debt_accounts
		WHERE user_id = $1
		  AND COALESCE(debt_category, 'attack') = 'structured'
		  AND COALESCE(apr, 0) > 5
		  AND balance > 0
	`, userID)
	if err != nil {
		log.Printf("nudges: debt reclassification query error: %v", err)
		return nil
	}
	defer rows.Close()

	var nudges []models.AINudge
	actionType := "ask_ai"

	for rows.Next() {
		var name, liabType string
		var apr float64
		if err := rows.Scan(&name, &apr, &liabType); err != nil {
			continue
		}
		// Don't nudge mortgages — they're almost always structured regardless of rate
		if liabType == "mortgage" {
			continue
		}
		nudges = append(nudges, models.AINudge{
			UserID:      userID,
			HouseholdID: hhPtr,
			NudgeType:   "debt_reclassification",
			Title:       fmt.Sprintf("Re-evaluate \"%s\"?", name),
			Body:        fmt.Sprintf("This %s is marked as structured but has a %0.1f%% rate. Ask the AI if attacking it would save you money.", liabType, apr),
			ActionType:  &actionType,
			Priority:    4,
		})
	}
	return nudges
}

// ─── Structured Debt Payoff Milestones ───────────────────────
// Celebrate when a structured debt hits 50% or 75% paid off
// (based on origination balance estimate from current balance + payments made).

func checkStructuredDebtMilestones(conn *sql.DB, userID string, hhPtr *string) []models.AINudge {
	rows, err := conn.Query(`
		SELECT da.name, da.balance, COALESCE(da.min_payment, 0),
		       COALESCE(l.origination_principal, 0)
		FROM debt_accounts da
		LEFT JOIN liabilities l ON l.plaid_account_id = da.plaid_account_id AND l.user_id = da.user_id::text
		WHERE da.user_id = $1
		  AND COALESCE(da.debt_category, 'attack') = 'structured'
		  AND da.balance > 0
	`, userID)
	if err != nil {
		log.Printf("nudges: structured milestone query error: %v", err)
		return nil
	}
	defer rows.Close()

	var nudges []models.AINudge
	actionType := "navigate_to"
	actionData := "/debts"

	for rows.Next() {
		var name string
		var balance, minPayment, origPrincipal float64
		if err := rows.Scan(&name, &balance, &minPayment, &origPrincipal); err != nil {
			continue
		}

		// Estimate original balance if not available from liabilities
		if origPrincipal <= 0 {
			// Rough estimate: if we know min payment and APR, skip
			// Otherwise just skip this debt — can't calculate milestone without original amount
			continue
		}

		pctPaid := (1 - balance/origPrincipal) * 100
		if pctPaid < 0 {
			continue
		}

		milestone := ""
		if pctPaid >= 75 && pctPaid < 80 {
			milestone = "75%"
		} else if pctPaid >= 50 && pctPaid < 55 {
			milestone = "50%"
		}

		if milestone != "" {
			amountPaid := math.Round((origPrincipal-balance)*100) / 100
			nudges = append(nudges, models.AINudge{
				UserID:      userID,
				HouseholdID: hhPtr,
				NudgeType:   "structured_debt_milestone",
				Title:       fmt.Sprintf("%s is %s paid off!", name, milestone),
				Body:        fmt.Sprintf("You've paid $%.0f on \"%s\". Keep going — the finish line is getting closer!", amountPaid, name),
				ActionType:  &actionType,
				ActionData:  &actionData,
				Priority:    3,
			})
		}
	}
	return nudges
}

// ─── Categorization Review ───────────────────────────────────
// Nudge when there are unverified auto-categorized transactions.

func checkCategorizationReview(conn *sql.DB, userID string, hhPtr *string) []models.AINudge {
	var count int
	err := conn.QueryRow(`
		SELECT COUNT(*) FROM transactions
		WHERE user_id = $1
		  AND COALESCE(user_verified, false) = false
		  AND match_confidence IN ('medium', 'low')
		  AND date >= NOW() - INTERVAL '14 days'
	`, userID).Scan(&count)
	if err != nil {
		log.Printf("nudges: categorization review query error: %v", err)
		return nil
	}

	if count == 0 {
		return nil
	}

	actionType := "navigate_to"
	actionData := "/transaction/list"
	return []models.AINudge{{
		UserID:      userID,
		HouseholdID: hhPtr,
		NudgeType:   "categorization_review",
		Title:       fmt.Sprintf("Review %d auto-categorized transactions", count),
		Body:        fmt.Sprintf("%d recent transactions were auto-categorized and need your review. Tap to verify or fix them.", count),
		ActionType:  &actionType,
		ActionData:  &actionData,
		Priority:    4,
	}}
}
