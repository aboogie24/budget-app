package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// MutatingTools is the set of advisor tools that WRITE user data. Calls to
// these are intercepted by the chat handler and queued as pending actions the
// user approves or declines in the chat UI — conversational consent alone is
// not an audit trail. Read tools, web search, and remember_fact (visible and
// deletable in Settings → Advisor Memory) execute directly.
var MutatingTools = map[string]bool{
	"create_savings_goal":         true,
	"update_savings_goal":         true,
	"create_budget":               true,
	"log_transaction":             true,
	"create_financial_plan":       true,
	"create_category":             true,
	"assign_transaction_category": true,
	"upsert_category_rule":        true,
}

// SummarizeAction renders a human-readable one-liner of what a queued tool
// call will do — this is what the approval card shows, so it must be phrased
// from the USER's perspective and name concrete values.
func SummarizeAction(toolName string, input json.RawMessage) string {
	var p map[string]interface{}
	_ = json.Unmarshal(input, &p)
	str := func(k string) string {
		if v, ok := p[k].(string); ok {
			return v
		}
		return ""
	}
	num := func(k string) float64 {
		if v, ok := p[k].(float64); ok {
			return v
		}
		return 0
	}

	switch toolName {
	case "create_savings_goal":
		s := fmt.Sprintf("Create savings goal %q with a $%.0f target", str("name"), num("target_amount"))
		if d := str("target_date"); d != "" {
			s += " by " + d
		}
		return s
	case "update_savings_goal":
		if a := num("add_amount"); a != 0 {
			return fmt.Sprintf("Add $%.0f to savings goal progress", a)
		}
		s := "Update savings goal"
		if t := num("target_amount"); t > 0 {
			s += fmt.Sprintf(" target to $%.0f", t)
		}
		if d := str("target_date"); d != "" {
			s += ", date to " + d
		}
		return s
	case "create_budget":
		freq := str("frequency")
		if freq == "" {
			freq = "monthly"
		}
		return fmt.Sprintf("Create %s budget %q at $%.0f/%s", defaultStr(str("type"), "expense"), str("name"), num("amount"), freq)
	case "log_transaction":
		return fmt.Sprintf("Log %s of $%.2f — %q", defaultStr(str("type"), "expense"), num("amount"), str("note"))
	case "create_financial_plan":
		return fmt.Sprintf("Create financial plan %q at $%.0f/month", str("name"), num("monthly_contribution"))
	case "create_category":
		s := fmt.Sprintf("Create %s category %q", defaultStr(str("type"), "expense"), str("name"))
		if pn := str("parent_name"); pn != "" {
			s += " under " + pn
		}
		return s
	case "assign_transaction_category":
		target := str("merchant")
		if target != "" {
			return fmt.Sprintf("Categorize all %q transactions as %q", target, str("category_name"))
		}
		return fmt.Sprintf("Categorize a transaction as %q", str("category_name"))
	case "upsert_category_rule":
		return fmt.Sprintf("Rule: always categorize %q as %q", defaultStr(str("merchant"), str("keyword")), str("category_name"))
	default:
		return "Run " + toolName
	}
}

func defaultStr(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

// BuildActionOutcomesBlock summarizes this conversation's recently resolved
// pending actions so the advisor knows what the user approved or declined —
// approvals happen outside the chat turn, invisible to the model otherwise.
func BuildActionOutcomesBlock(conn *sql.DB, userID, conversationID string) string {
	rows, err := conn.Query(`
		SELECT summary, status, COALESCE(result, '')
		FROM ai_pending_actions
		WHERE user_id = $1 AND conversation_id::text = $2 AND status != 'pending'
		ORDER BY resolved_at DESC NULLS LAST
		LIMIT 10
	`, userID, conversationID)
	if err != nil {
		return ""
	}
	defer rows.Close()

	var b strings.Builder
	for rows.Next() {
		var summary, status, result string
		if rows.Scan(&summary, &status, &result) != nil {
			continue
		}
		if b.Len() == 0 {
			b.WriteString("## Action Outcomes (this conversation)\nActions you queued earlier were resolved by the user:\n")
		}
		line := fmt.Sprintf("- [%s] %s", status, summary)
		if status == "approved" && result != "" && len(result) < 300 {
			line += " → " + result
		}
		b.WriteString(line + "\n")
	}
	return strings.TrimRight(b.String(), "\n")
}
