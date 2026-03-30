package middleware

import "net/http"

// SecurityHeadersMiddleware adds security headers to all HTTP responses.
// These headers help protect against common web vulnerabilities like XSS, clickjacking, and MIME sniffing.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prevent MIME type sniffing (browsers won't guess content type)
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Prevent clickjacking attacks by disallowing framing
		w.Header().Set("X-Frame-Options", "DENY")

		// Enable XSS protection (deprecated but still useful for older browsers)
		w.Header().Set("X-XSS-Protection", "1; mode=block")

		// Enforce HTTPS and include subdomains
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Content Security Policy - restrict all resources to same origin
		w.Header().Set("Content-Security-Policy", "default-src 'self'")

		// Control how referrer information is shared
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Prevent feature access from untrusted contexts
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		next.ServeHTTP(w, r)
	})
}
