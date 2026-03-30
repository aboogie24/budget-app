package plaid

import (
	"fmt"
	"os"
	"strings"
)

// PlaidConfig holds configuration for Plaid API connections
type PlaidConfig struct {
	ClientID    string // Plaid API Client ID
	Secret      string // Plaid API Secret
	Environment string // Environment: sandbox, development, or production
	WebhookURL  string // Webhook URL for receiving Plaid events (optional)
}

// LoadConfig reads Plaid configuration from environment variables
func LoadConfig() (*PlaidConfig, error) {
	clientID := os.Getenv("PLAID_CLIENT_ID")
	secret := os.Getenv("PLAID_SECRET")
	env := strings.ToLower(os.Getenv("PLAID_ENV"))

	if clientID == "" || secret == "" {
		return nil, fmt.Errorf("PLAID_CLIENT_ID and PLAID_SECRET must be set")
	}

	if env == "" {
		env = "sandbox"
	}

	validEnvs := map[string]bool{"sandbox": true, "development": true, "production": true}
	if !validEnvs[env] {
		return nil, fmt.Errorf("PLAID_ENV must be sandbox, development, or production (got: %s)", env)
	}

	webhookURL := os.Getenv("PLAID_WEBHOOK_URL")

	return &PlaidConfig{
		ClientID:    clientID,
		Secret:      secret,
		Environment: env,
		WebhookURL:  webhookURL,
	}, nil
}

// IsProduction returns true if the environment is production
func (c *PlaidConfig) IsProduction() bool {
	return c.Environment == "production"
}

// IsDevelopment returns true if the environment is development
func (c *PlaidConfig) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsSandbox returns true if the environment is sandbox
func (c *PlaidConfig) IsSandbox() bool {
	return c.Environment == "sandbox"
}
