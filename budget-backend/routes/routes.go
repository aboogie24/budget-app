package routes

import (
	"github.com/aboogie/budget-backend/handlers"

	"github.com/gorilla/mux"
)

func SetupRoutes(r *mux.Router) {
	r.HandleFunc("/transactions", handlers.CreateTransaction).Methods("POST")
	r.HandleFunc("/users/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/users/login", handlers.LoginUser).Methods("POST")
}
