package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// billsDBFactory allows swapping the DB in tests.
var billsDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// computeBillingPeriod returns the start and end of the current billing period for a bill.
func computeBillingPeriod(dueDay int, frequency string, ref time.Time) (time.Time, time.Time) {
	y, m, _ := ref.Date()

	switch frequency {
	case "weekly":
		// Current week (Mon-Sun) containing the reference date
		weekday := int(ref.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start := ref.AddDate(0, 0, -(weekday - 1))
		start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
		end := start.AddDate(0, 0, 6)
		return start, end

	case "biweekly":
		// Two-week window centered on due day
		periodStart := time.Date(y, m, dueDay, 0, 0, 0, 0, time.UTC)
		if ref.Before(periodStart) {
			periodStart = periodStart.AddDate(0, 0, -14)
		}
		return periodStart, periodStart.AddDate(0, 0, 13)

	default: // monthly, quarterly, yearly
		// Period = 1st through last day of the current month
		start := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
		end := start.AddDate(0, 1, -1)
		return start, end
	}
}

func ListBills(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	hh := db.ResolveHouseholdID(client.Raw(), userID)

	query := `
		SELECT b.id, b.user_id, COALESCE(b.household_id::text, ''), b.name, b.amount_due,
		       b.due_day, b.frequency, COALESCE(b.payee, ''), b.category_id, b.debt_account_id,
		       b.is_autopay, b.is_shared,
		       COALESCE(c.name, ''), COALESCE(d.name, '')
		FROM bills b
		LEFT JOIN categories c ON b.category_id = c.id
		LEFT JOIN debt_accounts d ON b.debt_account_id = d.id
	`
	var rows *sql.Rows
	if hh == "" {
		rows, err = client.Query(query+" WHERE b.user_id = $1 ORDER BY b.due_day", userID)
	} else {
		rows, err = client.Query(query+`
			WHERE b.user_id = $2
			   OR (b.is_shared = true AND b.user_id IN (
			       SELECT hm.user_id FROM household_members hm
			       LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			           AND (sp.household_id::text = $1 OR sp.household_id IS NULL)
			       WHERE hm.household_id::text = $1
			         AND hm.user_id != $2
			         AND COALESCE(sp.share_budgets, true) = true
			   ))
			ORDER BY b.due_day
		`, hh, userID)
	}
	if err != nil {
		log.Printf("ListBills query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	now := time.Now().UTC()

	var bills []models.Bill
	for rows.Next() {
		var b models.Bill
		var catID, debtID sql.NullString
		var catName, debtName, payee, hhID string
		if err := rows.Scan(&b.ID, &b.UserID, &hhID, &b.Name, &b.AmountDue,
			&b.DueDay, &b.Frequency, &payee, &catID, &debtID,
			&b.IsAutopay, &b.IsShared,
			&catName, &debtName); err != nil {
			log.Printf("ListBills scan error: %v", err)
			continue
		}
		b.HouseholdID = hhID
		if payee != "" {
			b.Payee = &payee
		}
		if catID.Valid {
			b.CategoryID = &catID.String
		}
		if debtID.Valid {
			b.DebtAccountID = &debtID.String
		}
		if catName != "" {
			b.CategoryName = &catName
		}
		if debtName != "" {
			b.DebtName = &debtName
		}

		// Compute status for current billing period
		periodStart, periodEnd := computeBillingPeriod(b.DueDay, b.Frequency, now)
		var paymentCount int
		_ = client.QueryRow(`
			SELECT COUNT(*) FROM bill_payments
			WHERE bill_id = $1 AND period_start = $2 AND period_end = $3
		`, b.ID, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")).Scan(&paymentCount)

		if paymentCount > 0 {
			b.Status = "paid"
		} else if now.Day() > b.DueDay && b.Frequency == "monthly" {
			b.Status = "overdue"
		} else {
			b.Status = "unpaid"
		}

		bills = append(bills, b)
	}

	if bills == nil {
		bills = []models.Bill{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bills)
}

func CreateBill(w http.ResponseWriter, r *http.Request) {
	var b models.Bill
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	if b.UserID == "" {
		b.UserID = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(b.UserID)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	b.UserID = userID

	if b.Name == "" {
		http.Error(w, "Bill name is required", http.StatusBadRequest)
		return
	}
	if b.AmountDue <= 0 {
		http.Error(w, "Amount must be greater than zero", http.StatusBadRequest)
		return
	}
	if b.DueDay < 1 || b.DueDay > 31 {
		http.Error(w, "Due day must be between 1 and 31", http.StatusBadRequest)
		return
	}
	if b.Frequency == "" {
		b.Frequency = "monthly"
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if b.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(client.Raw(), b.UserID); hh != "" {
			b.HouseholdID = hh
		}
	}
	if b.IsShared && b.HouseholdID == "" {
		http.Error(w, "Join or create a household before creating shared items", http.StatusBadRequest)
		return
	}

	var hhVal any
	if b.HouseholdID == "" {
		hhVal = nil
	} else {
		hhVal = b.HouseholdID
	}

	_, err = client.Exec(`
		INSERT INTO bills (id, user_id, household_id, name, amount_due, due_day, frequency, payee, category_id, debt_account_id, is_autopay, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`, b.ID, b.UserID, hhVal, b.Name, b.AmountDue, b.DueDay, b.Frequency, b.Payee, b.CategoryID, b.DebtAccountID, b.IsAutopay, b.IsShared)
	if err != nil {
		log.Printf("CreateBill insert error: %v", err)
		http.Error(w, "Insert error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(b)
}

func UpdateBill(w http.ResponseWriter, r *http.Request) {
	billID := mux.Vars(r)["id"]
	if billID == "" {
		http.Error(w, "Missing bill id", http.StatusBadRequest)
		return
	}

	var b models.Bill
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	res, err := client.Exec(`
		UPDATE bills
		SET name=$1, amount_due=$2, due_day=$3, frequency=$4, payee=$5, category_id=$6, debt_account_id=$7, is_autopay=$8, is_shared=$9, updated_at=NOW()
		WHERE id=$10
	`, b.Name, b.AmountDue, b.DueDay, b.Frequency, b.Payee, b.CategoryID, b.DebtAccountID, b.IsAutopay, b.IsShared, billID)
	if err != nil {
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Bill not found", http.StatusNotFound)
		return
	}

	b.ID = billID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(b)
}

func DeleteBill(w http.ResponseWriter, r *http.Request) {
	billID := mux.Vars(r)["id"]
	if billID == "" {
		http.Error(w, "Missing bill id", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	res, err := client.Exec(`DELETE FROM bills WHERE id=$1`, billID)
	if err != nil {
		http.Error(w, "Delete error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Bill not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func MarkBillPaid(w http.ResponseWriter, r *http.Request) {
	billID := mux.Vars(r)["id"]
	if billID == "" {
		http.Error(w, "Missing bill id", http.StatusBadRequest)
		return
	}

	var body struct {
		Amount   float64 `json:"amount"`
		PaidDate string  `json:"paid_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Fetch the bill (with category name for the transaction)
	var bill models.Bill
	var catID, debtID sql.NullString
	var payee, catName string
	row := client.QueryRow(`
		SELECT b.id, b.user_id, COALESCE(b.household_id::text, ''), b.name, b.amount_due, b.due_day, b.frequency,
		       COALESCE(b.payee, ''), b.category_id, b.debt_account_id, b.is_autopay, b.is_shared,
		       COALESCE(c.name, '')
		FROM bills b
		LEFT JOIN categories c ON b.category_id = c.id
		WHERE b.id = $1
	`, billID)
	if err := row.Scan(&bill.ID, &bill.UserID, &bill.HouseholdID, &bill.Name, &bill.AmountDue, &bill.DueDay, &bill.Frequency, &payee, &catID, &debtID, &bill.IsAutopay, &bill.IsShared, &catName); err != nil {
		http.Error(w, "Bill not found", http.StatusNotFound)
		return
	}
	if payee != "" {
		bill.Payee = &payee
	}
	if catID.Valid {
		bill.CategoryID = &catID.String
	}
	if debtID.Valid {
		bill.DebtAccountID = &debtID.String
	}

	amount := body.Amount
	if amount <= 0 {
		amount = bill.AmountDue
	}
	paidDate := time.Now().UTC()
	if body.PaidDate != "" {
		if parsed, err := time.Parse(time.RFC3339, body.PaidDate); err == nil {
			paidDate = parsed
		}
	}

	now := time.Now().UTC()
	periodStart, periodEnd := computeBillingPeriod(bill.DueDay, bill.Frequency, now)

	paymentID := uuid.New().String()
	txID := uuid.New().String()
	var hhVal any
	if bill.HouseholdID == "" {
		hhVal = nil
	} else {
		hhVal = bill.HouseholdID
	}

	// Create an expense transaction so the payment appears in the budget
	_, err = client.Exec(`
		INSERT INTO transactions (id, user_id, household_id, category_id, type, amount, category_name, note, date, frequency, due_day, source)
		VALUES ($1,$2,$3,$4,'expense',$5,$6,$7,$8,$9,$10,'bill')
	`, txID, bill.UserID, hhVal, bill.CategoryID, amount, catName,
		bill.Name+" payment", paidDate, bill.Frequency, bill.DueDay)
	if err != nil {
		log.Printf("MarkBillPaid transaction insert error: %v", err)
		http.Error(w, "Insert transaction error", http.StatusInternalServerError)
		return
	}

	_, err = client.Exec(`
		INSERT INTO bill_payments (id, bill_id, user_id, household_id, amount_paid, paid_date, transaction_id, source, period_start, period_end)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',$8,$9)
	`, paymentID, billID, bill.UserID, hhVal, amount, paidDate, txID,
		periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02"))
	if err != nil {
		log.Printf("MarkBillPaid insert error: %v", err)
		http.Error(w, "Insert payment error", http.StatusInternalServerError)
		return
	}

	// If linked to a debt account, decrease the balance
	if bill.DebtAccountID != nil && *bill.DebtAccountID != "" {
		_, err = client.Exec(`
			UPDATE debt_accounts SET balance = GREATEST(balance - $1, 0) WHERE id = $2
		`, amount, *bill.DebtAccountID)
		if err != nil {
			log.Printf("MarkBillPaid debt update error: %v", err)
		}
	}

	bill.Status = "paid"
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bill)
}

func ListBillPayments(w http.ResponseWriter, r *http.Request) {
	billID := mux.Vars(r)["id"]
	if billID == "" {
		http.Error(w, "Missing bill id", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	rows, err := client.Query(`
		SELECT id, bill_id, user_id, COALESCE(household_id::text, ''), amount_paid, paid_date, transaction_id, source, period_start, period_end
		FROM bill_payments
		WHERE bill_id = $1
		ORDER BY paid_date DESC
	`, billID)
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var payments []models.BillPayment
	for rows.Next() {
		var p models.BillPayment
		var txID sql.NullString
		if err := rows.Scan(&p.ID, &p.BillID, &p.UserID, &p.HouseholdID, &p.AmountPaid, &p.PaidDate, &txID, &p.Source, &p.PeriodStart, &p.PeriodEnd); err != nil {
			log.Printf("ListBillPayments scan error: %v", err)
			continue
		}
		if txID.Valid {
			p.TransactionID = &txID.String
		}
		payments = append(payments, p)
	}

	if payments == nil {
		payments = []models.BillPayment{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payments)
}

func AutoDetectBillPayments(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := billsDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	now := time.Now().UTC()

	// Get all bills for user
	billRows, err := client.Query(`
		SELECT id, user_id, COALESCE(household_id::text, ''), name, amount_due, due_day, frequency, category_id, debt_account_id
		FROM bills WHERE user_id = $1
	`, userID)
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer billRows.Close()

	type billInfo struct {
		ID            string
		UserID        string
		HouseholdID   string
		AmountDue     float64
		DueDay        int
		Frequency     string
		CategoryID    *string
		DebtAccountID *string
	}

	var bills []billInfo
	for billRows.Next() {
		var b billInfo
		var catID, debtID sql.NullString
		var name string
		if err := billRows.Scan(&b.ID, &b.UserID, &b.HouseholdID, &name, &b.AmountDue, &b.DueDay, &b.Frequency, &catID, &debtID); err != nil {
			continue
		}
		if catID.Valid {
			b.CategoryID = &catID.String
		}
		if debtID.Valid {
			b.DebtAccountID = &debtID.String
		}
		bills = append(bills, b)
	}

	var detected []map[string]any

	for _, bill := range bills {
		periodStart, periodEnd := computeBillingPeriod(bill.DueDay, bill.Frequency, now)

		// Check if already paid this period
		var count int
		_ = client.QueryRow(`
			SELECT COUNT(*) FROM bill_payments WHERE bill_id = $1 AND period_start = $2 AND period_end = $3
		`, bill.ID, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")).Scan(&count)
		if count > 0 {
			continue
		}

		// Try to match a bank-synced transaction
		// Match criteria: source='bank', amount within 5%, date in period, same category (if set)
		tolerance := bill.AmountDue * 0.05
		lowerBound := bill.AmountDue - tolerance
		upperBound := bill.AmountDue + tolerance

		var matchQuery string
		var matchArgs []any
		if bill.CategoryID != nil && *bill.CategoryID != "" {
			matchQuery = `
				SELECT id, amount FROM transactions
				WHERE user_id = $1
				  AND source = 'bank'
				  AND amount >= $2 AND amount <= $3
				  AND date >= $4 AND date <= $5
				  AND category_id = $6
				LIMIT 1
			`
			matchArgs = []any{bill.UserID, lowerBound, upperBound,
				periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02"),
				*bill.CategoryID}
		} else {
			matchQuery = `
				SELECT id, amount FROM transactions
				WHERE user_id = $1
				  AND source = 'bank'
				  AND amount >= $2 AND amount <= $3
				  AND date >= $4 AND date <= $5
				LIMIT 1
			`
			matchArgs = []any{bill.UserID, lowerBound, upperBound,
				periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")}
		}

		var txID string
		var txAmount float64
		err := client.QueryRow(matchQuery, matchArgs...).Scan(&txID, &txAmount)
		if err != nil {
			continue // no match
		}

		// Found a match — create bill_payment
		paymentID := uuid.New().String()
		var hhVal any
		if bill.HouseholdID == "" {
			hhVal = nil
		} else {
			hhVal = bill.HouseholdID
		}

		_, err = client.Exec(`
			INSERT INTO bill_payments (id, bill_id, user_id, household_id, amount_paid, paid_date, transaction_id, source, period_start, period_end)
			VALUES ($1,$2,$3,$4,$5,NOW(),$6,'auto_detected',$7,$8)
		`, paymentID, bill.ID, bill.UserID, hhVal, txAmount, txID,
			periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02"))
		if err != nil {
			log.Printf("AutoDetect insert error for bill %s: %v", bill.ID, err)
			continue
		}

		// If linked to debt, decrease balance
		if bill.DebtAccountID != nil && *bill.DebtAccountID != "" {
			_, _ = client.Exec(`
				UPDATE debt_accounts SET balance = GREATEST(balance - $1, 0) WHERE id = $2
			`, txAmount, *bill.DebtAccountID)
		}

		detected = append(detected, map[string]any{
			"bill_id":        bill.ID,
			"payment_id":     paymentID,
			"transaction_id": txID,
			"amount":         math.Round(txAmount*100) / 100,
		})
	}

	if detected == nil {
		detected = []map[string]any{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"detected": detected,
		"count":    len(detected),
	})
}
