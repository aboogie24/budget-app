// Package recurrence holds the ONE implementation of budget-frequency math.
// Every surface that turns "amount + frequency" into a monthly figure (budget
// summary, dashboard signals, AI financial snapshot) must agree, or the same
// budget reads differently across screens.
package recurrence

import "time"

// OccurrencesInMonth returns how many times a budget with the given start date
// and frequency lands inside [monthStart, monthEnd). Weekly/biweekly cadences
// count real calendar occurrences (anchored to start_date when set, else the
// 1st of the month) rather than a flat ×4/×2, so months with 5 paydays don't
// drift from actuals.
func OccurrencesInMonth(startDate *time.Time, frequency string, monthStart, monthEnd time.Time) int {
	if startDate != nil && !startDate.Before(monthEnd) {
		return 0
	}
	switch frequency {
	case "weekly", "biweekly":
		step := 7
		if frequency == "biweekly" {
			step = 14
		}
		anchor := monthStart
		if startDate != nil {
			anchor = *startDate
		}
		current := anchor
		if current.Before(monthStart) {
			// Advance to the first occurrence at or after monthStart, keeping
			// the anchor's cadence phase.
			days := int(monthStart.Sub(current).Hours() / 24)
			steps := (days + step - 1) / step
			current = current.AddDate(0, 0, steps*step)
		}
		count := 0
		for current.Before(monthEnd) {
			count++
			current = current.AddDate(0, 0, step)
		}
		return count
	case "1st-15th":
		return 2
	default:
		return 1
	}
}
