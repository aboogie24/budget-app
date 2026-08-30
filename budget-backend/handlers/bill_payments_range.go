package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/lib/pq"
)

// billPaymentPeriod is a lightweight record telling the calendar which bill was
// paid for which period, so it can suppress a scheduled bill in ANY displayed
// month (not just the current one) once that period is paid.
type billPaymentPeriod struct {
	BillID        string `json:"bill_id"`
	PeriodStart   string `json:"period_start"`
	PeriodEnd     string `json:"period_end"`
	TransactionID string `json:"transaction_id,omitempty"`
}

// ListBillPaymentsInRange returns bill payments whose billing period overlaps
// [start, end] for the caller's household bills. The calendar uses this to
// dedupe a paid bill against its real transaction correctly across months,
// where the per-current-period `paid_this_period` flag on /bills can't.
//
// GET /auth/bill-payments?start=YYYY-MM-DD&end=YYYY-MM-DD
func ListBillPaymentsInRange(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	if start == "" || end == "" {
		http.Error(w, "Missing start or end (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Cover the whole household's bills so shared bills dedupe too.
	ids := []string{userID}
	if hh := db.ResolveHouseholdID(conn.Raw(), userID); hh != "" {
		if members := householdMemberIDs(conn.Raw(), hh); len(members) > 0 {
			ids = members
		}
	}

	rows, err := conn.Query(`
		SELECT bp.bill_id::text, bp.period_start::text, bp.period_end::text,
		       COALESCE(bp.transaction_id::text, '')
		FROM bill_payments bp
		JOIN bills b ON b.id = bp.bill_id
		WHERE b.user_id = ANY($1)
		  AND bp.period_start <= $3 AND bp.period_end >= $2
	`, pq.Array(ids), start, end)
	if err != nil {
		log.Printf("ListBillPaymentsInRange query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	payments := []billPaymentPeriod{}
	for rows.Next() {
		var p billPaymentPeriod
		if err := rows.Scan(&p.BillID, &p.PeriodStart, &p.PeriodEnd, &p.TransactionID); err != nil {
			continue
		}
		payments = append(payments, p)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"payments": payments})
}
