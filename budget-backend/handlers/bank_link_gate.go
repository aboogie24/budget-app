package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/aboogie/budget-backend/db"
)

// WithBankLinkGate enforces Free's 1-bank household limit before the next handler
// runs. Used for Plaid link_token / exchange_token so we gate at the route
// boundary without editing the large plaid.go provider file (C031).
func WithBankLinkGate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			userID = r.Header.Get("X-User-ID")
		}
		if userID == "" {
			userID, _ = getUserIDFromRequest(r)
		}
		// exchange_token puts user_id in JSON body — peek without consuming.
		if userID == "" && r.Body != nil {
			body, err := io.ReadAll(r.Body)
			if err == nil {
				r.Body = io.NopCloser(bytes.NewReader(body))
				var peek struct {
					UserID string `json:"user_id"`
				}
				_ = json.Unmarshal(body, &peek)
				userID = peek.UserID
			}
		}
		if userID == "" {
			http.Error(w, "Missing user_id", http.StatusBadRequest)
			return
		}
		conn, err := db.New()
		if err != nil {
			http.Error(w, "Database connection error", http.StatusInternalServerError)
			return
		}
		defer conn.Close()
		if !checkBankLinkAllowed(w, conn.Raw(), userID) {
			return
		}
		next(w, r)
	}
}
