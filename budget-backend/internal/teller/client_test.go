package teller

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// newTestClient returns a Client pointed at the given test server URL.
func newTestClient(url string) *Client {
	return &Client{
		appID:      "app_test",
		env:        "sandbox",
		baseURL:    url,
		httpClient: &http.Client{},
	}
}

func TestListAccounts(t *testing.T) {
	const token = "test_token_abc"
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/accounts" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		user, pass, ok := r.BasicAuth()
		if !ok || user != token || pass != "" {
			t.Errorf("bad basic auth: user=%q pass=%q ok=%v", user, pass, ok)
		}
		if v := r.Header.Get("Teller-Version"); v != apiVersion {
			t.Errorf("Teller-Version = %q, want %q", v, apiVersion)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[
			{"id":"acc_1","name":"Checking","type":"depository","subtype":"checking",
			 "currency":"USD","last_four":"1234","status":"open",
			 "institution":{"id":"ins_1","name":"Test Bank"}}
		]`))
	}))
	defer ts.Close()

	accounts, err := newTestClient(ts.URL).ListAccounts(token)
	if err != nil {
		t.Fatalf("ListAccounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("got %d accounts, want 1", len(accounts))
	}
	if accounts[0].ID != "acc_1" || accounts[0].Institution.Name != "Test Bank" {
		t.Errorf("unexpected account: %+v", accounts[0])
	}
}

func TestGetBalance(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/accounts/acc_1/balances" {
			t.Errorf("unexpected path %q", r.URL.Path)
		}
		w.Write([]byte(`{"account_id":"acc_1","ledger":"1500.25","available":"1400.00"}`))
	}))
	defer ts.Close()

	bal, err := newTestClient(ts.URL).GetBalance("tok", "acc_1")
	if err != nil {
		t.Fatalf("GetBalance: %v", err)
	}
	if bal.Ledger != "1500.25" || bal.Available != "1400.00" {
		t.Errorf("unexpected balance: %+v", bal)
	}
}

func TestListTransactionsPaginates(t *testing.T) {
	// First page returns a full page (txPageSize items) → client requests a
	// second page via from_id; second page is short → pagination stops.
	calls := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if got := r.URL.Query().Get("start_date"); got != "2024-01-01" {
			t.Errorf("start_date = %q, want 2024-01-01", got)
		}
		if calls == 1 {
			if fromID := r.URL.Query().Get("from_id"); fromID != "" {
				t.Errorf("first page should have no from_id, got %q", fromID)
			}
			w.Write([]byte(fullPage()))
			return
		}
		if fromID := r.URL.Query().Get("from_id"); fromID != "txn_99" {
			t.Errorf("second page from_id = %q, want txn_99", fromID)
		}
		w.Write([]byte(`[{"id":"txn_last","account_id":"acc_1","amount":"-9.99","date":"2024-02-01","description":"Coffee","status":"posted"}]`))
	}))
	defer ts.Close()

	txns, err := newTestClient(ts.URL).ListTransactions("tok", "acc_1", "2024-01-01")
	if err != nil {
		t.Fatalf("ListTransactions: %v", err)
	}
	if calls != 2 {
		t.Errorf("expected 2 pages fetched, got %d", calls)
	}
	if len(txns) != txPageSize+1 {
		t.Errorf("got %d transactions, want %d", len(txns), txPageSize+1)
	}
}

func TestAPIErrorIsSurfaced(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":{"code":"unauthorized","message":"bad token"}}`))
	}))
	defer ts.Close()

	_, err := newTestClient(ts.URL).ListAccounts("tok")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
}

// fullPage builds a JSON array of exactly txPageSize transactions, the last
// one having id "txn_99" so the test can assert the pagination cursor.
func fullPage() string {
	out := "["
	for i := 0; i < txPageSize; i++ {
		if i > 0 {
			out += ","
		}
		id := "txn_" + itoa(i)
		if i == txPageSize-1 {
			id = "txn_99"
		}
		out += `{"id":"` + id + `","account_id":"acc_1","amount":"-1.00","date":"2024-01-15","description":"x","status":"posted"}`
	}
	return out + "]"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}
