package routes

import (
	"log"

	"github.com/aboogie/budget-backend/handlers"
	plaidclient "github.com/aboogie/budget-backend/internal/plaid"
	"github.com/aboogie/budget-backend/middleware"

	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {

	log.Print("Setting up Routes")

	plaid := plaidclient.NewClient()

	r.Use(middleware.Logging)

	authRoutes := r.PathPrefix("/auth").Subrouter()
	authRoutes.Use(middleware.RequireAuth)

	// Transactions
	authRoutes.HandleFunc("/transactions", handlers.CreateTransaction).Methods("POST")
	authRoutes.HandleFunc("/transactions", handlers.GetTransactions).Methods("GET")
	authRoutes.HandleFunc("/transactions/{id}", handlers.DeleteTransaction).Methods("Delete")
	authRoutes.HandleFunc("/savings-goals", handlers.ListSavingsGoals).Methods("GET")
	authRoutes.HandleFunc("/savings-goals", handlers.CreateSavingsGoal).Methods("POST")
	authRoutes.HandleFunc("/savings-goals/{id}", handlers.UpdateSavingsGoal).Methods("PUT")
	authRoutes.HandleFunc("/savings-goals/{id}/progress", handlers.UpdateSavingsProgress).Methods("PATCH")
	authRoutes.HandleFunc("/linked-accounts", handlers.ListLinkedAccounts).Methods("GET")
	authRoutes.HandleFunc("/linked-accounts", handlers.DeleteLinkedAccount).Methods("DELETE")
	authRoutes.HandleFunc("/debts", handlers.ListDebts).Methods("GET")
	authRoutes.HandleFunc("/debts", handlers.CreateDebt).Methods("POST")
	authRoutes.HandleFunc("/debts/{id}", handlers.UpdateDebt).Methods("PUT")
	authRoutes.HandleFunc("/debts/{id}/payment", handlers.ApplyDebtPayment).Methods("PATCH")
	authRoutes.HandleFunc("/priorities", handlers.ListFinancialPriorities).Methods("GET")
	authRoutes.HandleFunc("/priorities", handlers.CreateFinancialPriority).Methods("POST")
	authRoutes.HandleFunc("/priorities/{id}", handlers.UpdateFinancialPriority).Methods("PUT")
	authRoutes.HandleFunc("/priorities/{id}", handlers.DeleteFinancialPriority).Methods("DELETE")
	authRoutes.HandleFunc("/priorities/reorder", handlers.ReorderFinancialPriorities).Methods("PATCH")
	authRoutes.HandleFunc("/trips", handlers.ListTrips).Methods("GET")
	authRoutes.HandleFunc("/trips", handlers.CreateTrip).Methods("POST")
	authRoutes.HandleFunc("/sharing-preferences", handlers.GetSharingPreferences).Methods("GET")
	authRoutes.HandleFunc("/sharing-preferences", handlers.UpsertSharingPreferences).Methods("POST")
	authRoutes.HandleFunc("/plaid/sync", handlers.SyncTransactions(plaid)).Methods("POST")
	authRoutes.HandleFunc("/plaid/investments", handlers.SyncInvestments(plaid)).Methods("POST")
	authRoutes.HandleFunc("/plaid/investments", handlers.GetInvestmentHoldings).Methods("GET")
	authRoutes.HandleFunc("/plaid/liabilities", handlers.SyncLiabilities(plaid)).Methods("POST")
	authRoutes.HandleFunc("/plaid/liabilities", handlers.GetLiabilities).Methods("GET")
	authRoutes.HandleFunc("/plaid/balances", handlers.SyncAccountBalances(plaid)).Methods("POST")
	authRoutes.HandleFunc("/plaid/balances", handlers.GetAccountBalances).Methods("GET")
	authRoutes.HandleFunc("/recurring/process", handlers.ProcessRecurring).Methods("POST")
	authRoutes.HandleFunc("/insights", handlers.GetSpendingInsights).Methods("GET")
	authRoutes.HandleFunc("/top-categories", handlers.GetTopMerchants).Methods("GET")
	authRoutes.HandleFunc("/refresh", handlers.RefreshTokenHandler).Methods("POST")
	authRoutes.HandleFunc("/onboarding/complete", handlers.CompleteOnboarding).Methods("POST")

	// Bills
	authRoutes.HandleFunc("/bills", handlers.ListBills).Methods("GET")
	authRoutes.HandleFunc("/bills", handlers.CreateBill).Methods("POST")
	authRoutes.HandleFunc("/bills/auto-detect", handlers.AutoDetectBillPayments).Methods("POST")
	authRoutes.HandleFunc("/bills/{id}", handlers.UpdateBill).Methods("PUT")
	authRoutes.HandleFunc("/bills/{id}", handlers.DeleteBill).Methods("DELETE")
	authRoutes.HandleFunc("/bills/{id}/pay", handlers.MarkBillPaid).Methods("POST")
	authRoutes.HandleFunc("/bills/{id}/payments", handlers.ListBillPayments).Methods("GET")

	// Auth (Login, Register)
	r.HandleFunc("/users/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/users/login", handlers.LoginUser).Methods("POST")

	// User (Logut)
	r.HandleFunc("/user/logout", handlers.LogoutUser).Methods("POST")

	// Categories (behind auth)
	authRoutes.HandleFunc("/categories", handlers.GetCategories).Methods("GET")
	authRoutes.HandleFunc("/categories", handlers.CreateCategory).Methods("POST")
	authRoutes.HandleFunc("/categories/user/{user_id}", handlers.GetCategoriesByUserID).Methods("GET")
	authRoutes.HandleFunc("/categories/{id}", handlers.UpdateCategory).Methods("PUT")
	authRoutes.HandleFunc("/categories/{id}", handlers.DeleteCategory).Methods("DELETE")

	// Budgets (behind auth)
	authRoutes.HandleFunc("/budgets", handlers.CreateBudget).Methods("POST")
	authRoutes.HandleFunc("/budgets/user/{user_id}", handlers.GetBudgetsByUser).Methods("GET")
	authRoutes.HandleFunc("/budgets/user/{user_id}/summary", handlers.GetBudgetSummary).Methods("GET")
	authRoutes.HandleFunc("/budgets/{id}", handlers.UpdateBudget).Methods("PUT")
	authRoutes.HandleFunc("/budgets/{id}", handlers.DeleteBudget).Methods("DELETE")

	// Plaid (behind auth)
	authRoutes.HandleFunc("/link_token", handlers.CreateLinkToken(plaid)).Methods("GET")
	authRoutes.HandleFunc("/exchange_token", handlers.ExchangeToken(plaid)).Methods("POST")

	// Plaid link page (public — serves HTML for WebView)
	r.HandleFunc("/plaid/link-page", handlers.PlaidLinkPage).Methods("GET")

	// Households (behind auth)
	authRoutes.HandleFunc("/households", handlers.CreateHousehold).Methods("POST")
	authRoutes.HandleFunc("/households/invite", handlers.CreateHouseholdInvite).Methods("POST")
	authRoutes.HandleFunc("/households/accept", handlers.AcceptHouseholdInvite).Methods("POST")
	authRoutes.HandleFunc("/households/invites", handlers.ListHouseholdInvites).Methods("GET")
	authRoutes.HandleFunc("/households/me", handlers.GetHouseholdForUser).Methods("GET")

}
