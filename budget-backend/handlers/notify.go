package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

// notifyDBFactory allows swapping the DB in tests.
var notifyDBFactory = func() (db.DBTX, error) {
	return db.New()
}

type expoPushMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title,omitempty"`
	Body  string            `json:"body"`
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`
}

// SendPushNotification sends a push notification to all enabled devices for a user.
// It runs in a goroutine so the caller is not blocked.
func SendPushNotification(userID, title, body string, data map[string]string) {
	go sendPush(userID, title, body, data)
}

// SendHouseholdNotification sends a notification to all household members except excludeUserID.
func SendHouseholdNotification(householdID, excludeUserID, title, body string, data map[string]string) {
	go func() {
		client, err := notifyDBFactory()
		if err != nil {
			log.Printf("notify: db error: %v", err)
			return
		}
		defer client.Close()

		rows, err := client.Query(
			`SELECT user_id FROM household_members WHERE household_id = $1 AND user_id != $2`,
			householdID, excludeUserID,
		)
		if err != nil {
			log.Printf("notify: household members query error: %v", err)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var memberID string
			if err := rows.Scan(&memberID); err != nil {
				continue
			}
			sendPush(memberID, title, body, data)
		}
	}()
}

// sendPush does the actual work of looking up tokens and calling the Expo Push API.
func sendPush(userID, title, body string, data map[string]string) {
	client, err := notifyDBFactory()
	if err != nil {
		log.Printf("notify: db error: %v", err)
		return
	}
	defer client.Close()

	rows, err := client.Query(
		`SELECT token FROM push_tokens WHERE user_id = $1 AND enabled = true`,
		userID,
	)
	if err != nil {
		log.Printf("notify: token query error: %v", err)
		return
	}
	defer rows.Close()

	var messages []expoPushMessage
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			continue
		}
		messages = append(messages, expoPushMessage{
			To:    token,
			Title: title,
			Body:  body,
			Data:  data,
			Sound: "default",
		})
	}

	if len(messages) == 0 {
		return
	}

	// Expo accepts up to 100 per request. Send in batches.
	for i := 0; i < len(messages); i += 100 {
		end := i + 100
		if end > len(messages) {
			end = len(messages)
		}
		batch := messages[i:end]

		payload, err := json.Marshal(batch)
		if err != nil {
			log.Printf("notify: marshal error: %v", err)
			continue
		}

		req, err := http.NewRequest("POST", expoPushURL, bytes.NewReader(payload))
		if err != nil {
			log.Printf("notify: request error: %v", err)
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("notify: send error: %v", err)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Printf("notify: expo returned status %d", resp.StatusCode)
		}
	}
}

// shouldNotifyPartner checks if the partner has notify_partner enabled in their sharing preferences.
func shouldNotifyPartner(householdID, partnerUserID string) bool {
	client, err := notifyDBFactory()
	if err != nil {
		return false
	}
	defer client.Close()

	var notify bool
	err = client.QueryRow(`
		SELECT COALESCE(sp.notify_partner, true)
		FROM household_members hm
		LEFT JOIN sharing_preferences sp ON sp.user_id = hm.user_id
			AND (sp.household_id::text = $1 OR sp.household_id IS NULL)
		WHERE hm.household_id::text = $1 AND hm.user_id = $2
		LIMIT 1
	`, householdID, partnerUserID).Scan(&notify)
	if err != nil {
		return true // default to notifying
	}
	return notify
}
