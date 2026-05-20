package flinks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const (
	// Flinks base URLs — the instance ID is embedded in the subdomain
	// Format: https://{instanceId}-api.private.fin.ag/v3
	sandboxBaseURL    = "https://toolbox-api.private.fin.ag/v3"
	productionBaseURL = "https://toolbox-api.private.fin.ag/v3"

	// Polling config for async 202 responses
	pollInterval   = 10 * time.Second
	pollMaxRetries = 18 // 18 * 10s = 3 minutes
)

// Client wraps the Flinks API.
type Client struct {
	instanceID string
	authKey    string
	baseURL    string
	env        string
	httpClient *http.Client
}

// Env returns the Flinks environment (sandbox or production).
func (c *Client) Env() string { return c.env }

// NewClient creates a Flinks API client from env vars.
// Environment variables:
//   - FLINKS_INSTANCE_ID: your Flinks instance ID
//   - FLINKS_AUTH_KEY: flinks-auth-key header value
//   - FLINKS_ENV: "sandbox" or "production"
func NewClient() *Client {
	instanceID := os.Getenv("FLINKS_INSTANCE_ID")
	authKey := os.Getenv("FLINKS_AUTH_KEY")
	env := os.Getenv("FLINKS_ENV")

	baseURL := sandboxBaseURL
	if env == "production" {
		baseURL = productionBaseURL
	}

	if instanceID == "" || authKey == "" {
		log.Println("WARNING: FLINKS_INSTANCE_ID or FLINKS_AUTH_KEY not set — Flinks features will be unavailable")
	}

	return &Client{
		instanceID: instanceID,
		authKey:    authKey,
		baseURL:    baseURL,
		env:        env,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// IsAvailable returns true if Flinks is configured.
func (c *Client) IsAvailable() bool {
	return c.instanceID != "" && c.authKey != ""
}

// GenerateAuthorizeToken creates a single-use token for Flinks Connect.
// POST /{instanceId}/BankingServices/GenerateAuthorizeToken
func (c *Client) GenerateAuthorizeToken() (string, error) {
	url := fmt.Sprintf("%s/%s/BankingServices/GenerateAuthorizeToken", c.baseURL, c.instanceID)

	payload := GenerateTokenRequest{
		Product: "GetAccountsDetail",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("flinks: marshal token request: %w", err)
	}

	log.Printf("flinks: POST %s", url)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("flinks: create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("flinks-auth-key", c.authKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("flinks: send token request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("flinks: GenerateAuthorizeToken error %d: %s", resp.StatusCode, string(respBody))
	}

	var tokenResp GenerateTokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return "", fmt.Errorf("flinks: decode token response: %w", err)
	}

	log.Printf("flinks: authorize token generated successfully")
	return tokenResp.Token, nil
}

// Authorize authenticates with a loginId after the user completes Flinks Connect.
// POST /{instanceId}/BankingServices/Authorize
func (c *Client) Authorize(loginId string) (string, error) {
	url := fmt.Sprintf("%s/%s/BankingServices/Authorize", c.baseURL, c.instanceID)

	payload := AuthorizeRequest{
		LoginId:          loginId,
		MostRecentCached: true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("flinks: marshal authorize request: %w", err)
	}

	log.Printf("flinks: POST %s (loginId=%s)", url, loginId)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("flinks: create authorize request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("flinks: send authorize request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("flinks: Authorize error %d: %s", resp.StatusCode, string(respBody))
	}

	var authResp AuthorizeResponse
	if err := json.Unmarshal(respBody, &authResp); err != nil {
		return "", fmt.Errorf("flinks: decode authorize response: %w", err)
	}

	log.Printf("flinks: authorized successfully, requestId=%s", authResp.RequestId)
	return authResp.RequestId, nil
}

// GetAccountsDetail fetches full account + transaction data.
// POST /{instanceId}/BankingServices/GetAccountsDetail
// Handles async 202 responses by polling every 10s up to 3 minutes.
func (c *Client) GetAccountsDetail(requestId string) (*AccountsDetailResponse, error) {
	url := fmt.Sprintf("%s/%s/BankingServices/GetAccountsDetail", c.baseURL, c.instanceID)

	for attempt := 0; attempt <= pollMaxRetries; attempt++ {
		payload := AccountsDetailRequest{RequestId: requestId}
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("flinks: marshal accounts detail request: %w", err)
		}

		log.Printf("flinks: POST %s (requestId=%s, attempt=%d)", url, requestId, attempt+1)
		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("flinks: create accounts detail request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("flinks: send accounts detail request: %w", err)
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusAccepted {
			log.Printf("flinks: GetAccountsDetail returned 202, polling in %s...", pollInterval)
			time.Sleep(pollInterval)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("flinks: GetAccountsDetail error %d: %s", resp.StatusCode, string(respBody))
		}

		var detailResp AccountsDetailResponse
		if err := json.Unmarshal(respBody, &detailResp); err != nil {
			return nil, fmt.Errorf("flinks: decode accounts detail response: %w", err)
		}

		log.Printf("flinks: GetAccountsDetail returned %d account(s)", len(detailResp.Accounts))
		return &detailResp, nil
	}

	return nil, fmt.Errorf("flinks: GetAccountsDetail timed out after %d attempts", pollMaxRetries+1)
}

// GetAccountsSummary fetches account balances only (faster, no transactions).
// POST /{instanceId}/BankingServices/GetAccountsSummary
// Handles async 202 responses by polling every 10s up to 3 minutes.
func (c *Client) GetAccountsSummary(requestId string) (*AccountsSummaryResponse, error) {
	url := fmt.Sprintf("%s/%s/BankingServices/GetAccountsSummary", c.baseURL, c.instanceID)

	for attempt := 0; attempt <= pollMaxRetries; attempt++ {
		payload := AccountsSummaryRequest{RequestId: requestId}
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("flinks: marshal accounts summary request: %w", err)
		}

		log.Printf("flinks: POST %s (requestId=%s, attempt=%d)", url, requestId, attempt+1)
		req, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("flinks: create accounts summary request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("flinks: send accounts summary request: %w", err)
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode == http.StatusAccepted {
			log.Printf("flinks: GetAccountsSummary returned 202, polling in %s...", pollInterval)
			time.Sleep(pollInterval)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("flinks: GetAccountsSummary error %d: %s", resp.StatusCode, string(respBody))
		}

		var summaryResp AccountsSummaryResponse
		if err := json.Unmarshal(respBody, &summaryResp); err != nil {
			return nil, fmt.Errorf("flinks: decode accounts summary response: %w", err)
		}

		log.Printf("flinks: GetAccountsSummary returned %d account(s)", len(summaryResp.Accounts))
		return &summaryResp, nil
	}

	return nil, fmt.Errorf("flinks: GetAccountsSummary timed out after %d attempts", pollMaxRetries+1)
}
