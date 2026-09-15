package routes

import (
	"github.com/aboogie/budget-backend/handlers"
	"github.com/gorilla/mux"
)

// registerC026Onboarding wires first-run endpoints (household bootstrap is on CreateHousehold).
func registerC026Onboarding(auth *mux.Router) {
	auth.HandleFunc("/budgets/bootstrap", handlers.BootstrapBudgets).Methods("POST")
	auth.HandleFunc("/users/me", handlers.GetCurrentUser).Methods("GET")
}
