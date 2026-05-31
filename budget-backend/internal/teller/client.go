package teller

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"
)

const (
	// defaultBaseURL is constant across environments — the access token type
	// and the Teller Connect `environment` parameter decide sandbox vs. real
	// data. It is overridable per-client only for tests.
	defaultBaseURL = "https://api.teller.io"

	// apiVersion is pinned via the Teller-Version header.
	apiVersion = "2020-10-12"

	// txPageSize / txMaxPages bound transaction pagination per account.
	txPageSize = 100
	txMaxPages = 20

	// rateLimitMaxRetries controls 429 backoff.
	rateLimitMaxRetries = 3
)

// Client wraps the Teller API.
//
// Authentication has two parts:
//   - mTLS: a client certificate + private key, required in development and
//     production (optional in sandbox).
//   - Per-request: the user's access token as the HTTP Basic Auth username
//     with an empty password.
type Client struct {
	appID      string
	env        string // sandbox | development | production
	baseURL    string
	httpClient *http.Client
	hasCert    bool
}

// Env returns the configured Teller environment.
func (c *Client) Env() string { return c.env }

// NewClient builds a Teller client from environment variables:
//
//	TELLER_APPLICATION_ID  application ID (used by Teller Connect)
//	TELLER_ENV             sandbox | development | production (default: sandbox)
//	TELLER_CERT_PATH       path to the client certificate PEM
//	TELLER_KEY_PATH        path to the client private key PEM
//	TELLER_CERT_PEM        certificate PEM contents (alternative to *_PATH)
//	TELLER_KEY_PEM         private key PEM contents (alternative to *_PATH)
func NewClient() *Client {
	appID := os.Getenv("TELLER_APPLICATION_ID")
	env := os.Getenv("TELLER_ENV")
	if env == "" {
		env = "sandbox"
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}
	hasCert := false

	if certPEM, keyPEM, ok := loadCertKey(); ok {
		cert, err := tls.X509KeyPair(certPEM, keyPEM)
		if err != nil {
			log.Printf("teller: failed to load client certificate: %v", err)
		} else {
			httpClient.Transport = &http.Transport{
				TLSClientConfig: &tls.Config{Certificates: []tls.Certificate{cert}},
			}
			hasCert = true
		}
	}

	if appID == "" {
		log.Println("WARNING: TELLER_APPLICATION_ID not set — Teller features will be unavailable")
	} else if !hasCert && env != "sandbox" {
		log.Printf("WARNING: Teller client certificate not loaded — API calls will fail in %s", env)
	}

	return &Client{
		appID:      appID,
		env:        env,
		baseURL:    defaultBaseURL,
		httpClient: httpClient,
		hasCert:    hasCert,
	}
}

// loadCertKey returns the client certificate + key PEM bytes from either the
// *_PEM env vars (inline) or the *_PATH env vars (files). ok is false when
// neither is configured.
func loadCertKey() (certPEM, keyPEM []byte, ok bool) {
	if c, k := os.Getenv("TELLER_CERT_PEM"), os.Getenv("TELLER_KEY_PEM"); c != "" && k != "" {
		return []byte(c), []byte(k), true
	}
	certPath, keyPath := os.Getenv("TELLER_CERT_PATH"), os.Getenv("TELLER_KEY_PATH")
	if certPath == "" || keyPath == "" {
		return nil, nil, false
	}
	c, err := os.ReadFile(certPath)
	if err != nil {
		log.Printf("teller: cannot read TELLER_CERT_PATH (%s): %v", certPath, err)
		return nil, nil, false
	}
	k, err := os.ReadFile(keyPath)
	if err != nil {
		log.Printf("teller: cannot read TELLER_KEY_PATH (%s): %v", keyPath, err)
		return nil, nil, false
	}
	return c, k, true
}

// IsAvailable reports whether Teller is configured enough to use.
func (c *Client) IsAvailable() bool {
	return c.appID != ""
}

// AppID returns the configured Teller application ID (used by Teller Connect).
func (c *Client) AppID() string { return c.appID }

// get performs an authenticated GET against the Teller API and decodes the
// JSON response into out. The access token is sent as the Basic Auth username.
func (c *Client) get(accessToken, path string, out interface{}) error {
	if accessToken == "" {
		return fmt.Errorf("teller: missing access token")
	}

	var lastErr error
	for attempt := 0; attempt <= rateLimitMaxRetries; attempt++ {
		req, err := http.NewRequest("GET", c.baseURL+path, nil)
		if err != nil {
			return fmt.Errorf("teller: build request: %w", err)
		}
		req.SetBasicAuth(accessToken, "")
		req.Header.Set("Teller-Version", apiVersion)
		req.Header.Set("Accept", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("teller: GET %s: %w", path, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusTooManyRequests {
			wait := time.Duration(1<<attempt) * time.Second
			log.Printf("teller: 429 on %s, backing off %s", path, wait)
			lastErr = fmt.Errorf("teller: rate limited on %s", path)
			time.Sleep(wait)
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			var apiErr apiError
			if json.Unmarshal(body, &apiErr) == nil && apiErr.Error.Message != "" {
				return fmt.Errorf("teller: GET %s failed %d: %s (%s)",
					path, resp.StatusCode, apiErr.Error.Message, apiErr.Error.Code)
			}
			return fmt.Errorf("teller: GET %s failed %d: %s", path, resp.StatusCode, string(body))
		}

		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("teller: decode %s response: %w", path, err)
		}
		return nil
	}
	return lastErr
}

// ListAccounts returns every account the user authorized during enrollment.
// GET /accounts
func (c *Client) ListAccounts(accessToken string) ([]Account, error) {
	var accounts []Account
	if err := c.get(accessToken, "/accounts", &accounts); err != nil {
		return nil, err
	}
	return accounts, nil
}

// GetBalance returns the current balance for a single account.
// GET /accounts/{id}/balances
func (c *Client) GetBalance(accessToken, accountID string) (*Balance, error) {
	var bal Balance
	if err := c.get(accessToken, "/accounts/"+url.PathEscape(accountID)+"/balances", &bal); err != nil {
		return nil, err
	}
	return &bal, nil
}

// ListTransactions returns transactions for an account on or after startDate
// (YYYY-MM-DD). It paginates internally using Teller's backward `from_id`
// cursor, up to txMaxPages pages.
func (c *Client) ListTransactions(accessToken, accountID, startDate string) ([]Transaction, error) {
	base := "/accounts/" + url.PathEscape(accountID) + "/transactions"
	var all []Transaction
	fromID := ""

	for page := 0; page < txMaxPages; page++ {
		q := url.Values{}
		q.Set("count", fmt.Sprintf("%d", txPageSize))
		if startDate != "" {
			q.Set("start_date", startDate)
		}
		if fromID != "" {
			q.Set("from_id", fromID)
		}

		var batch []Transaction
		if err := c.get(accessToken, base+"?"+q.Encode(), &batch); err != nil {
			return all, err
		}
		all = append(all, batch...)

		if len(batch) < txPageSize {
			break // last page
		}
		fromID = batch[len(batch)-1].ID
	}
	return all, nil
}
