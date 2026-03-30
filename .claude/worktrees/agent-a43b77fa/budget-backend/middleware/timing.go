package middleware

import (
	"log"
	"net/http"
	"time"
)

// TimingMiddleware logs the duration of HTTP requests and warns about slow endpoints.
// Requests taking over 500ms are logged as warnings.
func TimingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		duration := time.Since(start)

		log.Printf("[PERF] %s %s took %v", r.Method, r.URL.Path, duration)

		if duration > 500*time.Millisecond {
			log.Printf("[PERF WARNING] Slow endpoint: %s %s (%v)", r.Method, r.URL.Path, duration)
		}
	})
}
