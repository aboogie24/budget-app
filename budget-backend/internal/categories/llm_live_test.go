//go:build live

package categories_test

import (
	"testing"

	"github.com/aboogie/budget-backend/internal/ai"
	"github.com/aboogie/budget-backend/internal/categories"
)

// Live smoke test for the LLM categorization fallback. Hits the real Claude
// API (claude-haiku-4-5, structured outputs), so it's behind the `live` build
// tag and skips without a key.
//
//	set -a && source .env && set +a && go test -tags live ./internal/categories/ -run TestLiveClassifyMerchants -v
func TestLiveClassifyMerchants(t *testing.T) {
	client := ai.NewClient()
	if !client.IsAvailable() {
		t.Skip("ANTHROPIC_API_KEY not set")
	}

	cats := []categories.CategoryOption{
		{ID: "cat-groceries", Name: "Groceries"},
		{ID: "cat-dining", Name: "Dining Out"},
		{ID: "cat-transport", Name: "Transportation", Parent: ""},
		{ID: "cat-subscriptions", Name: "Subscriptions"},
		{ID: "cat-utilities", Name: "Utilities"},
	}
	valid := map[string]bool{}
	for _, c := range cats {
		valid[c.ID] = true
	}

	// Real merchant shapes from a Teller sandbox sync.
	merchants := []categories.MerchantInput{
		{Name: "starbucks store 6639", Sample: "STARBUCKS STORE 6639 070526"},
		{Name: "tesla supercharger", Sample: "TESLA SUPERCHARGER US 870-856-1086"},
		{Name: "anthropic claude sub", Sample: "ANTHROPIC* CLAUDE SUB ANTHROPIC.COM"},
	}

	results, err := categories.ClassifyMerchants(client, merchants, cats)
	if err != nil {
		t.Fatalf("ClassifyMerchants: %v", err)
	}
	if len(results) != len(merchants) {
		t.Fatalf("expected %d results, got %d", len(merchants), len(results))
	}

	classified := 0
	for _, r := range results {
		t.Logf("merchant %q → %q", r.Merchant, r.CategoryID)
		if r.CategoryID == "" {
			continue // declining is allowed — but not for all of them
		}
		if !valid[r.CategoryID] {
			t.Errorf("merchant %q: category %q is not one of the allowed options", r.Merchant, r.CategoryID)
		}
		classified++
	}
	if classified == 0 {
		t.Fatal("model declined every merchant — categorization is not working")
	}
}
