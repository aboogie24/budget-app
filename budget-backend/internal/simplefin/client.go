// Package simplefin implements the SimpleFIN Bridge protocol
// (https://www.simplefin.org/protocol.html). SimpleFIN is user-funded: the
// user connects their banks at the SimpleFIN Bridge and hands the app a
// one-time SETUP TOKEN (a base64-encoded claim URL). Claiming it returns an
// ACCESS URL with embedded basic-auth credentials that we store as the linked
// account's access token. No app-level API keys or client certificates exist —
// the client is always "available".
package simplefin

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const requestTimeout = 30 * time.Second

// Account is one bank account behind a SimpleFIN connection.
type Account struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	Currency         string        `json:"currency"`
	Balance          string        `json:"balance"`           // decimal string
	AvailableBalance string        `json:"available-balance"` // decimal string, optional
	BalanceDate      int64         `json:"balance-date"`      // unix epoch
	Transactions     []Transaction `json:"transactions"`
	// Older protocol (used by the beta bridge): the institution rides on the
	// account. Newer protocol: a top-level connections list keyed by conn_id.
	Org    Org    `json:"org"`
	ConnID string `json:"conn_id"`
}

// Org identifies the financial institution (older protocol shape).
type Org struct {
	Name   string `json:"name"`
	Domain string `json:"domain"`
}

// Connection identifies the institution (newer protocol shape).
type Connection struct {
	ConnID string `json:"conn_id"`
	Name   string `json:"name"`
	OrgID  string `json:"org_id"`
	OrgURL string `json:"org_url"`
}

// Transaction is one bank transaction. Amount is a decimal string where
// positive = deposit and negative = withdrawal.
type Transaction struct {
	ID           string `json:"id"`
	Posted       int64  `json:"posted"` // unix epoch; 0 while pending
	Amount       string `json:"amount"`
	Description  string `json:"description"`
	Pending      bool   `json:"pending"`
	TransactedAt int64  `json:"transacted_at"` // unix epoch, optional
}

// AccountSet is the /accounts response envelope.
type AccountSet struct {
	Errors      []string     `json:"errors"`
	ErrList     []string     `json:"errlist"`
	Accounts    []Account    `json:"accounts"`
	Connections []Connection `json:"connections"`
}

// InstitutionFor resolves the institution name for an account across both
// protocol shapes, falling back to the org domain, then a generic label.
func (s *AccountSet) InstitutionFor(a Account) string {
	if a.Org.Name != "" {
		return a.Org.Name
	}
	for _, c := range s.Connections {
		if c.ConnID != "" && c.ConnID == a.ConnID {
			if c.Name != "" {
				return c.Name
			}
			return c.OrgURL
		}
	}
	if a.Org.Domain != "" {
		return a.Org.Domain
	}
	return "SimpleFIN"
}

var httpClient = &http.Client{Timeout: requestTimeout}

// ClaimSetupToken exchanges a one-time setup token for the permanent access
// URL. The token is a base64-encoded claim URL that must be POSTed to exactly
// once — a second claim returns 403.
func ClaimSetupToken(setupToken string) (string, error) {
	trimmed := strings.TrimSpace(setupToken)
	if trimmed == "" {
		return "", fmt.Errorf("setup token is empty")
	}

	decoded, err := base64.StdEncoding.DecodeString(trimmed)
	if err != nil {
		// Some UIs copy tokens with URL-safe encoding.
		decoded, err = base64.URLEncoding.DecodeString(trimmed)
		if err != nil {
			return "", fmt.Errorf("setup token is not valid base64")
		}
	}
	claimURL := strings.TrimSpace(string(decoded))
	parsed, err := url.Parse(claimURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", fmt.Errorf("setup token does not decode to an https claim URL")
	}

	resp, err := httpClient.Post(claimURL, "application/json", nil)
	if err != nil {
		return "", fmt.Errorf("claim request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	accessURL := strings.TrimSpace(string(body))
	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusForbidden:
		return "", fmt.Errorf("setup token was already used or is invalid — generate a new one at your SimpleFIN bridge")
	default:
		return "", fmt.Errorf("claim failed with status %d", resp.StatusCode)
	}

	parsedAccess, err := url.Parse(accessURL)
	if err != nil || parsedAccess.Scheme != "https" || parsedAccess.User == nil {
		return "", fmt.Errorf("bridge returned an unexpected access URL")
	}
	return accessURL, nil
}

// FetchAccounts retrieves accounts (and their transactions since startDate)
// from the access URL. Pending transactions are included so they can upsert to
// posted later. Set balancesOnly to skip transaction payloads.
func FetchAccounts(accessURL string, startDate time.Time, balancesOnly bool) (*AccountSet, error) {
	base, err := url.Parse(strings.TrimRight(accessURL, "/"))
	if err != nil {
		return nil, fmt.Errorf("bad access url: %w", err)
	}
	q := url.Values{}
	if balancesOnly {
		q.Set("balances-only", "1")
	} else {
		q.Set("start-date", fmt.Sprintf("%d", startDate.Unix()))
		q.Set("pending", "1")
	}
	endpoint := base.String() + "/accounts?" + q.Encode()

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("accounts request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("access denied by bridge (%d) — the connection may have been revoked", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<12))
		return nil, fmt.Errorf("accounts request returned %d: %s", resp.StatusCode, string(body))
	}

	var set AccountSet
	if err := decodeJSON(resp.Body, &set); err != nil {
		return nil, fmt.Errorf("decode accounts: %w", err)
	}
	return &set, nil
}

func decodeJSON(r io.Reader, v interface{}) error {
	body, err := io.ReadAll(io.LimitReader(r, 16<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}
