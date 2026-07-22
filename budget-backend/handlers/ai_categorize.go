package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/internal/categories"
)

const (
	aiCategorizeMaxMerchants = 200 // safety cap on LLM spend per call
	aiCategorizeBatchSize    = 50  // merchants per Claude request
)

// AICategorizeTransactions runs the Claude LLM fallback over the caller's
// still-uncategorized bank transactions. Distinct merchants the deterministic
// resolver could not place are sent to Claude, cached as auto-created merchant
// rules (so future syncs never call the LLM for that merchant again), and
// applied to matching transactions with 'ai' confidence — applied so budgets
// are correct, flagged so the user can review.
// POST /auth/transactions/ai-categorize
func AICategorizeTransactions(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	client := ai.NewClient()
	if !client.IsAvailable() {
		http.Error(w, "AI categorization unavailable (ANTHROPIC_API_KEY not set)", http.StatusServiceUnavailable)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	merchants, classified, applied, err := RunAICategorization(dbClient, userID)
	if err != nil {
		log.Printf("ai-categorize: %v", err)
		http.Error(w, "AI classification failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	log.Printf("ai-categorize: user=%s merchants=%d classified=%d applied=%d", userID, merchants, classified, applied)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{
		"merchants":  merchants,
		"classified": classified,
		"applied":    applied,
	})
}

// RunAICategorization is the reusable core of the LLM categorization fallback.
// It is called by the HTTP handler above and automatically after a bank sync
// (see handlers/teller.go) so freshly linked accounts categorize without the
// user having to press anything. Returns (merchants considered, classified,
// transactions updated). A missing API key returns (0,0,0,nil) — silently
// skipping is correct for the background path.
func RunAICategorization(dbClient *db.DB, userID string) (int, int, int, error) {
	client := ai.NewClient()
	if !client.IsAvailable() {
		return 0, 0, 0, nil
	}

	var householdID *string
	if hh := db.ResolveHouseholdID(dbClient.Conn, userID); hh != "" {
		householdID = &hh
	}

	// 1. Distinct uncategorized merchants (+ a sample raw description). A NULL
	//    category_id means the deterministic resolver already couldn't place it.
	rows, err := dbClient.Query(`
		SELECT merchant_normalized, MIN(note)
		FROM transactions
		WHERE user_id = $1
		  AND source IN `+bankSourcesSQL+`
		  AND type != 'transfer'
		  AND merchant_normalized IS NOT NULL AND merchant_normalized <> ''
		  AND category_id IS NULL
		  AND COALESCE(user_verified, false) = false
		GROUP BY merchant_normalized
		LIMIT $2
	`, userID, aiCategorizeMaxMerchants)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("query merchants: %w", err)
	}
	var merchants []categories.MerchantInput
	for rows.Next() {
		var name string
		var sample sql.NullString
		if err := rows.Scan(&name, &sample); err == nil {
			merchants = append(merchants, categories.MerchantInput{Name: name, Sample: sample.String})
		}
	}
	rows.Close()

	if len(merchants) == 0 {
		return 0, 0, 0, nil
	}

	// 2. Categories Claude may choose from — system defaults + the user's own.
	catRows, err := dbClient.Query(`
		SELECT c.id, c.name, COALESCE(p.name, '')
		FROM categories c
		LEFT JOIN categories p ON c.parent_id = p.id
		WHERE c.user_id IS NULL OR c.user_id = $1
	`, userID)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("query categories: %w", err)
	}
	var cats []categories.CategoryOption
	validCat := map[string]bool{}
	for catRows.Next() {
		var c categories.CategoryOption
		if err := catRows.Scan(&c.ID, &c.Name, &c.Parent); err == nil {
			cats = append(cats, c)
			validCat[c.ID] = true
		}
	}
	catRows.Close()
	if len(cats) == 0 {
		return 0, 0, 0, fmt.Errorf("no categories available")
	}

	// 3. Classify in batches; cache each answer as a rule and apply it.
	classified, applied := 0, 0
	for start := 0; start < len(merchants); start += aiCategorizeBatchSize {
		end := start + aiCategorizeBatchSize
		if end > len(merchants) {
			end = len(merchants)
		}

		results, cerr := categories.ClassifyMerchants(client, merchants[start:end], cats)
		if cerr != nil {
			return len(merchants), classified, applied, fmt.Errorf("classify batch: %w", cerr)
		}

		for _, res := range results {
			// Skip when the model declined to guess or returned an unknown id.
			if res.CategoryID == "" || !validCat[res.CategoryID] {
				continue
			}
			classified++

			// Cache as an auto-created rule — future syncs categorize this
			// merchant household-wide without another LLM call.
			upsertMerchantRule(dbClient, userID, householdID, res.Merchant, res.CategoryID, true)

			// Apply to the user's matching uncategorized transactions.
			upd, uerr := dbClient.Exec(`
				UPDATE transactions
				SET category_id = $1, match_confidence = 'ai', updated_at = NOW()
				WHERE user_id = $2 AND merchant_normalized = $3
				  AND category_id IS NULL
				  AND COALESCE(user_verified, false) = false
			`, res.CategoryID, userID, res.Merchant)
			if uerr != nil {
				log.Printf("ai-categorize: apply %s: %v", res.Merchant, uerr)
				continue
			}
			if n, _ := upd.RowsAffected(); n > 0 {
				applied += int(n)
			}
		}
	}

	return len(merchants), classified, applied, nil
}
