package handlers

import (
	"crypto/rsa"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/middleware"
	"github.com/golang-jwt/jwt/v5"
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
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IdentityToken == "" {
		http.Error(w, "identity_token is required", http.StatusBadRequest)
		return
	}

	claims, err := verifyAppleToken(req.IdentityToken)
	if err != nil {
		log.Printf("Apple token verification failed: %v", err)
		http.Error(w, "Invalid Apple token", http.StatusUnauthorized)
		return
	}

	// Only the email from the verified token is trusted: users are matched
	// by email, so a caller-supplied fallback would let any valid token log
	// into an arbitrary account. Apple always includes the email claim when
	// the app requests the email scope.
	email := claims.Email
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

	// Validate audience matches one of our Google client IDs (if configured).
	// GOOGLE_CLIENT_ID is comma-separated: with Expo, the token's aud is the
	// client ID of the requesting platform (iOS / Android / web).
	if !audAllowed(info.Aud, os.Getenv("GOOGLE_CLIENT_ID")) {
		return nil, fmt.Errorf("token audience mismatch")
	}

	// Validate email is verified
	if strings.ToLower(info.EmailVerified) != "true" {
		return nil, fmt.Errorf("email not verified")
	}

	return &info, nil
}

// audAllowed reports whether aud matches any of the comma-separated client
// IDs in configured. An empty configuration disables the check.
func audAllowed(aud, configured string) bool {
	if strings.TrimSpace(configured) == "" {
		return true
	}
	for _, id := range strings.Split(configured, ",") {
		if id = strings.TrimSpace(id); id != "" && id == aud {
			return true
		}
	}
	return false
}

// appleJWKSURL is a var so tests can point it at a fake JWKS server.
var appleJWKSURL = "https://appleid.apple.com/auth/keys"

// appleKeyCache caches Apple's signing keys by kid, refetching the JWKS
// when an unknown kid shows up (key rotation) at most once per minute.
type appleKeyCache struct {
	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

var appleKeys appleKeyCache

func (c *appleKeyCache) key(kid string) (*rsa.PublicKey, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	if c.keys != nil && time.Since(c.fetchedAt) < time.Minute {
		return nil, fmt.Errorf("unknown Apple key id %q", kid)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(appleJWKSURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Apple JWKS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Apple JWKS returned status %d", resp.StatusCode)
	}

	var jwks struct {
		Keys []struct {
			Kty string `json:"kty"`
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return nil, fmt.Errorf("failed to parse Apple JWKS: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: int(new(big.Int).SetBytes(eBytes).Int64()),
		}
	}
	c.keys = keys
	c.fetchedAt = time.Now()

	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("unknown Apple key id %q", kid)
}

// appleTokenClaims holds the fields we extract from an Apple identity token.
type appleTokenClaims struct {
	Iss   string `json:"iss"`
	Sub   string `json:"sub"`
	Aud   string `json:"aud"`
	Email string `json:"email"`
}

// verifyAppleToken verifies an Apple identity JWT: RS256 signature against
// Apple's published JWKS, issuer, expiry, and (if APPLE_BUNDLE_ID is set)
// audience.
func verifyAppleToken(tokenStr string) (*appleTokenClaims, error) {
	token, err := jwt.Parse(tokenStr,
		func(t *jwt.Token) (any, error) {
			kid, _ := t.Header["kid"].(string)
			if kid == "" {
				return nil, fmt.Errorf("token has no kid header")
			}
			return appleKeys.key(kid)
		},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer("https://appleid.apple.com"),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}

	mc, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("unexpected claims type")
	}

	// Validate audience if configured
	if expected := os.Getenv("APPLE_BUNDLE_ID"); expected != "" {
		auds, _ := mc.GetAudience()
		found := false
		for _, aud := range auds {
			if aud == expected {
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("token audience mismatch")
		}
	}

	sub, _ := mc.GetSubject()
	email, _ := mc["email"].(string)
	aud, _ := mc.GetAudience()
	claims := &appleTokenClaims{Sub: sub, Email: email, Iss: "https://appleid.apple.com"}
	if len(aud) > 0 {
		claims.Aud = aud[0]
	}
	return claims, nil
}
