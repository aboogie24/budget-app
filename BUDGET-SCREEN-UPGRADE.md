# Budget Screen Upgrade: Subcategory-Aware UI

## Depends On

This plan assumes the backend changes from `CATEGORY-SYSTEM-UPGRADE.md` are complete:
- Categories have `parent_id` (subcategory hierarchy)
- Transactions have `category_id` FK (no more orphaned `category_name`-only records)
- `GetBudgetSummary` returns subcategory-level spending rolled up to parent budgets
- `transaction_splits` table exists for split transactions
- `category_mapping_rules` table exists for auto-categorization
- `match_confidence` and `user_verified` fields exist on transactions

## What's Wrong With the Current Screen

1. **Flat category breakdown.** The expanded budget card shows a flat list of categories with mini bar charts. With subcategories, this needs to show a two-level hierarchy — parent totals with expandable subcategory detail.

2. **No uncategorized transaction awareness.** The screen has no way to surface transactions that need user attention (low-confidence auto-categorizations). Users don't know they have unverified transactions affecting their budget numbers.

3. **Add Budget form uses a flat dropdown.** The `DropDownPicker` for category selection shows a flat list. Needs to become a hierarchical picker that can select parent categories (budget tracks all children) or specific subcategories.

4. **No split transaction visibility.** When a transaction is split, the budget summary should show split portions under their respective categories. The current card has no indication that spending includes splits.

5. **Category colors are hardcoded.** The `SpendingBars` component uses a hardcoded color array. Categories now have their own `color` field — use it.

6. **Bill section is disconnected.** Bills appear as a separate section but don't participate in category-based budgeting. Bills should map to categories too (e.g., the electric bill maps to "Utilities" under "Housing").

---

## Updated API Response Shape

The `GetBudgetSummary` endpoint needs to return richer data. Here's the updated shape:

```typescript
type SubcategorySummary = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  spent: number;
  transaction_count: number;
  has_unverified: boolean;      // true if any transactions are unverified
  unverified_count: number;
};

type CategorySummary = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  spent: number;                // total including subcategories
  transaction_count: number;
  has_unverified: boolean;
  unverified_count: number;
  subcategories: SubcategorySummary[];
};

type BudgetSummaryItem = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  budgeted: number;
  spent: number;
  remaining: number;
  percent: number;
  frequency: string;
  household_id?: string | null;
  is_shared?: boolean;
  source?: string;
  // Updated: categories now include subcategory breakdown
  categories: CategorySummary[];
  // New fields
  total_unverified: number;     // count of unverified transactions in this budget
  has_splits: boolean;          // true if any transactions are splits
};

type SummaryResponse = {
  month: number;
  year: number;
  total_income: number;
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  total_unverified: number;     // global count for the review nudge banner
  budgets: BudgetSummaryItem[];
};
```

### Backend Change: `handlers/budgets.go`

Update `GetBudgetSummary` to:

1. Query spending grouped by `(parent_category_id, category_id)` instead of just `category_id`
2. Include `match_confidence` and `user_verified` counts in the grouping
3. Return nested `subcategories` arrays under each parent category
4. Include `color` from the categories table
5. Count transactions with `user_verified = false` per budget

The core query change (from `CATEGORY-SYSTEM-UPGRADE.md` Phase 5) feeds this response shape.

---

## Phase 1: Updated Type Definitions

**File:** `app/(tabs)/budget.tsx` — top of file

Replace the existing types with the updated shapes above. Also add:

```typescript
type CategoryTreeItem = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  type: string;
  parent_id?: string | null;
  subcategories?: CategoryTreeItem[];
};
```

---

## Phase 2: Review Banner Component

**New component:** `components/UnverifiedTransactionsBanner.tsx`

When `summary.total_unverified > 0`, show a banner at the top of the scroll view (below the hero card, above budget cards):

```
┌─────────────────────────────────────────────┐
│ ⚠️  12 transactions need your review         │
│ Auto-categorized — tap to verify             │
│                                    [Review →]│
└─────────────────────────────────────────────┘
```

Design specs:
- Background: `rgba(251, 191, 36, 0.08)` (warm amber glass)
- Border: `rgba(251, 191, 36, 0.2)` (1px)
- Left accent: 3px amber bar
- Icon: `alert-circle` in amber
- Text: White title, muted subtitle
- "Review" button routes to `/transactions/review` (the new review screen from CATEGORY-SYSTEM-UPGRADE.md)

Props:
```typescript
{ count: number; onPress: () => void }
```

Place it in the budget screen right after the hero card:
```tsx
{summary.total_unverified > 0 && (
  <UnverifiedTransactionsBanner
    count={summary.total_unverified}
    onPress={() => router.push('/transactions/review')}
  />
)}
```

---

## Phase 3: Updated Budget Card — Subcategory Breakdown

**File:** `app/(tabs)/budget.tsx` — `BudgetCard` component

The expanded section currently shows a flat list. Redesign it as a two-level expandable tree.

### Collapsed State (same as today, minor tweaks)

No change to the card header. Add a small unverified indicator if the budget has unverified transactions:

```tsx
{budget.total_unverified > 0 && (
  <View style={[styles.chipBadge, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
    <Ionicons name="alert-circle" size={9} color="#fbbf24" />
    <Text style={{ fontSize: 10, color: '#fbbf24', marginLeft: 3 }}>
      {budget.total_unverified} to review
    </Text>
  </View>
)}
```

### Expanded State — New Layout

Replace the current flat category list with:

```
┌─ CATEGORIES (3) ──────────── [mini spending bars] ─┐
│                                                      │
│ 🟣 Food & Dining                          $320.50   │
│   ├─ Groceries                   $210.00            │
│   ├─ Restaurants                  $85.50            │
│   └─ Coffee Shops                 $25.00            │
│                                                      │
│ 🔵 Transportation                         $180.00   │
│   ├─ Gas                         $120.00            │
│   └─ Rideshare ⚠️                 $60.00            │
│       └─ (2 unverified)                             │
│                                                      │
│ 🟢 Entertainment                           $45.00   │
│   └─ Streaming                    $45.00            │
│                                                      │
│            👁 View all transactions                   │
└──────────────────────────────────────────────────────┘
```

Implementation — new `CategoryBreakdown` component:

```tsx
const CategoryBreakdown = ({ categories }: { categories: CategorySummary[] }) => {
  return (
    <>
      {categories.map((cat, i) => (
        <View key={cat.id}>
          {/* Parent category row */}
          <View style={styles.parentCatRow}>
            <View style={[styles.catDot, { backgroundColor: cat.color }]} />
            <Text style={styles.parentCatName}>{cat.name}</Text>
            {cat.has_unverified && (
              <Ionicons name="alert-circle" size={10} color="#fbbf24" />
            )}
            <Text style={styles.parentCatAmount}>{fmt(cat.spent)}</Text>
          </View>

          {/* Subcategory rows (indented) */}
          {cat.subcategories.map((sub, j) => (
            <View key={sub.id} style={styles.subCatRow}>
              <View style={styles.subCatTreeLine}>
                {j < cat.subcategories.length - 1 ? (
                  <Text style={styles.treeBranch}>├─</Text>
                ) : (
                  <Text style={styles.treeBranch}>└─</Text>
                )}
              </View>
              <Text style={styles.subCatName}>{sub.name}</Text>
              {sub.has_unverified && (
                <Text style={styles.unverifiedHint}>
                  ({sub.unverified_count} unverified)
                </Text>
              )}
              <Text style={styles.subCatAmount}>{fmt(sub.spent)}</Text>
            </View>
          ))}

          {/* Divider between parent categories */}
          {i < categories.length - 1 && <View style={styles.catDivider} />}
        </View>
      ))}
    </>
  );
};
```

### SpendingBars Update

The `SpendingBars` component currently uses a hardcoded color array. Update it to use category colors:

```tsx
const SpendingBars = ({ categories }: { categories: CategorySummary[] }) => {
  const max = Math.max(...categories.map((c) => c.spent), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 50 }}>
      {categories.map((c, i) => {
        const h = (c.spent / max) * 40;
        return (
          <View key={c.id} style={{ alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 20,
                height: Math.max(h, 3),
                borderRadius: 3,
                backgroundColor: c.color,  // Use category's own color
                opacity: 0.8,
              }}
            />
            <Text style={styles.barLabel} numberOfLines={1}>
              {c.name.slice(0, 5)}
            </Text>
          </View>
        );
      })}
    </View>
  );
};
```

---

## Phase 4: Hierarchical Category Picker

**New component:** `components/CategoryPicker.tsx`

This replaces the flat `DropDownPicker` in both the budget screen's inline add form AND the `add-budget.tsx` screen.

### Design

```
┌─ Select Category ───────────────────────────┐
│ 🔍 Search categories...                     │
├──────────────────────────────────────────────┤
│                                              │
│ 🟣 Food & Dining                        ▸   │
│   (tap to expand)                            │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ 🔵 Transportation                       ▸   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ 🟢 Entertainment                        ▸   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ 🟡 Shopping                             ▸   │
│                                              │
│              + Add custom category           │
└──────────────────────────────────────────────┘

(After tapping "Food & Dining"):

┌─ Food & Dining ─────────────────────────────┐
│ ← Back                                      │
├──────────────────────────────────────────────┤
│                                              │
│ ◉ Food & Dining (all)                        │
│   Select to track ALL subcategories          │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
│ ○ Groceries                                  │
│ ○ Restaurants                                │
│ ○ Coffee Shops                               │
│ ○ Fast Food                                  │
│                                              │
│         + Add subcategory                    │
└──────────────────────────────────────────────┘
```

### Behavior

- **For budgets:** Selecting a parent means "this budget tracks all spending in all subcategories." Selecting a specific subcategory means "this budget only tracks that one."
- **For transactions:** User always picks a specific subcategory (not a parent). If they pick a parent, prompt them to pick a child or let them use the parent directly for general spending.
- **Search:** Typing filters both parents and children. If a child matches, its parent section auto-expands.
- **Add custom:** Opens an inline form to create a new category. If inside a parent, creates a subcategory.

### Props

```typescript
type CategoryPickerProps = {
  type: 'income' | 'expense';
  selectedId?: string;
  onSelect: (categoryId: string, categoryName: string, parentId?: string) => void;
  allowParentSelection?: boolean;  // true for budgets, false for transactions
  placeholder?: string;
};
```

### Data Loading

The picker calls `GET /auth/categories/user/{user_id}` which now returns a tree structure (Phase 1 of CATEGORY-SYSTEM-UPGRADE.md). It caches the tree in state and renders from there.

---

## Phase 5: Update the Inline Add Budget Form

**File:** `app/(tabs)/budget.tsx` — the inline `Modal` for adding budgets

The current form has these fields: Name, Amount, Type toggle, Category (flat dropdown), Frequency, Start Date, Shared toggle.

Changes:

1. **Replace the DropDownPicker** with the new `CategoryPicker` component (Phase 4).
2. **Auto-name from category:** When user selects a category, auto-fill the budget name if it's empty. E.g., selecting "Groceries" auto-fills name as "Groceries."
3. **Show subcategory info:** After selecting a parent category, show a note: "This budget will track spending across all subcategories: Groceries, Restaurants, Coffee Shops, Fast Food."
4. **Budget linking:** The `handleSave` function currently sends `category_id`. Update it to also handle parent categories — when a parent is selected, the backend creates `budget_categories` entries for the parent AND all its current children.

### Updated Form Layout

```
┌─ New Budget ────────────────────────────────┐
│                                              │
│ Category                                     │
│ ┌──────────────────────────────────────────┐ │
│ │ 🟣 Food & Dining (all)              ✕   │ │
│ │ Tracks: Groceries, Restaurants, ...      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Budget Name                                  │
│ ┌──────────────────────────────────────────┐ │
│ │ Food & Dining                            │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Amount           Frequency                   │
│ ┌────────────┐  ┌────────────────────┐      │
│ │ $600       │  │ Monthly        ▼   │      │
│ └────────────┘  └────────────────────┘      │
│                                              │
│ ☐ Shared with partner                        │
│                                              │
│        [Cancel]        [Save Budget]         │
└──────────────────────────────────────────────┘
```

---

## Phase 6: Update `add-budget.tsx` Screen

**File:** `app/budget/add-budget.tsx`

This is the standalone add-budget screen (navigated to from elsewhere). Apply the same changes as Phase 5:

1. Replace `DropDownPicker` with `CategoryPicker`
2. Remove the manual category deduplication logic (lines 40-56) — the tree endpoint handles this
3. Remove the `API_URL` direct fetch on line 104 — use `api.post` consistently
4. Add subcategory info display below the picker
5. Match the updated form layout from Phase 5

---

## Phase 7: Hero Card — Add Unbudgeted Spending Awareness

**File:** `app/(tabs)/budget.tsx` — hero card section

The hero card shows Income / Budgeted / Remaining. Add a fourth stat: **Unbudgeted spending.**

This is money spent on categories that aren't linked to any budget. The backend calculates this as:

```
unbudgeted_spending = total_spent - sum(spending on categories linked to budgets)
```

Add to the `SummaryResponse`:
```typescript
total_unbudgeted: number;  // spending on categories not assigned to any budget
```

Add to the hero card stat row:
```tsx
<View style={{ alignItems: 'center' }}>
  <Text style={styles.statLabel}>Unbudgeted</Text>
  <Text style={[styles.statValue, { color: '#f87171' }]}>
    {fmtShort(summary.total_unbudgeted)}
  </Text>
</View>
```

If `total_unbudgeted > 0`, show a subtle prompt below the hero card:

```tsx
{summary.total_unbudgeted > 0 && (
  <TouchableOpacity
    style={styles.unbudgetedHint}
    onPress={() => router.push('/budget/unbudgeted')}
  >
    <Ionicons name="information-circle" size={14} color="#a855f7" />
    <Text style={styles.unbudgetedHintText}>
      {fmt(summary.total_unbudgeted)} spent on categories without budgets
    </Text>
    <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.35)" />
  </TouchableOpacity>
)}
```

### New Screen: `app/budget/unbudgeted.tsx`

Shows categories with spending but no budget, grouped by parent:

```
┌─ Unbudgeted Spending ───────────────────────┐
│                                              │
│ These categories have spending but no budget │
│                                              │
│ 🟡 Shopping                        $230.00  │
│   ├─ Clothing                      $180.00  │
│   └─ Electronics                    $50.00  │
│                              [Create Budget] │
│                                              │
│ 🔴 Health                           $95.00  │
│   └─ Pharmacy                       $95.00  │
│                              [Create Budget] │
└──────────────────────────────────────────────┘
```

"Create Budget" pre-fills the add-budget form with the category and the current month's spending as a suggested amount.

---

## Phase 8: Bill-to-Category Mapping

Currently bills appear as a separate "Bills" section. Update them to participate in the category system.

### Backend Change

Add `category_id` to the `bills` table (migration):

```sql
ALTER TABLE bills ADD COLUMN category_id UUID REFERENCES categories(id);
```

When creating a bill, auto-suggest a category (e.g., electric bill → "Utilities" subcategory). Bills with a `category_id` contribute their payments to the budget summary alongside regular transactions.

### Frontend Change

In the Bills section of the budget screen, show which budget/category each bill belongs to:

```tsx
<BillBudgetCard bill={bill} categoryName="Utilities → Housing" />
```

If a bill has no category, show a small "Categorize" button that opens the `CategoryPicker`.

---

## Phase 9: Polish & Interactions

### A. Tap-to-drill-down

When a user taps a subcategory in the expanded budget card, navigate to a filtered transaction list showing only transactions in that category for the current month:

```tsx
onPress={() => router.push({
  pathname: '/transactions',
  params: { category_id: sub.id, month: monthYear.month + 1, year: monthYear.year }
})}
```

### B. Long-press budget card → Quick actions

Currently long-press navigates to edit. Add a context menu:
- Edit budget
- View transactions
- Change category
- Delete budget

### C. Smooth animations

Use `LayoutAnimation` or `react-native-reanimated` for:
- Expanding/collapsing budget cards (currently instant)
- Expanding subcategory tree within a card
- Banner entrance/exit

### D. Pull-to-refresh feedback

After refresh, if new unverified transactions were found, briefly highlight the review banner with a pulse animation.

---

## Files Summary

| File | Action |
|------|--------|
| **Modified** | |
| `app/(tabs)/budget.tsx` | Updated types, hero card, budget card expanded section, inline add form, review banner, unbudgeted awareness |
| `app/budget/add-budget.tsx` | Replace flat dropdown with CategoryPicker, match updated form layout |
| `handlers/budgets.go` | Updated GetBudgetSummary query with subcategory rollup, unverified counts, unbudgeted spending |
| **New Files** | |
| `components/CategoryPicker.tsx` | Hierarchical category selection component |
| `components/CategoryBreakdown.tsx` | Two-level category spending display for budget cards |
| `components/UnverifiedTransactionsBanner.tsx` | Amber banner for unverified transaction count |
| `app/budget/unbudgeted.tsx` | Screen showing unbudgeted category spending |
| `app/transactions/review.tsx` | Transaction review screen (from CATEGORY-SYSTEM-UPGRADE.md) |
| **Migrations** | |
| `XXXXXX_bills_category_id.up.sql` | Add category_id to bills table |

## Implementation Order

1. **Phase 1** (Types) — Update TypeScript types to match new API response. Quick, unblocks everything.
2. **Phase 4** (CategoryPicker) — Build the shared picker component. Used by multiple screens.
3. **Phase 3** (Budget Card subcategory breakdown) — The biggest visual improvement. Users see where their money actually goes.
4. **Phase 2** (Review Banner) — Surface unverified transactions. Drives user engagement with the auto-categorization system.
5. **Phase 5-6** (Add Budget forms) — Wire up the new picker to budget creation.
6. **Phase 7** (Hero Card + Unbudgeted) — Surface spending gaps. Encourages users to create more budgets.
7. **Phase 8** (Bill-to-category) — Connect bills to the category system.
8. **Phase 9** (Polish) — Animations, drill-down, context menus.

## Relationship to Other Plans

- **CATEGORY-SYSTEM-UPGRADE.md**: Backend must be done first. This plan is the frontend companion.
- **DEBT-CATEGORIZATION-PLAN.md**: Independent — debt and budget screens are separate. But the debt category concept ("attack" vs "structured") could eventually show in the budget screen as a "Debt Payment" budget category.
- **FIX-WELCOME-REDIRECT.md**: Independent — already implemented.
