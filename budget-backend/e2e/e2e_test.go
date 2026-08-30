//go:build e2e

// Package e2e runs the real router against a real Postgres database and
// drives full HTTP flows — the money-critical paths that unit tests with
// sqlmock can't cover (sync → detection → status interactions).
//
// Run with:  make test-e2e-backend   (from the repo root)
// It expects a FRESH database (the make target drops/recreates budget_db_e2e
// and applies all migrations) and the PG_*/JWT_SECRET env vars to point at it.
package e2e

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/routes"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

var (
	server *httptest.Server
	conn   *sql.DB
)

func TestMain(m *testing.M) {
	// Defaults for local runs; the make target sets these explicitly. The DB
	// name must NEVER default to the dev database — tests write real rows.
	setDefault("PG_HOST", "localhost")
	setDefault("PG_PORT", "5432")
	setDefault("PG_USER", "youruser")
	setDefault("PG_PASS", "yourpassword")
	setDefault("PG_DB", "budget_db_e2e")
	setDefault("JWT_SECRET", "e2e-test-secret")

	if os.Getenv("PG_DB") == "budget_db" {
		fmt.Fprintln(os.Stderr, "refusing to run e2e suite against the dev database (PG_DB=budget_db)")
		os.Exit(1)
	}

	handle, err := db.New()
	if err != nil {
		fmt.Fprintf(os.Stderr, "e2e: cannot connect to %s: %v\n", os.Getenv("PG_DB"), err)
		os.Exit(1)
	}
	conn = handle.Conn

	r := mux.NewRouter()
	routes.SetupRoutes(r)
	server = httptest.NewServer(r)

	code := m.Run()
	server.Close()
	os.Exit(code)
}

func setDefault(key, val string) {
	if os.Getenv(key) == "" {
		os.Setenv(key, val)
	}
}

// ── HTTP helpers ────────────────────────────────────────────────

type resp struct {
	status int
	body   map[string]any
	list   []map[string]any
	raw    []byte
}

func call(t *testing.T, method, path, token string, payload any) resp {
	t.Helper()
	var body *bytes.Buffer = bytes.NewBuffer(nil)
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = bytes.NewBuffer(b)
	}
	req, err := http.NewRequest(method, server.URL+path, body)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()

	out := resp{status: res.StatusCode}
	dec := json.NewDecoder(res.Body)
	var anyBody any
	if err := dec.Decode(&anyBody); err == nil {
		switch v := anyBody.(type) {
		case map[string]any:
			out.body = v
		case []any:
			for _, item := range v {
				if m, ok := item.(map[string]any); ok {
					out.list = append(out.list, m)
				}
			}
		}
	}
	return out
}

// registerAndLogin creates a fresh user through the real endpoints and
// returns (userID, bearer token).
func registerAndLogin(t *testing.T) (string, string) {
	t.Helper()
	userID := uuid.New().String()
	email := fmt.Sprintf("e2e-%s@test.local", userID[:8])

	r := call(t, http.MethodPost, "/users/register", "", map[string]any{
		"id":        userID,
		"email":     email,
		"full_name": "E2E Tester",
		"password":  "supersecret123",
	})
	if r.status != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d (%v)", r.status, r.body)
	}

	r = call(t, http.MethodPost, "/users/login", "", map[string]any{
		"email":    email,
		"password": "supersecret123",
	})
	if r.status != http.StatusOK {
		t.Fatalf("login: expected 200, got %d (%v)", r.status, r.body)
	}
	token, _ := r.body["token"].(string)
	if token == "" {
		t.Fatalf("login: no token in response: %v", r.body)
	}
	return userID, token
}

// expenseCategoryID returns a seeded expense category, or creates one.
func expenseCategoryID(t *testing.T) string {
	t.Helper()
	var id string
	err := conn.QueryRow(
		`SELECT id FROM categories WHERE type = 'expense' ORDER BY name LIMIT 1`,
	).Scan(&id)
	if err == nil {
		return id
	}
	id = uuid.New().String()
	if _, err := conn.Exec(
		`INSERT INTO categories (id, name, type) VALUES ($1, 'E2E Expenses', 'expense')`, id,
	); err != nil {
		t.Fatalf("create category: %v", err)
	}
	return id
}

// insertBankTransaction plants a synced expense the way a provider sync would.
func insertBankTransaction(t *testing.T, userID, categoryID string, amount float64, date time.Time) string {
	t.Helper()
	id := uuid.New().String()
	_, err := conn.Exec(`
		INSERT INTO transactions (id, user_id, type, amount, category_id, note, date, source, external_id)
		VALUES ($1, $2, 'expense', $3, $4, 'E2E BANK PAYMENT', $5, 'simplefin', $6)
	`, id, userID, amount, categoryID, date.UTC(), "e2e:"+id)
	if err != nil {
		t.Fatalf("insert transaction: %v", err)
	}
	return id
}

// ── Flows ───────────────────────────────────────────────────────

// TestAuthRoundTrip: register → login → authorized call succeeds, and an
// unauthorized call is rejected.
func TestAuthRoundTrip(t *testing.T) {
	userID, token := registerAndLogin(t)

	r := call(t, http.MethodGet, "/auth/bills?user_id="+userID, token, nil)
	if r.status != http.StatusOK {
		t.Fatalf("authorized bills list: expected 200, got %d", r.status)
	}
	r = call(t, http.MethodGet, "/auth/bills?user_id="+userID, "", nil)
	if r.status != http.StatusUnauthorized {
		t.Fatalf("unauthorized bills list: expected 401, got %d", r.status)
	}
}

// TestBillAutoDetect_OverpaymentAndDebtGuard covers the full chain reported as
// "I paid this bill but it shows overdue":
//   - a synced payment LARGER than the bill (extra principal) must still match
//   - detection runs automatically on bill creation (no manual button)
//   - a payment predating the debt record must NOT decrement the debt balance
//   - after backdating the debt, re-detection DOES decrement it
func TestBillAutoDetect_OverpaymentAndDebtGuard(t *testing.T) {
	userID, token := registerAndLogin(t)
	categoryID := expenseCategoryID(t)

	// A synced double-payment earlier this month (yesterday, so monthly period
	// still contains it; due day = today-2 so the bill would read overdue).
	now := time.Now().UTC()
	if now.Day() < 4 {
		t.Skip("first days of the month: period math for backdating is ambiguous, skipping")
	}
	txDate := now.AddDate(0, 0, -1)
	txID := insertBankTransaction(t, userID, categoryID, 2443.44, txDate)
	_ = txID

	// Debt created NOW (balance already includes the payment above).
	r := call(t, http.MethodPost, "/auth/debts", token, map[string]any{
		"user_id":        userID,
		"name":           "E2E Auto Loan",
		"balance":        43481.92,
		"apr":            6.5,
		"min_payment":    1212.72,
		"due_day":        now.Day() - 2,
		"liability_type": "auto",
		"debt_category":  "attack",
		"is_shared":      false,
	})
	if r.status != http.StatusCreated {
		t.Fatalf("create debt: expected 201, got %d (%v)", r.status, r.body)
	}
	debtID, _ := r.body["id"].(string)

	// Bill for the minimum payment, same category, linked to the debt. The
	// synced payment is ~2x the amount — detection must match it anyway.
	r = call(t, http.MethodPost, "/auth/bills", token, map[string]any{
		"user_id":         userID,
		"name":            "E2E Auto Loan Payment",
		"amount_due":      1212.72,
		"due_day":         now.Day() - 2,
		"frequency":       "monthly",
		"category_id":     categoryID,
		"debt_account_id": debtID,
		"is_autopay":      false,
		"is_shared":       false,
	})
	if r.status != http.StatusCreated {
		t.Fatalf("create bill: expected 201, got %d (%v)", r.status, r.body)
	}
	billID, _ := r.body["id"].(string)

	// Creation-time detection should have matched the overpayment already.
	r = call(t, http.MethodGet, "/auth/bills?user_id="+userID, token, nil)
	if r.status != http.StatusOK {
		t.Fatalf("list bills: %d", r.status)
	}
	var found bool
	for _, b := range r.list {
		if b["id"] == billID {
			found = true
			if b["status"] != "paid" {
				t.Fatalf("bill status: expected paid (overpayment auto-matched on create), got %v", b["status"])
			}
		}
	}
	if !found {
		t.Fatalf("created bill not in list")
	}

	// The payment predates the debt record → balance must be untouched.
	var balance float64
	if err := conn.QueryRow(`SELECT balance FROM debt_accounts WHERE id = $1`, debtID).Scan(&balance); err != nil {
		t.Fatalf("read debt balance: %v", err)
	}
	if balance != 43481.92 {
		t.Fatalf("debt balance: expected untouched 43481.92 (payment predates debt), got %v", balance)
	}

	// Backdate the debt so the payment postdates it, clear the payment record,
	// and re-run detection: now the decrement SHOULD apply.
	if _, err := conn.Exec(`UPDATE debt_accounts SET created_at = NOW() - INTERVAL '60 days' WHERE id = $1`, debtID); err != nil {
		t.Fatalf("backdate debt: %v", err)
	}
	if _, err := conn.Exec(`DELETE FROM bill_payments WHERE bill_id = $1`, billID); err != nil {
		t.Fatalf("clear bill payment: %v", err)
	}
	r = call(t, http.MethodPost, "/auth/bills/auto-detect?user_id="+userID, token, nil)
	if r.status != http.StatusOK {
		t.Fatalf("auto-detect: %d", r.status)
	}
	if err := conn.QueryRow(`SELECT balance FROM debt_accounts WHERE id = $1`, debtID).Scan(&balance); err != nil {
		t.Fatalf("read debt balance: %v", err)
	}
	want := 43481.92 - 2443.44
	if diff := balance - want; diff > 0.01 || diff < -0.01 {
		t.Fatalf("debt balance after backdated detection: expected %v, got %v", want, balance)
	}
}

// TestDebtAccountLink covers the balance-mirroring link:
//   - creating a linked debt snaps its balance to |account balance|
//   - manual payments on a linked debt are rejected (409)
//   - a second debt linking the same account is rejected (409)
func TestDebtAccountLink(t *testing.T) {
	userID, token := registerAndLogin(t)

	// Plant a synced credit-card account (negative balance, provider style).
	balanceID := uuid.New().String()
	_, err := conn.Exec(`
		INSERT INTO account_balances (id, user_id, plaid_account_id, name, type, current_balance, institution_name, created_at, updated_at)
		VALUES ($1, $2, $3, 'E2E Visa (1234)', 'credit', -3996.85, 'E2E Bank', NOW(), NOW())
	`, balanceID, userID, "e2e-acct-"+balanceID[:8])
	if err != nil {
		t.Fatalf("insert account balance: %v", err)
	}

	r := call(t, http.MethodPost, "/auth/debts", token, map[string]any{
		"user_id":           userID,
		"name":              "E2E Visa",
		"balance":           0,
		"apr":               24.99,
		"min_payment":       35,
		"liability_type":    "credit",
		"debt_category":     "attack",
		"is_shared":         false,
		"linked_balance_id": balanceID,
	})
	if r.status != http.StatusCreated {
		t.Fatalf("create linked debt: expected 201, got %d (%v)", r.status, r.body)
	}
	debtID, _ := r.body["id"].(string)

	// Balance snapped to the account's magnitude.
	list := call(t, http.MethodGet, "/auth/debts?user_id="+userID, token, nil)
	var got float64 = -1
	for _, d := range list.list {
		if d["id"] == debtID {
			got, _ = d["balance"].(float64)
			if d["linked_balance_id"] != balanceID {
				t.Fatalf("linked_balance_id not returned: %v", d["linked_balance_id"])
			}
			if d["linked_account_name"] != "E2E Visa (1234)" {
				t.Fatalf("linked_account_name: got %v", d["linked_account_name"])
			}
		}
	}
	if diff := got - 3996.85; diff > 0.01 || diff < -0.01 {
		t.Fatalf("linked debt balance: expected snap to 3996.85, got %v", got)
	}

	// Manual payment on a mirrored balance → 409.
	r = call(t, http.MethodPatch, "/auth/debts/"+debtID+"/payment", token, map[string]any{"amount": 100})
	if r.status != http.StatusConflict {
		t.Fatalf("payment on linked debt: expected 409, got %d", r.status)
	}

	// Second debt on the same account → 409.
	r = call(t, http.MethodPost, "/auth/debts", token, map[string]any{
		"user_id":           userID,
		"name":              "E2E Visa Duplicate",
		"balance":           0,
		"liability_type":    "credit",
		"is_shared":         false,
		"linked_balance_id": balanceID,
	})
	if r.status != http.StatusConflict {
		t.Fatalf("duplicate link: expected 409, got %d (%v)", r.status, r.body)
	}
}

// TestSavingsGoalAccountLink mirrors the goal-side contract the app already
// ships: linking snaps progress to the account and manual updates are blocked.
func TestSavingsGoalAccountLink(t *testing.T) {
	userID, token := registerAndLogin(t)

	balanceID := uuid.New().String()
	_, err := conn.Exec(`
		INSERT INTO account_balances (id, user_id, plaid_account_id, name, type, current_balance, institution_name, created_at, updated_at)
		VALUES ($1, $2, $3, 'E2E HYSA', 'depository', 4250.92, 'E2E Bank', NOW(), NOW())
	`, balanceID, userID, "e2e-acct-"+balanceID[:8])
	if err != nil {
		t.Fatalf("insert account balance: %v", err)
	}

	r := call(t, http.MethodPost, "/auth/savings-goals", token, map[string]any{
		"user_id":           userID,
		"name":              "E2E Emergency Fund",
		"target_amount":     10000,
		"current_amount":    0,
		"is_shared":         false,
		"linked_balance_id": balanceID,
	})
	if r.status != http.StatusCreated {
		t.Fatalf("create linked goal: expected 201, got %d (%v)", r.status, r.body)
	}
	goalID, _ := r.body["id"].(string)

	list := call(t, http.MethodGet, "/auth/savings-goals?user_id="+userID, token, nil)
	var got float64 = -1
	for _, g := range list.list {
		if g["id"] == goalID {
			got, _ = g["current_amount"].(float64)
		}
	}
	if diff := got - 4250.92; diff > 0.01 || diff < -0.01 {
		t.Fatalf("linked goal progress: expected snap to 4250.92, got %v", got)
	}

	r = call(t, http.MethodPatch, "/auth/savings-goals/"+goalID+"/progress", token, map[string]any{"current_amount": 99})
	if r.status != http.StatusConflict {
		t.Fatalf("manual progress on linked goal: expected 409, got %d", r.status)
	}
}
