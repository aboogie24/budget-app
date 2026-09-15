package ai

import (
	"database/sql"
	"log"
	"time"

	"github.com/aboogie/budget-backend/internal/recurrence"
)

// sumBudgetedMonthlyIncome applies recurrence.OccurrencesInMonth — the same
// occurrence math as the Budget tab and getFinancialSnapshot — so chat context
// and the snapshot tool never disagree on weekly/biweekly income.
func sumBudgetedMonthlyIncome(conn *sql.DB, whereSQL string, args []interface{}, monthStart, monthEnd time.Time) float64 {
	var total float64
	rows, err := conn.Query(`
		SELECT amount, COALESCE(frequency, ''), start_date
		FROM budgets b
		WHERE (`+whereSQL+`) AND b.type = 'income'`, args...)
	if err != nil {
		log.Printf("budgeted income query error: %v", err)
		return 0
	}
	defer rows.Close()
	for rows.Next() {
		var amount float64
		var freq string
		var start sql.NullTime
		if rows.Scan(&amount, &freq, &start) != nil {
			continue
		}
		var startPtr *time.Time
		if start.Valid {
			startPtr = &start.Time
		}
		total += amount * float64(recurrence.OccurrencesInMonth(startPtr, freq, monthStart, monthEnd))
	}
	return total
}

func currentMonthBoundsUTC() (monthStart, monthEnd time.Time) {
	now := time.Now().UTC()
	monthStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthEnd = monthStart.AddDate(0, 1, 0)
	return monthStart, monthEnd
}
