package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/aboogie/budget-backend/db"
)

// AttentionItem is a single actionable signal shown on the dashboard.
// Action is a stable token the frontend uses to dispatch the right CTA;
// Payload carries the parameters the action needs (e.g. enrollment_id).
type AttentionItem struct {
	ID       string                 `json:"id"`
	Priority int                    `json:"priority"` // lower = more urgent
	Title    string                 `json:"title"`
	Body     string                 `json:"body,omitempty"`
	Icon     string                 `json:"icon"`     // Ionicons name
	Color    string                 `json:"color"`    // hex
	CtaLabel string                 `json:"cta_label"`
	Action   string                 `json:"action"`   // "reconnect" | "mark_paid" | "review" | "open_budget" | "ai_categorize"
	Payload  map[string]interface{} `json:"payload,omitempty"`
}

// GET /auth/dashboard/attention
// Returns up to N (default 3) prioritized signals the user could act on now.
// Empty array when there's nothing to flag — the frontend hides the card.
func GetAttention(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	var items []AttentionItem

	// ── Rule 1: disconnected linked accounts (Teller-style reauth) ───────────
	rows, err := dbClient.Query(`
		SELECT id, item_id, COALESCE(institution_name, 'Your bank'), provider
		FROM linked_accounts
		WHERE user_id = $1 AND item_status = 'login_required'
		ORDER BY updated_at DESC
	`, userID)
	if err == nil {
		for rows.Next() {
			var accountID, itemID, institution, provider string
			if err := rows.Scan(&accountID, &itemID, &institution, &provider); err == nil {
				if provider != "teller" {
					// Only Teller has a reconnect flow wired up today.
					continue
				}
				items = append(items, AttentionItem{
					ID:       "reconnect-" + accountID,
					Priority: 10,
					Title:    institution + " needs to reconnect",
					Body:     "Your bank dropped the connection. Re-authenticate to keep syncing.",
					Icon:     "warning-outline",
					Color:    "#f59e0b",
					CtaLabel: "Reconnect",
					Action:   "reconnect",
					Payload: map[string]interface{}{
						"enrollment_id": itemID,
					},
				})
			}
		}
		rows.Close()
	}

	// ── Rule 2: bills due in the next 7 days, not yet paid for current period
	now := time.Now().UTC()
	billRows, err := dbClient.Query(`
		SELECT id, name, amount_due, due_day, COALESCE(frequency,'monthly')
		FROM bills
		WHERE user_id = $1
	`, userID)
	if err == nil {
		type billRec struct {
			ID        string
			Name      string
			Amount    float64
			DueDay    int
			Frequency string
		}
		var bills []billRec
		for billRows.Next() {
			var b billRec
			if scanErr := billRows.Scan(&b.ID, &b.Name, &b.Amount, &b.DueDay, &b.Frequency); scanErr == nil {
				bills = append(bills, b)
			}
		}
		billRows.Close()

		for _, b := range bills {
			daysUntil, dueDate := daysUntilNextDue(b.DueDay, b.Frequency, now)
			if daysUntil < 0 || daysUntil > 7 {
				continue
			}
			// Skip if already paid for the current period.
			periodStart, periodEnd := computeBillingPeriod(b.DueDay, b.Frequency, dueDate)
			var paid int
			_ = dbClient.QueryRow(`
				SELECT COUNT(*) FROM bill_payments
				WHERE bill_id = $1 AND period_start = $2 AND period_end = $3
			`, b.ID, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")).Scan(&paid)
			if paid > 0 {
				continue
			}
			items = append(items, AttentionItem{
				ID:       "bill-" + b.ID,
				Priority: 20 + daysUntil, // sooner due → higher priority
				Title:    b.Name + " due " + relativeDay(daysUntil),
				Body:     formatUSD(b.Amount),
				Icon:     "receipt-outline",
				Color:    "#60a5fa",
				CtaLabel: "Mark paid",
				Action:   "mark_paid",
				Payload: map[string]interface{}{
					"bill_id": b.ID,
					"amount":  b.Amount,
				},
			})
		}
	}

	// ── Rule 3: budget overruns (current month) ──────────────────────────────
	overRows, err := dbClient.Query(`
		WITH spent AS (
			SELECT t.category_id, SUM(t.amount) AS total
			FROM transactions t
			WHERE t.user_id = $1
			  AND t.type = 'expense'
			  AND COALESCE(t.source,'') != 'bill'
			  AND t.date >= date_trunc('month', NOW())
			  AND t.date < date_trunc('month', NOW()) + INTERVAL '1 month'
			GROUP BY t.category_id
		)
		SELECT b.category_id::text, c.name, b.amount, s.total
		FROM budgets b
		JOIN categories c ON c.id = b.category_id
		JOIN spent s ON s.category_id = b.category_id
		WHERE b.user_id = $1 AND b.type = 'expense'
		  AND s.total > b.amount
		ORDER BY (s.total - b.amount) DESC
		LIMIT 3
	`, userID)
	if err == nil {
		for overRows.Next() {
			var categoryID, catName string
			var budgeted, spent float64
			if scanErr := overRows.Scan(&categoryID, &catName, &budgeted, &spent); scanErr == nil {
				over := spent - budgeted
				items = append(items, AttentionItem{
					ID:       "overrun-" + categoryID,
					Priority: 40,
					Title:    formatUSD(over) + " over " + catName,
					Body:     "Spent " + formatUSD(spent) + " of " + formatUSD(budgeted) + " budget this month",
					Icon:     "alert-circle-outline",
					Color:    "#ef4444",
					CtaLabel: "Open budget",
					Action:   "open_budget",
					Payload: map[string]interface{}{
						"category_id": categoryID,
					},
				})
			}
		}
		overRows.Close()
	}

	// ── Rule 4: unverified transactions ──────────────────────────────────────
	var unverifiedCount int
	_ = dbClient.QueryRow(`
		SELECT COUNT(*)
		FROM transactions
		WHERE user_id = $1
		  AND type IN ('income','expense')
		  AND COALESCE(user_verified, false) = false
		  AND COALESCE(match_confidence, '') != 'exact'
		  AND category_id IS NOT NULL
	`, userID).Scan(&unverifiedCount)
	if unverifiedCount >= 5 {
		items = append(items, AttentionItem{
			ID:       "review",
			Priority: 50,
			Title:    pluralize(unverifiedCount, "transaction needs", "transactions need") + " review",
			Body:     "Confirm the auto-applied categories or change them.",
			Icon:     "checkmark-circle-outline",
			Color:    "#10b981",
			CtaLabel: "Review",
			Action:   "review",
		})
	}

	// ── Rule 5: uncategorized backlog ────────────────────────────────────────
	var uncategorizedCount int
	_ = dbClient.QueryRow(`
		SELECT COUNT(*)
		FROM transactions
		WHERE user_id = $1
		  AND type IN ('income','expense')
		  AND category_id IS NULL
		  AND source IN ('teller','bank','flinks')
	`, userID).Scan(&uncategorizedCount)
	if uncategorizedCount >= 10 {
		items = append(items, AttentionItem{
			ID:       "ai-categorize",
			Priority: 60,
			Title:    pluralize(uncategorizedCount, "transaction lacks", "transactions lack") + " a category",
			Body:     "Let AI suggest categories in one tap.",
			Icon:     "sparkles-outline",
			Color:    "#c084fc",
			CtaLabel: "Categorize",
			Action:   "ai_categorize",
		})
	}

	// Sort by priority asc and cap at 3.
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].Priority < items[j].Priority
	})
	if len(items) > 3 {
		items = items[:3]
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"items": items,
		"count": len(items),
	}); err != nil {
		log.Printf("GetAttention encode error: %v", err)
	}
}

// netWorthSnapshotRequest is the body for POST /auth/dashboard/networth/snapshot.
// The client sends the components computed from its in-memory state; the
// backend persists today's snapshot and returns history. Sending the
// components (rather than recomputing on the server) avoids duplicating the
// account/investment/property/debt aggregation logic in two places.
type netWorthSnapshotRequest struct {
	Cash        float64 `json:"cash"`
	Investments float64 `json:"investments"`
	Properties  float64 `json:"properties"`
	Debt        float64 `json:"debt"`
	Total       float64 `json:"total"`
}

type netWorthSnapshotPoint struct {
	Date  string  `json:"date"`
	Total float64 `json:"total"`
}

// POST /auth/dashboard/networth/snapshot?days=30
// Upserts today's snapshot and returns the trailing window of daily totals
// (default 30 days) for sparkline rendering.
func RecordNetWorthSnapshot(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	var req netWorthSnapshotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	days := 30
	if v := r.URL.Query().Get("days"); v != "" {
		if n, perr := strconv.Atoi(v); perr == nil && n > 0 && n <= 365 {
			days = n
		}
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	if _, err := dbClient.Exec(`
		INSERT INTO net_worth_snapshots
			(user_id, snapshot_date, cash, investments, properties, debt, total)
		VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
			cash        = EXCLUDED.cash,
			investments = EXCLUDED.investments,
			properties  = EXCLUDED.properties,
			debt        = EXCLUDED.debt,
			total       = EXCLUDED.total,
			updated_at  = NOW()
	`, userID, req.Cash, req.Investments, req.Properties, req.Debt, req.Total); err != nil {
		log.Printf("RecordNetWorthSnapshot upsert error: %v", err)
		http.Error(w, "Failed to record snapshot", http.StatusInternalServerError)
		return
	}

	rows, err := dbClient.Query(`
		SELECT to_char(snapshot_date, 'YYYY-MM-DD'), total
		FROM net_worth_snapshots
		WHERE user_id = $1
		  AND snapshot_date >= CURRENT_DATE - ($2::int - 1)
		ORDER BY snapshot_date ASC
	`, userID, days)
	if err != nil {
		log.Printf("RecordNetWorthSnapshot select error: %v", err)
		http.Error(w, "Failed to load history", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	snapshots := make([]netWorthSnapshotPoint, 0)
	for rows.Next() {
		var p netWorthSnapshotPoint
		if err := rows.Scan(&p.Date, &p.Total); err == nil {
			snapshots = append(snapshots, p)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"snapshots": snapshots,
		"days":      days,
	})
}

// daysUntilNextDue returns the integer days from `now` until the next occurrence
// of a bill with the given due_day and frequency. Also returns the absolute
// next-due date so callers can derive the billing period for it. Negative when
// already overdue this period.
func daysUntilNextDue(dueDay int, frequency string, now time.Time) (int, time.Time) {
	y, m, _ := now.Date()
	switch frequency {
	case "weekly":
		// dueDay 1..7 (Mon..Sun). Find next instance.
		wd := int(now.Weekday())
		if wd == 0 {
			wd = 7
		}
		delta := dueDay - wd
		if delta < 0 {
			delta += 7
		}
		next := now.AddDate(0, 0, delta)
		next = time.Date(next.Year(), next.Month(), next.Day(), 0, 0, 0, 0, time.UTC)
		return delta, next
	case "biweekly":
		next := time.Date(y, m, dueDay, 0, 0, 0, 0, time.UTC)
		if now.After(next.AddDate(0, 0, 7)) {
			next = next.AddDate(0, 0, 14)
		} else if now.After(next) {
			next = next.AddDate(0, 0, 14)
		}
		return int(next.Sub(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)).Hours() / 24), next
	default:
		// monthly, quarterly, yearly — next instance is this month's dueDay, or next month.
		next := time.Date(y, m, dueDay, 0, 0, 0, 0, time.UTC)
		if now.Day() > dueDay {
			next = next.AddDate(0, 1, 0)
		}
		days := int(next.Sub(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)).Hours() / 24)
		return days, next
	}
}

func relativeDay(days int) string {
	switch days {
	case 0:
		return "today"
	case 1:
		return "tomorrow"
	default:
		return "in " + itoa(days) + " days"
	}
}

func pluralize(n int, singular, plural string) string {
	if n == 1 {
		return "1 " + singular
	}
	return itoa(n) + " " + plural
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func formatUSD(v float64) string {
	if v < 0 {
		return "-$" + formatNumber(-v)
	}
	return "$" + formatNumber(v)
}

// formatNumber renders a non-negative float with 2 decimals and thousands
// separators (e.g. 1234.5 -> "1,234.50"). Avoids pulling in a heavier dep.
func formatNumber(v float64) string {
	// Round to 2 decimals
	whole := int64(v)
	frac := int64((v - float64(whole)) * 100)
	if frac < 0 {
		frac = -frac
	}
	wholeStr := itoa64WithCommas(whole)
	if frac < 10 {
		return wholeStr + ".0" + itoa(int(frac))
	}
	return wholeStr + "." + itoa(int(frac))
}

func itoa64WithCommas(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	out := make([]byte, 0, len(digits)+len(digits)/3)
	for i, d := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, d)
	}
	if neg {
		out = append([]byte{'-'}, out...)
	}
	return string(out)
}
