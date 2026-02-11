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

	if loginReq.Email == "" || loginReq.Password == "" {
		validationError(w, "Email and password are required")
		return
	}

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	row := conn.QueryRow("SELECT id, email, COALESCE(full_name,''), password, COALESCE(onboarding_complete, FALSE) FROM users WHERE email = $1", loginReq.Email)
	var user models.User
	var onboardingComplete bool
	if err := row.Scan(&user.ID, &user.Email, &user.FullName, &user.Password, &onboardingComplete); err != nil {
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
			"id":                  user.ID,
			"email":               user.Email,
			"full_name":           user.FullName,
			"onboarding_complete": onboardingComplete,
		},
	})
}

// RefreshTokenHandler accepts a valid Bearer token and returns a new one
// with a fresh expiry. The client should call this before the token expires.
func RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || len(authHeader) < 8 {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}
	tokenStr := authHeader[7:] // strip "Bearer "

	newToken, userID, err := auth.RefreshToken(tokenStr)
	if err != nil {
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"token":   newToken,
		"user_id": userID,
	})
}

func LogoutUser(w http.ResponseWriter, r *http.Request) {
	session, _ := middleware.GetSession(w, r)
	delete(session.Values, "user_id")
	session.Save(r, w)
	w.WriteHeader(http.StatusOK)
}
