package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
)

// CompleteOnboarding saves the user's monthly budget goal and marks onboarding done.
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

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`
		UPDATE users SET monthly_budget_goal = $1, onboarding_complete = TRUE WHERE id = $2
	`, req.MonthlyBudgetGoal, req.UserID)
	if err != nil {
		log.Printf("CompleteOnboarding error: %v", err)
		http.Error(w, "Failed to save onboarding", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"status": "onboarding complete"})
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

	conn, err := db.Init()
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
			"id":           user.ID,
			"email":        user.Email,
			"full_name":    user.FullName,
			"isFirstLogin": true,
		},
	})
}
