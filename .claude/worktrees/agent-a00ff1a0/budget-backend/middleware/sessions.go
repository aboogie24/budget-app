package middleware

import (
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/aboogie/budget-backend/auth"
	"github.com/gorilla/sessions"
)

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

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, _ := GetSession(w, r)
		if _, ok := session.Values["user_id"]; ok {
			next.ServeHTTP(w, r)
			return
		}

		// Fallback to Bearer token auth for mobile/clients that rely on JWT
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			token := strings.TrimSpace(authHeader[len("bearer "):])
			if userID, err := auth.ValidateToken(token); err == nil && userID != "" {
				next.ServeHTTP(w, r)
				return
			}
		}

		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	})
}
