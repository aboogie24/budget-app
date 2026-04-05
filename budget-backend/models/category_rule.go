package models

// CategoryMappingRule represents a rule that maps merchants, Plaid categories,
// or keywords to a specific budget category.
type CategoryMappingRule struct {
	ID           string  `json:"id"`
	UserID       *string `json:"user_id,omitempty"`
	HouseholdID  *string `json:"household_id,omitempty"`
	RuleType     string  `json:"rule_type"`     // merchant, plaid_category, keyword
	MatchValue   string  `json:"match_value"`
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name,omitempty"` // joined from categories table
	Priority     int     `json:"priority"`
	AutoCreated  bool    `json:"auto_created"`
	UsageCount   int     `json:"usage_count"`
	CreatedAt    string  `json:"created_at"`
}

// CreateRuleRequest is the payload for creating a new mapping rule.
type CreateRuleRequest struct {
	RuleType   string `json:"rule_type"`
	MatchValue string `json:"match_value"`
	CategoryID string `json:"category_id"`
	Priority   int    `json:"priority"`
}

// CreateRuleFromEditRequest is the payload for auto-creating a rule
// when the user manually recategorizes a transaction.
type CreateRuleFromEditRequest struct {
	MerchantName string `json:"merchant_name"`
	CategoryID   string `json:"category_id"`
}

// ResolveResult holds the output of the category resolver.
type ResolveResult struct {
	CategoryID string  `json:"category_id"`
	Confidence string  `json:"confidence"` // exact, high, medium, low
	RuleID     *string `json:"rule_id,omitempty"`
}
