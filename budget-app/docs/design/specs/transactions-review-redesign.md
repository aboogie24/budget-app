# Transactions Review Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Route / file:** `transactions/review` → `budget-app/app/transactions/review.tsx`
**Archetype:** list (review queue)
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/transactions/review.tsx`

---

## 1. Why this redesign exists

The Review Transactions screen is a **review queue**: it shows the household's
un-verified transactions (imported from the bank or entered manually) so a partner can
confirm the category is right and mark them verified. It works, but — like the old
calendar and dashboard — it is **visually a different app** from the redesigned screens.

Concretely, it fights the design system in three ways:

1. **Its own gradient.** It renders a raw `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>`
   instead of the canonical `<GradientBackground variant="bgDarkPurple">`. That off-purple
   is the single biggest "feels like a different screen" tell.
2. **Its own palette and surfaces.** Hardcoded `#22c55e`, `#4ade80`, `#f87171`, `#a855f7`,
   `#c084fc`, `#94a3b8`, `rgba(255,255,255,0.06)` cards, `rgba(255,255,255,0.08)` borders,
   confidence-badge rgba tints — none of them come from tokens.
3. **Its own spacing / radius / type.** Literal `14`, `16`, `12`, `8` paddings, `borderRadius: 14`,
   and inline `fontSize`/`fontWeight` everywhere, instead of `spacing`/`radius`/`typography`.

It also has **no loading skeleton** (just a centered `ActivityIndicator`), no error state,
and its **information architecture buries the one number that matters**: *how much work is
left in this queue*. The count lives in a tiny header badge; there is no sense of progress,
no "you've cleared 8 of 12," and the primary bulk action (**Confirm All**) is a small
header pill rather than a committed, confident affordance.

This redesign does two things at once, exactly like the calendar and dashboard redesigns:

1. **Adopts the design system** — every color, radius, space, font, gradient, and surface
   comes from `design-system.ts`. No magic numbers (except the documented 12%/8% semantic
   tints).
2. **Sharpens the information architecture** — it makes the *review queue itself* the
   headline (a `glassFloating` hero that leads with the count of items left + the two bulk
   actions), and it applies the app's settled **verify-vs-unverified = solid-vs-ghosted**
   metaphor to the rows so "needs review" reads at a glance and never by color alone.

It stays recognizably the same screen: same grouped-by-date list, same per-row confirm,
same swipe-to-confirm, same tap-category-to-recategorize, same Confirm All + AI Categorize,
same CategoryPicker bottom sheet, same optional per-category filter.

---

## 2. The core visual idea — "Unverified is ghosted, verified is gone"

This screen's whole job is separating *needs-your-review* from *done*. We reuse the
app-wide **solid-vs-ghosted** metaphor (from the calendar's actual-vs-projected and the
bills' committed-vs-tentative rules) so it reads consistently:

| Concept | Visual language | Tokens |
|---|---|---|
| **Unverified** (in the queue, awaiting review) | **Ghosted** row: 1px `borderGlass` fill, an **outline** category icon, a **status chip that pairs icon + word + color** (`Needs review` / the AI-confidence word) | `glassEffects.glass`, `colors.warning` accent for the review chip |
| **Just verified** (row the user confirms inline) | **Solidifies** — the ghost fills to a `colors.success` tint, a filled `checkmark-circle`, then animates out of the queue | `colors.success` at 12% tint |

The row is never distinguished from "done" by a color alone. An unverified row always
carries a **word** ("Needs review", or the confidence word "AI / Medium / Low") next to a
matching icon, so it passes for color-blind users.

Confidence is data we already have (`match_confidence`), and it is genuinely useful in a
review queue — a `Low` / `AI` guess deserves more scrutiny than an `Exact` match. So the
confidence badge stays, but it is re-expressed as an **icon + word + tint** triple on the
semantic palette (see §6.2) rather than a bare colored pill.

---

## 3. The headline — "Review Queue" hero (glass floating card)

Per the list-archetype convention, **one** elevated card per screen leads with the number
that matters, in `typography.h2`. Here the number that matters is **how many transactions
still need review** — the size of the queue — and the card is also the natural home for the
two bulk actions (Confirm All, AI Categorize) that today are cramped into the header.

### Wireframe — Review Queue hero (default, items remaining)

```
┌──────────────────────────────────────────────────────────┐
│  ◑ Needs your review                        3 of 12 done  │  ← eyebrow + progress
│                                                            │
│   9                                                        │  ← h2 hero: count left
│   transactions to review                                  │  ← caption, muted
│                                                            │
│   ▓▓▓░░░░░░░░░░░  25%                                      │  ← thin progress bar
│                                                            │
│   ┌───────────────────────┐  ┌────────────────────────┐   │
│   │  ✓  Confirm all (9)   │  │  ✨  AI categorize      │   │  ← two bulk actions
│   └───────────────────────┘  └────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

- **Eyebrow** (`typography.caption`, `colors.textMuted`): `Needs your review`, or when the
  screen is filtered to a category, `Review · Groceries` (preserve the current
  `params.category_name` title). A leading `◑`/`◐` partner glyph appears only if the queue
  is scoped to one partner (see §7); household-wide review shows a neutral list-check icon.
- **Progress `3 of 12 done`** top-right (`typography.caption`, `colors.textMuted`) — the
  count of already-verified vs total in scope, so the user feels forward motion.
- **Hero number** = **unverified count** in `typography.h2` `colors.text`, with
  `transactions to review` beneath in `typography.caption` `colors.textMuted`. This is the
  "how much is left" answer, given the most weight on the screen.
- **Progress bar** — thin (`spacing.xs` = 4pt tall) `radius.full` bar, fill
  `gradients.primaryGradient` (or `colors.primary`), track `colors.glassLight`, showing
  `verified / total`. Under reduce-motion it renders at final width with no grow-in.
- **Confirm all (N)** — the **primary** bulk action: solid `gradients.primaryGradient`
  button, `radius.md`, `checkmark-circle` icon + `typography.button` label with the live
  count so it reads as committed ("Confirm all (9)"), not an afterthought. While running it
  shows an inline spinner + `Confirming…`.
- **AI categorize** — **secondary**: `glassEffects.glass` fill, `borderGlass`, `sparkles`
  icon in `colors.primary2` + `typography.smallBold` label. While running: inline spinner +
  `Categorizing…`.

Only this card floats (`glassEffects.glassFloating`, `radius.xl`); every list row is flat
`glassEffects.glass`. That is the visual-weight contract that keeps the hero on top.

> Why promote the count and bulk actions: today the queue size is a tiny badge and the two
> actions are two small header pills competing with the title. In a review queue the two
> questions are "how much is left?" and "can I clear it in bulk?" — so both get the hero.

---

## 4. Full-screen wireframe (default / populated)

iPhone 15 Pro (390×844). Fixed header row outside the scroll; hero + grouped list scroll.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Review transactions                                       │  ← fixed header
│                                                                │     BackButton + h3
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  ◑ Needs your review                       3 of 12 done   │ │  │ HERO
│  │   9   transactions to review                              │ │  │ glassFloating
│  │   ▓▓▓░░░░░░░░░░░  25%                                      │ │  │
│  │   [ ✓ Confirm all (9) ]   [ ✨ AI categorize ]            │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  THU, JUL 9                                                    │  ┐ date group label
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🛒] Whole Foods                            -$84.20   ( ✓ )│ │  │ ghosted row
│  │      Groceries ›   ● AI                                    │ │  │ glass, outline icon
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [💵] Paycheck — Acme Corp                 +$2,600.00  ( ✓ )│ │  │
│  │      Income ›   ● Exact                                    │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  WED, JUL 8                                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [🎬] Netflix                                -$15.49   ( ✓ )│ │
│  │      Uncategorized ›   ▲ Low                              │ │  low-confidence
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                  ← swipe a row right to confirm →              │  (gesture, not chrome)
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal; `spacing.xl` gap under the
hero; `spacing.lg` between date groups; group labels (`THU, JUL 9`) are `typography.caption`
uppercase in `colors.textMuted` with `spacing.sm` below; rows separated by `spacing.sm`.

---

## 5. States

### 5.1 Loading — skeleton (reuse `components/Skeleton.tsx`)

No more bare centered spinner. Layout-matched skeleton: a `glassFloating` hero block
(short eyebrow line + a wide `h2`-height hero bar + a thin progress bar + two button
blocks), one date-label skeleton, then 3 skeleton rows (icon square + two stacked text
lines + a right-aligned amount block). A small `ActivityIndicator` is allowed in the header
**only** for background refresh (`useFocusEffect` re-fetch), never as the whole-screen
loader.

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Review transactions                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ▬▬▬▬▬▬                              ▬▬▬▬▬             │ │  Skeleton hero
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                                     │ │  (h2 bar)
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                               │ │  (progress)
│  │ ▬▬▬▬▬▬▬▬▬▬▬▬▬   ▬▬▬▬▬▬▬▬▬▬▬▬▬                        │ │  (2 buttons)
│  └──────────────────────────────────────────────────────┘ │
│  ▬▬▬▬▬▬▬                                                  │  date label
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ▢  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                     ▬▬▬▬▬▬          │ │  3× Skeleton row
│  │    ▬▬▬▬▬▬▬▬                                           │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Skeleton blocks use the existing component's `rgba(255,255,255,0.08)` fill with matching
`width`/`height`/`borderRadius` so the layout doesn't jump when data lands.

### 5.2 Empty — "All caught up" (queue cleared)

The queue is empty because everything is verified — a **success** empty state, not a
"nothing here" one. Reuse the `EmptyState` component recipe (glass card, icon circle, title,
description, action) with review-specific copy. Keep the current friendly tone.

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Review transactions                                  │
│                                                            │
│                    ╭─────────────╮                         │
│                    │      ✓✓      │   ← checkmark-done,     │
│                    ╰─────────────╯      success tint circle│
│                                                            │
│                  All caught up!                            │  title, h3
│         Every transaction has been reviewed                │  body, muted
│                  and verified.                             │
│                                                            │
│               [  Back to dashboard  ]                      │  primaryGradient CTA
└──────────────────────────────────────────────────────────┘
```

- Icon circle: `checkmark-done-outline` in `colors.success` on a `colors.success` @12%
  circle (`radius.full`, 80pt).
- Title `typography.h3` `colors.text`; description `typography.body` `colors.textMuted`.
- CTA `Back to dashboard` on `gradients.primaryGradient`, `radius.md`, ≥44pt tall.
  Preserve the existing navigation target (`router.replace('/(tabs)/goals')`).
- **Filtered empty variant:** when scoped to a category, title becomes
  `Groceries is all reviewed` and the CTA is `Back` (`router.back()`), matching the current
  category-filter navigation.

### 5.3 Error — inline glass card (reuse `ErrorState`)

If the `GET /auth/transactions` fetch throws (today it only `console.error`s and shows an
empty list — a silent failure), render an inline `ErrorState` glass card instead of a blank
screen. Icon `alert-circle-outline` `colors.error`, title `Couldn't load your queue`,
message `We couldn't reach your transactions. Check your connection and try again.`,
`Try again` button that re-runs `load()`. The header stays put so the user can still back
out.

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Review transactions                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              ╭────╮                                   │ │
│  │              │ ⚠  │   Couldn't load your queue        │ │
│  │              ╰────╯                                   │ │
│  │   We couldn't reach your transactions. Check your     │ │
│  │   connection and try again.                           │ │
│  │              [ ⟳ Try again ]                          │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Overflow / edge cases

| Case | Treatment |
|---|---|
| **Long merchant name** | `numberOfLines={1}` + ellipsis on merchant; amount is `flexShrink: 0` and never truncates. |
| **Long category name** | category link `numberOfLines={1}`; the confidence chip stays pinned right of it and never wraps to a second line. |
| **Missing merchant** | fall back to `Unknown merchant` in `colors.textMuted` (keep current copy). |
| **Missing category** | show `Uncategorized ›` in `colors.warning` (not the neutral link color) so it reads as "needs a category," pairing with the confidence chip. |
| **Very long queue (100+)** | `FlatList` virtualization retained; hero count + progress still summarize it; Confirm all confirms the whole in-scope set as today. |
| **A single row mid-confirm** | that row shows the inline spinner in place of its `✓`, dims to ~60% while the PATCH is in flight, then animates out; the rest of the list is unaffected. |
| **AI categorize returns 0** | keep current copy: alert "No uncategorized transactions to classify." The AI button returns to idle. |

---

## 6. Section / component specs

### 6.1 Header (fixed, outside scroll)

- Row: `commonStyles.flexBetween`, `paddingHorizontal: spacing.lg`, `paddingVertical: spacing.md`.
- **Left:** shared `<BackButton size={20}>`; preserve the conditional target
  (`params.category_id ? router.back() : router.replace('/(tabs)/goals')`). ≥44pt target.
- **Title:** `typography.h3` `colors.text` — `Review transactions`, or `Review · {category_name}`
  when filtered. `numberOfLines={1}`.
- **No action icons in the header.** The count badge, Confirm All, and AI Categorize all
  move down into the hero (§3) where they have room and hierarchy. The header is just
  Back + title, matching the calendar/dashboard header pattern.

### 6.2 Confidence chip (icon + word + color)

Replaces the bare colored pill. Always **icon + word + tint** so it's color-independent.
Mapped from `match_confidence`:

| `match_confidence` | Word | Icon (Ionicons) | Color token | Chip bg |
|---|---|---|---|---|
| `exact` | `Exact` | `checkmark-circle` | `colors.success` | `success` @12% |
| `high` | `High` | `checkmark-circle-outline` | `colors.success` | `success` @12% |
| `ai` | `AI` | `sparkles` | `colors.primary2` | `primary2` @12% |
| `medium` | `Medium` | `remove-circle-outline` | `colors.warning` | `warning` @12% |
| `low` | `Low` | `alert-circle-outline` | `colors.error` | `error` @12% |
| _none / unknown_ | `Needs review` | `help-circle-outline` | `colors.textMuted` | `glassLight` |

Chip: `radius.full`, `paddingHorizontal: spacing.sm`, `paddingVertical: spacing.xs`, icon
12px + `typography.caption` label. This is the row's color-independent status signal.

### 6.3 Transaction review row (`transactions-review-ReviewRow`)

Flat `glassEffects.glass` card, `radius.lg`, `padding: spacing.md`, `marginBottom: spacing.sm`.
Wrapped in the existing swipe-to-confirm gesture (§6.4). Layout (left → right):

- **Category icon chip** — 40pt, `radius.md`, tinted with the category/semantic color @12%.
  Use an **outline** glyph (`getCategoryIcon` heuristic, `*-outline` variants) to signal
  "not yet verified / ghosted." Income rows use `cash-outline` in `colors.success` @12%.
- **Center (flex 1):**
  - Merchant — `typography.bodyBold` `colors.text`, `numberOfLines={1}` (fallback
    `Unknown merchant`, muted).
  - Sub-row (`spacing.xs` gap): tappable **category link** `{category_name || 'Uncategorized'} ›`
    in `colors.primary2` (`Uncategorized` → `colors.warning`), `typography.small`; then the
    **confidence chip** (§6.2). Tapping the category opens the CategoryPicker (§6.5).
- **Right (`alignItems: 'flex-end'`, `gap: spacing.xs`):**
  - Amount — `typography.bodyBold`, `getValueColor`-style: income `+` `colors.success`,
    expense `-` `colors.error`; `flexShrink: 0`.
  - **Confirm button** — 44pt tap target, `checkmark-circle-outline` `colors.success` (24px);
    while confirming, inline `ActivityIndicator` `colors.success`.

**States:** `default` (ghosted glass) · `pressed` (subtle scale, `animation.fast`) ·
`confirming` (row ~60% opacity + spinner in the ✓ slot) · `verifying-out` (fills to
`success` @12%, ✓ becomes filled `checkmark-circle`, then the row animates out).

### 6.4 Swipe-to-confirm (preserve gesture, retokenize reveal)

Keep the existing right-swipe-to-confirm `PanResponder` behavior. Retokenize the reveal
background that sits under the row: fill `colors.success` (not raw `#22c55e`), `radius.lg`
to match the row, `checkmark-circle` icon + `Confirm` label in `colors.text` @ `typography.smallBold`.
Threshold/animation unchanged; under reduce-motion the row snaps rather than sliding out.

### 6.5 CategoryPicker bottom sheet (reuse existing, tokenized)

Keep the existing `CategoryPicker` modal and its retroactive-recategorize behavior
(setting a category learns a merchant rule and re-categorizes the user's other unverified
transactions from the same merchant, then `load()` refetches so verified rows drop off the
queue). Present it as the app's standard bottom sheet on `colors.surface2`. Preserve the
"Also auto-categorized N more…" confirmation alert. No structural change — this spec only
requires it read as the shared form-sheet recipe.

### 6.6 Date group label

`typography.caption` uppercase, `colors.textMuted`, `letterSpacing` per token default,
`marginBottom: spacing.sm`, `marginLeft: spacing.xs`. Preserve the current
`Thu, Jul 9`-style formatting and newest-date-first sort.

---

## 7. Couples attribution (additive, graceful-degrade)

Consistent with the calendar and dashboard redesigns: an optional lightweight partner
glyph shows *whose* transaction is in the queue, since either partner may be reviewing.

- A 14px glyph in the row sub-row (after the confidence chip), matched from `tx.user_id`
  against household members: Partner A → `◑` `colors.primary2`; Partner B → `◐` `colors.info`.
- Shared/household or unknown owner → **no glyph** (most items stay neutral).
- The hero eyebrow glyph (§3) mirrors this only when the whole queue is scoped to one
  partner; household-wide review shows a neutral `list`/`checkmark-done` icon.
- If `user_id`/members aren't available yet, omit silently — nothing else changes. That's
  why it's additive, not structural.

---

## 8. Accessibility

- **Touch targets:** BackButton, per-row confirm ✓, category link, and both hero bulk-action
  buttons are all ≥44×44pt (hit-slop where the visual glyph is smaller, e.g. the 24px ✓).
- **Color independence:** review status is always **icon + word + color** — the confidence
  chip carries a word (`Exact`/`AI`/`Medium`/`Low`/`Needs review`) beside a matching icon,
  and `Uncategorized` is spelled out, so a red `Low` chip is never *only* red. Amount sign
  is prefixed `+`/`−`, not color-only.
- **Contrast:** all text is `colors.text` / `colors.textMuted` on dark glass (clears WCAG
  AA). Semantic tints are backgrounds only; the icon/text on a chip stays full-opacity
  semantic color, verified ≥ 4.5:1 on the dark card.
- **Screen-reader order & labels:**
  - Hero reads as one node: `"9 transactions to review, 3 of 12 done."` then the two
    buttons: `"Confirm all 9, button."` / `"AI categorize, button."`
  - Each row: `"{merchant}, {category}, {income|expense} {amount}, {confidence word}.
    Double tap the checkmark to confirm; swipe right to confirm; tap the category to change it."`
  - Confirm success announces `"Confirmed."`; Confirm all announces `"Confirmed 9
    transactions."`
- **Reduced motion:** progress-bar grow-in, swipe-out slide, row press-scale, and
  verify-out transition all use `animation.fast`; under reduce-motion they become instant
  state swaps (row simply disappears; bar renders at final width).
- **Dynamic Type:** merchant/category lines reflow (`numberOfLines` caps but no fixed row
  height that clips); amount uses `flexShrink: 0` so it never collapses.

---

## 9. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| loading `ActivityIndicator #a855f7` full-screen | `Skeleton` layout (spinner only for header background-refresh) |
| `#22c55e`, `#4ade80` (confirm / income) | `colors.success` |
| `#f87171` (expense) | `colors.error` |
| `#eab308` (medium confidence) | `colors.warning` |
| `#ef4444` (low confidence) | `colors.error` |
| `#a855f7` (category icon / accent) | `colors.primary2` |
| `#c084fc` (AI accent) | `colors.primary2` |
| `#a78bfa` (category link) | `colors.primary2` |
| `#7c3aed` (count badge / CTA) | `colors.primary` / `gradients.primaryGradient` |
| `#f8fafc` / `#fff` text | `colors.text` |
| `#94a3b8` (muted / date header) | `colors.textMuted` |
| badge tints `rgba(34,197,94,0.15)` etc. | `` `${semanticToken}1f` `` (12%) |
| card `rgba(255,255,255,0.06)` + border `rgba(255,255,255,0.08)` | `glassEffects.glass` / `commonStyles.card`, border `colors.borderGlass` |
| hero / elevated card | `glassEffects.glassFloating` (only the hero floats) |
| swipe reveal `#22c55e` bg | `colors.success` |
| `borderRadius: 14 / 12 / 10 / 6` | `radius.lg / md / md / sm` (chip `radius.full`) |
| paddings `16 / 14 / 12 / 8 / 4` | `spacing.lg / md / md / sm / xs` |
| inline `fontSize`/`fontWeight` (18/800, 15/700, 15/800, 13, 12, 11) | `typography.h3 / bodyBold / smallBold / small / caption` |
| empty-state icon circle `rgba(34,197,94,0.12)` | `colors.success` @12% |
| empty CTA `rgba(168,85,247,0.15)` + border | `gradients.primaryGradient` button |

> Hard rule (list-archetype convention): no literal hex/rgba/px after redesign except the
> documented 12% (`1f`) / 8% semantic tints.

---

## 10. Developer notes

- **This is a re-layout of existing data**, not new endpoints. The queue derives from the
  same `unverifiedTransactions` filter already in the file
  (`!t.user_verified && t.match_confidence !== 'exact' && category filter`). The hero
  counts: `left = unverifiedTransactions.length`, `total = transactions.length` in scope,
  `done = total − left`, `progress = done / total`.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `Skeleton` (loading),
  `BackButton` (header), `EmptyState` (all-caught-up), `ErrorState` (fetch failure),
  `CategoryPicker` (recategorize sheet). The swipe row's `PanResponder` stays; only its
  colors/radii/type get tokenized.
- **Wire the error state:** today `load()` swallows the fetch error into an empty list. Add
  an `error` flag so a failed fetch renders `ErrorState` (§5.3) with `onRetry={load}` instead
  of showing a false "All caught up."
- **Preserve behaviors verbatim:** per-row `confirmTransaction`, `confirmAll` (Confirm all
  reflects the live in-scope count), `runAICategorize` (+ its "Classified N…" and "No
  uncategorized…" alerts), `handleCategorySelect` retroactive recategorize + refetch,
  `successHaptic()` on confirm, the conditional back target, and the `category_id` /
  `category_name` param filter.
- **Confidence chip** drives off the existing `getConfidenceBadge` values but re-expressed
  as the icon+word+tint table in §6.2 — extend that helper to also return an `icon` and use
  semantic tokens instead of raw hex.
- **Category icon** keeps the existing `getCategoryIcon` heuristic; switch its returned
  glyphs to the `*-outline` variants so unverified rows read as ghosted.
- Partner glyph mapping mirrors calendar/dashboard exactly (A → `primary2`/`◑`,
  B → `info`/`◐`, shared → none) for cross-screen consistency.

---

## 11. Handoff checklist

- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] One `glassFloating` hero leading with the money/queue number (`h2`), rest flat `glass`
- [x] Bulk actions (Confirm all + AI categorize) relocated from header into the hero
- [x] Unverified-vs-verified expressed with the app-wide solid-vs-ghosted metaphor
- [x] Status is always icon + word + color (confidence chip + `Uncategorized` spelled out)
- [x] All states designed: default, loading (Skeleton), empty (all-caught-up), error, overflow
- [x] Swipe-to-confirm, per-row confirm, tap-to-recategorize, retroactive recategorize preserved
- [x] Every old hardcoded color/gradient/spacing/font mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Couples attribution proposed as additive, graceful-degrade glyph
- [x] Component specs written (`docs/design/components/transactions-review-*.json`)
</content>
</invoke>
