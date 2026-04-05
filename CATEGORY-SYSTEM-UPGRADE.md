# Category System Upgrade: Smart Tagging, Auto-Matching & Subcategories

## What's Wrong Today

The current system has several gaps that break the connection between transactions and budgets:

1. **Plaid transactions are orphaned.** Bank-synced transactions store `category_name` (a plain string from Plaid like "Food and Drink") but no `category_id` FK. They never connect to budgets. A user with a "Groceries" budget won't see their Whole Foods charges counted against it.

2. **No category hierarchy.** Categories are flat — "Groceries", "Restaurants", "Coffee" are all top-level. Users can't group related spending (all three are really "Food") and can't split a Walmart receipt into "Groceries" + "Household."

3. **No learning.** Every new Plaid transaction gets whatever string Plaid sends. The system never learns that "WHOLEFDS MKT" = Groceries or that the user always recategorizes "Transfer" transactions from Venmo as "Entertainment."

4. **No category-to-budget enforcement.** The `budget_categories` join table exists but the budget summary query does loose matching. If a transaction has `category_name = "Food and Drink"` but no `category_id`, it's invisible to the budget.

## Design Goals

- Every transaction gets a `category_id` FK — no more orphaned `category_name`-only records
- Subcategories allow splits and finer tracking while rolling up to parent budgets
- Auto-matching assigns categories on sync; user rules override and teach the system
- Best-guess assignment with nudges — nothing sits uncategorized, but users are prompted to verify
- The budget screen accurately reflects ALL spending (manual + bank) by category

---

## Phase 1: Subcategories — Add Hierarchy to Categories

### Schema Change

**Migration:** `XXXXXX_add_category_hierarchy.up.sql`

```sql
ALTER TABLE categories
  ADD COLUMN parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN icon TEXT,
  ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Index for fast parent lookups
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
```

**Updated Category Model** (`models/category.go`):

```go
type Category struct {
    ID              string      `json:"id"`
    Name            string      `json:"name"`
    Type            string      `json:"type"`              // income, expense
    UserID          *string     `json:"user_id,omitempty"`
    HouseholdID     *string     `json:"household_id,omitempty"`
    ParentID        *string     `json:"parent_id,omitempty"`
    Color           string      `json:"color"`
    Icon            *string     `json:"icon,omitempty"`
    LimitAmount     float64     `json:"limit_amount"`
    RolloverEnabled bool        `json:"rollover_enabled"`
    SortOrder       int         `json:"sort_order"`
    CreatedAt       time.Time   `json:"created_at"`
    UpdatedAt       time.Time   `json:"updated_at"`
    // Populated by queries, not stored
    Subcategories   []Category  `json:"subcategories,omitempty"`
}
```

### Default Category Tree

Seed the system defaults with a two-level hierarchy. These are the `user_id = NULL` system categories:

```
Housing (parent)
  ├── Rent/Mortgage
  ├── Utilities
  ├── Home Insurance
  └── Maintenance

Food & Dining (parent)
  ├── Groceries
  ├── Restaurants
  ├── Coffee Shops
  └── Fast Food

Transportation (parent)
  ├── Gas
  ├── Auto Payment
  ├── Auto Insurance
  ├── Public Transit
  └── Rideshare

Entertainment (parent)
  ├── Streaming
  ├── Movies & Events
  ├── Hobbies
  └── Games

Shopping (parent)
  ├── Clothing
  ├── Electronics
  ├── Home Goods
  └── Personal Care

Health (parent)
  ├── Medical
  ├── Pharmacy
  ├── Gym & Fitness
  └── Mental Health

Income (parent, type=income)
  ├── Salary
  ├── Freelance
  ├── Side Hustle
  └── Investments

Savings & Debt (parent)
  ├── Emergency Fund
  ├── Debt Payment
  ├── Investments
  └── Retirement

Bills & Subscriptions (parent)
  ├── Phone
  ├── Internet
  ├── Insurance
  └── Subscriptions

Personal (parent)
  ├── Gifts
  ├── Donations
  ├── Education
  └── Pets
```

Users can create custom subcategories under any parent, or create entirely new parent categories.

### Handler Changes

**`handlers/categories.go`:**

- `GetCategoriesForUser` — Return categories as a tree. Query all categories for the user, then nest children under parents in Go before returning:
  ```go
  // Query: WHERE (user_id = ? OR household_id = ? OR user_id IS NULL) ORDER BY parent_id NULLS FIRST, sort_order
  // Build tree: group children by parent_id, attach to parent objects
  ```

- `CreateCategory` — Accept optional `parent_id`. Validate that the parent exists and belongs to the same user/household scope. Inherit `type` from parent if not provided.

- `DeleteCategory` — If deleting a parent, either: (a) promote children to top-level, or (b) reject if children exist. Safer to reject and require the user to move/delete children first.

### Rules

- Max depth = 2 (parent → child). No grandchildren — keeps things simple.
- Subcategories inherit `type` from parent (can't mix income/expense in same tree).
- Budget can be linked to a parent category (tracks all subcategory spending) OR a specific subcategory.
- User-created subcategories live under system parents — no need to duplicate the parent.

---

## Phase 2: Category Mapping Rules — Plaid-to-Category Resolution

This is the engine that turns a raw Plaid transaction into a properly categorized record.

### Schema

**Migration:** `XXXXXX_add_category_mapping_rules.up.sql`

```sql
CREATE TABLE category_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                         -- NULL = system-wide default rule
  household_id UUID,
  rule_type TEXT NOT NULL,              -- 'merchant', 'plaid_category', 'keyword'
  match_value TEXT NOT NULL,            -- The string to match against
  category_id UUID NOT NULL REFERENCES categories(id),
  priority INTEGER DEFAULT 0,          -- Higher = checked first
  auto_created BOOLEAN DEFAULT false,  -- True if system-generated
  usage_count INTEGER DEFAULT 0,       -- How many times this rule has fired
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups during transaction sync
CREATE INDEX idx_mapping_rules_user ON category_mapping_rules(user_id);
CREATE INDEX idx_mapping_rules_household ON category_mapping_rules(household_id);
CREATE INDEX idx_mapping_rules_match ON category_mapping_rules(rule_type, match_value);
```

### Rule Types

| Rule Type | `match_value` | Example | How It Matches |
|-----------|---------------|---------|----------------|
| `merchant` | Merchant name (normalized) | `"whole foods"` | Exact match against `transaction.name` (lowercased, trimmed) |
| `plaid_category` | Plaid's category string | `"Food and Drink"` | Exact match against Plaid's `category[0]` |
| `keyword` | Substring | `"uber"` | Contains match against `transaction.name` |

### Resolution Priority

When a new transaction comes in, resolve its category using this waterfall:

```
1. User merchant rule     (rule_type='merchant', user_id=current_user)
2. Household merchant rule (rule_type='merchant', household_id=user's household)
3. User keyword rule      (rule_type='keyword', user_id=current_user)
4. Household keyword rule  (rule_type='keyword', household_id=user's household)
5. System plaid_category   (rule_type='plaid_category', user_id=NULL)
6. System merchant rule    (rule_type='merchant', user_id=NULL)
7. Best-guess from Plaid category name → fuzzy match to system categories
8. Fallback: assign to "Uncategorized" subcategory under best-guess parent
```

User rules always beat household rules. Household rules always beat system defaults. Merchant matches always beat keyword matches (more specific).

### Seeding System Rules

Seed `category_mapping_rules` with Plaid-to-system-category mappings:

```sql
-- Plaid category → system category mappings
INSERT INTO category_mapping_rules (rule_type, match_value, category_id, auto_created) VALUES
  ('plaid_category', 'Food and Drink',     (SELECT id FROM categories WHERE name='Food & Dining' AND parent_id IS NULL AND user_id IS NULL), true),
  ('plaid_category', 'Groceries',          (SELECT id FROM categories WHERE name='Groceries' AND user_id IS NULL), true),
  ('plaid_category', 'Restaurants',        (SELECT id FROM categories WHERE name='Restaurants' AND user_id IS NULL), true),
  ('plaid_category', 'Transfer',           (SELECT id FROM categories WHERE name='Savings & Debt' AND parent_id IS NULL AND user_id IS NULL), true),
  ('plaid_category', 'Payment',            (SELECT id FROM categories WHERE name='Debt Payment' AND user_id IS NULL), true),
  ('plaid_category', 'Travel',             (SELECT id FROM categories WHERE name='Entertainment' AND parent_id IS NULL AND user_id IS NULL), true),
  ('plaid_category', 'Shops',              (SELECT id FROM categories WHERE name='Shopping' AND parent_id IS NULL AND user_id IS NULL), true),
  -- ... (30-50 mappings covering common Plaid categories)
  ;
```

### New Handler: `handlers/category_rules.go`

```
GET    /auth/category-rules              — List rules for user (with household)
POST   /auth/category-rules              — Create a new rule
PUT    /auth/category-rules/:id          — Update a rule
DELETE /auth/category-rules/:id          — Delete a rule
POST   /auth/category-rules/from-edit    — Auto-create rule when user recategorizes a transaction
```

The `from-edit` endpoint is key — when a user changes a transaction's category, the system asks "Always categorize [merchant] as [new category]?" and creates a merchant rule.

### Resolution Function: `internal/categories/resolver.go`

New package `internal/categories/` with:

```go
// ResolveCategory determines the best category_id for a transaction.
// Returns the matched category_id and a confidence level.
func ResolveCategory(
    db *sql.DB,
    userID string,
    householdID string,
    merchantName string,
    plaidCategories []string,
) (categoryID string, confidence string, ruleID *string, err error) {
    // confidence: "exact" (merchant rule match), "high" (plaid_category rule),
    //             "medium" (keyword match), "low" (fuzzy/best-guess)

    // 1. Check user merchant rules
    // 2. Check household merchant rules
    // 3. Check user keyword rules
    // 4. Check household keyword rules
    // 5. Check system plaid_category rules
    // 6. Check system merchant rules
    // 7. Fuzzy match plaid category name to system category names
    // 8. Return "Uncategorized" with confidence "low"
}
```

---

## Phase 3: Fix Transaction Sync — Every Transaction Gets a `category_id`

### Update Plaid Sync Handler

**File:** `handlers/plaid.go` — `SyncTransactions` function

Currently (around line 210-235), the sync does:
```go
catName = tx.GetCategory()[0]
// INSERT with category_name = catName, category_id = NULL
```

Change to:
```go
// Resolve category using the rule engine
catID, confidence, ruleID, err := categories.ResolveCategory(
    db, userID, householdID,
    tx.GetName(),          // merchant name
    tx.GetCategory(),      // plaid categories array
)

// INSERT with both category_id = catID AND category_name (for audit trail)
// Also store: match_confidence, matched_rule_id
```

### New Transaction Fields

**Migration:** `XXXXXX_add_transaction_category_fields.up.sql`

```sql
ALTER TABLE transactions
  ADD COLUMN match_confidence TEXT,        -- 'exact', 'high', 'medium', 'low'
  ADD COLUMN matched_rule_id UUID REFERENCES category_mapping_rules(id),
  ADD COLUMN user_verified BOOLEAN DEFAULT false;  -- True after user confirms/changes category

-- Backfill: try to match existing bank transactions to categories
-- (Run as a one-time data migration script, not in the migration itself)
```

**Updated Transaction Model** (`models/transaction.go`):

Add:
```go
MatchConfidence  *string `json:"match_confidence,omitempty"`
MatchedRuleID    *string `json:"matched_rule_id,omitempty"`
UserVerified     bool    `json:"user_verified"`
```

### Backfill Script

Write a one-time Go script (or management endpoint) that:
1. Queries all transactions where `category_id IS NULL AND category_name IS NOT NULL`
2. Runs each through `ResolveCategory` using the `category_name` as a pseudo-Plaid category
3. Updates the `category_id` based on the best match
4. Sets `match_confidence` accordingly

This ensures existing data works with the new budget summary logic.

---

## Phase 4: Transaction Splits — Subcategory Allocation

### Schema

**Migration:** `XXXXXX_add_transaction_splits.up.sql`

```sql
CREATE TABLE transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_splits_transaction ON transaction_splits(transaction_id);
CREATE INDEX idx_splits_category ON transaction_splits(category_id);

-- Add flag to transactions table
ALTER TABLE transactions
  ADD COLUMN is_split BOOLEAN DEFAULT false;
```

### How Splits Work

- A $200 Walmart transaction can be split into: $150 → Groceries, $50 → Household
- The parent transaction keeps its `amount = 200` and `is_split = true`
- The `transaction_splits` rows define where each portion goes
- **Constraint:** Sum of split amounts must equal the parent transaction amount
- The parent transaction's `category_id` becomes the "primary" category (largest split)

### Split Endpoints

```
POST   /auth/transactions/:id/split    — Split a transaction into categories
PUT    /auth/transactions/:id/split    — Update split allocations
DELETE /auth/transactions/:id/split    — Remove splits (reverts to single category)
GET    /auth/transactions/:id/split    — Get split details
```

**POST payload:**
```json
{
  "splits": [
    { "category_id": "cat-groceries", "amount": 150.00, "note": "Food items" },
    { "category_id": "cat-household", "amount": 50.00, "note": "Cleaning supplies" }
  ]
}
```

**Validation:**
- Sum of split amounts must equal `transaction.amount`
- At least 2 splits (otherwise it's not a split)
- All category_ids must exist and be accessible to the user
- Split categories should be subcategories (but not enforced — user might split across parents)

---

## Phase 5: Update Budget Summary — Category-Aware Spending

### Fix `GetBudgetSummary` in `handlers/budgets.go`

This is the most important change. The budget summary query needs to:

1. **Include ALL transactions** that have a matching `category_id` (manual + bank + bill)
2. **Roll up subcategory spending** to parent budgets
3. **Handle splits** by using `transaction_splits.amount` instead of `transaction.amount` when `is_split = true`

**Updated Spending Query:**

```sql
-- For non-split transactions: use transaction.amount with transaction.category_id
-- For split transactions: use each split's amount with split's category_id

WITH effective_spending AS (
  -- Non-split transactions
  SELECT t.category_id, t.amount, t.date, t.user_id, t.household_id
  FROM transactions t
  WHERE t.is_split = false
    AND t.type = 'expense'
    AND t.source != 'bill'
    AND EXTRACT(MONTH FROM t.date) = $month
    AND EXTRACT(YEAR FROM t.date) = $year

  UNION ALL

  -- Split transactions: each split is its own spending line
  SELECT ts.category_id, ts.amount, t.date, t.user_id, t.household_id
  FROM transaction_splits ts
  JOIN transactions t ON ts.transaction_id = t.id
  WHERE t.is_split = true
    AND t.type = 'expense'
    AND t.source != 'bill'
    AND EXTRACT(MONTH FROM t.date) = $month
    AND EXTRACT(YEAR FROM t.date) = $year
),

-- Roll up subcategory spending to parent
category_spending AS (
  SELECT
    COALESCE(c.parent_id, c.id) AS budget_category_id,  -- Roll up to parent
    c.id AS actual_category_id,
    es.amount
  FROM effective_spending es
  JOIN categories c ON es.category_id = c.id
  WHERE (es.user_id = $user_id OR es.household_id = $household_id)
)

SELECT budget_category_id, actual_category_id, SUM(amount) as total_spent
FROM category_spending
GROUP BY budget_category_id, actual_category_id;
```

This means:
- A budget linked to "Food & Dining" (parent) automatically includes spending from Groceries, Restaurants, Coffee Shops, Fast Food
- A budget linked to just "Groceries" (subcategory) only shows grocery spending
- Split transactions contribute their split amounts to the correct categories

---

## Phase 6: Nudge System — Best-Guess Verification

### New Nudge Types in `internal/ai/nudges.go`

When bank transactions sync with `match_confidence` = "medium" or "low", create a nudge:

```go
// nudge_type = "categorization_review"
{
    NudgeType:   "categorization_review",
    Title:       "Review new transactions",
    Body:        "5 new transactions were auto-categorized. Tap to review.",
    ActionType:  "navigate",
    ActionData:  "/transactions/review",   // New review screen
    Priority:    "medium",
    ExpiresAt:   now.AddDate(0, 0, 7),     // Expires in a week
}
```

**Nudge triggers:**
- After Plaid sync, count transactions with `match_confidence IN ('medium', 'low') AND user_verified = false`
- If count > 0, create/update the review nudge with the count
- One nudge per sync batch (don't spam)

### When User Recategorizes

When a user changes a transaction's category (via the transaction edit screen or the review screen):

1. Update `transactions.category_id` to the new category
2. Set `transactions.user_verified = true`
3. Prompt: "Always categorize [merchant name] as [new category]?"
   - If yes → `POST /auth/category-rules/from-edit` creates a merchant rule
   - If no → just this transaction, no rule created
4. Increment `usage_count` on the matched rule (for analytics)

---

## Phase 7: Frontend Changes

### A. Category Picker Component — `components/CategoryPicker.tsx`

Replace the current flat autocomplete with a hierarchical picker:

- Shows parent categories as expandable sections
- Tapping a parent expands to show subcategories
- User can pick a parent (general) or subcategory (specific)
- "Add custom" option at the bottom of each parent section
- Search/filter across all categories

Used in: `add-transaction.tsx`, `add-budget.tsx`, transaction edit, split modal

### B. Transaction Review Screen — `app/transactions/review.tsx` (NEW)

Shows transactions that need user verification (`user_verified = false`, `match_confidence != 'exact'`):

- List grouped by date
- Each row shows: merchant name, amount, auto-assigned category (with confidence indicator)
- Swipe right = confirm (sets `user_verified = true`)
- Tap = open category picker to change
- "Confirm all" bulk action for when the guesses look good
- After confirming, prompt for "always categorize as..." rule

### C. Split Transaction Modal — `components/SplitTransactionModal.tsx` (NEW)

Triggered from the transaction detail view:

- Shows the total amount at the top
- List of splits with category picker + amount field for each
- "Add split" button to add more rows
- Running total that must equal the transaction amount
- Validation: shows error if totals don't match

### D. Budget Screen Updates — `app/(tabs)/budget.tsx`

- Budget cards now show subcategory breakdown within each budget
- If a budget is linked to a parent category, show a stacked bar of subcategory spending
- Example: "Food & Dining: $450 / $600" with mini bars showing "$250 Groceries, $120 Restaurants, $80 Coffee"

### E. Category Management — `app/settings/categories.tsx`

- Show categories as a tree (collapsible parents)
- Allow reordering via drag (updates `sort_order`)
- "Add subcategory" action on each parent
- Show rule count per category ("12 auto-match rules")
- Tap a category → shows its rules, option to add/edit/delete rules

### F. Category Rules Screen — `app/settings/category-rules.tsx` (NEW)

- List all user/household rules grouped by rule_type
- Each rule shows: match value, target category, usage count
- Edit/delete individual rules
- "Add rule" with: type picker (merchant/keyword), match value input, category picker

---

## Phase 8: Backfill & Migration Strategy

This phase handles existing data — don't break what's working.

### Step 1: Run the category hierarchy migration
- Add `parent_id`, `icon`, `sort_order` columns
- Insert system default category tree (parents + subcategories)
- Existing user-created categories remain top-level (no parent) — users can reorganize later

### Step 2: Run the mapping rules migration
- Create `category_mapping_rules` table
- Seed with Plaid category → system category mappings

### Step 3: Run the transaction fields migration
- Add `match_confidence`, `matched_rule_id`, `user_verified` columns
- All existing manual transactions get `user_verified = true` (user chose the category)
- All existing bank transactions get `user_verified = false`, `match_confidence = NULL`

### Step 4: Run the backfill script
- Process all `category_id IS NULL` transactions through the resolver
- Set `category_id` and `match_confidence` based on results
- Log any transactions that couldn't be matched (for manual review)

### Step 5: Run the splits migration
- Create `transaction_splits` table
- Add `is_split` column to transactions (default false)
- No backfill needed — splits are a new feature

---

## Files Summary

| File | Action |
|------|--------|
| **Models** | |
| `models/category.go` | Add ParentID, Icon, SortOrder, Subcategories fields |
| `models/transaction.go` | Add MatchConfidence, MatchedRuleID, UserVerified, IsSplit |
| `models/category_rule.go` | **NEW** — CategoryMappingRule struct |
| `models/transaction_split.go` | **NEW** — TransactionSplit struct |
| **Migrations** | |
| `migrations/XXXXXX_category_hierarchy.up.sql` | parent_id + seed tree |
| `migrations/XXXXXX_category_mapping_rules.up.sql` | Rules table + seed mappings |
| `migrations/XXXXXX_transaction_category_fields.up.sql` | confidence, rule_id, verified |
| `migrations/XXXXXX_transaction_splits.up.sql` | Splits table + is_split flag |
| **Backend** | |
| `internal/categories/resolver.go` | **NEW** — Category resolution engine |
| `handlers/categories.go` | Tree queries, parent_id support |
| `handlers/category_rules.go` | **NEW** — Rule CRUD + from-edit |
| `handlers/transactions.go` | Recategorize flow, verified flag |
| `handlers/budgets.go` | Updated summary query with rollup + splits |
| `handlers/plaid.go` | Use resolver on sync |
| `internal/ai/nudges.go` | categorization_review nudge type |
| **Frontend** | |
| `components/CategoryPicker.tsx` | **NEW** — Hierarchical category picker |
| `components/SplitTransactionModal.tsx` | **NEW** — Split UI |
| `app/transactions/review.tsx` | **NEW** — Uncategorized transaction review |
| `app/settings/category-rules.tsx` | **NEW** — Rule management |
| `app/settings/categories.tsx` | Tree view, subcategory management |
| `app/(tabs)/budget.tsx` | Subcategory spending breakdown |
| `app/add-transaction.tsx` | Use new CategoryPicker |
| `app/budget/add-budget.tsx` | Use new CategoryPicker |

## Implementation Order

Build in this order — each phase is usable on its own:

1. **Phase 1** (Subcategories) — Foundation. Everything else builds on hierarchy.
2. **Phase 2** (Mapping Rules) — The rule engine. No UI yet, just the table + resolver function.
3. **Phase 3** (Fix Transaction Sync) — Wire resolver into Plaid sync. Bank transactions now get real category_ids.
4. **Phase 5** (Budget Summary Fix) — Budgets now accurately reflect all spending. This is the biggest user-visible improvement.
5. **Phase 8** (Backfill) — Fix existing data so it works with the new system.
6. **Phase 6** (Nudges) — Users get prompted to review auto-categorized transactions.
7. **Phase 7A-B** (CategoryPicker + Review Screen) — Users can interact with the new system.
8. **Phase 4** (Splits) — Add split capability once the core is solid.
9. **Phase 7C-F** (Remaining Frontend) — Split modal, rules screen, budget breakdown.
