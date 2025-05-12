package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/aboogie/budget-backend/models"
)

func LoginUser(w http.ResponseWriter, r *http.Request) {
	var loginReq struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	row := conn.QueryRow("SELECT id, email, password FROM users WHERE email = $1", loginReq.Email)
	var user models.User
	if err := row.Scan(&user.ID, &user.Email, &user.Password); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if !user.CheckPassword(loginReq.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateToken(user.ID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	session, _ := middleware.GetSession(w, r)
	session.Values["user_id"] = user.ID
	session.Save(r, w)

	json.NewEncoder(w).Encode(map[string]any{
		"status": "login successful",
		"token":  token,
		"user": map[string]any{
			"id":           user.ID,
			"email":        user.Email,
			"isFirstLogin": false,
		},
	})
}

func LogoutUser(w http.ResponseWriter, r *http.Request) {
	session, _ := middleware.GetSession(w, r)
	delete(session.Values, "user_id")
	session.Save(r, w)
	w.WriteHeader(http.StatusOK)
}
