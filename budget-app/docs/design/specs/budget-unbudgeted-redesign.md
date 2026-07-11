# Unbudgeted Spending Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/budget/unbudgeted.tsx`
**Archetype:** list (matches `calendar-redesign.md`, `dashboard-redesign.md`, `bills-redesign.md`)

---

## 1. Why this redesign exists

The screen works, but it is **visually a different app** from the rest of CoupleFlow. Like
the pre-redesign calendar and dashboard, it hardcodes everything:

- Its own **background gradient** `['#0f0a1e','#1a1035','#0f0a1e']` via a raw
  `LinearGradient` — a subtly *wrong* purple that differs from `gradients.bgDarkPurple`.
- Its own **surfaces/borders** (`rgba(255,255,255,0.04)`, `rgba(255,255,255,0.06)`,
  `borderRadius: 14`) instead of `glassEffects.glass` / `radius.*`.
- Its own **accent** `#a855f7` inline in five places instead of `colors.primary2`.
- Its own **text colors** as raw `rgba(255,255,255,0.x)` ramps instead of
  `colors.text` / `colors.textMuted`.
- Inline **font sizes/weights** (20/700, 15/700, 16/800, 13/700, 11…) instead of
  `typography.*`.
- Ad-hoc **paddings** (20, 16, 14, 12, 10…) instead of the `spacing` scale.

Two structural gaps versus the established list archetype:

1. **No error state at all.** A failed fetch just `console.error`s and leaves an empty
   screen (loading spinner clears to a blank ScrollView). Every redesigned list screen must
   degrade to an inline `ErrorState` with Retry.
2. **Loading is a spinner** (`ActivityIndicator` + "Analyzing spending…"), not a layout-
   holding `Skeleton`. The archetype rule is skeleton placeholders; spinner is reserved for
   background refresh only.

Two information-architecture improvements that clearly help (kept recognizably the same
screen):

- **A headline card is missing.** The screen has no answer to its own core question:
  *"how much money slipped through the cracks with no budget this month?"* We add ONE
  `glassFloating` headline that leads with that total in `typography.h2` — matching the
  "one elevated headline card per screen" convention. The list below becomes the *evidence*.
- **The subcategory tree is decorative, not scannable.** The ASCII tree glyphs
  (`├─`/`└─`) and a 6px color dot read as clutter, and long subcategory names have no
  amount alignment. We keep the parent→subcategory grouping (it's genuinely useful) but
  re-render it as a tokenized, aligned sub-row list.

---

## 2. The core idea — "unbudgeted money is money leaking; make the leak legible, then closable"

The screen's whole job is: surface spending that has **no budget**, grouped by category,
and make it one tap to **create a budget** for each group. The redesign keeps that job and
sharpens it into three tiers, matching the list archetype:

1. **Headline** (`glassFloating`) — total unbudgeted this month + how many categories. The
   one number that answers "how bad is the leak?"
2. **The leak list** (`glass` cards) — one card per parent category, biggest first
   (existing sort), each with its subcategory breakdown and a **Create Budget** CTA.
3. **Empty / loading / error** states — the archetype's required full set.

There is no committed-vs-tentative money on this screen (every amount here is a *real*
transaction total, already spent), so the solid-vs-ghosted metaphor does **not** apply —
all amounts render solid. What we DO carry over from the archetype is the **status = icon +
word + color** rule, applied to a small **"No budget" pill** on each group so the screen's
meaning is never color-only.

---

## 3. Wireframes

iPhone 15 Pro (390×844). Fixed header row sits OUTSIDE the ScrollView.

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Unbudgeted Spending                                   ⟳    │  ← fixed header
│                                                                │     BackButton + title
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 1
│  │                                                          │ │  │ Headline
│  │   $842.19                                                │ │  │ glassFloating
│  │   unbudgeted this month                                  │ │  │  (h2 total)
│  │                                                          │ │  │
│  │   ⚠ 4 categories have spending but no budget            │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  BY CATEGORY                                        4 groups   │  ┐ group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 2
│  │ [🏷] Shopping                              $318.44        │ │  │ glass card
│  │      3 transactions          ◉ No budget                 │ │  │
│  │  ────────────────────────────────────────────────        │ │  │
│  │   Electronics                       12 · $210.00         │ │  │ sub-rows
│  │   Home goods                         8 · $108.44         │ │  │
│  │  ┌────────────────────────────────────────────────────┐  │ │  │
│  │  │  ＋  Create budget                                  │  │ │  │ CTA (full width)
│  │  └────────────────────────────────────────────────────┘  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [🏷] Dining                                $241.90        │ │
│  │      6 transactions          ◉ No budget                 │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │  single-sub group:
│  │  │  ＋  Create budget                                  │  │ │  no sub-rows / divider
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              ⋮ (scrolls)                        │
└──────────────────────────────────────────────────────────────┘
```

Notes:
- Screen horizontal padding `spacing.lg` (16). Headline→list gap `spacing.xl` (24); gap
  between list cards `spacing.md` (12).
- The group label `BY CATEGORY` is `typography.caption` uppercase `colors.textMuted`, with
  a right-aligned `{n} groups` count in the same style — mirrors dashboard group labels
  ("THIS WEEK", "RECENT ACTIVITY").
- The **subcategory divider + sub-rows only render when a group has > 1 subcategory**
  (preserves existing `subcategories.length > 1` behavior). Single-sub groups go straight
  headline-row → CTA, so the card stays compact.

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Layout-matched skeleton; NO spinner in the body. Small `⟳` in header may spin only for a
background refresh.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Unbudgeted Spending                                        │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating shell
│  │  ▇▇▇▇▇▇▇         (hero amount skeleton, ~140×28)          │ │
│  │  ▇▇▇▇▇▇▇▇▇▇▇     (subtitle skeleton, ~180×12)             │ │
│  │  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇  (pill line skeleton, ~220×12)            │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▇▇▇▇▇▇▇▇                                                      │  label skeleton
│  ┌──────────────────────────────────────────────────────────┐ │  glass card skeleton
│  │  ◍  ▇▇▇▇▇▇▇▇                        ▇▇▇▇▇                 │ │  (circle + 2 lines + amt)
│  │     ▇▇▇▇▇▇                                                │ │
│  │  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇  (CTA skeleton bar)        │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │  × 3 total cards
│  │  ◍  ▇▇▇▇▇▇▇▇                        ▇▇▇▇▇                 │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton pieces (all `Skeleton` with `borderRadius: radius.sm` unless noted):
- Headline: one `Skeleton` `140×28` (hero), one `180×12`, one `220×12`, stacked `spacing.sm`.
- Each list card (render **3**): a `40×40` `Skeleton` `borderRadius: radius.md` (icon
  chip), two stacked lines (`120×14`, `80×12`), a right-aligned `64×16` (amount), then a
  full-width `Skeleton` `height 40, radius.md` for the CTA.

### 3.3 Empty — "all spending is budgeted" (the good outcome)

This is a *success* empty state, not a void. Keep the friendly framing but render it as one
`glass` card, tokenized (or reuse `EmptyState` with a success icon).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Unbudgeted Spending                                        │
│                                                                │
│              ┌────────────────────────────────────┐            │
│              │              ✓ (48)                 │            │  success circle
│              │                                     │            │
│              │     All spending is budgeted        │            │  bodyBold, text
│              │                                     │            │
│              │  Every category with transactions   │            │  small, textMuted
│              │  this month has a budget assigned.  │            │
│              └────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

- Icon `checkmark-circle` (filled) in `colors.success`, in a `colors.success` @12% circle
  chip (`radius.full`, 72×72).
- Title "All spending is budgeted" `typography.bodyBold` `colors.text`.
- Subtitle keeps existing copy, `typography.small` `colors.textMuted`, centered.
- **No CTA** — the empty state here is the desired end state, so no "add" prompt.

### 3.4 Error — fetch failed

Never blank the screen. Inline `glass` card with Retry (reuse `ErrorState`).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Unbudgeted Spending                                        │
│                                                                │
│              ┌────────────────────────────────────┐            │
│              │           ⨯ (40)                    │            │  error-tint circle
│              │                                     │            │
│              │  Couldn't load unbudgeted spending  │            │  bodyBold, text
│              │                                     │            │
│              │  Check your connection and try      │            │  small, textMuted
│              │  again.                             │            │
│              │        ┌──────────────────┐         │            │
│              │        │     Try Again     │         │            │  text button, primary2
│              │        └──────────────────┘         │            │
│              └────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

- `alert-circle-outline` `colors.error` in an `error` @12% circle.
- Title "Couldn't load unbudgeted spending", body copy, `Retry` calls `loadData()`.
- Pull-to-refresh still works from the error state.

### 3.5 Overflow / edge cases

```
│ [🏷] International Groceries & Spec…       $1,204.30          │  parent name numberOfLines=1
│      42 transactions          ◉ No budget                    │  amount flexShrink:0
│   Very-long-subcategory-name-that…    18 · $640.00           │  sub name numberOfLines=1
```

- Parent name `numberOfLines={1}` + ellipsis; amount `flexShrink: 0` (never truncates).
- Sub-row name `numberOfLines={1}`; its `count · amount` right cluster `flexShrink: 0`.
- A group with many subcategories: the card grows naturally (all sub-rows shown, no inner
  scroll — these lists are short); the outer ScrollView handles length.

---

## 4. Section / component specs

### 4.1 Header (fixed, outside ScrollView)

Matches the archetype header exactly (BackButton + `h3` title + optional action icon).

- Row: `flexDirection: row`, `alignItems: center`, `gap: spacing.md`, padding
  `spacing.lg` horizontal, `spacing.md` top/bottom.
- **BackButton** (shared): `fallback="/(tabs)/budget"`, `iconName="chevron-back"`. 44pt
  target.
- **Title:** "Unbudgeted Spending", `typography.h3` `colors.text`, `numberOfLines={1}`,
  `flex: 1`.
- **Refresh action (optional):** a `refresh` Ionicon button (`colors.textMuted`, 44pt
  target) at the trailing edge that triggers `onRefresh` and spins (`animation.medium`,
  looped) while `refreshing`. This is the ONLY place a spinner is allowed. The old inline
  subtitle ("These categories have spending but no budget") is **removed from the header**
  and absorbed into the headline card (§4.2) — the header stays one clean line, matching
  calendar/dashboard.

### 4.2 TIER 1 — Unbudgeted Headline card (`glassFloating`)

The one elevated card. Leads with the money number.

- Surface: `glassEffects.glassFloating`, `padding: spacing.xl`, `borderRadius: radius.xl`.
  Only this card floats.
- **Hero total:** `$842.19` = sum of every group's `total` (`groups.reduce((s,g)=>s+g.total,0)`),
  `typography.h2` `colors.text`. Format with existing `fmt()` / `formatCurrency`.
- **Hero caption:** "unbudgeted this month" `typography.caption` `colors.textMuted`, directly
  under the number (`spacing.xs` gap).
- **Status line:** `⚠ {n} categories have spending but no budget` — an inline
  `alert-circle` icon in `colors.warning` + text `typography.small` `colors.textMuted`,
  `spacing.md` above. This is the color-independent status (icon + word). Pluralize
  "categor{y|ies}".
- **Zero-guard:** this card only renders when `groups.length > 0` (otherwise the empty
  state §3.3 replaces the whole body).

Component: `budget-unbudgeted-headline.json`.

### 4.3 TIER 2 — Group label

- `BY CATEGORY` `typography.caption` uppercase, `letterSpacing` per caption, `colors.textMuted`,
  left; `{n} groups` right, same style. Row `flexBetween`, `spacing.sm` below before first
  card. Mirrors dashboard's `RECENT ACTIVITY … See all ›` label row.

### 4.4 TIER 2 — Unbudgeted Group card (`glass`)

One per parent category, existing biggest-first sort. Replaces `groupCard`.

- Surface: `glassEffects.glass`, `padding: spacing.lg`, `borderRadius: radius.lg`,
  `marginBottom: spacing.md`.

**Header row** (replaces `parentRow`):
- **Icon chip:** 40×40, `borderRadius: radius.md`, background = `group.color` @12%
  (data-driven category color kept — it's the one documented per-item color exception, like
  AttentionCard's `item.color`). Icon `pricetag` (filled, was `-outline`) in `group.color`.
- **Name + meta (flex:1, minWidth:0):**
  - Name `typography.bodyBold` `colors.text`, `numberOfLines={1}`.
  - Meta row `spacing.xs` below: `{count} transactions` `typography.caption`
    `colors.textMuted` + a **"No budget" pill** (§4.5) to its right.
- **Amount:** `fmt(group.total)` `typography.bodyBold` `colors.text`, `flexShrink: 0`.
  (Not semantic-red: this is a spend *total*, and coloring every group red would be noise;
  the leak framing lives in the headline. Keep amounts neutral `colors.text`.)

**Sub-rows** (only if `subcategories.length > 1`; replaces `subRow`/tree glyphs):
- A `commonStyles.divider` (`colors.borderLight`) `spacing.md` above the first sub-row.
- Each sub-row: `flexBetween`, `paddingVertical: spacing.sm`.
  - Left: sub name `typography.small` `colors.textMuted`, `numberOfLines={1}`, `flex:1`.
    (Drop the tree glyphs and the 6px color dot — the parent chip already carries color;
    the dot added clutter without info.)
  - Right cluster (`flexShrink:0`, `gap: spacing.sm`): `{count} ·` in `typography.caption`
    `colors.textDark` then `{fmt(sub.total)}` in `typography.smallBold` `colors.textMuted`.

**Create Budget CTA** (replaces `createBtn`):
- Full-width row, `marginTop: spacing.md`, `paddingVertical: spacing.md`,
  `borderRadius: radius.md`, `justifyContent: center`, `gap: spacing.sm`.
- Fill `colors.primary2` @12%; border 1px `colors.primary2` @20% (the semantic-tint recipe,
  reusing the existing look but tokenized).
- Icon `add-circle` (filled) + "Create budget" text, both `colors.primary2`,
  `typography.smallBold`.
- Press: `activeOpacity` / scale `animation.fast`.
- Action unchanged: `router.push('/budget/add-budget', { prefill_category_id: group.id,
  prefill_name: group.name })`.
- 44pt min height.

Component: `budget-unbudgeted-group-card.json`.

### 4.5 "No budget" status pill

The archetype's icon + word + color status marker (so meaning is never color-only).

- Small pill, `radius.full`, `paddingHorizontal: spacing.sm`, `paddingVertical: 2`.
- Fill `colors.warning` @12%; content: a tiny `alert-circle` (12px) + "No budget", both
  `colors.warning`, `typography.caption`.
- Purely informational (not tappable) — it labels *why* the group is on this screen.

### 4.6 Empty / Error states

- **Empty:** reuse `EmptyState` (`components/EmptyState.tsx`) with `icon="checkmark-circle"`,
  title/description per §3.3, **no** `actionLabel`. Override its accent to `colors.success`
  if the component allows; otherwise render the tokenized inline card in §3.3.
- **Error:** reuse `ErrorState` (`components/ErrorState.tsx`) with title/message per §3.4,
  `retryLabel="Try Again"`, `onRetry={loadData}`. Requires adding a `try/catch` `error`
  flag to the screen's state (currently absent).

---

## 5. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `unbudgeted.tsx`) | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `#a855f7` (accent, refresh tint, CTA text/icon/border) | `colors.primary2` |
| `#34d399` (empty checkmark) | `colors.success` |
| default parent color fallback `'#a855f7'` | `colors.primary2` |
| `group.color` / `sub.color` (per-category) | **kept** — data-driven, documented exception |
| `rgba(255,255,255,0.04)` group card fill | `glassEffects.glass` (`colors.glassLight`) |
| `rgba(255,255,255,0.06)` card border | `colors.borderGlass` |
| `rgba(255,255,255,0.08)` back btn fill | (handled by shared `BackButton`) |
| headline card (new) | `glassEffects.glassFloating` (only it floats) |
| CTA fill `rgba(168,85,247,0.1)` / border `rgba(168,85,247,0.2)` | `` `${colors.primary2}1f` `` (12%) / `` `${colors.primary2}33` `` (20%) |
| "No budget" pill fill (new) | `` `${colors.warning}1f` `` (12%) |
| icon chip `#{color}22` | `` `${group.color}1f` `` (12%) |
| `borderRadius: 14` (card) | `radius.lg` (16) |
| `borderRadius: 12` (icon chip, back btn) | `radius.md` |
| `borderRadius: 10` (CTA) | `radius.md` |
| `borderRadius: 3` (sub dot — **removed**) | n/a (dot dropped) |
| paddings `20 / 16 / 14 / 12 / 10 / 5` | `spacing.lg(16) / md(12) / sm(8) / xs(4)`; screen h-pad `spacing.lg` |
| `gap: 12 / 6` | `spacing.md` / `spacing.sm` |
| header title `20/700` | `typography.h3` |
| header subtitle `12` (removed → headline) | `typography.small` `colors.textMuted` |
| parent name `15/700` | `typography.bodyBold` |
| parent amount `16/800` | `typography.bodyBold` |
| parent sub `11` | `typography.caption` |
| hero total (new) `—` | `typography.h2` |
| sub name `12` | `typography.small` |
| sub amount `11/600` | `typography.smallBold` |
| CTA text `13/700` | `typography.smallBold` |
| loading text `#94a3b8 14` | removed (replaced by skeleton) |
| empty title `18/700` | `typography.bodyBold` |
| empty subtitle `13` | `typography.small` |
| text `white` / `rgba(255,255,255,0.6/0.5/0.45/0.4/0.15)` | `colors.text` / `colors.textMuted` / `colors.textDark` / `colors.borderLight` |
| `ActivityIndicator` loading | `Skeleton` placeholders (spinner only for header refresh) |
| `RefreshControl tintColor="#a855f7"` | `colors.primary2` |

Hard rule after redesign: no literal hex/rgba/px except the documented 12%/20% semantic
tints and the data-driven per-category `group.color`.

---

## 6. Accessibility

- **Touch targets:** BackButton, header refresh, and each **Create budget** CTA ≥ 44×44pt
  (CTA already meets it via `spacing.md` vertical padding; verify min-height 44). Group
  cards are not tappable as a whole (only the CTA navigates), so no 44pt requirement on the
  card body — but the CTA is the sole affordance and is clearly the primary action per card.
- **Color independence:** the "why this is here" signal is **icon + word + color**
  everywhere — the `⚠` + "categories … no budget" in the headline, and the `◉ alert-circle`
  + "No budget" pill on each group. Removing the pill's color would still leave the word +
  icon. Never rely on the warning-yellow alone.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` / `colors.textDark` over
  dark glass. Verify `colors.textDark` (`#475569`) on the group-card glass clears AA for the
  small `{count} ·` cluster; if it fails at `caption` size, bump that cluster to
  `colors.textMuted`.
- **Screen-reader order & labels:**
  - Header → Headline (one node): `"Unbudgeted this month, $842.19. 4 categories have
    spending but no budget."`
  - Each group card is one node: `"{group.name}, {fmt(total)}, {count} transactions, no
    budget. Button: Create budget."` Sub-rows read after as `"{sub.name}, {sub.count}
    transactions, {fmt(sub.total)}"`.
  - The **Create budget** button has an explicit `accessibilityRole="button"` and
    `accessibilityHint="Creates a budget for {group.name}"`.
  - Decorative tree glyphs are gone, so there's no junk read to the screen reader (the old
    `├─`/`└─` would have been announced).
- **Reduced motion:** the header refresh spin, CTA press-scale, and skeleton pulse use
  `animation.fast`/`medium`; under reduce-motion the spin/scale become instant state
  swaps and the skeleton can hold a static (non-pulsing) fill.
- **Dynamic Type:** hero total and names must reflow (no fixed heights that clip); amounts
  keep `flexShrink: 0` and names `numberOfLines={1}` so growth wraps predictably.

---

## 7. Developer notes

- **This is a re-layout of existing data — no new endpoints.** `loadData()` already
  produces `groups` (parent categories with `subcategories`, sorted by `total` desc). Add:
  1. an `error` boolean to state (`catch` sets it; `loadData` clears it on entry),
  2. a derived `grandTotal = groups.reduce((s,g)=>s+g.total,0)` for the headline.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `Skeleton` (loading),
  `BackButton` (header), `EmptyState` (§3.3), `ErrorState` (§3.4). Do NOT hand-roll the
  gradient or the loading spinner.
- **Preserve behavior:** the parent→sub grouping, biggest-first sort, the
  `subcategories.length > 1` guard for showing sub-rows, pull-to-refresh, and the
  `add-budget` prefill navigation are all unchanged. Only presentation changes.
- **Per-category color is the documented data exception** (same status as AttentionCard's
  `item.color`): keep `group.color` for the icon chip fill/icon and drop the redundant
  `sub.color` dot. Everything else is a token.
- **`AttentionCard` / `Sparkline` / dashboard sub-components** were considered and are
  **not used** here — there's no attention feed, no time-series, and no household-scope
  headline on this screen. Noting so the frontend agent doesn't force-fit them.
- **No partner attribution** on this screen: unbudgeted spending is a household-level
  category concern, not a per-transaction row, so the partner-glyph rule doesn't apply.

---

## 8. Handoff checklist

- [x] Adopts `<GradientBackground variant="bgDarkPurple">` — raw `LinearGradient` removed
- [x] Fixed header = `BackButton` + `h3` title + optional refresh action (archetype header)
- [x] One `glassFloating` headline leading with the money number (`h2`); rest is flat `glass`
- [x] All states designed: default, loading (skeleton), empty (success), error (Retry), overflow
- [x] Status = icon + word + color (headline `⚠` line + per-group "No budget" pill)
- [x] Every hardcoded color/gradient/spacing/font mapped to a design-system token
- [x] Semantic-tint recipe applied (12% / 20%); per-category color kept as documented exception
- [x] Loading uses `Skeleton`, not `ActivityIndicator` (spinner only for header refresh)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Reuses shared `GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, `ErrorState`
- [x] Component specs written (`docs/design/components/budget-unbudgeted-*.json`)
