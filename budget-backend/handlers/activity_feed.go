package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
)

var activityFeedDBFactory = func() (db.DBTX, error) {
	return db.New()
}

// GET /auth/activity-feed?user_id=&limit=50&offset=0
func GetActivityFeed(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	if limitStr == "" {
		limitStr = "50"
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 50
	}

	offsetStr := r.URL.Query().Get("offset")
	if offsetStr == "" {
		offsetStr = "0"
	}
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	client, err := activityFeedDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Get user's household ID
	householdID := db.ResolveHouseholdID(client.Raw(), userID)
	if householdID == "" {
		http.Error(w, "User not in a household", http.StatusBadRequest)
		return
	}

	// Query activity events for the household, ordered by created_at DESC
	rows, err := client.Query(`
		SELECT
			ae.id,
			ae.household_id,
			ae.user_id,
			COALESCE(u.full_name, u.email) AS user_name,
			ae.event_type,
			ae.entity_id,
			ae.entity_type,
			ae.amount,
			ae.description,
			ae.metadata,
			ae.created_at
		FROM activity_events ae
		LEFT JOIN users u ON ae.user_id = u.id
		WHERE ae.household_id = $1
		ORDER BY ae.created_at DESC
		LIMIT $2 OFFSET $3
	`, householdID, limit, offset)
	if err != nil {
		log.Printf("GetActivityFeed query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	events := make([]models.ActivityEvent, 0)
	for rows.Next() {
		var ae models.ActivityEvent
		var metadata sql.NullString
		if err := rows.Scan(
			&ae.ID,
			&ae.HouseholdID,
			&ae.UserID,
			&ae.UserName,
			&ae.EventType,
			&ae.EntityID,
			&ae.EntityType,
			&ae.Amount,
			&ae.Description,
			&metadata,
			&ae.CreatedAt,
		); err != nil {
			log.Printf("GetActivityFeed scan error: %v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}

		// Parse metadata JSONB
		if metadata.Valid {
			ae.Metadata = json.RawMessage(metadata.String)
		} else {
			ae.Metadata = json.RawMessage("{}")
		}

		events = append(events, ae)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// POST /auth/activity-feed
// Request body: {
//   "user_id": "uuid",
//   "event_type": "transaction_added|bill_paid|budget_created|debt_payment|savings_contribution|goal_created",
//   "entity_id": "uuid (optional)",
//   "entity_type": "transaction|bill|budget|debt|savings_goal (optional)",
//   "amount": 50.00 (optional),
//   "description": "User added a transaction"
// }
func RecordActivityEvent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID      string  `json:"user_id"`
		EventType   string  `json:"event_type"`
		EntityID    *string `json:"entity_id,omitempty"`
		EntityType  *string `json:"entity_type,omitempty"`
		Amount      *float64 `json:"amount,omitempty"`
		Description string  `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if body.UserID == "" || body.EventType == "" || body.Description == "" {
		http.Error(w, "Missing required fields: user_id, event_type, description", http.StatusBadRequest)
		return
	}

	client, err := activityFeedDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Get user's household ID
	householdID := db.ResolveHouseholdID(client.Raw(), body.UserID)
	if householdID == "" {
		http.Error(w, "User not in a household", http.StatusBadRequest)
		return
	}

	eventID := uuid.Must(uuid.NewV4())
	_, err = client.Exec(`
		INSERT INTO activity_events (id, household_id, user_id, event_type, entity_id, entity_type, amount, description, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}')
	`, eventID, householdID, body.UserID, body.EventType, body.EntityID, body.EntityType, body.Amount, body.Description)

	if err != nil {
		log.Printf("RecordActivityEvent insert error: %v", err)
		http.Error(w, "Failed to record activity", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "id": eventID.String()})
}

// RecordActivity is a helper function that other handlers can call to log activity events
// householdID and userID are required; other parameters are optional
// This function does NOT require an HTTP context and returns error for caller handling
func RecordActivity(client db.DBTX, householdID, userID, eventType, entityID, entityType string, amount float64, description string) error {
	eventID := uuid.Must(uuid.NewV4())

	var amountPtr *float64
	if amount != 0 {
		amountPtr = &amount
	}

	var entityIDPtr *string
	if entityID != "" {
		entityIDPtr = &entityID
	}

	var entityTypePtr *string
	if entityType != "" {
		entityTypePtr = &entityType
	}

	_, err := client.Exec(`
		INSERT INTO activity_events (id, household_id, user_id, event_type, entity_id, entity_type, amount, description, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}')
	`, eventID, householdID, userID, eventType, entityIDPtr, entityTypePtr, amountPtr, description)

	if err != nil {
		log.Printf("RecordActivity insert error: %v", err)
		return err
	}

	return nil
}
