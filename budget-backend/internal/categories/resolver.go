package categories

import (
	"database/sql"
	"strings"
)

// ResolveCategory determines the best category_id for a transaction using a
// priority waterfall. It checks user-specific rules first, then household rules,
// then system-level Plaid category mappings, and finally attempts a fuzzy match
// against category names.
//
// Returns categoryID, confidence ("exact"|"high"|"medium"|"low"), ruleID (if matched), error.
func ResolveCategory(
	db *sql.DB,
	userID string,
	householdID string,
	merchantName string,
	plaidCategories []string,
) (categoryID string, confidence string, ruleID *string, err error) {
	lowerMerchant := strings.ToLower(strings.TrimSpace(merchantName))

	// 1. User merchant rule — exact match on lowercased merchant name
	if userID != "" && lowerMerchant != "" {
		cid, rid, found, e := matchMerchantRule(db, &userID, nil, lowerMerchant)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "exact", &rid, nil
		}
	}

	// 2. Household merchant rule — exact match
	if householdID != "" && lowerMerchant != "" {
		cid, rid, found, e := matchMerchantRule(db, nil, &householdID, lowerMerchant)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "exact", &rid, nil
		}
	}

	// 3. User keyword rule — LIKE '%keyword%' on merchant name
	if userID != "" && lowerMerchant != "" {
		cid, rid, found, e := matchKeywordRule(db, &userID, nil, lowerMerchant)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "high", &rid, nil
		}
	}

	// 4. Household keyword rule
	if householdID != "" && lowerMerchant != "" {
		cid, rid, found, e := matchKeywordRule(db, nil, &householdID, lowerMerchant)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "high", &rid, nil
		}
	}

	// 5. System plaid_category rule — exact match on any element
	if len(plaidCategories) > 0 {
		cid, rid, found, e := matchPlaidCategoryRule(db, plaidCategories)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "high", &rid, nil
		}
	}

	// 6. System merchant rule — exact match (no user/household scope)
	if lowerMerchant != "" {
		cid, rid, found, e := matchSystemMerchantRule(db, lowerMerchant)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "medium", &rid, nil
		}
	}

	// 7. Fuzzy match: ILIKE against category names using plaid categories
	if len(plaidCategories) > 0 {
		cid, found, e := fuzzyMatchCategoryName(db, plaidCategories)
		if e != nil {
			return "", "", nil, e
		}
		if found {
			return cid, "medium", nil, nil
		}
	}

	// 8. Fallback: no match
	return "", "low", nil, nil
}

// matchMerchantRule finds a merchant-type rule scoped to a user or household.
func matchMerchantRule(db *sql.DB, userID *string, householdID *string, lowerMerchant string) (categoryID string, ruleID string, found bool, err error) {
	var query string
	var arg interface{}

	if userID != nil {
		query = `SELECT id, category_id FROM category_mapping_rules
			WHERE rule_type = 'merchant' AND LOWER(match_value) = $1 AND user_id = $2
			ORDER BY priority DESC LIMIT 1`
		arg = *userID
	} else {
		query = `SELECT id, category_id FROM category_mapping_rules
			WHERE rule_type = 'merchant' AND LOWER(match_value) = $1 AND household_id = $2
			ORDER BY priority DESC LIMIT 1`
		arg = *householdID
	}

	err = db.QueryRow(query, lowerMerchant, arg).Scan(&ruleID, &categoryID)
	if err == sql.ErrNoRows {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}

	// Increment usage_count asynchronously (fire-and-forget)
	go incrementUsage(db, ruleID)
	return categoryID, ruleID, true, nil
}

// matchKeywordRule finds a keyword-type rule where the merchant name contains the keyword.
func matchKeywordRule(db *sql.DB, userID *string, householdID *string, lowerMerchant string) (categoryID string, ruleID string, found bool, err error) {
	var query string
	var arg interface{}

	if userID != nil {
		query = `SELECT id, category_id FROM category_mapping_rules
			WHERE rule_type = 'keyword' AND $1 LIKE '%' || LOWER(match_value) || '%' AND user_id = $2
			ORDER BY priority DESC LIMIT 1`
		arg = *userID
	} else {
		query = `SELECT id, category_id FROM category_mapping_rules
			WHERE rule_type = 'keyword' AND $1 LIKE '%' || LOWER(match_value) || '%' AND household_id = $2
			ORDER BY priority DESC LIMIT 1`
		arg = *householdID
	}

	err = db.QueryRow(query, lowerMerchant, arg).Scan(&ruleID, &categoryID)
	if err == sql.ErrNoRows {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}

	go incrementUsage(db, ruleID)
	return categoryID, ruleID, true, nil
}

// matchPlaidCategoryRule checks system-level plaid_category rules (no user/household scope).
// It iterates plaid categories from most specific (last) to least specific (first).
func matchPlaidCategoryRule(db *sql.DB, plaidCategories []string) (categoryID string, ruleID string, found bool, err error) {
	// Plaid categories come ordered general->specific, so check in reverse for best match
	for i := len(plaidCategories) - 1; i >= 0; i-- {
		cat := strings.TrimSpace(plaidCategories[i])
		if cat == "" {
			continue
		}

		err = db.QueryRow(`
			SELECT id, category_id FROM category_mapping_rules
			WHERE rule_type = 'plaid_category'
			  AND LOWER(match_value) = LOWER($1)
			  AND user_id IS NULL AND household_id IS NULL
			ORDER BY priority DESC LIMIT 1
		`, cat).Scan(&ruleID, &categoryID)

		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return "", "", false, err
		}

		go incrementUsage(db, ruleID)
		return categoryID, ruleID, true, nil
	}

	return "", "", false, nil
}

// matchSystemMerchantRule checks system-level merchant rules (no user/household).
func matchSystemMerchantRule(db *sql.DB, lowerMerchant string) (categoryID string, ruleID string, found bool, err error) {
	err = db.QueryRow(`
		SELECT id, category_id FROM category_mapping_rules
		WHERE rule_type = 'merchant'
		  AND LOWER(match_value) = $1
		  AND user_id IS NULL AND household_id IS NULL
		ORDER BY priority DESC LIMIT 1
	`, lowerMerchant).Scan(&ruleID, &categoryID)

	if err == sql.ErrNoRows {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}

	go incrementUsage(db, ruleID)
	return categoryID, ruleID, true, nil
}

// fuzzyMatchCategoryName does an ILIKE search against category names using Plaid categories.
func fuzzyMatchCategoryName(db *sql.DB, plaidCategories []string) (categoryID string, found bool, err error) {
	for i := len(plaidCategories) - 1; i >= 0; i-- {
		cat := strings.TrimSpace(plaidCategories[i])
		if cat == "" {
			continue
		}

		err = db.QueryRow(`
			SELECT id FROM categories
			WHERE LOWER(name) ILIKE '%' || LOWER($1) || '%'
			ORDER BY parent_id NULLS LAST, sort_order
			LIMIT 1
		`, cat).Scan(&categoryID)

		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return "", false, err
		}

		return categoryID, true, nil
	}

	return "", false, nil
}

// incrementUsage bumps the usage_count for a matched rule.
func incrementUsage(db *sql.DB, ruleID string) {
	_, _ = db.Exec(`UPDATE category_mapping_rules SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1`, ruleID)
}
