package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// MemoryItem is one durable fact the advisor remembers about a couple.
type MemoryItem struct {
	ID    string `json:"id"`
	Scope string `json:"scope"` // "shared" | "private"
	Fact  string `json:"fact"`
}

// LoadAdvisorMemories returns the facts visible to this user: all SHARED facts
// in their household plus their OWN private facts. A user never sees a partner's
// private facts. When the user has no household, all of their facts are
// returned (shared and private are equivalent for a solo user).
func LoadAdvisorMemories(conn *sql.DB, userID, householdID string) ([]MemoryItem, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if householdID != "" {
		rows, err = conn.Query(`
			SELECT id, scope, fact FROM advisor_memories
			WHERE (scope = 'shared' AND household_id = $1)
			   OR (scope = 'private' AND user_id = $2)
			ORDER BY scope, updated_at DESC
		`, householdID, userID)
	} else {
		rows, err = conn.Query(`
			SELECT id, scope, fact FROM advisor_memories
			WHERE user_id = $1
			ORDER BY scope, updated_at DESC
		`, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []MemoryItem
	for rows.Next() {
		var it MemoryItem
		if err := rows.Scan(&it.ID, &it.Scope, &it.Fact); err != nil {
			continue
		}
		items = append(items, it)
	}
	return items, nil
}

// BuildMemoryBlock formats remembered facts for injection into the system
// prompt. Returns "" when there is nothing to inject.
func BuildMemoryBlock(items []MemoryItem) string {
	if len(items) == 0 {
		return ""
	}
	var shared, private []string
	for _, it := range items {
		if it.Scope == "shared" {
			shared = append(shared, it.Fact)
		} else {
			private = append(private, it.Fact)
		}
	}

	var b strings.Builder
	b.WriteString("## What You Remember\n")
	b.WriteString("Facts you saved about this couple in earlier conversations. Use them to give continuous, personalized advice instead of starting fresh each time. If one looks stale or wrong, save a corrected version.\n")
	if len(shared) > 0 {
		b.WriteString("\nShared (both partners can see these):\n")
		for _, f := range shared {
			b.WriteString("- " + f + "\n")
		}
	}
	if len(private) > 0 {
		b.WriteString("\nPrivate to the current user (the partner cannot see these — do not surface them in shared/couple contexts):\n")
		for _, f := range private {
			b.WriteString("- " + f + "\n")
		}
	}
	return b.String()
}

// rememberFactTool saves a durable fact about the couple. Scope defaults to
// "private" when unset or invalid — the safe default, since private facts never
// leak to the partner.
func rememberFactTool(conn *sql.DB, userID, householdID string, input json.RawMessage) (string, error) {
	var params struct {
		Scope string `json:"scope"`
		Fact  string `json:"fact"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return "", fmt.Errorf("remember_fact: parse input: %w", err)
	}
	fact := strings.TrimSpace(params.Fact)
	if fact == "" {
		return `{"error": "fact is required"}`, nil
	}
	scope := params.Scope
	if scope != "shared" {
		scope = "private"
	}

	// household_id is nullable — pass NULL for solo users.
	var hh interface{}
	if householdID != "" {
		hh = householdID
	}

	var id string
	err := conn.QueryRow(`
		INSERT INTO advisor_memories (household_id, user_id, scope, fact)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, hh, userID, scope, fact).Scan(&id)
	if err != nil {
		log.Printf("remember_fact insert error: %v", err)
		return "", fmt.Errorf("remember_fact: save: %w", err)
	}

	out, _ := json.Marshal(map[string]interface{}{
		"saved": true,
		"id":    id,
		"scope": scope,
	})
	return string(out), nil
}
