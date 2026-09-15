package routes

import (
	"github.com/aboogie/budget-backend/handlers"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/gorilla/mux"
)

// MountC026 attaches C026 first-run routes on /auth (same auth gate as SetupRoutes).
func MountC026(r *mux.Router) {
	auth := r.PathPrefix("/auth").Subrouter()
	auth.Use(middleware.RequireAuth)
	auth.HandleFunc("/budgets/bootstrap", handlers.BootstrapBudgets).Methods("POST")
	auth.HandleFunc("/users/me", handlers.GetCurrentUser).Methods("GET")
}
