package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/models"
	"github.com/plaid/plaid-go/v20/plaid"
)

type exchangeTokenRequest struct {
	PublicToken string `json:"public_token"`
}

type exchangeTokenResponse struct {
	AccessToken string `json:"access_token"`
	ItemID      string `json:"item_id"`
}

// This returns a handler function that has access to your models.Client
func ExchangeToken(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req exchangeTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.PublicToken == "" {
			http.Error(w, "Missing public_token", http.StatusBadRequest)
			return
		}

		resp, _, err := client.API.PlaidApi.ItemPublicTokenExchange(context.Background()).
			ItemPublicTokenExchangeRequest(plaid.ItemPublicTokenExchangeRequest{
				PublicToken: req.PublicToken,
			}).Execute()

		if err != nil {
			http.Error(w, "Plaid token exchange failed: "+err.Error(), http.StatusInternalServerError)
			log.Printf("Plaid token exchange failed")
			return
		}

		json.NewEncoder(w).Encode(exchangeTokenResponse{
			AccessToken: resp.GetAccessToken(),
			ItemID:      resp.GetItemId(),
		})
	}
}

// func CreateLinkToken(client *models.Client) http.HandlerFunc {
// 	return func(w http.ResponseWriter, r *http.Request) {
// 		user := plaid.LinkTokenCreateRequestUser{
// 			ClientUserId: *models.User.ID, // Replace with real user ID in production
// 		}

// 		request := plaid.NewLinkTokenCreateRequest(
// 			"Budget App",
// 			[]plaid.Products{plaid.PRODUCTS_TRANSACTIONS},
// 			"en",
// 			[]string{"US"},
// 			user,
// 		)

// 		resp, _, err := client.API.PlaidApi.LinkTokenCreate(context.Background()).
// 			LinkTokenCreateRequest(*request).
// 			Execute()

// 		if err != nil {
// 			http.Error(w, "Failed to create link token: "+err.Error(), http.StatusInternalServerError)
// 			return
// 		}

// 		json.NewEncoder(w).Encode(map[string]string{
// 			"link_token": resp.GetLinkToken(),
// 		})
// 	}
// }
