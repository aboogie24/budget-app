package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gorilla/mux"
)

// ListCategoryRules returns all mapping rules visible to the authenticated user,
// including system rules (user_id IS NULL AND household_id IS NULL), user-owned
// rules, and household rules.
func ListCategoryRules(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Printf("ListCategoryRules DB error: %v", err)
		return
	}
	defer conn.Close()

	householdID := db.ResolveHouseholdID(conn.Conn, userID)

	var rows *sql.Rows
	if householdID != "" {
		rows, err = conn.Query(`
			SELECT r.id, r.user_id, r.household_id, r.rule_type, r.match_value,
			       r.category_id, COALESCE(c.name, '') AS category_name,
			       r.priority, r.auto_created, r.usage_count, r.created_at
			FROM category_mapping_rules r
			LEFT JOIN categories c ON c.id = r.category_id
			WHERE r.user_id = $1
			   OR r.household_id = $2
			   OR (r.user_id IS NULL AND r.household_id IS NULL)
			ORDER BY r.priority DESC, r.usage_count DESC, r.created_at DESC
		`, userID, householdID)
	} else {
		rows, err = conn.Query(`
			SELECT r.id, r.user_id, r.household_id, r.rule_type, r.match_value,
			       r.category_id, COALESCE(c.name, '') AS category_name,
			       r.priority, r.auto_created, r.usage_count, r.created_at
			FROM category_mapping_rules r
			LEFT JOIN categories c ON c.id = r.category_id
			WHERE r.user_id = $1
			   OR (r.user_id IS NULL AND r.household_id IS NULL)
			ORDER BY r.priority DESC, r.usage_count DESC, r.created_at DESC
		`, userID)
	}
	if err != nil {
		http.Error(w, "Failed to fetch rules", http.StatusInternalServerError)
		log.Printf("ListCategoryRules query error: %v", err)
		return
	}
	defer rows.Close()

	rules := make([]models.CategoryMappingRule, 0)
	for rows.Next() {
		var rule models.CategoryMappingRule
		var uid, hid sql.NullString
		if err := rows.Scan(
			&rule.ID, &uid, &hid, &rule.RuleType, &rule.MatchValue,
			&rule.CategoryID, &rule.CategoryName,
			&rule.Priority, &rule.AutoCreated, &rule.UsageCount, &rule.CreatedAt,
		); err != nil {
			log.Printf("ListCategoryRules scan error: %v", err)
			continue
		}
		if uid.Valid {
			rule.UserID = &uid.String
		}
		if hid.Valid {
			rule.HouseholdID = &hid.String
		}
		rules = append(rules, rule)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rules)
}

// CreateCategoryRule creates a new user-scoped mapping rule.
func CreateCategoryRule(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("CreateCategoryRule decode error: %v", err)
		return
	}

	if req.RuleType == "" || req.MatchValue == "" || req.CategoryID == "" {
		http.Error(w, "rule_type, match_value, and category_id are required", http.StatusBadRequest)
		return
	}
	if req.RuleType != "merchant" && req.RuleType != "plaid_category" && req.RuleType != "keyword" {
		http.Error(w, "rule_type must be merchant, plaid_category, or keyword", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Printf("CreateCategoryRule DB error: %v", err)
		return
	}
	defer conn.Close()

	// Resolve household for the user
	var householdID *string
	if hh := db.ResolveHouseholdID(conn.Conn, userID); hh != "" {
		householdID = &hh
	}

	var rule models.CategoryMappingRule
	err = conn.QueryRow(`
		INSERT INTO category_mapping_rules (user_id, household_id, rule_type, match_value, category_id, priority)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, household_id, rule_type, match_value, category_id, priority, auto_created, usage_count, created_at
	`, userID, householdID, req.RuleType, req.MatchValue, req.CategoryID, req.Priority).Scan(
		&rule.ID, &rule.UserID, &rule.HouseholdID, &rule.RuleType, &rule.MatchValue,
		&rule.CategoryID, &rule.Priority, &rule.AutoCreated, &rule.UsageCount, &rule.CreatedAt,
	)
	if err != nil {
		http.Error(w, "Failed to create rule", http.StatusInternalServerError)
		log.Printf("CreateCategoryRule insert error: %v", err)
		return
	}

	log.Printf("Category rule created: %s -> %s (user %s)", rule.MatchValue, rule.CategoryID, userID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rule)
}

// UpdateCategoryRule updates an existing rule owned by the user.
func UpdateCategoryRule(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ruleID := mux.Vars(r)["id"]
	if ruleID == "" {
		http.Error(w, "Missing rule ID", http.StatusBadRequest)
		return
	}

	var req models.CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("UpdateCategoryRule decode error: %v", err)
		return
	}

	if req.RuleType != "" && req.RuleType != "merchant" && req.RuleType != "plaid_category" && req.RuleType != "keyword" {
		http.Error(w, "rule_type must be merchant, plaid_category, or keyword", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Printf("UpdateCategoryRule DB error: %v", err)
		return
	}
	defer conn.Close()

	// Only allow updating rules owned by this user
	result, err := conn.Exec(`
		UPDATE category_mapping_rules
		SET rule_type   = COALESCE(NULLIF($1, ''), rule_type),
		    match_value = COALESCE(NULLIF($2, ''), match_value),
		    category_id = COALESCE(NULLIF($3, ''), category_id),
		    priority    = $4,
		    updated_at  = NOW()
		WHERE id = $5 AND user_id = $6
	`, req.RuleType, req.MatchValue, req.CategoryID, req.Priority, ruleID, userID)
	if err != nil {
		http.Error(w, "Failed to update rule", http.StatusInternalServerError)
		log.Printf("UpdateCategoryRule exec error: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Rule not found or not owned by you", http.StatusNotFound)
		return
	}

	log.Printf("Category rule updated: %s (user %s)", ruleID, userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated", "id": ruleID})
}

// DeleteCategoryRule deletes a rule owned by the user.
func DeleteCategoryRule(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ruleID := mux.Vars(r)["id"]
	if ruleID == "" {
		http.Error(w, "Missing rule ID", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Printf("DeleteCategoryRule DB error: %v", err)
		return
	}
	defer conn.Close()

	// Only allow deleting rules owned by this user (not system rules)
	result, err := conn.Exec(`DELETE FROM category_mapping_rules WHERE id = $1 AND user_id = $2`, ruleID, userID)
	if err != nil {
		http.Error(w, "Failed to delete rule", http.StatusInternalServerError)
		log.Printf("DeleteCategoryRule exec error: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		http.Error(w, "Rule not found or not owned by you", http.StatusNotFound)
		return
	}

	log.Printf("Category rule deleted: %s (user %s)", ruleID, userID)
	w.WriteHeader(http.StatusNoContent)
}

// CreateRuleFromEdit auto-creates a merchant mapping rule when the user manually
// recategorizes a transaction. If a rule for this merchant already exists, it updates
// the category_id instead of creating a duplicate.
func CreateRuleFromEdit(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromRequest(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreateRuleFromEditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("CreateRuleFromEdit decode error: %v", err)
		return
	}

	if req.MerchantName == "" || req.CategoryID == "" {
		http.Error(w, "merchant_name and category_id are required", http.StatusBadRequest)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Printf("CreateRuleFromEdit DB error: %v", err)
		return
	}
	defer conn.Close()

	var householdID *string
	if hh := db.ResolveHouseholdID(conn.Conn, userID); hh != "" {
		householdID = &hh
	}

	lowerMerchant := strings.ToLower(strings.TrimSpace(req.MerchantName))

	// Upsert: if user already has a merchant rule for this value, update category
	var rule models.CategoryMappingRule
	err = conn.QueryRow(`
		INSERT INTO category_mapping_rules (user_id, household_id, rule_type, match_value, category_id, auto_created, priority)
		VALUES ($1, $2, 'merchant', $3, $4, true, 10)
		ON CONFLICT DO NOTHING
		RETURNING id, user_id, household_id, rule_type, match_value, category_id, priority, auto_created, usage_count, created_at
	`, userID, householdID, lowerMerchant, req.CategoryID).Scan(
		&rule.ID, &rule.UserID, &rule.HouseholdID, &rule.RuleType, &rule.MatchValue,
		&rule.CategoryID, &rule.Priority, &rule.AutoCreated, &rule.UsageCount, &rule.CreatedAt,
	)

	if err == sql.ErrNoRows {
		// ON CONFLICT DO NOTHING returned nothing — a rule exists, update it
		_, err = conn.Exec(`
			UPDATE category_mapping_rules
			SET category_id = $1, usage_count = usage_count + 1, updated_at = NOW()
			WHERE user_id = $2 AND rule_type = 'merchant' AND LOWER(match_value) = $3
		`, req.CategoryID, userID, lowerMerchant)
		if err != nil {
			http.Error(w, "Failed to update existing rule", http.StatusInternalServerError)
			log.Printf("CreateRuleFromEdit update error: %v", err)
			return
		}

		// Fetch the updated rule for response
		err = conn.QueryRow(`
			SELECT id, user_id, household_id, rule_type, match_value, category_id,
			       priority, auto_created, usage_count, created_at
			FROM category_mapping_rules
			WHERE user_id = $1 AND rule_type = 'merchant' AND LOWER(match_value) = $2
		`, userID, lowerMerchant).Scan(
			&rule.ID, &rule.UserID, &rule.HouseholdID, &rule.RuleType, &rule.MatchValue,
			&rule.CategoryID, &rule.Priority, &rule.AutoCreated, &rule.UsageCount, &rule.CreatedAt,
		)
		if err != nil {
			http.Error(w, "Failed to fetch updated rule", http.StatusInternalServerError)
			log.Printf("CreateRuleFromEdit fetch error: %v", err)
			return
		}
	} else if err != nil {
		http.Error(w, "Failed to create rule", http.StatusInternalServerError)
		log.Printf("CreateRuleFromEdit insert error: %v", err)
		return
	}

	log.Printf("Category rule from edit: '%s' -> %s (user %s)", lowerMerchant, req.CategoryID, userID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rule)
}
