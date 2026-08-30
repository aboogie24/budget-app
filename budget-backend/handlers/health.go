package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
)

// Version is stamped at build time via
// -ldflags "-X github.com/aboogie/budget-backend/handlers.Version=vX.Y.Z".
var Version = "dev"

// HealthCheck reports whether the API can serve requests: 200 when the
// database answers a ping, 503 otherwise. Public (no auth) — used by
// Kubernetes readiness probes and manual curl checks; the body carries the
// release version so a deploy can be verified end to end.
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	conn, err := db.New()
	if err == nil {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		err = conn.Conn.PingContext(ctx)
		conn.Close()
	}

	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "degraded",
			"version": Version,
			"error":   "database unreachable",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": Version,
	})
}
