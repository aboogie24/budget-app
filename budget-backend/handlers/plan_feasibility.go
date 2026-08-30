package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/models"
)

// SavingsFeasibility is the deterministic answer to "can we realistically hit
// this savings goal by this date?" plus (when not) the three ways out.
type SavingsFeasibility struct {
	Months           int     `json:"months"`
	RequiredMonthly  float64 `json:"required_monthly"`  // to hit target by date
	SurplusMonthly   float64 `json:"surplus_monthly"`   // income - expenses this month
	CommittedMonthly float64 `json:"committed_monthly"` // already allocated by active plans
	AvailableMonthly float64 `json:"available_monthly"` // surplus - committed (the honest free number)
	Feasible         bool    `json:"feasible"`
	// When not feasible, the three options:
	RealisticDate string  `json:"realistic_date,omitempty"` // earliest date at AvailableMonthly
	LowerTarget   float64 `json:"lower_target,omitempty"`   // target reachable by the date
	FreeUpMonthly float64 `json:"free_up_monthly,omitempty"`// extra $/mo needed to make it
	// AI-authored realistic assessment (deterministic fallback if unavailable).
	Pointer string `json:"pointer"`
}

// scopeMemberIDs returns the household member ids (or [userID] when solo).
func scopeMemberIDs(conn *sql.DB, userID string) []string {
	if hh := db.ResolveHouseholdID(conn, userID); hh != "" {
		if m := householdMemberIDs(conn, hh); len(m) > 0 {
			return m
		}
	}
	return []string{userID}
}

// computeSavingsFeasibility runs the deterministic math. targetDate is YYYY-MM-DD.
func computeSavingsFeasibility(conn *sql.DB, userID string, target, current float64, targetDate string) SavingsFeasibility {
	f := SavingsFeasibility{}
	f.Months = monthsUntil(targetDate)
	need := target - current
	if need < 0 {
		need = 0
	}
	if f.Months > 0 {
		f.RequiredMonthly = math.Ceil(need/float64(f.Months)*100) / 100
	}

	// Available = this-month surplus minus what active plans already commit.
	f.SurplusMonthly = round2(computeSignals(conn, scopeMemberIDs(conn, userID)).CashFlowMonth)
	committed := 0.0
	for _, v := range effectiveMonthlyByTarget(conn, userID) {
		committed += v
	}
	f.CommittedMonthly = round2(committed)
	f.AvailableMonthly = round2(f.SurplusMonthly - f.CommittedMonthly)

	f.Feasible = need == 0 || (f.RequiredMonthly > 0 && f.RequiredMonthly <= f.AvailableMonthly)

	if !f.Feasible && need > 0 {
		if f.AvailableMonthly > 0 {
			monthsNeeded := int(math.Ceil(need / f.AvailableMonthly))
			if monthsNeeded < 1 {
				monthsNeeded = 1
			}
			f.RealisticDate = time.Now().UTC().AddDate(0, monthsNeeded, 0).Format("2006-01-02")
			f.LowerTarget = round2(current + f.AvailableMonthly*float64(f.Months))
		} else {
			// No free money at all — can't project a date from the current surplus.
			f.LowerTarget = round2(current)
		}
		f.FreeUpMonthly = round2(f.RequiredMonthly - f.AvailableMonthly)
		if f.FreeUpMonthly < 0 {
			f.FreeUpMonthly = 0
		}
	}
	return f
}

// AssessSavingsFeasibility is the endpoint the guided flow calls as the couple
// sets the amount and date. POST /auth/plans/savings-feasibility
// Body: { target_amount, current_amount, target_date }
func AssessSavingsFeasibility(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Name          string  `json:"name"`
		TargetAmount  float64 `json:"target_amount"`
		CurrentAmount float64 `json:"current_amount"`
		TargetDate    string  `json:"target_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if body.TargetDate == "" || body.TargetAmount <= 0 {
		http.Error(w, "target_amount and target_date are required", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	f := computeSavingsFeasibility(conn.Raw(), userID, body.TargetAmount, body.CurrentAmount, body.TargetDate)
	f.Pointer = authorFeasibilityPointer(body.Name, body.TargetDate, f)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(f)
}

// ─── AI-authored realistic pointer (Haiku, cached, graceful) ─────

var (
	feasibilityCache   = map[string]cachedHeadline{}
	feasibilityCacheMu sync.Mutex
)

const feasibilitySystem = `You are CoupleFlow AI, a warm, realistic financial advisor for couples. Given the deterministic numbers for a savings goal, write ONE short, encouraging-but-honest assessment (1-2 sentences, under 40 words, no emoji).

Rules:
- Use the numbers exactly; never invent figures.
- If feasible: affirm it and name the monthly amount.
- If not feasible: be kind and concrete — mention the realistic date, a lower target, OR freeing up the gap, whichever is most useful. Never scold.`

// authorFeasibilityPointer upgrades a deterministic sentence with a warm
// AI-authored one when the model is available; caches by the rounded numbers.
func authorFeasibilityPointer(name, targetDate string, f SavingsFeasibility) string {
	det := deterministicPointer(name, targetDate, f)

	client := ai.NewClient()
	if client == nil || !client.IsAvailable() {
		return det
	}
	key := fmt.Sprintf("%v|%.0f|%.0f|%.0f|%d|%s", f.Feasible, f.RequiredMonthly, f.AvailableMonthly, f.FreeUpMonthly, f.Months, f.RealisticDate)
	feasibilityCacheMu.Lock()
	if c, ok := feasibilityCache[key]; ok && time.Now().Before(c.expiry) {
		feasibilityCacheMu.Unlock()
		return c.text
	}
	feasibilityCacheMu.Unlock()

	facts, _ := json.Marshal(map[string]interface{}{
		"goal_name":         name,
		"target_date":       targetDate,
		"months":            f.Months,
		"required_monthly":  f.RequiredMonthly,
		"available_monthly": f.AvailableMonthly,
		"feasible":          f.Feasible,
		"realistic_date":    f.RealisticDate,
		"lower_target":      f.LowerTarget,
		"free_up_monthly":   f.FreeUpMonthly,
		"fallback_sentence": det,
	})
	resp, err := client.SendMessage(models.ClaudeRequest{
		Model:     ai.ClassifyModel,
		MaxTokens: 160,
		System:    feasibilitySystem,
		Messages:  []models.ClaudeMessage{{Role: "user", Content: string(facts)}},
	})
	if err != nil {
		log.Printf("feasibility pointer author error: %v", err)
		return det
	}
	var text strings.Builder
	for _, b := range resp.Content {
		if b.Type == "text" {
			text.WriteString(b.Text)
		}
	}
	out := strings.TrimSpace(text.String())
	if out == "" {
		return det
	}
	feasibilityCacheMu.Lock()
	feasibilityCache[key] = cachedHeadline{text: out, expiry: time.Now().Add(time.Hour)}
	feasibilityCacheMu.Unlock()
	return out
}

func deterministicPointer(name, targetDate string, f SavingsFeasibility) string {
	label := name
	if label == "" {
		label = "this goal"
	}
	if f.Feasible {
		return fmt.Sprintf("You can hit %s by %s at about $%.0f/mo — it fits your free cash flow.", label, targetDate, f.RequiredMonthly)
	}
	if f.AvailableMonthly <= 0 {
		return fmt.Sprintf("Right now there's no free cash flow to put toward %s — you'd need to free up about $%.0f/mo first.", label, f.FreeUpMonthly)
	}
	if f.RealisticDate != "" {
		return fmt.Sprintf("%s by %s needs $%.0f/mo but you have about $%.0f free — realistic date is %s, or free up $%.0f/mo.",
			label, targetDate, f.RequiredMonthly, f.AvailableMonthly, f.RealisticDate, f.FreeUpMonthly)
	}
	return fmt.Sprintf("%s needs $%.0f/mo but only $%.0f is free — consider a later date or freeing up $%.0f/mo.",
		label, f.RequiredMonthly, f.AvailableMonthly, f.FreeUpMonthly)
}
