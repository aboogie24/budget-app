package middleware

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/aboogie/budget-backend/auth"
	"github.com/gorilla/sessions"
)

type contextKey string

// UserIDContextKey is the request-context key for the authenticated user id.
const UserIDContextKey contextKey = "auth_user_id"

var (
	store     *sessions.CookieStore
	storeOnce sync.Once
)

func getStore() *sessions.CookieStore {
	storeOnce.Do(func() {
		secret := os.Getenv("SESSION_SECRET")
		if secret == "" {
			log.Println("WARNING: SESSION_SECRET not set, using insecure default — set this in production!")
			secret = "fallback-dev-only-change-me"
		}
		store = sessions.NewCookieStore([]byte(secret))
	})
	return store
}

func GetSession(w http.ResponseWriter, r *http.Request) (*sessions.Session, error) {
	return getStore().Get(r, "budget-session")
}

// WithAuthenticatedUserID injects a user id into the request context (tests / invite handlers).
func WithAuthenticatedUserID(r *http.Request, userID string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), UserIDContextKey, userID))
}

// AuthenticatedUserID returns the session or JWT user id for the request.
// Prefers an explicit context value (set by RequireAuth or tests), then session, then Bearer JWT.
func AuthenticatedUserID(r *http.Request) string {
	if v, ok := r.Context().Value(UserIDContextKey).(string); ok && v != "" {
		return v
	}
	session, err := getStore().Get(r, "budget-session")
	if err == nil {
		if uid, ok := session.Values["user_id"].(string); ok && uid != "" {
			return uid
		}
	}
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token := strings.TrimSpace(authHeader[len("bearer "):])
		if userID, err := auth.ValidateToken(token); err == nil && userID != "" {
			return userID
		}
	}
	return ""
}

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, _ := GetSession(w, r)
		if uid, ok := session.Values["user_id"].(string); ok && uid != "" {
			next.ServeHTTP(w, WithAuthenticatedUserID(r, uid))
			return
		}

		// Fallback to Bearer token auth for mobile/clients that rely on JWT
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			token := strings.TrimSpace(authHeader[len("bearer "):])
			if userID, err := auth.ValidateToken(token); err == nil && userID != "" {
				next.ServeHTTP(w, WithAuthenticatedUserID(r, userID))
				return
			}
		}

		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	})
}
