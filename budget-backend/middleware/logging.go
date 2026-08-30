package middleware

import (
	"log"
	"net/http"
	"os"
	"time"
)

// verboseLogging is enabled with LOG_VERBOSE=1 (or "true"). Verbose lines add
// client IP, query string, user agent, and request/response sizes. Bodies and
// headers are never logged — they carry tokens and financial data.
func verboseLogging() bool {
	v := os.Getenv("LOG_VERBOSE")
	return v == "1" || v == "true"
}

// Logging middleware to record method, path, status, and duration.
func Logging(next http.Handler) http.Handler {
	verbose := verboseLogging()
	if verbose {
		log.Print("Verbose request logging enabled (LOG_VERBOSE)")
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lrw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(lrw, r)
		if verbose {
			ip := r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}
			query := ""
			if r.URL.RawQuery != "" {
				query = "?" + r.URL.RawQuery
			}
			log.Printf("%s %s%s -> %d (%s) ip=%s ua=%q in=%dB out=%dB",
				r.Method, r.URL.Path, query, lrw.statusCode, time.Since(start),
				ip, r.UserAgent(), r.ContentLength, lrw.bytes)
			return
		}
		log.Printf("%s %s -> %d (%s)", r.Method, r.URL.Path, lrw.statusCode, time.Since(start))
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	bytes      int64
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}

func (lrw *loggingResponseWriter) Write(b []byte) (int, error) {
	n, err := lrw.ResponseWriter.Write(b)
	lrw.bytes += int64(n)
	return n, err
}

// Flush delegates to the underlying ResponseWriter so SSE streaming works.
func (lrw *loggingResponseWriter) Flush() {
	if f, ok := lrw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
