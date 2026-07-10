package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/models"
	"github.com/lib/pq"
)

// DashboardStatus is the "how are we doing right now?" answer for the dashboard.
// The signal engine is deterministic and server-side; the Headline is a warm
// one-liner (Haiku-authored when available, deterministic fallback otherwise).
type DashboardStatus struct {
	Scope     string           `json:"scope"`  // "household" | "personal"
	Status    string           `json:"status"` // "good" | "watch" | "alert"
	Headline  string           `json:"headline"`
	HeroLabel string           `json:"hero_label"`
	HeroValue float64          `json:"hero_value"`
	Signals   dashboardSignals `json:"signals"`
}

type dashboardSignals struct {
	IncomeMonth       float64 `json:"income_month"`
	ExpenseMonth      float64 `json:"expense_month"`
	CashFlowMonth     float64 `json:"cash_flow_month"`
	BudgetedMonth     float64 `json:"budgeted_month"`
	SpentMonth        float64 `json:"spent_month"`
	WithinBudget      bool    `json:"within_budget"`
	BillsOverdue      int     `json:"bills_overdue"`
	BillsDueSoon      int     `json:"bills_due_soon"`
	BillsCovered      bool    `json:"bills_covered"`
	TopCategory       string  `json:"top_category,omitempty"`
	TopCategoryAmount float64 `json:"top_category_amount,omitempty"`
}

// GetDashboardStatus computes the right-now financial health for the requested
// scope. scope=household (default) aggregates over all household members;
// scope=personal is just the caller. Solo users always get personal.
func GetDashboardStatus(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	scope := r.URL.Query().Get("scope")
	hh := db.ResolveHouseholdID(conn.Raw(), userID)

	// Resolve the set of member user IDs the status covers.
	var ids []string
	effectiveScope := "personal"
	if scope != "personal" && hh != "" {
		ids = householdMemberIDs(conn.Raw(), hh)
		if len(ids) > 0 {
			effectiveScope = "household"
		}
	}
	if len(ids) == 0 {
		ids = []string{userID}
	}

	sig := computeSignals(conn.Raw(), ids)
	status, reason := classifyStatus(sig)
	deterministic := deterministicHeadline(status, reason, sig)

	out := DashboardStatus{
		Scope:     effectiveScope,
		Status:    status,
		Headline:  authorHeadline(effectiveScope, status, reason, sig, deterministic),
		HeroLabel: "Cash flow this month",
		HeroValue: sig.CashFlowMonth,
		Signals:   sig,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func householdMemberIDs(conn *sql.DB, householdID string) []string {
	rows, err := conn.Query(`SELECT user_id::text FROM household_members WHERE household_id::text = $1`, householdID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

// computeSignals runs the deterministic, server-side math for the given users.
func computeSignals(conn *sql.DB, ids []string) dashboardSignals {
	var s dashboardSignals

	// Month cash flow — all income vs all expenses (paid bills included; they're
	// real money out). Transfers are excluded by type.
	_ = conn.QueryRow(`
		SELECT
			COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = ANY($1) AND type = 'income'  AND date >= date_trunc('month', CURRENT_DATE)), 0),
			COALESCE((SELECT SUM(amount) FROM transactions WHERE user_id = ANY($1) AND type = 'expense' AND date >= date_trunc('month', CURRENT_DATE)), 0)
	`, pq.Array(ids)).Scan(&s.IncomeMonth, &s.ExpenseMonth)
	s.CashFlowMonth = s.IncomeMonth - s.ExpenseMonth

	// Spent vs budgeted — spent excludes bill-payment transactions (they're
	// tracked as bills), matching the budget tab's definition of category spend.
	_ = conn.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM transactions
		WHERE user_id = ANY($1) AND type = 'expense'
		  AND date >= date_trunc('month', CURRENT_DATE)
		  AND id NOT IN (SELECT transaction_id FROM bill_payments WHERE transaction_id IS NOT NULL)
	`, pq.Array(ids)).Scan(&s.SpentMonth)

	_ = conn.QueryRow(`
		SELECT COALESCE(SUM(
			CASE frequency
				WHEN 'weekly'   THEN amount * 4
				WHEN 'biweekly' THEN amount * 2
				WHEN '1st-15th' THEN amount * 2
				ELSE amount
			END), 0)
		FROM budgets WHERE user_id = ANY($1) AND type = 'expense'
	`, pq.Array(ids)).Scan(&s.BudgetedMonth)
	// No budget set → we can't say they're "over" nothing; treat as within.
	s.WithinBudget = s.BudgetedMonth <= 0 || s.SpentMonth <= s.BudgetedMonth

	// Top spending category this month (supporting fact for the headline).
	_ = conn.QueryRow(`
		SELECT COALESCE(c.name, t.category_name, 'Uncategorized'), SUM(t.amount)
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = ANY($1) AND t.type = 'expense'
		  AND t.date >= date_trunc('month', CURRENT_DATE)
		GROUP BY 1 ORDER BY 2 DESC LIMIT 1
	`, pq.Array(ids)).Scan(&s.TopCategory, &s.TopCategoryAmount)

	// Bills — overdue / due-soon, computed with the same period logic as the
	// bills screen so the status agrees with what the user sees there.
	s.BillsOverdue, s.BillsDueSoon = billHealth(conn, ids)
	s.BillsCovered = s.BillsOverdue == 0

	return s
}

// billHealth counts overdue and due-soon (≤5 days) unpaid bills for the users,
// reusing the bill-period helpers so it matches the bills screen exactly.
func billHealth(conn *sql.DB, ids []string) (overdue, dueSoon int) {
	rows, err := conn.Query(`SELECT id, due_day, COALESCE(frequency, 'monthly') FROM bills WHERE user_id = ANY($1)`, pq.Array(ids))
	if err != nil {
		return 0, 0
	}
	defer rows.Close()

	now := time.Now().UTC()
	type bill struct {
		id     string
		dueDay int
		freq   string
	}
	var bills []bill
	for rows.Next() {
		var b bill
		if err := rows.Scan(&b.id, &b.dueDay, &b.freq); err == nil {
			bills = append(bills, b)
		}
	}

	for _, b := range bills {
		periodStart, periodEnd := computeBillingPeriod(b.dueDay, b.freq, now)
		var paid int
		_ = conn.QueryRow(`
			SELECT COUNT(*) FROM bill_payments
			WHERE bill_id = $1 AND period_start = $2 AND period_end = $3
		`, b.id, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")).Scan(&paid)
		if paid > 0 {
			continue // paid this period
		}
		if isDueDatePassed(b.dueDay, b.freq, periodStart, now) {
			overdue++
			continue
		}
		// Due within the next 5 days?
		if _, dueDate := daysUntilNextDue(b.dueDay, b.freq, now); dueDate.Sub(now).Hours() <= 5*24 {
			dueSoon++
		}
	}
	return overdue, dueSoon
}

// classifyStatus applies worst-signal-wins and returns the level + the dominant
// reason code that drives the headline.
func classifyStatus(s dashboardSignals) (status, reason string) {
	overBudget := s.BudgetedMonth > 0 && s.SpentMonth > s.BudgetedMonth
	nearBudget := s.BudgetedMonth > 0 && s.SpentMonth >= 0.9*s.BudgetedMonth

	switch {
	case s.BillsOverdue > 0:
		return "alert", "bill_overdue"
	case s.CashFlowMonth < 0:
		return "alert", "negative_cash_flow"
	case overBudget:
		return "alert", "over_budget"
	case s.BillsDueSoon > 0:
		return "watch", "bill_due_soon"
	case nearBudget:
		return "watch", "near_budget"
	default:
		return "good", "on_track"
	}
}

func deterministicHeadline(status, reason string, s dashboardSignals) string {
	switch reason {
	case "bill_overdue":
		if s.BillsOverdue == 1 {
			return "A bill is overdue — let's get it covered."
		}
		return fmt.Sprintf("%d bills are overdue — let's get them covered.", s.BillsOverdue)
	case "negative_cash_flow":
		return "You've spent more than you've brought in this month."
	case "over_budget":
		return "You're over budget this month — worth a look."
	case "bill_due_soon":
		return pluralize(s.BillsDueSoon, "A bill is due in the next few days.", "A few bills are due soon.")
	case "near_budget":
		return "You're getting close to your budget for the month."
	default:
		return "You're on track — bills covered and within budget."
	}
}

// ─── Headline authorship (Haiku, cached, graceful) ───────────────

type cachedHeadline struct {
	text   string
	expiry time.Time
}

var (
	headlineCache   = map[string]cachedHeadline{}
	headlineCacheMu sync.Mutex
)

const headlineAuthorSystem = `You are CoupleFlow AI, a warm, encouraging financial advisor for couples. Rewrite the given status into ONE short, plain-language sentence a couple sees at the top of their dashboard answering "how are we doing right now?".

Rules:
- One sentence, under 16 words, no emoji.
- Use the provided numbers exactly; never invent figures.
- Match the tone to the status: good = affirming, watch = a gentle heads-up, alert = clear but kind, never alarming.
- Speak to "you" (the couple). Don't restate the status word itself.`

// authorHeadline upgrades the deterministic headline with a warmer AI-authored
// one when the model is available. Cached by the rounded signal signature so we
// don't re-author identical states; falls back to deterministic on any failure.
func authorHeadline(scope, status, reason string, s dashboardSignals, deterministic string) string {
	client := ai.NewClient()
	if client == nil || !client.IsAvailable() {
		return deterministic
	}

	key := fmt.Sprintf("%s|%s|%s|%.0f|%.0f|%.0f|%d|%d", scope, status, reason,
		s.CashFlowMonth, s.SpentMonth, s.BudgetedMonth, s.BillsOverdue, s.BillsDueSoon)

	headlineCacheMu.Lock()
	if c, ok := headlineCache[key]; ok && time.Now().Before(c.expiry) {
		headlineCacheMu.Unlock()
		return c.text
	}
	headlineCacheMu.Unlock()

	facts, _ := json.Marshal(map[string]interface{}{
		"status":              status,
		"cash_flow_month":     round2(s.CashFlowMonth),
		"spent_month":         round2(s.SpentMonth),
		"budgeted_month":      round2(s.BudgetedMonth),
		"within_budget":       s.WithinBudget,
		"bills_overdue":       s.BillsOverdue,
		"bills_due_soon":      s.BillsDueSoon,
		"top_category":        s.TopCategory,
		"top_category_amount": round2(s.TopCategoryAmount),
		"fallback_sentence":   deterministic,
	})

	resp, err := client.SendMessage(models.ClaudeRequest{
		Model:     ai.ClassifyModel,
		MaxTokens: 128,
		System:    headlineAuthorSystem,
		Messages:  []models.ClaudeMessage{{Role: "user", Content: string(facts)}},
	})
	if err != nil {
		log.Printf("dashboard headline author error: %v", err)
		return deterministic
	}

	var text strings.Builder
	for _, b := range resp.Content {
		if b.Type == "text" {
			text.WriteString(b.Text)
		}
	}
	headline := strings.TrimSpace(text.String())
	if headline == "" {
		return deterministic
	}

	headlineCacheMu.Lock()
	headlineCache[key] = cachedHeadline{text: headline, expiry: time.Now().Add(time.Hour)}
	headlineCacheMu.Unlock()
	return headline
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}
