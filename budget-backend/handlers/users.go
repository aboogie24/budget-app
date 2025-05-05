package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
)

func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	log.Print("Registeration Started")
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
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
		INSERT INTO users (id, email, password)
		VALUES ($1, $2, $3)
	`, user.ID, user.Email, user.Password)
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
			"isFirstLogin": true,
		},
	})
}
