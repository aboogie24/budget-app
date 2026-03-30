package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
)

// ProcessRecurring generates transaction records for recurring entries that
// are due up to today. It scans transactions with a non-empty frequency
// (excluding "one-time") and creates new rows for each occurrence that
// hasn't been generated yet.
//
// The approach: for each recurring "template" transaction, find the latest
// generated child (or the template date itself), then step forward by the
// frequency interval and insert rows until we reach today.
func ProcessRecurring(w http.ResponseWriter, r *http.Request) {
	created, err := RunRecurringSync()
	if err != nil {
		http.Error(w, "recurring sync failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"created": created,
	})
}

// RunRecurringSync is the core logic, callable from HTTP handler or background goroutine.
func RunRecurringSync() (int, error) {
	dbClient, err := db.New()
	if err != nil {
		return 0, err
	}
	defer dbClient.Close()

	today := time.Now().UTC().Truncate(24 * time.Hour)

	// Find all recurring template transactions.
	// A template is identified by having a frequency set and NOT being a child
	// (children are generated with source = 'recurring').
	rows, err := dbClient.Query(`
		SELECT id, user_id, household_id, budget_id, category_id, category_name,
		       type, amount, note, date, frequency, due_day
		FROM transactions
		WHERE frequency IS NOT NULL
		  AND frequency NOT IN ('', 'one-time')
		  AND COALESCE(source, '') != 'recurring'
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type template struct {
		ID          string
		UserID      string
		HouseholdID *string
		BudgetID    *string
		CategoryID  *string
		Category    *string
		Type        string
		Amount      float64
		Note        string
		Date        time.Time
		Frequency   string
		DueDay      *int
	}

	var templates []template
	for rows.Next() {
		var t template
		var hh, budID, catID, catName sql.NullString
		var dueDay sql.NullInt64
		if err := rows.Scan(&t.ID, &t.UserID, &hh, &budID, &catID, &catName,
			&t.Type, &t.Amount, &t.Note, &t.Date, &t.Frequency, &dueDay); err != nil {
			log.Printf("recurring: scan template: %v", err)
			continue
		}
		if hh.Valid {
			val := hh.String
			t.HouseholdID = &val
		}
		if budID.Valid {
			val := budID.String
			t.BudgetID = &val
		}
		if catID.Valid {
			val := catID.String
			t.CategoryID = &val
		}
		if catName.Valid {
			val := catName.String
			t.Category = &val
		}
		if dueDay.Valid {
			d := int(dueDay.Int64)
			t.DueDay = &d
		}
		templates = append(templates, t)
	}

	totalCreated := 0

	for _, tmpl := range templates {
		// Find the most recent generated occurrence for this template.
		var lastDate time.Time
		err := dbClient.QueryRow(`
			SELECT COALESCE(MAX(date), $2)
			FROM transactions
			WHERE note LIKE 'recurring:' || $1 || '%'
			  AND source = 'recurring'
		`, tmpl.ID, tmpl.Date).Scan(&lastDate)
		if err != nil {
			lastDate = tmpl.Date
		}

		// Step forward from lastDate by the frequency interval.
		nextDate := advanceDate(lastDate, tmpl.Frequency, tmpl.DueDay)
		for !nextDate.After(today) {
			txID := uuid.Must(uuid.NewV4()).String()
			source := "recurring"
			note := "recurring:" + tmpl.ID
			if tmpl.Note != "" {
				note = tmpl.Note
			}

			_, err := dbClient.Exec(`
				INSERT INTO transactions (id, user_id, household_id, budget_id, category_id,
				  category_name, type, amount, note, date, frequency, due_day, source)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			`,
				txID, tmpl.UserID, tmpl.HouseholdID, tmpl.BudgetID, tmpl.CategoryID,
				tmpl.Category, tmpl.Type, tmpl.Amount, note, nextDate,
				tmpl.Frequency, tmpl.DueDay, source,
			)
			if err != nil {
				log.Printf("recurring: insert failed for template %s date %s: %v", tmpl.ID, nextDate, err)
				break
			}
			totalCreated++
			nextDate = advanceDate(nextDate, tmpl.Frequency, tmpl.DueDay)
		}
	}

	log.Printf("recurring sync: created %d transactions from %d templates", totalCreated, len(templates))
	return totalCreated, nil
}

// advanceDate returns the next occurrence date given a frequency.
func advanceDate(from time.Time, frequency string, dueDay *int) time.Time {
	switch frequency {
	case "weekly":
		return from.AddDate(0, 0, 7)
	case "biweekly":
		return from.AddDate(0, 0, 14)
	case "monthly":
		if dueDay != nil && *dueDay >= 1 && *dueDay <= 28 {
			next := from.AddDate(0, 1, 0)
			return time.Date(next.Year(), next.Month(), *dueDay, 0, 0, 0, 0, time.UTC)
		}
		return addMonth(from)
	case "1st-15th":
		if from.Day() < 15 {
			return time.Date(from.Year(), from.Month(), 15, 0, 0, 0, 0, time.UTC)
		}
		return time.Date(from.Year(), from.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	default:
		return addMonth(from) // fallback to monthly
	}
}

// addMonth advances by one calendar month, clamping to the last day of the
// target month (e.g. Jan 31 → Feb 28).
func addMonth(from time.Time) time.Time {
	y, m, d := from.Year(), from.Month()+1, from.Day()
	if m > 12 {
		m = 1
		y++
	}
	// Find last day of target month.
	lastDay := time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if d > lastDay {
		d = lastDay
	}
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// StartRecurringTicker runs the recurring sync once per day in a background goroutine.
func StartRecurringTicker() {
	go func() {
		// Run once on startup.
		if created, err := RunRecurringSync(); err != nil {
			log.Printf("recurring ticker: initial sync failed: %v", err)
		} else {
			log.Printf("recurring ticker: initial sync created %d transactions", created)
		}

		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if created, err := RunRecurringSync(); err != nil {
				log.Printf("recurring ticker: sync failed: %v", err)
			} else {
				log.Printf("recurring ticker: created %d transactions", created)
			}
		}
	}()
}
