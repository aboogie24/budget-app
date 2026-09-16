package routes

import (
	"github.com/aboogie/budget-backend/handlers"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/gorilla/mux"
)

// MountC031 attaches household entitlements routes (Free|Plus). No billing rails.
func MountC031(r *mux.Router) {
	auth := r.PathPrefix("/auth").Subrouter()
	auth.Use(middleware.RequireAuth)
	auth.HandleFunc("/entitlements", handlers.GetEntitlements).Methods("GET")
	auth.HandleFunc("/households/plan", handlers.SetHouseholdPlan).Methods("PUT")
}
