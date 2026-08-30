# Debt Categorization: Auto Loans & Flexible Liability Types

## Problem

The current `Liability` model only supports three types via Plaid: `credit`, `mortgage`, and `student`. Auto loans, personal loans, medical debt, and other common debt types are not represented. Users need the ability to:

1. Have auto loans (and other loan types) properly categorized when synced via Plaid
2. Manually add debts that aren't linked to a bank (e.g., personal loans from family)
3. Classify debts as either **"attack debt"** (pay off aggressively) or **"structured debt"** (pay minimums, treat like a mortgage) based on their financial strategy
4. Have the AI assistant (Claude) factor this classification into plan recommendations

## Context: Why This Matters for CoupleFlow

In the CoupleFlow Method's 5-level framework, Level 2 is "Attack Debt." But not all debt is created equal:

- **High-rate auto loans (7%+):** Most financial advisors would say attack this
- **Low-rate auto loans (2-4%):** Reasonable to treat as structured/keep and invest the difference
- **Mortgages:** Almost always structured — pay on schedule
- **Credit cards:** Almost always attack — pay off ASAP
- **Student loans:** Depends on rate, forgiveness eligibility, etc.

The AI needs this classification to build smart payoff plans and give couples good advice.

## Implementation Plan

### Phase 1: Expand the Liability Model

**File:** `budget-backend/models/liability.go`

Add new fields to the `Liability` struct:

```go
// New fields to add
DebtCategory      string   `json:"debt_category"`       // "attack" or "structured"
ManualEntry       bool     `json:"manual_entry"`         // true if user-added (not from Plaid)
CurrentBalance    *float64 `json:"current_balance,omitempty"` // for manual debts
DisplayName       *string  `json:"display_name,omitempty"`    // user-friendly override name
AssetDepreciates  *bool    `json:"asset_depreciates,omitempty"` // true for auto loans, false for mortgage
```

Expand `LiabilityType` to support: `credit`, `mortgage`, `student`, `auto`, `personal`, `medical`, `other`

**Default category mapping:**

| Type | Default Category | Rationale |
|------|-----------------|-----------|
| credit | attack | High interest, no asset backing |
| auto | attack | Depreciating asset, typically moderate-high rate |
| personal | attack | No asset backing |
| medical | attack | No asset backing |
| student | attack | Default, but user can override if on forgiveness track |
| mortgage | structured | Appreciating asset, low rate, tax deductible |
| other | attack | Conservative default |

Users can always override the default — the category is a user preference, not a hard rule.

### Phase 2: Database Migration

**New migration:** `budget-backend/migrations/20260402000001_expand_liabilities.up.sql`

```sql
-- Add new columns to liabilities table
ALTER TABLE liabilities
  ADD COLUMN IF NOT EXISTS debt_category VARCHAR(20) NOT NULL DEFAULT 'attack',
  ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS asset_depreciates BOOLEAN;

-- Update existing rows with smart defaults
UPDATE liabilities SET debt_category = 'structured' WHERE liability_type = 'mortgage';
UPDATE liabilities SET debt_category = 'attack' WHERE liability_type IN ('credit', 'student');
UPDATE liabilities SET asset_depreciates = false WHERE liability_type = 'mortgage';
UPDATE liabilities SET asset_depreciates = true WHERE liability_type = 'auto';

-- Update the type check constraint to allow new types
-- (Only if there's an existing constraint — check first)
```

**Down migration:** `20260402000001_expand_liabilities.down.sql`

```sql
ALTER TABLE liabilities
  DROP COLUMN IF EXISTS debt_category,
  DROP COLUMN IF EXISTS manual_entry,
  DROP COLUMN IF EXISTS current_balance,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS asset_depreciates;
```

### Phase 3: Plaid Integration for Auto Loans

**File:** `budget-backend/handlers/plaid.go`

The current Plaid webhook handler processes credit cards, mortgages, and student loans. Plaid's Liabilities product doesn't natively break out auto loans as a separate category — they may come through as generic loan accounts. The approach:

1. In the Plaid account sync handler, check the `subtype` field on accounts. Plaid uses subtypes like `auto`, `loan`, `line of credit` under the `loan` type.
2. Map Plaid subtypes to CoupleFlow liability types:
   - `auto` → `auto`
   - `loan` (generic) → `personal`
   - `line of credit` → `credit`
   - Existing mortgage/student mappings stay the same
3. Apply default `debt_category` based on the type mapping table above
4. For accounts Plaid can't categorize, mark as `other` and prompt the user to classify

### Phase 4: Manual Debt Entry API

**New handler:** `budget-backend/handlers/manual_debt.go`

```
POST   /api/v1/debts/manual        — Create a manual debt entry
PUT    /api/v1/debts/:id/category  — Update debt category (attack/structured)
PUT    /api/v1/debts/:id           — Update manual debt details
DELETE /api/v1/debts/:id           — Delete a manual debt entry (only if manual_entry = true)
GET    /api/v1/debts               — List all debts (both Plaid and manual), grouped by category
```

The `POST /api/v1/debts/manual` payload:

```json
{
  "name": "Toyota Camry Loan",
  "liability_type": "auto",
  "current_balance": 18500.00,
  "interest_rate": 6.5,
  "minimum_payment": 385.00,
  "debt_category": "attack",
  "next_payment_due_date": "2026-05-01"
}
```

The `PUT /api/v1/debts/:id/category` lets users toggle any debt (Plaid or manual) between `attack` and `structured`. This is the core of the feature — giving couples control over their strategy.

### Phase 5: Update the Debt Payoff Calculator

**File:** `budget-backend/internal/ai/calculators.go`

The `CalculateDebtPayoff` function currently operates on `[]models.DebtInfo` — it doesn't know about categories. Update it to:

1. Accept a filter parameter: `category string` — either `"attack"`, `"structured"`, or `"all"`
2. When generating plans, only include `attack` debts in the aggressive payoff simulation by default
3. `Structured` debts still appear in the overall financial picture but are shown with their standard amortization schedule (no extra payments directed to them)
4. Add a new function `CalculateStructuredDebtAmortization` for mortgage/structured debt projections showing the standard payoff timeline

### Phase 6: Update the AI Framework Assessment

**File:** `budget-backend/internal/ai/framework.go`

Level 2 ("Attack Debt") assessment currently checks `hasAnyDebts()`. Update to:

1. `assessLevel2` should only consider debts with `debt_category = 'attack'` when determining if the user has cleared Level 2
2. A user with only `structured` debts (e.g., mortgage at 3%) and no `attack` debts should be able to advance past Level 2
3. Update `hasAnyDebts()` → `hasAttackDebts()` with an optional flag to check all debts vs attack-only

### Phase 7: Update Claude Tool Definitions

**File:** `budget-backend/internal/ai/tools.go`

Update the `calculate_debt_payoff` tool to include category awareness:

```json
{
  "name": "calculate_debt_payoff",
  "description": "Calculate debt payoff schedule. Can filter by debt category.",
  "input_schema": {
    "properties": {
      "strategy": { "type": "string", "enum": ["avalanche", "snowball", "hybrid"] },
      "extra_monthly_payment": { "type": "number" },
      "debt_category": { "type": "string", "enum": ["attack", "structured", "all"], "default": "attack" }
    }
  }
}
```

Update the system prompt in `prompts.go` to explain debt categories to Claude so it can give appropriate advice, e.g.:

> "Users classify debts as 'attack' (pay off aggressively) or 'structured' (pay minimums, like a mortgage). When building payoff plans, focus extra payments on attack debts. When a user asks whether a debt should be attack or structured, consider: interest rate (>5% usually attack), asset depreciation (auto = depreciating = attack bias), tax benefits (mortgage interest deduction = structured bias), and the couple's risk tolerance."

### Phase 8: Frontend — Debt Management Screen

**File:** `budget-app/app/debts.tsx`

Update the existing debts screen to:

1. Group debts into two sections: "Attack Debts" and "Structured Debts"
2. Add a toggle/swipe action on each debt to reclassify between categories
3. Show a summary card: total attack debt vs total structured debt
4. Add a "+" button to add manual debts
5. Show the AI's recommendation badge on debts where the user's classification differs from the default (e.g., user kept a 9% auto loan as "structured" — show a nudge)

**New screen:** `budget-app/app/add-debt.tsx`

Form for adding manual debts with fields: name, type (dropdown), balance, rate, minimum payment, category.

### Phase 9: AI Nudge Integration

**File:** `budget-backend/internal/ai/nudges.go`

Add new nudge types:

1. `debt_category_suggestion` — When a new debt is synced via Plaid, suggest a category based on rate/type
2. `debt_reclassification` — If rates change (e.g., variable rate auto loan jumps), suggest the couple re-evaluate
3. `structured_debt_payoff_milestone` — Celebrate when a structured debt hits milestones (50% paid, etc.)

## Testing Plan

1. **Unit tests** for the expanded calculator with category filtering
2. **Unit tests** for framework assessment with attack-only debt checking
3. **Integration test** for manual debt CRUD operations
4. **Integration test** for Plaid sync with auto loan account types
5. **Integration test** for debt category toggle (attack ↔ structured)
6. **AI tool test** to verify Claude receives correct debt context with categories

## Files to Modify (Summary)

| File | Change |
|------|--------|
| `models/liability.go` | Add new fields, expand type enum |
| `migrations/` | New migration for schema changes |
| `handlers/plaid.go` | Map Plaid auto loan subtypes |
| `handlers/manual_debt.go` | New file — manual debt CRUD |
| `handlers/routes.go` | Register new endpoints |
| `internal/ai/calculators.go` | Category-aware payoff calculation |
| `internal/ai/framework.go` | Attack-only debt assessment for Level 2 |
| `internal/ai/tools.go` | Update tool definitions with category param |
| `internal/ai/tool_executors.go` | Handle new category parameter |
| `internal/ai/prompts.go` | Add debt category guidance to system prompt |
| `internal/ai/nudges.go` | New nudge types for debt categorization |
| `app/debts.tsx` | Grouped view, category toggle |
| `app/add-debt.tsx` | New manual debt entry form |

## Priority Order

Implement in this order for fastest value delivery:

1. **Phase 1-2** (Model + Migration) — Foundation, everything depends on this
2. **Phase 4** (Manual Debt API) — Lets users add auto loans immediately
3. **Phase 5** (Calculator update) — Makes payoff plans category-aware
4. **Phase 6** (Framework update) — Fixes Level 2 assessment
5. **Phase 3** (Plaid auto detection) — Automates what users are doing manually
6. **Phase 7** (AI tools) — Claude becomes category-aware
7. **Phase 8** (Frontend) — Users can see and manage categories
8. **Phase 9** (Nudges) — Proactive intelligence layer
