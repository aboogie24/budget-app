package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
)

func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`
		INSERT INTO users (id, email, password)
		VALUES ($1, $2, $3)
	`, user.ID, user.Email, user.Password)
	if err != nil {
		http.Error(w, "Failed to register user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "user registered"})
}
