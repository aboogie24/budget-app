package ai

import (
	"database/sql"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/aboogie/budget-backend/models"
)

// debtState tracks per-debt simulation state during payoff calculation.
type debtState struct {
	models.DebtInfo
	balance       float64
	totalInterest float64
	months        []models.MonthEntry
	paidOff       bool
	payoffMonth   int
}

// firstUnpaid returns the first debt that has not been paid off.
func firstUnpaid(states []*debtState) *debtState {
	for _, s := range states {
		if !s.paidOff {
			return s
		}
	}
	return nil
}

// CalculateDebtPayoff simulates month-by-month debt payoff using the given strategy.
// Strategies: "avalanche" (highest APR first), "snowball" (lowest balance first),
// "hybrid" (highest APR but within 5% APR bands, lowest balance first).
// extraPayment is the total extra money per month above all minimum payments.
func CalculateDebtPayoff(debts []models.DebtInfo, strategy string, extraPayment float64) []models.DebtPayoffSchedule {
	if len(debts) == 0 {
		return []models.DebtPayoffSchedule{}
	}

	states := make([]*debtState, len(debts))
	for i, d := range debts {
		states[i] = &debtState{
			DebtInfo: d,
			balance:  d.Balance,
		}
	}

	sortStates := func() {
		switch strategy {
		case "snowball":
			sort.Slice(states, func(i, j int) bool {
				if states[i].paidOff != states[j].paidOff {
					return !states[i].paidOff
				}
				return states[i].balance < states[j].balance
			})
		case "hybrid":
			sort.Slice(states, func(i, j int) bool {
				if states[i].paidOff != states[j].paidOff {
					return !states[i].paidOff
				}
				bandI := int(states[i].APR / 5.0)
				bandJ := int(states[j].APR / 5.0)
				if bandI != bandJ {
					return bandI > bandJ
				}
				return states[i].balance < states[j].balance
			})
		default: // avalanche
			sort.Slice(states, func(i, j int) bool {
				if states[i].paidOff != states[j].paidOff {
					return !states[i].paidOff
				}
				return states[i].APR > states[j].APR
			})
		}
	}

	const maxMonths = 360

	for month := 1; month <= maxMonths; month++ {
		sortStates()

		allPaid := true
		for _, s := range states {
			if !s.paidOff {
				allPaid = false
				break
			}
		}
		if allPaid {
			break
		}

		remaining := extraPayment
		target := firstUnpaid(states)

		for _, s := range states {
			if s.paidOff {
				continue
			}

			monthlyRate := s.APR / 100.0 / 12.0
			interest := math.Round(s.balance*monthlyRate*100) / 100

			payment := s.MinPayment
			if s == target {
				payment += remaining
				remaining = 0
			}

			if payment > s.balance+interest {
				payment = math.Round((s.balance+interest)*100) / 100
			}

			principal := math.Round((payment-interest)*100) / 100
			if principal < 0 {
				principal = 0
			}

			s.balance = math.Round((s.balance-principal)*100) / 100
			if s.balance < 0.01 {
				s.balance = 0
			}
			s.totalInterest += interest

			s.months = append(s.months, models.MonthEntry{
				Month:            month,
				Payment:          payment,
				Principal:        principal,
				Interest:         interest,
				RemainingBalance: s.balance,
			})

			if s.balance <= 0 {
				s.paidOff = true
				s.payoffMonth = month
				extraPayment += s.MinPayment
			}
		}
	}

	now := time.Now()
	schedules := make([]models.DebtPayoffSchedule, len(states))
	for i, s := range states {
		payoffDate := ""
		if s.payoffMonth > 0 {
			payoffDate = now.AddDate(0, s.payoffMonth, 0).Format("2006-01")
		}
		schedules[i] = models.DebtPayoffSchedule{
			DebtID:        s.ID,
			DebtName:      s.Name,
			Months:        s.months,
			TotalInterest: math.Round(s.totalInterest*100) / 100,
			PayoffDate:    payoffDate,
		}
	}
	return schedules
}

// CalculateStructuredDebtAmortization projects a standard amortization schedule for
// structured debts (e.g., mortgage). No extra payments — just minimum payment over time.
func CalculateStructuredDebtAmortization(debts []models.DebtInfo) []models.DebtPayoffSchedule {
	now := time.Now()
	schedules := make([]models.DebtPayoffSchedule, 0, len(debts))

	for _, d := range debts {
		if d.Balance <= 0 || d.MinPayment <= 0 {
			continue
		}

		balance := d.Balance
		var months []models.MonthEntry
		var totalInterest float64
		monthlyRate := d.APR / 100.0 / 12.0

		for month := 1; month <= 360 && balance > 0.01; month++ {
			interest := math.Round(balance*monthlyRate*100) / 100
			payment := d.MinPayment
			if payment > balance+interest {
				payment = math.Round((balance+interest)*100) / 100
			}
			principal := math.Round((payment-interest)*100) / 100
			if principal < 0 {
				principal = 0
			}
			balance = math.Round((balance-principal)*100) / 100
			if balance < 0.01 {
				balance = 0
			}
			totalInterest += interest

			months = append(months, models.MonthEntry{
				Month:            month,
				Payment:          payment,
				Principal:        principal,
				Interest:         interest,
				RemainingBalance: balance,
			})
		}

		payoffDate := ""
		if len(months) > 0 && balance <= 0 {
			payoffDate = now.AddDate(0, len(months), 0).Format("2006-01")
		}

		schedules = append(schedules, models.DebtPayoffSchedule{
			DebtID:        d.ID,
			DebtName:      d.Name,
			Months:        months,
			TotalInterest: math.Round(totalInterest*100) / 100,
			PayoffDate:    payoffDate,
		})
	}
	return schedules
}

// ProjectSavings projects month-by-month savings growth with compound interest.
// annualRate is a decimal (e.g. 0.05 for 5%).
// Runs until targetAmount is reached or 360 months (30 years).
func ProjectSavings(monthlyAmount, currentAmount, targetAmount, annualRate float64) models.SavingsProjection {
	monthlyRate := annualRate / 12.0
	balance := currentAmount
	var months []models.SavingsMonth

	const maxMonths = 360

	for month := 1; month <= maxMonths; month++ {
		interest := math.Round(balance*monthlyRate*100) / 100
		balance = math.Round((balance+interest+monthlyAmount)*100) / 100

		months = append(months, models.SavingsMonth{
			Month:        month,
			Contribution: monthlyAmount,
			Interest:     interest,
			Balance:      balance,
		})

		if targetAmount > 0 && balance >= targetAmount {
			break
		}
	}

	targetDate := ""
	if len(months) > 0 && targetAmount > 0 && balance >= targetAmount {
		targetDate = time.Now().AddDate(0, len(months), 0).Format("2006-01")
	}

	return models.SavingsProjection{
		Months:     months,
		TargetDate: targetDate,
	}
}

// AnalyzeCashFlow queries the last 3 months of transactions and returns a structured analysis.
func AnalyzeCashFlow(conn *sql.DB, userID string) (models.CashFlowAnalysis, error) {
	analysis := models.CashFlowAnalysis{MonthsAnalyzed: 3}

	var totalIncome sql.NullFloat64
	err := conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'income'
		  AND date >= NOW() - INTERVAL '3 months'
	`, userID).Scan(&totalIncome)
	if err != nil {
		return analysis, fmt.Errorf("income query: %w", err)
	}
	if totalIncome.Float64 == 0 {
		// Income tracked as budgets — sum with frequency adjustment, multiply by 3 for the 3-month window
		var budgetIncome sql.NullFloat64
		_ = conn.QueryRow(`
			SELECT COALESCE(SUM(
				CASE frequency
					WHEN 'weekly' THEN amount * 4
					WHEN 'biweekly' THEN amount * 2
					WHEN '1st-15th' THEN amount * 2
					ELSE amount
				END
			), 0) FROM budgets WHERE user_id = $1 AND type = 'income'
		`, userID).Scan(&budgetIncome)
		totalIncome.Float64 = budgetIncome.Float64 * 3
	}
	analysis.AvgMonthlyIncome = math.Round(totalIncome.Float64/3.0*100) / 100

	var totalExpenses sql.NullFloat64
	err = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM transactions
		WHERE user_id = $1 AND type = 'expense'
		  AND date >= NOW() - INTERVAL '3 months'
	`, userID).Scan(&totalExpenses)
	if err != nil {
		return analysis, fmt.Errorf("expenses query: %w", err)
	}
	analysis.AvgMonthlyExpenses = math.Round(totalExpenses.Float64/3.0*100) / 100
	analysis.AvgMonthlySurplus = math.Round((analysis.AvgMonthlyIncome-analysis.AvgMonthlyExpenses)*100) / 100

	rows, err := conn.Query(`
		SELECT COALESCE(c.name, t.category_name, 'Uncategorized') as category,
		       SUM(t.amount) as total
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
		  AND t.type = 'expense'
		  AND t.date >= NOW() - INTERVAL '3 months'
		GROUP BY category
		ORDER BY total DESC
	`, userID)
	if err != nil {
		return analysis, fmt.Errorf("category query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var cat string
		var total float64
		if err := rows.Scan(&cat, &total); err != nil {
			continue
		}
		analysis.CategoryBreakdown = append(analysis.CategoryBreakdown, models.CategorySpend{
			Category:       cat,
			Total:          math.Round(total*100) / 100,
			MonthlyAverage: math.Round(total/3.0*100) / 100,
		})
	}

	if analysis.CategoryBreakdown == nil {
		analysis.CategoryBreakdown = []models.CategorySpend{}
	}

	return analysis, nil
}
