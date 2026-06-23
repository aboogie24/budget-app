package handlers

import (
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/aboogie/budget-backend/models"
)

// pushNudgeTypes are the time-sensitive, actionable nudge categories worth an
// interrupting push notification. Everything else stays a silent dashboard card
// — the rule is "push only high-priority + actionable", so we don't train users
// to swipe our notifications away.
var pushNudgeTypes = map[string]bool{
	"spending_alert":     true, // budget breached / spending spike
	"milestone_reminder": true, // a plan milestone is due this week
}

// quietHoursTZ is the timezone used for the 9pm–8am quiet window. We don't store
// per-user timezones yet; override with QUIET_HOURS_TZ. Falls back to UTC if the
// name can't be loaded.
func quietHoursLocation() *time.Location {
	name := os.Getenv("QUIET_HOURS_TZ")
	if name == "" {
		name = "America/New_York"
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.UTC
	}
	return loc
}

// inQuietHours reports whether local time falls in the no-push window (9pm–8am).
func inQuietHours(t time.Time) bool {
	h := t.In(quietHoursLocation()).Hour()
	return h >= 21 || h < 8
}

// PushNewNudges sends at most one interrupting push per user for the
// highest-priority push-worthy nudge among those just inserted, honoring quiet
// hours, a 1/day-per-user cap, and couple-routing consent. `inserted` must carry
// nudge IDs (SaveNudges populates them). Safe to call with an empty slice.
func PushNewNudges(conn *sql.DB, inserted []models.AINudge) {
	if len(inserted) == 0 || inQuietHours(time.Now()) {
		return
	}

	// Choose the single highest-priority push-worthy nudge per owner (lower
	// priority number = more urgent).
	top := map[string]*models.AINudge{}
	for i := range inserted {
		n := &inserted[i]
		if !pushNudgeTypes[n.NudgeType] {
			continue
		}
		if cur, ok := top[n.UserID]; !ok || n.Priority < cur.Priority {
			top[n.UserID] = n
		}
	}

	for ownerID, n := range top {
		data := map[string]string{"type": "nudge", "nudge_id": n.ID}
		if n.ActionType != nil {
			data["action_type"] = *n.ActionType
		}
		if n.ActionData != nil {
			data["action_data"] = *n.ActionData
		}

		// Push to the owner first.
		if !pushToUser(conn, ownerID, n.ID, n.Title, n.Body, data) {
			continue
		}

		// Couple-routing: this nudge is attributed to its owner. The partner is
		// notified only if the owner has consented to sharing (notify_partner),
		// and only if the partner is under their own daily cap.
		hh := ""
		if n.HouseholdID != nil {
			hh = *n.HouseholdID
		}
		if hh != "" && shouldNotifyPartner(hh, ownerID) {
			if partnerID := partnerUserID(conn, hh, ownerID); partnerID != "" {
				pushToUser(conn, partnerID, n.ID, n.Title, n.Body, data)
			}
		}
	}
}

// pushToUser sends a single push to one user, enforcing the 1/day cap, and
// records it. Returns true if a push was actually sent. (Quiet hours are checked
// once in PushNewNudges.)
func pushToUser(conn *sql.DB, userID, nudgeID, title, body string, data map[string]string) bool {
	if pushedRecently(conn, userID) {
		return false
	}
	SendPushNotification(userID, title, body, data)
	if _, err := conn.Exec(`INSERT INTO push_log (user_id, nudge_id) VALUES ($1, $2)`, userID, nudgeID); err != nil {
		log.Printf("push_log insert error: %v", err)
	}
	return true
}

// pushedRecently reports whether the user has received any push in the last 24h.
func pushedRecently(conn *sql.DB, userID string) bool {
	var exists bool
	err := conn.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM push_log WHERE user_id = $1 AND sent_at > NOW() - INTERVAL '24 hours'
		)
	`, userID).Scan(&exists)
	if err != nil {
		log.Printf("push cap check error: %v", err)
		return true // on error, err on the side of NOT spamming
	}
	return exists
}

// partnerUserID returns the other household member's user ID, or "" if none.
func partnerUserID(conn *sql.DB, householdID, excludeUserID string) string {
	var pid string
	err := conn.QueryRow(`
		SELECT user_id FROM household_members
		WHERE household_id::text = $1 AND user_id != $2
		LIMIT 1
	`, householdID, excludeUserID).Scan(&pid)
	if err != nil {
		return ""
	}
	return pid
}
