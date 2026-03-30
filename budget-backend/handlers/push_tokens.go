package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/google/uuid"
)

var pushDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// RegisterPushToken upserts a push token for a user.
// POST /auth/push-token  body: { user_id, token, platform? }
func RegisterPushToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID   string `json:"user_id"`
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" || body.Token == "" {
		http.Error(w, "invalid body: user_id and token required", http.StatusBadRequest)
		return
	}
	if body.Platform == "" {
		body.Platform = "expo"
	}

	client, err := pushDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	now := time.Now()

	// Upsert: if the token already exists, update user_id and re-enable it.
	_, err = client.Exec(`
		INSERT INTO push_tokens (id, user_id, token, platform, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, true, $5, $5)
		ON CONFLICT (token) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			platform = EXCLUDED.platform,
			enabled = true,
			updated_at = $5
	`, uuid.New().String(), body.UserID, body.Token, body.Platform, now)
	if err != nil {
		log.Printf("RegisterPushToken error: %v", err)
		http.Error(w, "insert error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "registered"})
}

// UnregisterPushToken removes a push token.
// DELETE /auth/push-token  body: { token }
func UnregisterPushToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Token == "" {
		http.Error(w, "invalid body: token required", http.StatusBadRequest)
		return
	}

	client, err := pushDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	_, err = client.Exec(`DELETE FROM push_tokens WHERE token = $1`, body.Token)
	if err != nil {
		log.Printf("UnregisterPushToken error: %v", err)
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdatePushPreference toggles notifications on/off for all of a user's tokens.
// PUT /auth/push-preference  body: { user_id, enabled }
func UpdatePushPreference(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID  string `json:"user_id"`
		Enabled *bool  `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.UserID == "" || body.Enabled == nil {
		http.Error(w, "invalid body: user_id and enabled required", http.StatusBadRequest)
		return
	}

	client, err := pushDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	_, err = client.Exec(`
		UPDATE push_tokens SET enabled = $1, updated_at = $2 WHERE user_id = $3
	`, *body.Enabled, time.Now(), body.UserID)
	if err != nil {
		log.Printf("UpdatePushPreference error: %v", err)
		http.Error(w, "update error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"enabled": *body.Enabled})
}

// GetPushPreference returns whether push notifications are enabled for a user.
// GET /auth/push-preference?user_id=...
func GetPushPreference(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	client, err := pushDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var enabled bool
	err = client.QueryRow(`
		SELECT COALESCE(bool_or(enabled), false) FROM push_tokens WHERE user_id = $1
	`, userID).Scan(&enabled)
	if err != nil {
		enabled = false
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"enabled": enabled})
}
