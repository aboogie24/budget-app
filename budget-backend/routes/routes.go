package routes

import (
	"log"

	"github.com/aboogie/budget-backend/handlers"
	plaidclient "github.com/aboogie/budget-backend/internal/plaid"

	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {

	log.Print("Setting up Routes")

	plaid := plaidclient.NewClient()

	// Transactions
	r.HandleFunc("/transactions", handlers.CreateTransaction).Methods("POST")
	r.HandleFunc("/transactions", handlers.GetTransactions).Methods("GET")
	r.HandleFunc("/transactions/{id}", handlers.DeleteTransaction).Methods("Delete")

	// Auth
	r.HandleFunc("/users/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/users/login", handlers.LoginUser).Methods("POST")

	// Categories
	r.HandleFunc("/categories", handlers.GetCategories).Methods("GET")
	r.HandleFunc("/categories", handlers.CreateCategory).Methods("POST")
	r.HandleFunc("/categories/user/{user_id}", handlers.GetCategoriesByUserID).Methods("GET") // ← new route
	r.HandleFunc("/categories/{id}", handlers.UpdateCategory).Methods("PUT")
	r.HandleFunc("/categories/{id}", handlers.DeleteCategory).Methods("DELETE")

	// Budgets
	r.HandleFunc("/budgets", handlers.CreateBudget).Methods("POST")
	r.HandleFunc("/budgets/user/{user_id}", handlers.GetBudgetsByUser).Methods("GET")
	r.HandleFunc("/budgets/{id}", handlers.UpdateBudget).Methods("PUT")
	r.HandleFunc("/budgets/{id}", handlers.DeleteBudget).Methods("DELETE")

	//Plaid
	r.HandleFunc("/exchange_token", handlers.ExchangeToken(plaid)).Methods("POST")

}
