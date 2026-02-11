package plaid

import (
	"log"
	"os"

	"github.com/aboogie/budget-backend/models"

	"github.com/plaid/plaid-go/v20/plaid"
)

func NewClient() *models.Client {
	config := plaid.NewConfiguration()
	config.AddDefaultHeader("PLAID-CLIENT-ID", os.Getenv("PLAID_CLIENT_ID"))
	config.AddDefaultHeader("PLAID-SECRET", os.Getenv("PLAID_SECRET"))

	env := os.Getenv("PLAID_ENV")
	switch env {
	case "production":
		config.UseEnvironment(plaid.Production)
	case "development":
		config.UseEnvironment(plaid.Development)
	default:
		config.UseEnvironment(plaid.Sandbox)
	}

	log.Printf("Plaid client initialized (env=%s)", env)
	apiClient := plaid.NewAPIClient(config)
	return &models.Client{API: apiClient}
}
