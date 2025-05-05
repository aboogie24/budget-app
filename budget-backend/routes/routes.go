package routes

import (
	"github.com/aboogie/budget-backend/handlers"

	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {

	// Transactions
	r.HandleFunc("/transactions", handlers.CreateTransaction).Methods("POST")
	r.HandleFunc("/transactions", handlers.GetTransactions).Methods("GET")
	r.HandleFunc("/transactions/{id}", handlers.DeleteTransaction).Methods("Delete")

	// Auth
	r.HandleFunc("/users/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/users/login", handlers.LoginUser).Methods("POST")

	// Categories
	r.HandleFunc("/categories", handlers.GetCategories).Methods("GET")
}
