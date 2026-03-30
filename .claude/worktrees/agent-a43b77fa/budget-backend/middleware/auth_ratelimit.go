package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// AuthRateLimiter provides stricter rate limiting for authentication endpoints.
type AuthRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*authVisitor
	rate     int           // tokens added per interval (requests per interval)
	burst    int           // max tokens (bucket size)
	interval time.Duration // refill interval
}

type authVisitor struct {
	tokens   int
	lastSeen time.Time
}

// NewAuthRateLimiter creates a rate limiter for auth endpoints.
// Example: NewAuthRateLimiter(5, 2, time.Minute) allows 5 requests per minute with burst of 2.
func NewAuthRateLimiter(rate, burst int, interval time.Duration) *AuthRateLimiter {
	rl := &AuthRateLimiter{
		visitors: make(map[string]*authVisitor),
		rate:     rate,
		burst:    burst,
		interval: interval,
	}
	// Clean up stale entries every 5 minutes.
	go rl.cleanup()
	return rl
}

func (rl *AuthRateLimiter) cleanup() {
	for {
		time.Sleep(5 * time.Minute)
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > 10*time.Minute {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// Allow checks whether a request from the given IP should be allowed.
func (rl *AuthRateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &authVisitor{tokens: rl.rate + rl.burst - 1, lastSeen: time.Now()}
		return true
	}

	// Refill tokens based on elapsed time.
	elapsed := time.Since(v.lastSeen)
	refill := int(elapsed / rl.interval) * rl.rate
	if refill > 0 {
		v.tokens += refill
		if v.tokens > rl.rate+rl.burst {
			v.tokens = rl.rate + rl.burst
		}
		v.lastSeen = time.Now()
	}

	if v.tokens > 0 {
		v.tokens--
		return true
	}
	return false
}

// Middleware returns an HTTP middleware that rate-limits auth requests by client IP.
func (rl *AuthRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)
		if !rl.Allow(ip) {
			http.Error(w, "Too many authentication attempts. Please try again later.", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func extractAuthIP(r *http.Request) string {
	// Check common proxy headers.
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the chain.
		if idx := len(xff); idx > 0 {
			for i, c := range xff {
				if c == ',' {
					return xff[:i]
				}
			}
		}
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
