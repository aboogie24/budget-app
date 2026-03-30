package handlers

import (
	"testing"
	"time"
)

func TestAdvanceDate_Monthly(t *testing.T) {
	from := time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "monthly", nil)
	expected := time.Date(2025, 2, 15, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestAdvanceDate_MonthlyEndOfMonth(t *testing.T) {
	// Jan 31 -> Feb should clamp to Feb 28 (non-leap)
	from := time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "monthly", nil)
	if next.Month() != 2 {
		t.Fatalf("expected February, got %v", next.Month())
	}
	if next.Day() > 28 {
		t.Fatalf("expected day <= 28 for Feb 2025, got %d", next.Day())
	}
}

func TestAdvanceDate_Weekly(t *testing.T) {
	from := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC) // Sunday
	next := advanceDate(from, "weekly", nil)
	expected := time.Date(2025, 6, 8, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestAdvanceDate_Biweekly(t *testing.T) {
	from := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "biweekly", nil)
	expected := time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestAdvanceDate_1st15th_From1st(t *testing.T) {
	from := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "1st-15th", nil)
	expected := time.Date(2025, 3, 15, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestAdvanceDate_1st15th_From15th(t *testing.T) {
	from := time.Date(2025, 3, 15, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "1st-15th", nil)
	expected := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestAdvanceDate_MonthlyWithDueDay(t *testing.T) {
	dueDay := 20
	from := time.Date(2025, 5, 20, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "monthly", &dueDay)
	if next.Day() != 20 || next.Month() != 6 {
		t.Fatalf("expected June 20, got %v", next)
	}
}

func TestAdvanceDate_OneTime(t *testing.T) {
	from := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "one-time", nil)
	// one-time should not advance (or return a far-future date)
	if next.Before(from) {
		t.Fatalf("one-time advanced to a past date: %v", next)
	}
}

func TestAdvanceDate_EmptyFrequency(t *testing.T) {
	from := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "", nil)
	// Empty frequency should default to monthly
	expected := time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}

func TestAdvanceDate_YearBoundary(t *testing.T) {
	from := time.Date(2025, 12, 15, 0, 0, 0, 0, time.UTC)
	next := advanceDate(from, "monthly", nil)
	expected := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("expected %v, got %v", expected, next)
	}
}
