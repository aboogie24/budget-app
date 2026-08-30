package handlers

import (
	"testing"
	"time"
)

func TestOccurrencesInMonth(t *testing.T) {
	month := func(y int, m time.Month) (time.Time, time.Time) {
		start := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
		return start, start.AddDate(0, 1, 0)
	}
	date := func(y int, m time.Month, d int) *time.Time {
		v := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
		return &v
	}

	julStart, julEnd := month(2026, time.July)   // 31 days, 5 Wednesdays from the 1st
	febStart, febEnd := month(2026, time.February) // 28 days

	tests := []struct {
		name       string
		start      *time.Time
		freq       string
		monthStart time.Time
		monthEnd   time.Time
		want       int
	}{
		{"weekly no anchor counts real weeks (5-occurrence month)", nil, "weekly", julStart, julEnd, 5},
		{"weekly no anchor in 28-day month", nil, "weekly", febStart, febEnd, 4},
		{"weekly anchored earlier keeps weekday", date(2026, time.June, 3), "weekly", julStart, julEnd, 5},
		{"biweekly keeps 14-day phase from prior month", date(2026, time.June, 26), "biweekly", julStart, julEnd, 2},
		{"biweekly anchored on the 1st", date(2026, time.July, 1), "biweekly", julStart, julEnd, 3},
		{"start mid-month counts from start", date(2026, time.July, 20), "weekly", julStart, julEnd, 2},
		{"start after month end is zero", date(2026, time.August, 1), "weekly", julStart, julEnd, 0},
		{"monthly default is one", nil, "monthly", julStart, julEnd, 1},
		{"empty frequency is one", nil, "", julStart, julEnd, 1},
		{"1st-15th is two", nil, "1st-15th", julStart, julEnd, 2},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := occurrencesInMonth(tc.start, tc.freq, tc.monthStart, tc.monthEnd)
			if got != tc.want {
				t.Fatalf("occurrencesInMonth(%v, %q) = %d, want %d", tc.start, tc.freq, got, tc.want)
			}
		})
	}
}
