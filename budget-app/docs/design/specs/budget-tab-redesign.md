# Budget Tab Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/(tabs)/budget.tsx`
**Archetype:** summary + list (main tab) — same family as `dashboard.tsx` and `calendar.tsx`

---

## 1. Why this redesign exists

The budget tab works, but visually it is **a different app** from the two screens already
brought into the theme (calendar, dashboard). Concretely, `budget.tsx` today:

1. **Hardcodes its own gradient** — `['#0f0a1e', '#1a1035', '#0f0a1e']` via a raw
   `<LinearGradient>`. That purple is subtly *wrong* — it is not `gradients.bgDarkPurple`
   (`['#0f172a','#1a0a40','#0f172a']`) that calendar and dashboard now use. Side by side,
   the budget tab reads as a slightly different hue of the app.
2. **Hardcodes ~40 color literals** inline — `'#34d399'`, `'#f59e0b'`, `'#22c55e'`,
   `'#ef4444'`, `'#a855f7'`, `'#c084fc'`, `'#64748b'`, `'#475569'`, `'#cbd5e1'`,
   `'rgba(255,255,255,0.04)'`, `'rgba(168,85,247,0.2)'`, `'rgba(239,68,68,0.04)'` … none
   of which come from `design-system.ts`. The progress color logic even uses a *third*
   green (`#34d399`) for the default `ProgressBar` and a *different* green (`#22c55e`) in
   the rows — two greens that should both be `colors.success`.
3. **Uses magic-number spacing and radii everywhere** — `paddingHorizontal: 20`,
   `padding: 18`, `borderRadius: 14/16/12/10/8`, `paddingVertical: 10/12`, `gap: 10` — none
   tokenized. The reference screens use `spacing.*` and `radius.*` exclusively.
4. **Uses inline font sizes/weights** — `fontSize: 22/18/14/13/12/11/10/9`, `fontWeight`
   as string literals — instead of the `typography.*` scale.
5. **Uses the wrong loading skeleton primitive.** It imports `SkeletonCard` from
   `components/SkeletonLoader`, while the two theme-aligned screens use
   `components/Skeleton.tsx` (`Skeleton` / `SkeletonStack`) with token-matched shapes. The
   loading state should be **layout-matched skeletons**, not generic cards.
6. **Has an inconsistent header.** It renders a bespoke `styles.header` (title `fontSize: 22`,
   color `'white'`) plus a `BackButton`, a month switcher, and a type toggle stacked in
   three separate rows above the scroll — a heavier chrome stack than the slim single-row
   headers on calendar/dashboard. The AI-categorize, settings, and add actions are three
   loose icon buttons.

None of the screen's **functionality** is wrong — the data model (category tree merged with
a budget/spend summary, split into Budgeted vs Unbudgeted, per-category inline budget
editing, month switching, expense/income toggle, add-category sheet, AI categorize) is
good and is **preserved**. This redesign is a **re-skin + light IA cleanup**: adopt the
design system end-to-end and make the budget tab a first-class sibling of dashboard and
calendar, while keeping it recognizably the same screen.

---

## 2. The core idea — tokenize, then let the "budget health" read at a glance

Two jobs, done together:

1. **Adopt the design system.** Every color, gradient, space, radius, font, and card
   surface comes from `design-system.ts`. Background becomes
   `<GradientBackground variant="bgDarkPurple">`. No local color constants, no magic
   numbers. This alone makes it match.
2. **Sharpen the information architecture** so the top of the screen answers the one budget
   question — *"How much of this month's budget is left, and is anything over?"* — the same
   way the dashboard answers "how are we doing?". The **Hero Summary card** earns
   `glassFloating` (the only floating card, mirroring the dashboard headline convention),
   and everything below it is subordinate `glass`.

### The status metaphor (shared across the app, color-independent)

Budget "health" is encoded exactly like the dashboard status and calendar actual/projected
split — **icon + word + color together, never color alone**:

| State | Meaning | Token | Icon (Ionicons) | Word |
|---|---|---|---|---|
| **On track** | spent ≤ 80% of budget | `colors.success` | `checkmark-circle` | `On track` |
| **Watch** | spent 80–100% of budget | `colors.warning` | `alert-circle` (outline) | `Watch` |
| **Over** | spent > budget | `colors.error` | `warning` | `Over` |

This single 3-state model drives the hero used-badge, every category/subcategory progress
bar color, and the "Over" chip — one consistent language, replacing today's three ad-hoc
thresholds (`#34d399` / `#f59e0b` / `#ef4444` computed inline in three different places).

---

## 3. Full-screen wireframe — default / populated

Expense scope, June 2026, has budgeted + unbudgeted categories. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Budget                              ✨   ⚙   ( + )         │  ← slim header row
│                                                                │     (BackButton→goals,
│                                                                │      AI · settings · add)
│                  ‹     June 2026     ›                         │  ← month nav (centered)
│                                                                │
│  ┌────────────────────────────┬─────────────────────────────┐ │
│  │  ▸ Expenses   │    Income   │                             │ │  ← segmented type toggle
│  └────────────────────────────┴─────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  EXPENSE BUDGET                     ● On track · 63% used │ │  │ HERO SUMMARY
│  │                                                          │ │  │ glassFloating
│  │   Budgeted        Spent           Remaining              │ │  │ (the only card
│  │   $4.6k           $2.9k           $1.7k                  │ │  │  that floats)
│  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  63%                       │ │  │
│  │   8 categories budgeted            $1,700.00 left        │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ BUDGETED section
│  │ [▦] Budgeted (8)                    $4,600 total    ▲    │ │  │ header (tappable
│  └──────────────────────────────────────────────────────────┘ │  ┘ collapse)
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │ [🏠] Housing            3 subs   ▓▓▓▓▓▓▓░░  $2,000   ▼   │ │  │ CategoryGroup
│  ├──────────────────────────────────────────────────────────┤ │  │ (collapsed)
│  │   [🏠] Rent           ▓▓▓▓▓▓▓▓▓▓  $1,800 spent  $0 left  $1,800 │
│  │   [⚡] Utilities       ▓▓▓▓▓░░░░  $120 spent  $80 left    $200 │
│  │   [＋ Add Subcategory]  (dashed)                         │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [🍔] Dining      ⚠ Over    ▓▓▓▓▓▓▓▓▓▓▓  $420 spent   $400 │ │  ← over-budget row
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │  ← spacing.md
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ UNBUDGETED section
│  │ [?] Unbudgeted (4)                  $210 spent      ▼    │ │  │ header (collapsed
│  └──────────────────────────────────────────────────────────┘ │  ┘ by default)
│                                                                │
│                                                    ( + FAB )   │  ← existing FAB kept
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal (down from the current 20);
header row inside the safe area; hero → first section gap `spacing.xl`; between section
groups `spacing.md`; category cards `spacing.sm` apart. Section group labels are inline in
their tappable header (not free-floating), mirroring the current pattern but tokenized.

---

## 4. Header — slim single row (matches tab-root convention)

The reference tab screens use a **single slim header row** (title left, actions right)
inside the safe area, then push all secondary controls (month nav, toggle) into the scroll
region or just below. Budget adopts the same shape.

```
‹  Budget                                       ✨    ⚙    ( + )
```

- **BackButton** — keep the existing `<BackButton iconName="chevron-back" fallback="/(tabs)/goals" />`.
  Budget is reachable from goals, so the back affordance stays; tokenize its color to
  `colors.textMuted`. (The `BackButton` component already ships a 40×40 target — leave it.)
  Rationale: calendar/dashboard are drawer/tab roots with no back; budget is a tab that is
  also pushed from goals, so it legitimately keeps a back control. This is the one allowed
  header difference from the two references, and it is functional, not cosmetic.
- **Title** — `Budget` in `typography.h3` `colors.text` `fontWeight: '800'` (exactly the
  calendar `styles.title`). Replaces the bespoke `fontSize: 22, color: 'white'`.
- **AI categorize** (`sparkles-outline`) — icon button, `colors.primary2`. While running,
  swap to an `ActivityIndicator` `colors.primary2` in place (existing behavior, tokenized).
- **Settings** (`settings-outline`) — icon button, `colors.textMuted`.
- **Add** — the primary action: a `radius.md` square button filled with
  `gradients.primaryGradient`, white `add` glyph (existing, tokenized). Opens the Add
  Category sheet.
- Icon buttons match the calendar `iconBtn` style: 34×34, `colors.glassLight` fill,
  `colors.borderGlass` border, `radius.sm`; hit-slop padded to 44.

### Month navigator (centered, below header)

```
              ‹     June 2026     ›
```

Keep the centered prev / label / next month switcher, tokenized: chevrons `colors.primary2`
(matches calendar `monthNav`), label `typography.bodyBold` `colors.text`. `spacing.md`
vertical padding. Each chevron tap target hit-slop-padded to 44.

### Type toggle (Expenses | Income) — reuse the ScopeToggle pattern

The current two-pill expense/income toggle becomes a **segmented control identical in
construction to the dashboard `ScopeToggle`** (`components/dashboard/ScopeToggle.tsx`
visual language), so the app has one segmented-control style:

```
┌──────────────────┬──────────────────┐
│  ▾ Expenses  ✓    │     Income       │
└──────────────────┴──────────────────┘
```

- Container: `glassEffects.glass`, `radius.full`, 2px inner padding, height 32pt.
- **Active segment:** fill `colors.primary`, label `typography.smallBold` `colors.text`,
  leading icon `trending-down` (expenses) / `trending-up` (income).
- **Inactive segment:** transparent, label `colors.textMuted`, hit-slop padded to 44.
- Slide the active pill with `animation.fast`; instant under reduce-motion.
- Full-width, `spacing.md` below the month nav.

Replaces today's `styles.typeToggle` / `typeToggleActive` (which used
`rgba(192,132,252,0.12)` fill and `#c084fc` / `#64748b` text — all now tokens).

---

## 5. Hero Summary card (the centerpiece — the only floating card)

Direct evolution of today's `heroCard`, promoted to `glassEffects.glassFloating` and fully
tokenized. It answers the budget question at a glance.

```
┌──────────────────────────────────────────────────────────┐
│  EXPENSE BUDGET                       ● On track · 63% used│  label + status badge
│                                                            │
│   Budgeted          Spent            Remaining             │  3 stat columns
│   $4.6k             $2.9k            $1.7k                 │
│                                                            │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  63%                     │  progress bar (6pt)
│   8 categories budgeted              $1,700.00 left        │  footer meta
└──────────────────────────────────────────────────────────┘
```

- **Card:** `glassEffects.glassFloating`, `padding: spacing.lg`, `marginBottom: spacing.xl`.
  It is the **only** floating card on the screen — same rule as the dashboard headline.
- **Label:** `EXPENSE BUDGET` / `INCOME BUDGET`, `typography.caption` `colors.textMuted`,
  `letterSpacing: 0.5`, uppercase.
- **Status badge** (top-right, `radius.full` pill): the §2 model — `● On track` / `◐ Watch`
  / `⚠ Over` + `{n}% used` (expense) / `earned` (income). Icon + word + color:
  - On track → `colors.success` on `${success}1f`
  - Watch → `colors.warning` on `${warning}1f`
  - Over → `colors.error` on `${error}1f`
  Replaces today's `usedBadge` that only flipped to red text at >80% with no icon/word.
- **Three stat columns** — Budgeted / Spent / Remaining. Labels `typography.caption`
  `colors.textMuted`; values `typography.h3` `colors.text` (using `fmtShort`, e.g. `$4.6k`).
  - **Spent** value colored by status: on-track → `colors.text`; watch → `colors.warning`;
    over → `colors.error`. (Today it was a flat `#f59e0b` for expense / `#34d399` for
    income — replace with the status color so it agrees with the badge.)
  - **Remaining** in `colors.success` when ≥ 0. If total spend exceeds budget, show the
    overage in `colors.error` with a `-` prefix and relabel the column `Over by`.
- **Progress bar:** full-width, 6pt, `radius.full`. Fill = status color (success/warning/
  error). Track `colors.glassLight`. Trailing `{pct}%` in `typography.caption`.
- **Footer meta row:** `{n} categories budgeted` (left) · `${remaining} left` (right),
  both `typography.caption` `colors.textMuted`.

Income scope: label `INCOME BUDGET`, badge word `earned`, and "Remaining" reads as target
progress; keep the existing income math, just recolor via the status model
(income under target is neutral, not an error).

---

## 6. Section headers (Budgeted / Unbudgeted) — tappable collapse

Keep the existing collapse/expand progressive-disclosure pattern (Budgeted expanded,
Unbudgeted collapsed by default). Tokenize the current `sectionHeader`.

```
[▦] Budgeted (8)                        $4,600 total     ▲
[?] Unbudgeted (4)                      $210 spent       ▼
```

- Row: `flexBetween`, `paddingVertical: spacing.sm`, `marginBottom: spacing.sm`. Whole row
  is the collapse toggle (≥ 44pt tall).
- **Leading icon chip:** 28×28, `radius.sm`.
  - Budgeted → `wallet-outline` `colors.success` on `${success}1f`.
  - Unbudgeted → `help-circle-outline` `colors.textMuted` on `${textMuted}1f`
    (replaces `#64748b` on `rgba(100,116,139,0.12)`).
- **Title:** `Budgeted ({n})` / `Unbudgeted ({n})` in `typography.smallBold` `colors.text`.
- **Sub:** Budgeted → `${total} total` `colors.success` `typography.caption`; Unbudgeted →
  `${spent} spent` or `Tap to set a budget`, `colors.textMuted` `typography.caption`.
- **Trailing total** (Budgeted only) + chevron (`chevron-up`/`chevron-down`,
  `colors.textMuted`).
- **Budgeted empty (no budgets yet):** an inline `glass` note card, `spacing.lg` padding,
  centered `typography.caption` `colors.textMuted`: "No budgeted categories yet. Tap
  '+ Set' on a category to get started." (tokenized from today's inline note).

---

## 7. CategoryGroup card (expandable parent) — tokenized

Today's `categoryGroupCard`. Preserve behavior (tap header to expand; shows aggregate
budgeted/spent when it has budgets; expands to editable subcategory rows + Add Subcategory).

```
┌──────────────────────────────────────────────────────────┐
│ [🏠] Housing            3 subs   ▓▓▓▓▓▓▓░░  $2,000    ▼   │  ← collapsed header
├──────────────────────────────────────────────────────────┤
│   [🏠] Rent           ▓▓▓▓▓▓▓▓▓▓  $1,800 spent  $0 left  $1,800│  ← subcategory rows
│   [⚡] Utilities       ▓▓▓▓▓░░░░  $120 spent  $80 left    $200│
│   ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐   │
│   ╎           ＋  Add Subcategory                    ╎   │  ← dashed add button
│   └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘   │
└──────────────────────────────────────────────────────────┘
```

- **Card:** `glassEffects.glass`, `radius.lg`, `marginBottom: spacing.sm`, `overflow: hidden`.
  Replaces `rgba(255,255,255,0.04)` + `rgba(255,255,255,0.06)` border.
- **Header:** `padding: spacing.md`, `gap: spacing.md`. Icon chip 36×36 `radius.md`, tinted
  `${category.color}22` (category color is data-driven — keep it, like the calendar keeps
  `item.color`). Name `typography.smallBold` `colors.text`; `{n} subs` counter
  `typography.caption` `colors.textDark`.
- **Aggregate progress** (when the group has any budget): a 3pt `ProgressBar` colored by
  the §2 status of the aggregate `spent/budgeted`, with `{spent} spent` / `{budgeted}
  budgeted` in `typography.caption` `colors.textMuted`. Trailing aggregate budget total in
  `typography.smallBold` `colors.text` (or an em-dash in `colors.textDark` when unbudgeted).
- **Chevron:** `colors.textMuted`.
- **Expanded body:** top border `colors.borderGlass`. If no subs, the parent renders as its
  own `CategoryBudgetRow`. Then subcategory rows. Then the **Add Subcategory** dashed
  button — border `colors.primary2` at 25% (`${primary2}40` dashed), fill `${primary2}0f`,
  icon + `Add Subcategory` label `colors.primary2` `typography.caption`.

---

## 8. CategoryBudgetRow (leaf / subcategory) — tokenized, inline budget edit

Today's `CategoryBudgetRow`. This is the workhorse list row — preserve all behavior: tap
name to drill into transactions, tap the "to review" chip to open review, tap the amount to
inline-edit the budget, over-budget tint, no-budget hint.

```
[🏠] Rent   [3 to review ›]     ▓▓▓▓▓▓▓▓▓▓        $1,800 spent  $0 left      $1,800
[🍔] Dining   ⚠ Over            ▓▓▓▓▓▓▓▓▓▓▓       $420 spent   $20 over      $400
[🎬] Movies                      No budget set · $35 spent                    [＋ Set]
```

- **Row:** `flexRow` + `alignItems: center`, `paddingVertical: spacing.md` (sub: `spacing.sm`),
  `paddingHorizontal: spacing.md`, sub-indent `paddingLeft: spacing.xxl` (48), `gap: spacing.sm`,
  bottom hairline `colors.borderLight`. Over-budget rows get a `${error}0a` (≈4%) wash —
  keep the subtle tint but tokenized.
- **Icon chip:** 36×36 (sub 28×28), `radius.md`/`radius.sm`, tint `${category.color}22`,
  glyph `category.color` (data-driven — preserved).
- **Name block** (tap → transactions list): name `typography.smallBold` (sub:
  `typography.small`, `colors.textMuted`) `colors.text`, `numberOfLines={1}`.
  - **Over chip:** `warning` glyph + `Over` word, `colors.error` on `${error}1f`,
    `radius.sm`. (Icon + word + color — passes color-independence.)
  - **"to review" chip** (when `unverified_count > 0`, tap → review screen): `{n} to review ›`
    in `colors.warning` on `${warning}1f`, `radius.sm`.
  - **With budget:** 3pt `ProgressBar` (status color) + `{spent} spent` (left,
    `colors.textMuted`) / `{left|over}` (right — `colors.error` when over, else
    `colors.textMuted`), all `typography.caption`.
  - **No budget:** `{spent} spent · No budget set` or `Tap amount to set budget`,
    `typography.caption` `colors.textDark`.
- **Budget amount control** (tap to edit):
  - **Set state:** pill, `colors.glassLight` fill, `colors.borderGlass` border, `radius.sm`,
    min-width 64. Shows `${budgeted}` in `colors.text` `typography.smallBold` when set, or
    `+ Set` in `colors.primary2` `typography.caption` when unset.
  - **Editing state:** inline `TextInput`, `${primary2}1f` fill, `${primary2}66` border,
    `radius.sm`, `$` prefix + numeric input `colors.text`. Submit on blur / return. (Keep
    the existing focus-on-open + optimistic update.)

---

## 9. Add Category bottom sheet — tokenized

Today's `AddCategoryModal`. Keep the flow (name, optional monthly budget, color picker,
icon picker, live preview, create). Tokenize the sheet chrome:

- **Backdrop:** `rgba(0,0,0,0.7)`, bottom-anchored.
- **Sheet:** background `colors.surfaceDark` (`#0f172a` — replaces the off-theme `#0f0a1e`),
  `borderTopLeftRadius/RightRadius: radius.xxl`, `padding: spacing.lg`, top border
  `colors.borderGlass`, `maxHeight: 85%`.
- **Title:** `Add Category` `typography.h3` `colors.text` `fontWeight: '800'`.
- **Close button:** 36×36 `radius.md`, `colors.glassMedium` fill, `close` glyph `colors.text`.
- **Field labels:** `typography.smallBold` `colors.textMuted`.
- **Text inputs:** `colors.glassMedium` fill, `colors.borderGlass` border, `radius.md`,
  `padding` `spacing.md`, text `colors.text`, placeholder `colors.textMuted`.
- **Budget `$` prefix:** `typography.h3` `colors.primary2`.
- **Color swatches:** keep the data-driven `PICKER_COLORS` array (these are category palette
  values, not theme tokens — analogous to calendar keeping `item.color`); selected swatch
  gets a white `radius.md` ring.
- **Icon picker:** 42×42 `radius.md` tiles; selected = `${color}22` fill + `color` border;
  unselected = `colors.glassLight` fill, `colors.borderGlass` border, glyph `colors.textMuted`.
- **Preview card:** `glassEffects.glass`, `radius.lg`, `padding: spacing.md`.
- **Create button:** `gradients.primaryGradient`, `radius.lg`, `padding: spacing.md`, label
  `typography.button` white; 50% opacity when name empty / saving.
- **Add Subcategory** (currently `Alert.prompt`): keep as-is for v1 — it is functional and
  platform-native; note it is Android-incompatible (`Alert.prompt` is iOS-only) and should
  eventually reuse this same sheet. Flagged in Developer Notes, not redesigned here.

---

## 10. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed (§3). |
| **Loading** | **Skeletons, not `SkeletonCard`.** Reuse `components/Skeleton.tsx`, layout-matched: a `glassFloating`-shaped hero skeleton (label line + 3 stat blocks + a wide progress bar), a section-header skeleton, then 3 category-card skeletons (icon square + name/progress lines + trailing amount pill). Header, month nav, and type toggle render immediately. Keep the small header `ActivityIndicator` for background refresh (pull-to-refresh + AI run). |
| **Empty — no categories at all** (for the active type) | Reuse the existing `EmptyState` component, tokenized: `wallet-outline` `colors.textDark`, title "No {expense/income} categories yet", body "Create your first {type} category to start budgeting", primary CTA "Add Category" (`gradients.primaryGradient`) → opens the sheet. The hero card still renders above it showing all-zeros so the screen never blanks. |
| **Empty — categories exist but none budgeted** | Hero renders with `$0` budgeted / `0% used`, Budgeted section shows the inline "Tap '+ Set' …" note (§6), Unbudgeted section holds every category. This is the natural first-run-after-adding state and needs no special empty art. |
| **Error** | Reuse `ErrorState` in place of the list (hero hidden): `alert-circle-outline` `colors.error`, "Something went wrong", the error message, `Retry` button that re-runs `loadData`. Do not blank the header/toggle. |
| **Overflow — long category names** | `numberOfLines={1}` + ellipsis on category/subcategory name; the budget amount pill is `flexShrink: 0` and never truncates. |
| **Overflow — many categories / subs** | The whole content scrolls; collapsed sections keep the screen short. Unbudgeted defaults collapsed so a long tail doesn't dominate. |
| **Over budget** | Row `${error}0a` wash + `⚠ Over` chip + error-colored progress + error "$X over" — four independent signals, none color-only. |
| **AI categorizing** | Header sparkles icon → inline `ActivityIndicator`; screen stays interactive; on completion an `Alert` reports counts (existing) and `loadData` refreshes. |
| **Editing a budget** | Inline amount input replaces the pill; optimistic local update, then server reload. Reduced-motion: no animated pill transition. |

---

## 11. Accessibility

- **Touch targets:** every interactive element ≥ 44×44pt — header icon buttons (hit-slop to
  44 over 34 visual), month chevrons (hit-slop 44), type-toggle segments (hit-slop over the
  32pt bar), section headers (≥44 tall), category rows, the budget-amount pill, the "to
  review" chip, and the Add Subcategory button. The FAB stays 52×52.
- **Color independence:** budget health is always **icon + word + color** — hero status
  badge (`On track`/`Watch`/`Over` + icon), row `⚠ Over` chip, "to review" chip (text +
  chevron). Progress-bar color is never the *only* signal; the spent/left/over text always
  states the number. A red row is never *only* red.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` / `colors.textDark` over
  dark glass. `colors.textDark` (`#475569`) is borderline — reserve it for non-essential
  meta (the "{n} subs" counter, "No budget set" hint) and verify ≥ 4.5:1; for anything a
  user must read to act (spent/left/over), use `colors.textMuted` or brighter. Status tints
  (`${color}1f`) are backgrounds only; the icon/word on them stays full-opacity semantic
  color.
- **Screen-reader order & labels:**
  - Header: back → title → AI categorize → settings → add.
  - Type toggle: `role="tablist"`; each segment a tab with `selected`; changing announces
    "Showing expenses" / "Showing income".
  - Hero: reads as one node — `"Expense budget, on track, 63 percent used. Budgeted $4,600,
    spent $2,900, remaining $1,700."`
  - Section header: `"Budgeted, 8 categories, $4,600 total, expanded/collapsed. Double tap
    to toggle."`
  - Category row: `"{name}, {spent} spent of {budget}, {left|over}{, over budget}. Double
    tap to view transactions."` The budget pill is a separate control:
    `"Set budget for {name}, currently ${amount}. Double tap to edit."` The "to review"
    chip: `"{n} transactions to review in {name}. Double tap to open."`
- **Reduced motion:** the type-toggle pill slide, progress-bar fill animation, and
  budget-pill/edit transition all use `animation.fast`; under reduce-motion they become
  instant state swaps. Skeleton pulse is decorative — acceptable, but honor reduce-motion by
  holding a static mid-opacity if the app exposes the setting.
- **Dynamic Type:** hero stat values and category names must reflow (no fixed row heights
  that clip); use min-heights, not fixed heights.

---

## 12. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `budget.tsx`) | Replace with token |
|---|---|
| gradient `['#0f0a1e','#1a1035','#0f0a1e']` (raw `<LinearGradient>`) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `#34d399` (ProgressBar default) / `#22c55e` (row green) / `#10b981` (remaining) | `colors.success` |
| `#f59e0b` (spent / warn threshold) / `#fbbf24` (review chip) / `#eab308` | `colors.warning` |
| `#ef4444` (over) | `colors.error` |
| `#a855f7` (accent, add-sub) / `#c084fc` (edit `$`, toggle text) | `colors.primary2` |
| `#7c3aed` (primary/add/FAB/save) | `colors.primary` (and `gradients.primaryGradient` for the add button / FAB / save) |
| `'white'` / `#f8fafc` / `#cbd5e1` text | `colors.text` |
| `#94a3b8` / `rgba(255,255,255,0.4)` / `rgba(255,255,255,0.5/0.7/0.8)` | `colors.textMuted` |
| `#64748b` / `#475569` (subs counter, hints) | `colors.textDark` |
| card `rgba(255,255,255,0.04)` + border `rgba(255,255,255,0.06)` | `glassEffects.glass` |
| hero `rgba(124,58,237,0.08)` + border `rgba(168,85,247,0.2)` | `glassEffects.glassFloating` (hero earns elevation) |
| toggle `rgba(192,132,252,0.12)` / `rgba(255,255,255,0.04)` | `colors.primary` (active) / `glassEffects.glass` container |
| amount pill `rgba(255,255,255,0.06)` + `rgba(255,255,255,0.08)` border | `colors.glassLight` + `colors.borderGlass` |
| edit input `rgba(168,85,247,0.12)` + `rgba(168,85,247,0.4)` border | `${colors.primary2}1f` + `${colors.primary2}66` |
| sheet bg `#0f0a1e` | `colors.surfaceDark` |
| badge fills `rgba(239,68,68,0.12)` / `rgba(251,191,36,0.12)` / `rgba(34,197,94,0.12)` | `` `${semanticToken}1f` `` (≈12%) |
| over-row wash `rgba(239,68,68,0.04)` | `` `${colors.error}0a` `` |
| progress track `rgba(255,255,255,0.08)` | `colors.glassLight` |
| bottom hairline `rgba(255,255,255,0.04)` | `colors.borderLight` |
| `borderRadius: 24 / 20 / 16 / 14 / 12 / 10 / 8` | `radius.xxl / xl / lg / lg / md / md / sm` |
| paddings `20 / 18 / 14 / 12 / 10 / 8 / 6 / 4` | `spacing.lg / lg / md / md / sm / sm / xs / xs` (indent 48 → `spacing.xxl`) |
| `fontSize: 22` title | `typography.h3` (`fontWeight: '800'`) |
| `fontSize: 20/18` (sheet title, stat value) | `typography.h3` |
| `fontSize: 16/15` | `typography.body` / `bodyBold` |
| `fontSize: 14/13` | `typography.small` / `smallBold` |
| `fontSize: 12/11/10/9` | `typography.caption` (9–10 = caption at reduced size only where truly a micro-label) |
| `SkeletonCard` (`components/SkeletonLoader`) | `Skeleton` / `SkeletonStack` (`components/Skeleton.tsx`) |

---

## 13. Component reuse

| Component | Source | Use here |
|---|---|---|
| `GradientBackground` | `components/GradientBackground.tsx` | screen background, `variant="bgDarkPurple"` |
| `Skeleton` / `SkeletonStack` | `components/Skeleton.tsx` | loading state (replace `SkeletonCard`) |
| `BackButton` | `components/BackButton.tsx` | header back → `/(tabs)/goals` |
| `EmptyState` | `components/EmptyState.tsx` | no-categories empty state (keep, tokenize) |
| `ErrorState` | `components/ErrorState.tsx` | error state (keep) |
| segmented control | model after `components/dashboard/ScopeToggle.tsx` | Expenses \| Income toggle |
| `FloatingActionButton` | (optional) `components/FloatingActionButton.tsx` | could replace the bespoke FAB for cross-screen consistency — optional, see notes |

Not applicable here: `AttentionCard`, `Sparkline`, `TrajectoryStrip`, `StatusHeadlineCard`,
`ThisWeekProof` (dashboard-specific), calendar day-cell/event-row components. The budget
tab's own reusable pieces are `CategoryGroup`, `CategoryBudgetRow`, `ProgressBar`, the
segmented `TypeToggle`, and the `BudgetHeroSummary` card — component specs for these are in
`docs/design/components/budget-tab-*.json`.

---

## 14. Developer notes

- **This is a re-skin, not a re-architecture.** The data flow (`buildMergedView`,
  `loadData`, `handleSetBudget`, `handleAddCategory`, `handleAddSub`, the
  budgeted/unbudgeted split, `totalBudgetedAmount`/`totalSpentAmount`/`usedPct` derivations)
  is preserved verbatim. Swap presentation, keep logic.
- **One status helper drives all budget-health color.** Add
  `budgetStatus(spent, budgeted) => 'ontrack' | 'watch' | 'over'` where `over = spent >
  budgeted && budgeted > 0`, `watch = pct > 80`, else `ontrack`; map to
  `colors.success/warning/error`. Use it in the hero badge, hero progress bar, hero Spent
  color, `CategoryGroup` aggregate bar, and `CategoryBudgetRow` bar — replacing the three
  separate inline threshold checks currently at lines ~258, ~519, ~1356.
- **`category.color` is data, not theme.** Like the calendar keeps `item.color` and the
  dashboard keeps `AttentionCard`'s `item.color`, keep the per-category color for icon
  chips. Only the *chrome* (cards, borders, text, status) tokenizes.
- **Progress-bar percent** stays clamped 0–100 for width; the *label* may read >100% (e.g.
  "128%") to communicate overage honestly — do not clamp the number, only the bar width.
- **`ProgressBar` default color** should become `colors.success` (it is currently `#34d399`,
  a fourth green); better, always pass an explicit status color so no default is relied on.
- **Skeleton swap:** remove the `SkeletonCard` import; import `Skeleton` from
  `components/Skeleton.tsx`. Match skeleton block heights to the real hero (~140) and
  category cards (~64) so the layout doesn't jump on load (the `Skeleton` doc explicitly
  calls this out).
- **`Alert.prompt` for Add Subcategory is iOS-only.** It is preserved as-is for v1 but is a
  known Android gap; the eventual fix is to reuse the Add Category sheet in a "subcategory"
  mode. Out of scope for this visual redesign — flagged so it isn't mistaken for new.
- **Header back button** is the one intentional divergence from the calendar/dashboard
  header (which have no back). Budget is pushed from goals, so the back is functional; keep
  it, tokenize its color to `colors.textMuted`.
- **Optional:** the bespoke FAB + header add-button both open the same sheet. Consider
  consolidating to a single entry (keep the FAB, demote the header `+` to only appear when
  the FAB is off-screen) — optional IA tidy, not required. If kept, both use
  `gradients.primaryGradient`.

---

## 15. Handoff checklist

- [x] Every hardcoded color/gradient/spacing/radius/font mapped to a design-system token (§12)
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Hero promoted to the single `glassFloating` card; all else `glass` (matches dashboard rule)
- [x] Budget-health status model (icon + word + color) unified across hero, groups, rows
- [x] All states designed: default, loading (Skeleton), empty (no categories), empty (none budgeted), error, overflow, over-budget
- [x] Loading state re-specified to reuse `components/Skeleton.tsx` (not `SkeletonCard`)
- [x] Type toggle re-specified to reuse the `ScopeToggle` segmented pattern
- [x] Functionality preserved (merge logic, month switch, inline budget edit, add category/sub, AI categorize)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Component reuse mapped (§13) + component specs (`docs/design/components/budget-tab-*.json`)
- [x] Developer notes flag the one header divergence, the `Alert.prompt` Android gap, and the single-status-helper refactor
