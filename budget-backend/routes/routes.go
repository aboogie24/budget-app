package routes

import (
	"log"

	"github.com/aboogie/budget-backend/handlers"
	"github.com/aboogie/budget-backend/internal/flinks"
	plaidclient "github.com/aboogie/budget-backend/internal/plaid"
	"github.com/aboogie/budget-backend/middleware"

	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {

	log.Print("Setting up Routes")

	plaid := plaidclient.NewClient()

	// Initialize Flinks client (logs availability)
	flinksClient := flinks.NewClient()
	if flinksClient.IsAvailable() {
		log.Println("Flinks client initialized (env=" + flinksClient.Env() + ")")
	}

	r.Use(middleware.RecoveryMiddleware)
	r.Use(middleware.Logging)

	authRoutes := r.PathPrefix("/auth").Subrouter()
	authRoutes.Use(middleware.RequireAuth)

	// Transactions
	authRoutes.HandleFunc("/transactions/backfill-categories", handlers.BackfillTransactionCategories).Methods("POST")
	authRoutes.HandleFunc("/transactions", handlers.CreateTransaction).Methods("POST")
	authRoutes.HandleFunc("/transactions", handlers.GetTransactions).Methods("GET")
	authRoutes.HandleFunc("/transactions/{id}/split", handlers.SplitTransaction).Methods("POST")
	authRoutes.HandleFunc("/transactions/{id}/split", handlers.GetTransactionSplits).Methods("GET")
	authRoutes.HandleFunc("/transactions/{id}/split", handlers.UpdateTransactionSplits).Methods("PUT")
	authRoutes.HandleFunc("/transactions/{id}/split", handlers.DeleteTransactionSplits).Methods("DELETE")
	authRoutes.HandleFunc("/transactions/{id}", handlers.UpdateTransaction).Methods("PUT")
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
	authRoutes.HandleFunc("/debts/{id}/category", handlers.UpdateDebtCategory).Methods("PUT")
	authRoutes.HandleFunc("/debts/grouped", handlers.ListDebtsByCategory).Methods("GET")
	authRoutes.HandleFunc("/priorities", handlers.ListFinancialPriorities).Methods("GET")
	authRoutes.HandleFunc("/priorities", handlers.CreateFinancialPriority).Methods("POST")
	authRoutes.HandleFunc("/priorities/{id}", handlers.UpdateFinancialPriority).Methods("PUT")
	authRoutes.HandleFunc("/priorities/{id}", handlers.DeleteFinancialPriority).Methods("DELETE")
	authRoutes.HandleFunc("/priorities/reorder", handlers.ReorderFinancialPriorities).Methods("PATCH")
	authRoutes.HandleFunc("/trips", handlers.ListTrips).Methods("GET")
	authRoutes.HandleFunc("/trips", handlers.CreateTrip).Methods("POST")
	authRoutes.HandleFunc("/sharing-preferences", handlers.GetSharingPreferences).Methods("GET")
	authRoutes.HandleFunc("/sharing-preferences", handlers.UpsertSharingPreferences).Methods("POST")
	authRoutes.HandleFunc("/bank/sync", handlers.SyncBankAccount).Methods("POST")
	authRoutes.HandleFunc("/bank/providers", handlers.GetBankProviders).Methods("GET")

	// Flinks (bank connection)
	authRoutes.HandleFunc("/flinks/authorize-token", handlers.FlinksAuthorizeToken).Methods("POST")
	authRoutes.HandleFunc("/flinks/connect", handlers.FlinksConnect).Methods("POST")
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

	// Auth (Login, Register, OAuth)
	r.HandleFunc("/users/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/users/login", handlers.LoginUser).Methods("POST")
	r.HandleFunc("/users/oauth/google", handlers.GoogleOAuth).Methods("POST")
	r.HandleFunc("/users/oauth/apple", handlers.AppleOAuth).Methods("POST")

	// User (Logut)
	r.HandleFunc("/user/logout", handlers.LogoutUser).Methods("POST")

	// Categories (behind auth)
	authRoutes.HandleFunc("/categories", handlers.GetCategories).Methods("GET")
	authRoutes.HandleFunc("/categories", handlers.CreateCategory).Methods("POST")
	authRoutes.HandleFunc("/categories/user/{user_id}", handlers.GetCategoriesByUserID).Methods("GET")
	authRoutes.HandleFunc("/categories/{id}", handlers.UpdateCategory).Methods("PUT")
	authRoutes.HandleFunc("/categories/{id}", handlers.DeleteCategory).Methods("DELETE")

	// Category Mapping Rules (behind auth)
	authRoutes.HandleFunc("/category-rules", handlers.ListCategoryRules).Methods("GET")
	authRoutes.HandleFunc("/category-rules", handlers.CreateCategoryRule).Methods("POST")
	authRoutes.HandleFunc("/category-rules/from-edit", handlers.CreateRuleFromEdit).Methods("POST")
	authRoutes.HandleFunc("/category-rules/{id}", handlers.UpdateCategoryRule).Methods("PUT")
	authRoutes.HandleFunc("/category-rules/{id}", handlers.DeleteCategoryRule).Methods("DELETE")

	// Budgets (behind auth)
	authRoutes.HandleFunc("/budgets", handlers.CreateBudget).Methods("POST")
	authRoutes.HandleFunc("/budgets/user/{user_id}", handlers.GetBudgetsByUser).Methods("GET")
	authRoutes.HandleFunc("/budgets/user/{user_id}/summary", handlers.GetBudgetSummary).Methods("GET")
	authRoutes.HandleFunc("/budgets/{id}", handlers.GetBudgetByID).Methods("GET")
	authRoutes.HandleFunc("/budgets/{id}", handlers.UpdateBudget).Methods("PUT")
	authRoutes.HandleFunc("/budgets/{id}", handlers.DeleteBudget).Methods("DELETE")

	// Plaid (behind auth)
	authRoutes.HandleFunc("/link_token", handlers.CreateLinkToken(plaid)).Methods("GET")
	authRoutes.HandleFunc("/exchange_token", handlers.ExchangeToken(plaid)).Methods("POST")
	authRoutes.HandleFunc("/linked-accounts/status", handlers.GetLinkedAccountStatus).Methods("GET")
	authRoutes.HandleFunc("/plaid/update-link-token", handlers.CreateUpdateLinkToken(plaid)).Methods("POST")
	authRoutes.HandleFunc("/linked-accounts/{id}/reset", handlers.ResetItemError).Methods("PUT")

	// Plaid link page (public — serves HTML for WebView)
	r.HandleFunc("/plaid/link-page", handlers.PlaidLinkPage).Methods("GET")

	// Plaid webhooks (public — receives real-time updates from Plaid)
	r.HandleFunc("/webhooks/plaid", handlers.HandlePlaidWebhook(plaid)).Methods("POST")

	// Flinks webhooks (public — no auth)
	r.HandleFunc("/webhooks/flinks", handlers.FlinksWebhook).Methods("POST")

	// Push Notifications (behind auth)
	authRoutes.HandleFunc("/push-token", handlers.RegisterPushToken).Methods("POST")
	authRoutes.HandleFunc("/push-token", handlers.UnregisterPushToken).Methods("DELETE")
	authRoutes.HandleFunc("/push-preference", handlers.UpdatePushPreference).Methods("PUT")
	authRoutes.HandleFunc("/push-preference", handlers.GetPushPreference).Methods("GET")

	// Properties (behind auth)
	authRoutes.HandleFunc("/properties", handlers.ListProperties).Methods("GET")
	authRoutes.HandleFunc("/properties", handlers.CreateProperty).Methods("POST")
	authRoutes.HandleFunc("/properties/{id}", handlers.UpdateProperty).Methods("PUT")
	authRoutes.HandleFunc("/properties/{id}", handlers.DeleteProperty).Methods("DELETE")
	authRoutes.HandleFunc("/properties/{id}/refresh", handlers.RefreshPropertyValue).Methods("POST")

	// Households (behind auth)
	authRoutes.HandleFunc("/households", handlers.CreateHousehold).Methods("POST")
	authRoutes.HandleFunc("/households/invite", handlers.CreateHouseholdInvite).Methods("POST")
	authRoutes.HandleFunc("/households/accept", handlers.AcceptHouseholdInvite).Methods("POST")
	authRoutes.HandleFunc("/households/invites", handlers.ListHouseholdInvites).Methods("GET")
	authRoutes.HandleFunc("/households/me", handlers.GetHouseholdForUser).Methods("GET")
	authRoutes.HandleFunc("/households/summary", handlers.GetHouseholdSummary).Methods("GET")

	// Activity Feed (behind auth)
	authRoutes.HandleFunc("/activity-feed", handlers.GetActivityFeed).Methods("GET")
	authRoutes.HandleFunc("/activity-feed", handlers.RecordActivityEvent).Methods("POST")

	// Spending Alerts (behind auth)
	authRoutes.HandleFunc("/spending-alerts", handlers.GetSpendingAlerts).Methods("GET")
	authRoutes.HandleFunc("/spending-alerts", handlers.UpsertSpendingAlert).Methods("POST")
	authRoutes.HandleFunc("/spending-alerts/check", handlers.CheckBudgetThresholds).Methods("POST")

	// Currencies (behind auth)
	authRoutes.HandleFunc("/currencies", handlers.GetSupportedCurrencies).Methods("GET")
	authRoutes.HandleFunc("/currencies/default", handlers.GetUserCurrency).Methods("GET")
	authRoutes.HandleFunc("/currencies/default", handlers.SetUserCurrency).Methods("PUT")

	// AI Chat (behind auth)
	authRoutes.HandleFunc("/ai/conversations", handlers.CreateAIConversation).Methods("POST")
	authRoutes.HandleFunc("/ai/conversations", handlers.ListAIConversations).Methods("GET")
	authRoutes.HandleFunc("/ai/conversations/{id}", handlers.GetAIConversation).Methods("GET")
	authRoutes.HandleFunc("/ai/conversations/{id}/messages", handlers.SendAIMessage).Methods("POST")
	authRoutes.HandleFunc("/ai/conversations/{id}", handlers.DeleteAIConversation).Methods("DELETE")

	// Financial Plans (behind auth)
	authRoutes.HandleFunc("/plans", handlers.CreatePlan).Methods("POST")
	authRoutes.HandleFunc("/plans", handlers.ListPlans).Methods("GET")
	authRoutes.HandleFunc("/plans/{id}", handlers.GetPlan).Methods("GET")
	authRoutes.HandleFunc("/plans/{id}", handlers.UpdatePlan).Methods("PUT")
	authRoutes.HandleFunc("/plans/{id}", handlers.DeletePlan).Methods("DELETE")
	authRoutes.HandleFunc("/plans/{id}/approve", handlers.ApprovePlan).Methods("POST")
	authRoutes.HandleFunc("/plans/{id}/reject", handlers.RejectPlan).Methods("POST")
	authRoutes.HandleFunc("/plans/{id}/approvals", handlers.GetPlanApprovals).Methods("GET")

	// Milestones
	authRoutes.HandleFunc("/plans/{id}/milestones", handlers.CreateMilestone).Methods("POST")
	authRoutes.HandleFunc("/plans/{planId}/milestones/{milestoneId}", handlers.UpdateMilestone).Methods("PUT")

	// Snapshots & Progress
	authRoutes.HandleFunc("/plans/{id}/snapshots", handlers.CreateSnapshot).Methods("POST")
	authRoutes.HandleFunc("/plans/{id}/progress", handlers.GetPlanProgress).Methods("GET")

	// Framework Level
	authRoutes.HandleFunc("/ai/framework-level", handlers.GetFrameworkLevel).Methods("GET")

	// AI Nudges
	authRoutes.HandleFunc("/ai/nudges", handlers.GetNudges).Methods("GET")
	authRoutes.HandleFunc("/ai/nudges/generate", handlers.GenerateNudgesNow).Methods("POST")
	authRoutes.HandleFunc("/ai/nudges/{id}/dismiss", handlers.DismissNudge).Methods("POST")

	// What-if & Monthly Review
	authRoutes.HandleFunc("/ai/what-if", handlers.SimulateWhatIf).Methods("POST")
	authRoutes.HandleFunc("/ai/monthly-review", handlers.GetMonthlyReview).Methods("GET")

}
