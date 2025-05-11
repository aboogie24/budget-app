package plaid

import (
	"log"
	"os"

	"github.com/aboogie/budget-backend/models"

	"github.com/plaid/plaid-go/v20/plaid"
)

func NewClient() *models.Client {
	config := plaid.NewConfiguration()
	log.Print(os.Getenv("PLAID_CLIENT_ID"))
	config.AddDefaultHeader("PLAID-CLIENT-ID", os.Getenv("PLAID_CLIENT_ID"))
	config.AddDefaultHeader("PLAID-SECRET", os.Getenv("PLAID_SECRET"))
	config.UseEnvironment(plaid.Sandbox) // or Development/Production

	apiClient := plaid.NewAPIClient(config)
	return &models.Client{API: apiClient}
}
