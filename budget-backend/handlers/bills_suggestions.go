package handlers

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/google/uuid"
)

// billSuggestionRow is one transaction loaded into the candidate pool.
type billSuggestionRow struct {
	ID         string
	Date       time.Time
	Amount     float64
	CategoryID *string
	CatName    *string
}

// BillSuggestion is what we return to the client per detected recurring merchant.
type BillSuggestion struct {
	MerchantNormalized   string   `json:"merchant_normalized"`
	DisplayName          string   `json:"display_name"`
	Frequency            string   `json:"frequency"`
	Amount               float64  `json:"amount"`
	AmountVariance       string   `json:"amount_variance"` // "fixed" | "approximate"
	DueDay               int      `json:"due_day"`
	CategoryID           *string  `json:"category_id"`
	CategoryName         *string  `json:"category_name"`
	OccurrenceCount      int      `json:"occurrence_count"`
	FirstSeen            string   `json:"first_seen"`
	LastSeen             string   `json:"last_seen"`
	SampleTransactionIDs []string `json:"sample_transaction_ids"`
}

// cadenceFromMedianGap maps a median day-gap onto a standard frequency string.
// Returns "" when the gap doesn't fit any recognized cadence — that means the
// merchant recurs but not on a billable schedule (e.g. groceries).
func cadenceFromMedianGap(medianDays float64) string {
	switch {
	case medianDays >= 6 && medianDays <= 8:
		return "weekly"
	case medianDays >= 13 && medianDays <= 15:
		return "biweekly"
	case medianDays >= 27 && medianDays <= 33:
		return "monthly"
	case medianDays >= 88 && medianDays <= 92:
		return "quarterly"
	case medianDays >= 360 && medianDays <= 370:
		return "yearly"
	default:
		return ""
	}
}

func median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	mid := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return (sorted[mid-1] + sorted[mid]) / 2
	}
	return sorted[mid]
}

// modeDayOfMonth returns the most common day-of-month from the given dates.
// Ties are broken by the most recent date's day.
func modeDayOfMonth(dates []time.Time) int {
	counts := map[int]int{}
	for _, d := range dates {
		counts[d.Day()]++
	}
	bestDay, bestCount := dates[len(dates)-1].Day(), 0
	for day, c := range counts {
		if c > bestCount {
			bestDay, bestCount = day, c
		}
	}
	return bestDay
}

// GET /auth/bills/suggestions?lookback_days=180&min_occurrences=3
func GetBillSuggestions(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	lookbackDays := 180
	if v := r.URL.Query().Get("lookback_days"); v != "" {
		if n, perr := strconv.Atoi(v); perr == nil && n > 0 && n <= 730 {
			lookbackDays = n
		}
	}
	minOccurrences := 3
	if v := r.URL.Query().Get("min_occurrences"); v != "" {
		if n, perr := strconv.Atoi(v); perr == nil && n >= 2 && n <= 50 {
			minOccurrences = n
		}
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	cutoff := time.Now().AddDate(0, 0, -lookbackDays)

	// Pull every bank-synced expense in the lookback window for this user with
	// a normalized merchant set, skipping:
	//   - merchants the user has explicitly dismissed
	//   - merchants already covered by an existing bill (any tx for that
	//     merchant is linked via bill_payments.transaction_id)
	rows, err := client.Query(`
		SELECT t.id, t.merchant_normalized, t.date, t.amount,
		       t.category_id, COALESCE(c.name, t.category_name)
		FROM transactions t
		LEFT JOIN categories c ON c.id = t.category_id
		WHERE t.user_id = $1
		  AND t.type = 'expense'
		  AND t.source IN ('teller','bank','flinks')
		  AND t.merchant_normalized IS NOT NULL
		  AND t.merchant_normalized <> ''
		  AND t.date >= $2
		  AND NOT EXISTS (
		      SELECT 1 FROM bill_suggestion_dismissals d
		      WHERE d.user_id = t.user_id
		        AND d.merchant_normalized = t.merchant_normalized
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM transactions t2
		      JOIN bill_payments bp ON bp.transaction_id = t2.id
		      WHERE t2.user_id = t.user_id
		        AND t2.merchant_normalized = t.merchant_normalized
		  )
		ORDER BY t.merchant_normalized, t.date
	`, userID, cutoff)
	if err != nil {
		log.Printf("GetBillSuggestions query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type group struct {
		rows         []billSuggestionRow
		categoryID   *string
		categoryName *string
	}
	groups := map[string]*group{}
	for rows.Next() {
		var (
			id, merch                       string
			amt                             float64
			date                            time.Time
			catID, catName                  *string
		)
		if err := rows.Scan(&id, &merch, &date, &amt, &catID, &catName); err != nil {
			continue
		}
		g, ok := groups[merch]
		if !ok {
			g = &group{}
			groups[merch] = g
		}
		g.rows = append(g.rows, billSuggestionRow{ID: id, Date: date, Amount: amt, CategoryID: catID, CatName: catName})
		// Take the most recent non-nil category as the suggestion's category.
		if catID != nil {
			g.categoryID = catID
			g.categoryName = catName
		}
	}

	suggestions := make([]BillSuggestion, 0)
	for merch, g := range groups {
		if len(g.rows) < minOccurrences {
			continue
		}

		// Compute gaps in days between consecutive sorted dates.
		gaps := make([]float64, 0, len(g.rows)-1)
		dates := make([]time.Time, len(g.rows))
		amounts := make([]float64, len(g.rows))
		for i, r := range g.rows {
			dates[i] = r.Date
			amounts[i] = r.Amount
			if i > 0 {
				gaps = append(gaps, g.rows[i].Date.Sub(g.rows[i-1].Date).Hours()/24)
			}
		}
		freq := cadenceFromMedianGap(median(gaps))
		if freq == "" {
			continue // recurring but not on a billable cadence
		}

		// Amount stats: mean + coefficient of variation.
		var sum float64
		for _, a := range amounts {
			sum += a
		}
		mean := sum / float64(len(amounts))
		var sqSum float64
		for _, a := range amounts {
			sqSum += (a - mean) * (a - mean)
		}
		stddev := math.Sqrt(sqSum / float64(len(amounts)))
		variance := "fixed"
		if mean > 0 && stddev/mean > 0.15 {
			variance = "approximate"
		}

		// Up to 5 sample transaction IDs (most recent first).
		sampleIDs := make([]string, 0, 5)
		for i := len(g.rows) - 1; i >= 0 && len(sampleIDs) < 5; i-- {
			sampleIDs = append(sampleIDs, g.rows[i].ID)
		}

		suggestions = append(suggestions, BillSuggestion{
			MerchantNormalized:   merch,
			DisplayName:          titleCaseMerchant(merch),
			Frequency:            freq,
			Amount:               math.Round(mean*100) / 100,
			AmountVariance:       variance,
			DueDay:               modeDayOfMonth(dates),
			CategoryID:           g.categoryID,
			CategoryName:         g.categoryName,
			OccurrenceCount:      len(g.rows),
			FirstSeen:            dates[0].Format("2006-01-02"),
			LastSeen:             dates[len(dates)-1].Format("2006-01-02"),
			SampleTransactionIDs: sampleIDs,
		})
	}

	// Sort by occurrence count desc, then by amount desc.
	sort.Slice(suggestions, func(i, j int) bool {
		if suggestions[i].OccurrenceCount != suggestions[j].OccurrenceCount {
			return suggestions[i].OccurrenceCount > suggestions[j].OccurrenceCount
		}
		return suggestions[i].Amount > suggestions[j].Amount
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"suggestions": suggestions,
		"count":       len(suggestions),
	})
}

// titleCaseMerchant turns "verizon wireless" into "Verizon Wireless" for display.
func titleCaseMerchant(s string) string {
	out := make([]byte, 0, len(s))
	upNext := true
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == ' ' || c == '-' || c == '_' {
			out = append(out, c)
			upNext = true
			continue
		}
		if upNext && c >= 'a' && c <= 'z' {
			c = c - ('a' - 'A')
		}
		out = append(out, c)
		upNext = false
	}
	return string(out)
}

// acceptBillSuggestionRequest is the body for POST /auth/bills/suggestions/accept.
// The client passes back the suggestion fields plus the merchant key so the
// handler can backfill historical bill_payments for matching transactions.
type acceptBillSuggestionRequest struct {
	MerchantNormalized string  `json:"merchant_normalized"`
	Name               string  `json:"name"`
	AmountDue          float64 `json:"amount_due"`
	DueDay             int     `json:"due_day"`
	Frequency          string  `json:"frequency"`
	CategoryID         *string `json:"category_id"`
	Payee              string  `json:"payee"`
	IsShared           bool    `json:"is_shared"`
}

// POST /auth/bills/suggestions/accept
// Creates a bill from the suggestion AND backfills bill_payments rows for
// every historical transaction that matched the merchant, so the user sees
// past periods already marked paid.
func AcceptBillSuggestion(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	var req acceptBillSuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.MerchantNormalized == "" || req.Name == "" || req.AmountDue <= 0 || req.DueDay < 1 || req.DueDay > 31 || req.Frequency == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	hh := db.ResolveHouseholdID(client.Raw(), userID)
	var hhVal any
	if hh != "" {
		hhVal = hh
	}

	billID := uuid.New().String()
	_, err = client.Exec(`
		INSERT INTO bills (id, user_id, household_id, name, amount_due, due_day, frequency, payee, category_id, debt_account_id, is_autopay, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,false,$10)
	`, billID, userID, hhVal, req.Name, req.AmountDue, req.DueDay, req.Frequency,
		nilIfEmpty(req.Payee), req.CategoryID, req.IsShared)
	if err != nil {
		log.Printf("AcceptBillSuggestion: create bill failed: %v", err)
		http.Error(w, "Failed to create bill", http.StatusInternalServerError)
		return
	}

	// Backfill bill_payments for every past transaction that matched the merchant.
	txRows, err := client.Query(`
		SELECT id, date, amount FROM transactions
		WHERE user_id = $1
		  AND type = 'expense'
		  AND source IN ('teller','bank','flinks')
		  AND merchant_normalized = $2
		ORDER BY date
	`, userID, req.MerchantNormalized)
	if err != nil {
		log.Printf("AcceptBillSuggestion: list transactions failed: %v", err)
		// Bill is created; return success even if backfill fails.
		respondAcceptedBill(w, billID, 0)
		return
	}
	defer txRows.Close()

	type pastTx struct {
		ID     string
		Date   time.Time
		Amount float64
	}
	var pastTxs []pastTx
	for txRows.Next() {
		var p pastTx
		if err := txRows.Scan(&p.ID, &p.Date, &p.Amount); err != nil {
			continue
		}
		pastTxs = append(pastTxs, p)
	}

	// Group transactions by their billing period — one bill_payment per period.
	// Since pastTxs is ordered by date asc, later writes win, so each period
	// ends up with its most recent transaction.
	type periodKey struct{ start, end time.Time }
	type periodTx struct {
		txID   string
		amount float64
	}
	byPeriod := map[periodKey]periodTx{}
	for _, p := range pastTxs {
		ps, pe := computeBillingPeriod(req.DueDay, req.Frequency, p.Date)
		byPeriod[periodKey{ps, pe}] = periodTx{txID: p.ID, amount: p.Amount}
	}

	backfilled := 0
	for k, ptx := range byPeriod {
		paymentID := uuid.New().String()
		_, err := client.Exec(`
			INSERT INTO bill_payments
				(id, bill_id, user_id, household_id, amount_paid, paid_date, transaction_id, source, period_start, period_end)
			VALUES ($1,$2,$3,$4,$5,NOW(),$6,'backfilled',$7,$8)
		`, paymentID, billID, userID, hhVal, ptx.amount, ptx.txID,
			k.start.Format("2006-01-02"), k.end.Format("2006-01-02"))
		if err != nil {
			log.Printf("AcceptBillSuggestion: backfill insert failed: %v", err)
			continue
		}
		backfilled++
	}

	respondAcceptedBill(w, billID, backfilled)
}

func respondAcceptedBill(w http.ResponseWriter, billID string, backfilled int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"bill_id":    billID,
		"backfilled": backfilled,
	})
}

// dismissBillSuggestionRequest is the body for POST /auth/bills/suggestions/dismiss.
type dismissBillSuggestionRequest struct {
	MerchantNormalized string `json:"merchant_normalized"`
}

// POST /auth/bills/suggestions/dismiss
func DismissBillSuggestion(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	var req dismissBillSuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.MerchantNormalized == "" {
		http.Error(w, "Missing merchant_normalized", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	_, err = client.Exec(`
		INSERT INTO bill_suggestion_dismissals (user_id, merchant_normalized)
		VALUES ($1, $2)
		ON CONFLICT (user_id, merchant_normalized) DO NOTHING
	`, userID, req.MerchantNormalized)
	if err != nil {
		log.Printf("DismissBillSuggestion: insert failed: %v", err)
		http.Error(w, "Failed to record dismissal", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

