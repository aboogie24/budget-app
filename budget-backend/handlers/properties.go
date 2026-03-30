package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

var propertiesDBFactory = func() (db.DBTX, error) {
	return db.New()
}

func nilIfZero(v float64) any {
	if v == 0 {
		return nil
	}
	return v
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func ListProperties(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := propertiesDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	hh := db.ResolveHouseholdID(client.Raw(), userID)

	query := `
		SELECT p.id, p.user_id, COALESCE(p.household_id::text, ''),
		       p.street_address, p.city, p.state, p.zip_code,
		       p.zestimate, p.manual_value,
		       COALESCE(p.zillow_url, ''), COALESCE(p.zpid, ''),
		       p.debt_account_id, p.last_fetched_at, p.is_shared,
		       d.name, d.balance
		FROM properties p
		LEFT JOIN debt_accounts d ON p.debt_account_id = d.id
	`

	var rows *sql.Rows
	if hh == "" {
		rows, err = client.Query(query+`
			WHERE p.household_id IS NULL AND p.user_id = $1
			ORDER BY p.created_at DESC
		`, userID)
	} else {
		rows, err = client.Query(query+`
			WHERE p.household_id::text = $1
			   OR (p.household_id IS NULL AND p.user_id = $2)
			ORDER BY p.created_at DESC
		`, hh, userID)
	}
	if err != nil {
		log.Printf("ListProperties query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var properties []models.Property
	for rows.Next() {
		var p models.Property
		var hhID sql.NullString
		var zest, manVal sql.NullFloat64
		var zURL, zpid sql.NullString
		var debtAcctID sql.NullString
		var lastFetched sql.NullTime
		var debtName sql.NullString
		var debtBalance sql.NullFloat64

		if err := rows.Scan(
			&p.ID, &p.UserID, &hhID,
			&p.StreetAddress, &p.City, &p.State, &p.ZipCode,
			&zest, &manVal,
			&zURL, &zpid,
			&debtAcctID, &lastFetched, &p.IsShared,
			&debtName, &debtBalance,
		); err != nil {
			log.Printf("ListProperties scan error: %v", err)
			continue
		}

		if hhID.Valid {
			p.HouseholdID = hhID.String
		}
		if zest.Valid {
			p.Zestimate = &zest.Float64
		}
		if manVal.Valid {
			p.ManualValue = &manVal.Float64
		}
		if zURL.Valid && zURL.String != "" {
			p.ZillowURL = &zURL.String
		}
		if zpid.Valid && zpid.String != "" {
			p.ZPID = &zpid.String
		}
		if debtAcctID.Valid {
			p.DebtAccountID = &debtAcctID.String
		}
		if lastFetched.Valid {
			p.LastFetchedAt = &lastFetched.Time
		}
		if debtName.Valid {
			p.DebtName = &debtName.String
		}
		if debtBalance.Valid {
			p.DebtBalance = &debtBalance.Float64
		}

		properties = append(properties, p)
	}

	if properties == nil {
		properties = []models.Property{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(properties)
}

func CreateProperty(w http.ResponseWriter, r *http.Request) {
	var p models.Property
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.UserID == "" {
		p.UserID = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(p.UserID)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	p.UserID = userID

	if p.StreetAddress == "" || p.City == "" || p.State == "" || p.ZipCode == "" {
		http.Error(w, "Street address, city, state, and zip code are required", http.StatusBadRequest)
		return
	}

	client, err := propertiesDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if p.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(client.Raw(), p.UserID); hh != "" {
			p.HouseholdID = hh
		}
	}
	if p.IsShared && p.HouseholdID == "" {
		http.Error(w, "Join or create a household before creating shared items", http.StatusBadRequest)
		return
	}

	// Attempt Zillow scrape — save whatever we get (ZPID/URL even without Zestimate)
	result, scrapeErr := FetchZestimate(p.StreetAddress, p.City, p.State, p.ZipCode)
	if result != nil {
		if result.Zestimate > 0 {
			p.Zestimate = &result.Zestimate
			now := time.Now()
			p.LastFetchedAt = &now
		}
		if result.ZillowURL != "" {
			p.ZillowURL = &result.ZillowURL
		}
		if result.ZPID != "" {
			p.ZPID = &result.ZPID
		}
	}
	if scrapeErr != nil {
		log.Printf("CreateProperty: Zillow scrape failed: %v", scrapeErr)
	}

	var hhVal, debtVal any
	if p.HouseholdID == "" {
		hhVal = nil
	} else {
		hhVal = p.HouseholdID
	}
	if p.DebtAccountID == nil || *p.DebtAccountID == "" {
		debtVal = nil
	} else {
		debtVal = *p.DebtAccountID
	}

	_, err = client.Exec(`
		INSERT INTO properties (id, user_id, household_id, street_address, city, state, zip_code,
		  zestimate, manual_value, zillow_url, zpid, debt_account_id, last_fetched_at, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
	`, p.ID, p.UserID, hhVal, p.StreetAddress, p.City, p.State, p.ZipCode,
		p.Zestimate, p.ManualValue, p.ZillowURL, p.ZPID, debtVal, p.LastFetchedAt, p.IsShared)
	if err != nil {
		log.Printf("CreateProperty insert error: %v", err)
		http.Error(w, "Insert error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func UpdateProperty(w http.ResponseWriter, r *http.Request) {
	propID := mux.Vars(r)["id"]
	if propID == "" {
		http.Error(w, "Missing property id", http.StatusBadRequest)
		return
	}

	var p models.Property
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = p.UserID
	}

	client, err := propertiesDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if !ownershipCheck(w, client.Raw(), "properties", propID, userID) {
		return
	}

	var debtVal any
	if p.DebtAccountID == nil || *p.DebtAccountID == "" {
		debtVal = nil
	} else {
		debtVal = *p.DebtAccountID
	}

	res, err := client.Exec(`
		UPDATE properties
		SET street_address=$1, city=$2, state=$3, zip_code=$4,
		    manual_value=$5, debt_account_id=$6, is_shared=$7, updated_at=NOW()
		WHERE id=$8
	`, p.StreetAddress, p.City, p.State, p.ZipCode,
		p.ManualValue, debtVal, p.IsShared, propID)
	if err != nil {
		log.Printf("UpdateProperty error: %v", err)
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Property not found", http.StatusNotFound)
		return
	}

	p.ID = propID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func DeleteProperty(w http.ResponseWriter, r *http.Request) {
	propID := mux.Vars(r)["id"]
	if propID == "" {
		http.Error(w, "Missing property id", http.StatusBadRequest)
		return
	}
	userID := r.URL.Query().Get("user_id")

	client, err := propertiesDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if !ownershipCheck(w, client.Raw(), "properties", propID, userID) {
		return
	}

	res, err := client.Exec(`DELETE FROM properties WHERE id=$1`, propID)
	if err != nil {
		http.Error(w, "Delete error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Property not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func RefreshPropertyValue(w http.ResponseWriter, r *http.Request) {
	propID := mux.Vars(r)["id"]
	if propID == "" {
		http.Error(w, "Missing property id", http.StatusBadRequest)
		return
	}

	userID := r.URL.Query().Get("user_id")

	client, err := propertiesDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if !ownershipCheck(w, client.Raw(), "properties", propID, userID) {
		return
	}

	// Load existing property
	var street, city, state, zip string
	var lastFetched sql.NullTime
	err = client.QueryRow(`
		SELECT street_address, city, state, zip_code, last_fetched_at
		FROM properties WHERE id = $1
	`, propID).Scan(&street, &city, &state, &zip, &lastFetched)
	if err != nil {
		http.Error(w, "Property not found", http.StatusNotFound)
		return
	}

	// Enforce 1-hour cooldown
	if lastFetched.Valid && time.Since(lastFetched.Time) < time.Hour {
		http.Error(w, "Please wait before refreshing again", http.StatusTooManyRequests)
		return
	}

	result, scrapeErr := FetchZestimate(street, city, state, zip)

	// Save any partial results (ZPID/URL) even if Zestimate extraction failed
	now := time.Now()
	if result != nil && (result.Zestimate > 0 || result.ZPID != "" || result.ZillowURL != "") {
		_, err = client.Exec(`
			UPDATE properties
			SET zestimate=COALESCE($1, zestimate), zillow_url=COALESCE($2, zillow_url),
			    zpid=COALESCE($3, zpid), last_fetched_at=$4, updated_at=NOW()
			WHERE id=$5
		`, nilIfZero(result.Zestimate), nilIfEmpty(result.ZillowURL), nilIfEmpty(result.ZPID), now, propID)
		if err != nil {
			log.Printf("RefreshPropertyValue update error: %v", err)
			http.Error(w, "Update error", http.StatusInternalServerError)
			return
		}
	}

	if scrapeErr != nil && (result == nil || result.Zestimate == 0) {
		log.Printf("RefreshPropertyValue: scrape failed: %v", scrapeErr)
		http.Error(w, "Failed to fetch value from Zillow: "+scrapeErr.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"zestimate":       result.Zestimate,
		"zillow_url":      result.ZillowURL,
		"zpid":            result.ZPID,
		"last_fetched_at": now,
	})
}
