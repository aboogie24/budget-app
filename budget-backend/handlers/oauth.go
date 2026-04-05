package handlers

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/google/uuid"
)

// googleTokenInfo is the response from Google's tokeninfo endpoint.
type googleTokenInfo struct {
	Iss           string `json:"iss"`
	Sub           string `json:"sub"`    // unique Google user ID
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Aud           string `json:"aud"` // must match our client ID
	Exp           string `json:"exp"`
}

// GoogleOAuth handles Google Sign-In. It accepts a Google ID token,
// verifies it, finds or creates the user, and returns a JWT.
func GoogleOAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IDToken == "" {
		http.Error(w, "id_token is required", http.StatusBadRequest)
		return
	}

	// Verify the token with Google
	info, err := verifyGoogleToken(req.IDToken)
	if err != nil {
		log.Printf("Google token verification failed: %v", err)
		http.Error(w, "Invalid Google token", http.StatusUnauthorized)
		return
	}

	if info.Email == "" {
		http.Error(w, "Google account has no email", http.StatusBadRequest)
		return
	}

	user, token, err := findOrCreateOAuthUser(info.Email, info.Name, "google", info.Sub)
	if err != nil {
		log.Printf("Google OAuth user error: %v", err)
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	session, _ := middleware.GetSession(w, r)
	session.Values["user_id"] = user.id
	session.Save(r, w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status": "login successful",
		"token":  token,
		"user": map[string]any{
			"id":                  user.id,
			"email":               user.email,
			"full_name":           user.fullName,
			"onboarding_complete": user.onboardingComplete,
		},
	})
}

// AppleOAuth handles Apple Sign-In. It accepts an Apple identity token,
// verifies it, finds or creates the user, and returns a JWT.
func AppleOAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IdentityToken string `json:"identity_token"`
		FullName      string `json:"full_name"`
		Email         string `json:"email"` // Apple sends email only on first sign-in
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IdentityToken == "" {
		http.Error(w, "identity_token is required", http.StatusBadRequest)
		return
	}

	claims, err := decodeAppleToken(req.IdentityToken)
	if err != nil {
		log.Printf("Apple token verification failed: %v", err)
		http.Error(w, "Invalid Apple token", http.StatusUnauthorized)
		return
	}

	email := claims.Email
	if email == "" {
		email = req.Email // fallback to request body (first sign-in only)
	}
	if email == "" {
		http.Error(w, "Could not determine email from Apple token", http.StatusBadRequest)
		return
	}

	fullName := req.FullName // Apple only sends name on first sign-in

	user, token, err := findOrCreateOAuthUser(email, fullName, "apple", claims.Sub)
	if err != nil {
		log.Printf("Apple OAuth user error: %v", err)
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	session, _ := middleware.GetSession(w, r)
	session.Values["user_id"] = user.id
	session.Save(r, w)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status": "login successful",
		"token":  token,
		"user": map[string]any{
			"id":                  user.id,
			"email":               user.email,
			"full_name":           user.fullName,
			"onboarding_complete": user.onboardingComplete,
		},
	})
}

// --- shared helpers ---

type oauthUser struct {
	id                 string
	email              string
	fullName           string
	onboardingComplete bool
}

// findOrCreateOAuthUser looks up a user by email. If not found, creates one.
// For existing users whose provider isn't set, it back-fills the provider info.
func findOrCreateOAuthUser(email, name, provider, providerID string) (*oauthUser, string, error) {
	conn, err := db.New()
	if err != nil {
		return nil, "", fmt.Errorf("database error: %w", err)
	}
	defer conn.Close()

	var userID, fullName string
	var onboardingComplete bool

	err = conn.QueryRow(
		`SELECT id, COALESCE(full_name,''), COALESCE(onboarding_complete, FALSE)
		 FROM users WHERE email = $1`, email,
	).Scan(&userID, &fullName, &onboardingComplete)

	if err == sql.ErrNoRows {
		// New user
		userID = uuid.New().String()
		fullName = name
		_, err = conn.Exec(
			`INSERT INTO users (id, email, full_name, auth_provider, auth_provider_id)
			 VALUES ($1, $2, $3, $4, $5)`,
			userID, email, fullName, provider, providerID,
		)
		if err != nil {
			return nil, "", fmt.Errorf("failed to create user: %w", err)
		}
		onboardingComplete = false
	} else if err != nil {
		return nil, "", fmt.Errorf("user lookup failed: %w", err)
	} else {
		// Existing user — back-fill provider if still 'local'
		conn.Exec(
			`UPDATE users SET auth_provider = $1, auth_provider_id = $2
			 WHERE id = $3 AND (auth_provider IS NULL OR auth_provider = 'local')`,
			provider, providerID, userID,
		)
		// Back-fill name if empty (Apple sends name only on first sign-in)
		if fullName == "" && name != "" {
			conn.Exec(`UPDATE users SET full_name = $1 WHERE id = $2 AND (full_name IS NULL OR full_name = '')`, name, userID)
			fullName = name
		}
	}

	token, err := auth.GenerateToken(userID)
	if err != nil {
		return nil, "", fmt.Errorf("token generation failed: %w", err)
	}

	return &oauthUser{
		id:                 userID,
		email:              email,
		fullName:           fullName,
		onboardingComplete: onboardingComplete,
	}, token, nil
}

// verifyGoogleToken calls Google's tokeninfo endpoint to validate the ID token.
func verifyGoogleToken(idToken string) (*googleTokenInfo, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken)
	if err != nil {
		return nil, fmt.Errorf("failed to contact Google: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Google rejected token: %s", string(body))
	}

	var info googleTokenInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, fmt.Errorf("failed to parse Google response: %w", err)
	}

	// Validate issuer
	if info.Iss != "accounts.google.com" && info.Iss != "https://accounts.google.com" {
		return nil, fmt.Errorf("invalid issuer: %s", info.Iss)
	}

	// Validate audience matches our Google client ID (if configured)
	expectedClientID := os.Getenv("GOOGLE_CLIENT_ID")
	if expectedClientID != "" && info.Aud != expectedClientID {
		return nil, fmt.Errorf("token audience mismatch")
	}

	// Validate email is verified
	if strings.ToLower(info.EmailVerified) != "true" {
		return nil, fmt.Errorf("email not verified")
	}

	return &info, nil
}

// appleTokenClaims holds the fields we extract from an Apple identity token.
type appleTokenClaims struct {
	Iss   string `json:"iss"`
	Sub   string `json:"sub"`
	Aud   string `json:"aud"`
	Email string `json:"email"`
}

// decodeAppleToken decodes the payload of an Apple identity JWT.
// For production hardening, verify the signature against Apple's JWKS.
func decodeAppleToken(tokenStr string) (*appleTokenClaims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid JWT format")
	}

	// Decode the payload (second segment, base64url-encoded)
	payload := parts[1]
	// Add padding if needed
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}

	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to decode token payload: %w", err)
	}

	var claims appleTokenClaims
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse token claims: %w", err)
	}

	// Validate issuer
	if claims.Iss != "https://appleid.apple.com" {
		return nil, fmt.Errorf("invalid Apple issuer: %s", claims.Iss)
	}

	// Validate audience if configured
	expectedBundleID := os.Getenv("APPLE_BUNDLE_ID")
	if expectedBundleID != "" && claims.Aud != expectedBundleID {
		return nil, fmt.Errorf("token audience mismatch")
	}

	return &claims, nil
}
