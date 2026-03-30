package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// RateLimiter provides per-IP request throttling using a token bucket algorithm.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int           // tokens added per interval
	burst    int           // max tokens (bucket size)
	interval time.Duration // refill interval
}

type visitor struct {
	tokens   int
	lastSeen time.Time
}

// NewRateLimiter creates a limiter that allows `rate` requests per `interval`
// with a burst capacity of `burst`. For example, NewRateLimiter(60, 10, time.Minute)
// allows 60 req/min with bursts up to 10 extra.
func NewRateLimiter(rate, burst int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		burst:    burst,
		interval: interval,
	}
	// Clean up stale entries every 5 minutes.
	go rl.cleanup()
	return rl
}

func (rl *RateLimiter) cleanup() {
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
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{tokens: rl.rate + rl.burst - 1, lastSeen: time.Now()}
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

// Middleware returns an HTTP middleware that rate-limits requests by client IP.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)
		if !rl.Allow(ip) {
			http.Error(w, "Too many requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func extractIP(r *http.Request) string {
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
