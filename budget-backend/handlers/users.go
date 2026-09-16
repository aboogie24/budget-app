package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/entitlements"
	"github.com/aboogie/budget-backend/models"
)

// CompleteOnboarding saves the user's monthly budget goal and marks onboarding done.
// Ensures a household exists so finish never leaves the user household-less.
func CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID            string  `json:"user_id"`
		MonthlyBudgetGoal float64 `json:"monthly_budget_goal"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		validationError(w, "user_id is required")
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	if _, err := db.EnsureHouseholdForUser(conn.Conn, req.UserID); err != nil {
		log.Printf("CompleteOnboarding ensure household: %v", err)
		http.Error(w, "Failed to ensure household", http.StatusInternalServerError)
		return
	}

	res, err := conn.Exec(`
		UPDATE users SET monthly_budget_goal = $1, onboarding_complete = TRUE WHERE id = $2
	`, req.MonthlyBudgetGoal, req.UserID)
	if err != nil {
		log.Printf("CompleteOnboarding error: %v", err)
		http.Error(w, "Failed to save onboarding", http.StatusInternalServerError)
		return
	}
	n, err := res.RowsAffected()
	if err != nil {
		log.Printf("CompleteOnboarding rows affected: %v", err)
		http.Error(w, "Failed to save onboarding", http.StatusInternalServerError)
		return
	}
	if n == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":              "onboarding complete",
		"onboarding_complete": true,
		"user_id":             req.UserID,
		"monthly_budget_goal": req.MonthlyBudgetGoal,
	})
}

// GetCurrentUser returns the user profile including onboarding_complete so cold
// starts can avoid bouncing into the wizard after finish (anvil writes AsyncStorage).
// GET /auth/users/me?user_id=
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		validationError(w, "user_id is required")
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	var (
		id                 string
		email              string
		fullName           string
		onboardingComplete bool
		monthlyBudgetGoal  float64
	)
	err = conn.QueryRow(`
		SELECT id, email, COALESCE(full_name, ''), COALESCE(onboarding_complete, FALSE),
		       COALESCE(monthly_budget_goal, 0)
		FROM users WHERE id = $1
	`, userID).Scan(&id, &email, &fullName, &onboardingComplete, &monthlyBudgetGoal)
	if err == sql.ErrNoRows {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("GetCurrentUser error: %v", err)
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}

	resp := map[string]any{
		"id":                  id,
		"email":               email,
		"full_name":           fullName,
		"onboarding_complete": onboardingComplete,
		"monthly_budget_goal": monthlyBudgetGoal,
	}
	if ent, err := entitlements.ResolveForUser(conn.Raw(), userID); err == nil {
		resp["entitlements"] = ent
		resp["plan"] = ent.Plan
	} else {
		log.Printf("GetCurrentUser entitlements: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	log.Print("Registration Started")
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Input validation
	if user.Email == "" || !isValidEmail(user.Email) {
		validationError(w, "A valid email address is required")
		return
	}
	if len(user.Password) < 8 {
		validationError(w, "Password must be at least 8 characters")
		return
	}
	if user.ID == "" {
		validationError(w, "User ID is required")
		return
	}

	if err := user.HashPassword(); err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Check for existing user
	var existingID string
	err = conn.QueryRow("SELECT id FROM users WHERE email = $1", user.Email).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}
	if existingID != "" {
		http.Error(w, "Email already registered", http.StatusConflict)
		return
	}

	_, err = conn.Exec(`
		INSERT INTO users (id, email, full_name, password)
		VALUES ($1, $2, $3, $4)
	`, user.ID, user.Email, user.FullName, user.Password)
	if err != nil {
		http.Error(w, "Failed to register user", http.StatusInternalServerError)
		log.Print("Failed to register user", http.StatusInternalServerError)
		return
	}
	log.Print("Registeration Complete for user ", user.Email)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"status": "user registered",
		"user": map[string]any{
			"id":                  user.ID,
			"email":               user.Email,
			"full_name":           user.FullName,
			"isFirstLogin":        true,
			"onboarding_complete": false,
		},
	})
}
