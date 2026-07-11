# Payoff Calculator Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/payoff-calculator.tsx`
**Archetype:** form + analytics (inputs at top drive a live-computed result below) — must
match the conventions of the calendar/dashboard redesigns (GradientBackground
`bgDarkPurple`, glass cards, `BackButton` header, tokenized spacing/type, and full
loading-skeleton / empty / error states).

---

## 1. Why this redesign exists

The current screen works functionally but is visually **a different app from the rest of
CoupleFlow**, for the same reason the old calendar and dashboard were:

1. **It fights the design system.** It hardcodes its own gradient
   (`['#0b1021', '#2b0f50', '#1b1039']` — a purple that is subtly *wrong* versus
   `gradients.bgDarkPurple`), its own colors (`#c084fc`, `#34d399`, `#f87171`, `#64748b`,
   `#cbd5e1`, a dozen `rgba(255,255,255,0.0x)` surfaces), its own radii (`14`, `16`, `10`),
   and inline font sizes/weights everywhere. No token is imported except via `BackButton`.
   That is *the* reason it reads as dated and off-brand.

2. **It has no loading, empty-of-selection, or error states beyond a bare spinner.** Load
   is a lone `ActivityIndicator`; a failed `GET /auth/debts` silently leaves an empty array
   (looks identical to "no debts"); there is no skeleton and no retry.

3. **Its information architecture buries the answer.** This is an *analytics* screen — the
   user came to learn **"when am I debt-free and what will it cost?"** Today that answer
   (the three result cards) sits *below* two forms and a chip list, so the user configures
   in the dark and scrolls to find the payoff. The redesign keeps every input but promotes
   the **outcome to a pinned headline**, mirroring the dashboard's "one question at a
   glance" north star.

This redesign is a **re-layout + full tokenization of existing data and math** — the
`computePayoff` engine, the three strategies, the presets, and the per-debt breakdown are
all preserved. It is recognizably the same screen.

---

## 2. The north star & hierarchy

> The payoff calculator answers **ONE** question: **"When are we debt-free, and what does
> it cost?"** Every input exists to move that answer; the answer is always visible.

Because this is a *form + analytics* screen, the redesign splits it into two zones with a
clear hierarchy, top to bottom:

1. **TIER 1 — Payoff Headline** (the centerpiece, `glassFloating`): the live result —
   debt-free date, months, total interest. The only floating card, the only `h1`. It
   updates instantly as inputs change and is the thing the eye lands on.
2. **TIER 2 — Levers** (`glass`): the inputs, grouped as "the things you can change" —
   **Strategy**, **Extra monthly payment**, and **Which debts** (collapsed into a
   selectable list). Editing any lever re-derives Tier 1 live.
3. **TIER 3 — Breakdown** (`glass`): the proof — total-cost summary + the ordered per-debt
   payoff list.

Same visual-weight rules as the dashboard: **only the headline floats and only the headline
uses `h1`.** Levers and breakdown are flat `glass`, `radius.lg`.

### Why promote the result above the inputs

The current order is `select debts → strategy → extra payment → results`. That is a
*wizard* pattern for a screen that is actually a *live simulator*: all inputs already
recompute the result on every keystroke via `useMemo`. Pinning the result on top turns the
levers into a tactile "watch the date move" experience — the single most motivating thing a
debt-payoff tool can do — without changing a line of the math.

---

## 3. Full-screen wireframe — default / populated

Household has 3 active debts; Avalanche; +$250/mo. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹      Payoff Calculator                            (space)   │  ← header: BackButton
│                                                                │    + title, tokenized
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  🏁  DEBT-FREE BY                                         │ │  │ TIER 1
│  │                                                          │ │  │ Payoff Headline
│  │      March 2029                                          │ │  │ glassFloating
│  │      42 months from now                                 │ │  │ (centerpiece, h1)
│  │                                                          │ │  │
│  │  ┌────────────────┬────────────────┬──────────────────┐ │ │  │
│  │  │ ⏱ 42 mo        │ 💸 $4,180      │ Σ $22,180        │ │ │  │ 3 metric cells
│  │  │ Time to pay    │ Interest       │ Total cost       │ │ │  │
│  │  └────────────────┴────────────────┴──────────────────┘ │ │  │
│  │                                                          │ │  │
│  │  ▸ +$250/mo extra saves you  8 mo · $1,940 interest     │ │  │ savings callout
│  └──────────────────────────────────────────────────────────┘ │  ┘  (vs $0 extra)
│                                                                │  ← spacing.xl gap
│  YOUR LEVERS                                                   │  ┐ tier 2 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 2
│  │  Strategy                                                │ │  │ Levers  (glass)
│  │  ┌────────────┐┌────────────┐┌────────────┐              │ │  │
│  │  │ Avalanche ✓││ Snowball   ││ Custom     │              │ │  │ segmented picker
│  │  │ Highest APR││ Lowest bal ││ Your order │              │ │  │
│  │  └────────────┘└────────────┘└────────────┘              │ │  │
│  │  ────────────────────────────────────────────────        │ │  │  divider
│  │  Extra monthly payment                                   │ │  │
│  │              $  250                                       │ │  │ big input, h2
│  │  [ $0 ][ $100 ][ $250✓ ][ $500 ][ $1000 ][ $2000 ]       │ │  │ preset chips
│  │  ────────────────────────────────────────────────        │ │  │  divider
│  │  Debts included                         3 of 3   All ▾   │ │  │
│  │  ☑ Chase Sapphire     $8,420 · 22.9% APR                 │ │  │ selectable rows
│  │  ☑ Auto loan          $12,100 · 6.4% APR                 │ │  │
│  │  ☑ Student loan       $9,300 · 4.5% APR                  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  THE BREAKDOWN                                                 │  ┐ tier 3 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 3
│  │  Total debt                                    $29,820   │ │  │ Breakdown (glass)
│  │  Interest you'll pay                      + $4,180 ⚠      │ │  │  cost summary
│  │  ────────────────────────────────────────────────        │ │  │
│  │  Total cost                                    $34,000   │ │  │
│  └──────────────────────────────────────────────────────────┘ │  │
│                                                                │  │
│  PAYOFF ORDER                                                  │  │ sub-label
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ ①  Chase Sapphire        14 mo · $1,780 interest         │ │  │ ordered rows
│  │ ②  Student loan          31 mo · $980 interest           │ │  │
│  │ ③  Auto loan             42 mo · $1,420 interest         │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: horizontal screen padding `spacing.lg` (16); scroll `paddingTop`
`spacing.xl`, `paddingBottom` `spacing.xxxl`×2 (keyboard clearance for the extra-payment
input). Tier gap under the headline is `spacing.xl`; between lower tiers `spacing.lg`. Group
labels ("YOUR LEVERS", "THE BREAKDOWN", "PAYOFF ORDER") are `typography.caption` uppercase
in `colors.textMuted` with `spacing.sm` below.

---

## 4. TIER 1 — Payoff Headline card (the centerpiece)

The entire redesign in one card. It replaces the old three equal-weight `resultCard`s with
a single pinned answer.

### 4.1 Anatomy

```
┌──────────────────────────────────────────────────────────┐
│  🏁  DEBT-FREE BY                                         │  eyebrow: flag icon + label
│                                                          │
│      March 2029                                          │  h1, colors.text
│      42 months from now                                  │  caption, colors.textMuted
│                                                          │
│  ┌────────────────┬────────────────┬──────────────────┐ │
│  │ ⏱ 42 mo        │ 💸 $4,180      │ Σ $34,000        │ │  3 metric cells
│  │ Time to pay    │ Interest       │ Total cost       │ │  (divider rules between)
│  └────────────────┴────────────────┴──────────────────┘ │
│                                                          │
│  ▸ +$250/mo saves you 8 mo · $1,940 interest            │  savings callout (success)
└──────────────────────────────────────────────────────────┘
```

- **Eyebrow** — `flag` (Ionicons, filled) in `colors.primary2` + `DEBT-FREE BY` in
  `typography.caption` uppercase `colors.textMuted`, letter-spaced. The at-a-glance topic.
- **Hero date** — `result.payoffDate` (`"March 2029"`) in `typography.h1` (32/700)
  `colors.text`. This is the single largest text on the screen and the emotional payload.
- **Sub-line** — `"{totalMonths} months from now"` in `typography.caption` `colors.textMuted`.
- **Three metric cells** — a single row split into thirds by 1px vertical rules
  (`colors.borderGlass`), each: small icon + value (`typography.bodyBold` `colors.text`) +
  label (`typography.caption` `colors.textMuted`):
  - `⏱ 42 mo · Time to pay` (`time-outline`, `colors.primary2`)
  - `💸 $4,180 · Interest` (`trending-up-outline`, `colors.error` — cost you didn't have to
    pay)
  - `Σ $34,000 · Total cost` (`wallet-outline`, `colors.text`) = balance + interest.
- **Savings callout** (only when `extraPayment > 0`): a one-line, `colors.success`-tinted
  strip (`` `${colors.success}14` `` fill, `radius.md`) — `▸ +${extra}/mo saves you
  {monthsSaved} mo · ${interestSaved} interest`, computed by running `computePayoff` a
  second time with `extraPayment = 0` and diffing. This is the motivator that makes the
  presets feel worth tapping. See Developer Notes for the diff math.

### 4.2 Surface & weight

`glassEffects.glassFloating` (the only floating card — shadow + `radius.xl`), padding
`spacing.xl`. A thin top-edge gradient wash in `colors.primary` at ~8% (`` `${colors.primary}14` ``)
gives it the "hero" energy the dashboard headline has, without a hard color.

### 4.3 Live-update behavior

The card recomputes on every lever change (already the case via `useMemo` on
`[focusedDebts, extraPayment, strategy]`). The **hero date** cross-fades with
`animation.medium` on value change so the "watch the date move earlier" moment is felt (see
Accessibility for reduced-motion). Metric values update instantly.

### 4.4 The "never payable" edge

When `totalMonths >= MAX_MONTHS` (600): hero date shows `Over 50 years` (not `N/A`),
sub-line `at this rate`, and the savings callout is replaced by an inline nudge —
`alert-circle-outline` `colors.warning` + `"Minimum payments barely cover interest — try
adding an extra payment."` This turns a dead-end into guidance and keeps status
color-independent (icon + word + color).

---

## 5. TIER 2 — Levers card

One `glass` card, three stacked lever groups separated by `commonStyles.divider`. Order
reflects impact: **Strategy** and **Extra payment** change the answer most, so they lead;
**Debts included** is a scoping control below.

### 5.1 Strategy — segmented picker

Reuses the current 3-way choice, restyled to match the dashboard ScopeToggle family (a
segmented control, not three loose buttons):

```
┌────────────┐┌────────────┐┌────────────┐
│ Avalanche ✓││ Snowball   ││ Custom     │
│ Highest APR││ Lowest bal ││ Your order │
└────────────┘└────────────┘└────────────┘
   active         inactive
```

- Row of 3 equal segments, `gap: spacing.sm`, each `radius.md`, min height 56pt (label +
  desc, still ≥ 44pt).
- **Active:** fill `colors.primary`, label `typography.smallBold` `colors.text`, desc
  `typography.caption` `colors.text` at ~85%. Subtle press scale (`animation.fast`).
- **Inactive:** `glassEffects.glass` fill, label `colors.textMuted`, desc `colors.textDark`.
- Selection is announced (see A11y). Active state must be conveyed by **fill + a ✓ glyph**,
  not color alone.

### 5.2 Extra monthly payment

```
Extra monthly payment
            $  250
[ $0 ][ $100 ][ $250 ✓ ][ $500 ][ $1000 ][ $2000 ]
```

- Group label `typography.smallBold` `colors.text`.
- **Amount input** — centered, `typography.h2` (28/700) `colors.primary2`, a leading `$`
  affix in `colors.textMuted`. `keyboardType="numeric"`, `placeholder "$0"`
  (`colors.textMuted`). Same clamp-to-≥0 logic as today.
- **Preset chips** — wrap row, `gap: spacing.sm`, from `EXTRA_PRESETS`
  (`[0,100,250,500,1000,2000]`). Each chip `radius.full`, padding `spacing.sm`×`spacing.md`,
  min 44pt tap target (hit-slop if visually shorter):
  - **Selected** (`extraPayment === val`): fill `colors.primary`, text `typography.smallBold`
    `colors.text`, ✓ glyph.
  - **Unselected:** `glassEffects.glass`, text `colors.textMuted`.
- Typing a custom amount deselects all preset chips (already implicit — none match).

### 5.3 Debts included — selectable list

Replaces the old top-of-screen chip wrap; moved here because "which debts" is a lever, not
the first thing you see.

```
Debts included                         3 of 3   All ▾
☑ Chase Sapphire     $8,420 · 22.9% APR
☑ Auto loan          $12,100 · 6.4% APR
☐ Student loan       $9,300 · 4.5% APR
```

- Group header row: label `Debts included` (`typography.smallBold`) left; a live count
  `{selected} of {total}` (`typography.caption` `colors.textMuted`) + a **Select/Deselect
  all** text button right (`colors.primary2`, ≥ 44pt target). The button label is
  `All` / `None` following the current `allSelected` logic.
- **Debt rows** — each a full-width tappable row (≥ 44pt), `gap: spacing.md`:
  - Leading control: `checkbox`/`checkbox-outline` (Ionicons) — **selected** `colors.primary2`,
    **unselected** `colors.textDark`. (Swaps the old `checkmark-circle`/`ellipse-outline`.)
  - Name `typography.smallBold` — selected `colors.text`, unselected `colors.textMuted`
    (dimmed to read as "excluded"), `numberOfLines={1}`.
  - Meta `typography.caption` `colors.textMuted`: `{fmt(balance)} · {apr}% APR`.
  - Selected row: `` `${colors.primary}0f` `` tint; unselected: transparent. Border
    `colors.borderGlass`, `radius.md`.
- **Zero-selected inline warning** (kept from current): when `selectedIds.size === 0`, show
  a `colors.warning` line under the list — `alert-circle-outline` + `"Select at least one
  debt to calculate."` — and Tier 1 enters its **empty-selection** state (§7).

---

## 6. TIER 3 — Breakdown

Two parts under one `THE BREAKDOWN` label: a cost summary card, then the ordered payoff
list under a `PAYOFF ORDER` sub-label.

### 6.1 Cost summary (glass card)

```
Total debt                                    $29,820
Interest you'll pay                      + $4,180 ⚠
────────────────────────────────────────────────
Total cost                                    $34,000
```

- Two rows + a divider + a bold total row (mirrors the current `summaryCard`, tokenized):
  - `Total debt` — label `typography.small` `colors.textMuted`; value `typography.smallBold`
    `colors.text` = `totalBalance`.
  - `Interest you'll pay` — value `+{fmt(interest)}` in `colors.error`, with a small
    `alert-circle-outline` so "this is the cost" reads without relying on red alone.
  - Divider = `commonStyles.divider`.
  - `Total cost` — both label and value `typography.bodyBold` `colors.text`
    (= `totalBalance + interest`).

### 6.2 Payoff order (ordered list)

```
①  Chase Sapphire        14 mo · $1,780 interest
②  Student loan          31 mo · $980 interest
③  Auto loan             42 mo · $1,420 interest
```

- Each row (from `result.perDebt`, already in payoff order): a rank chip + name + meta.
  - **Rank chip** — 28px `radius.md` square, `` `${colors.primary}2e` `` fill, number in
    `typography.smallBold` `colors.primary2`.
  - Name `typography.smallBold` `colors.text`, `numberOfLines={1}`.
  - Meta `typography.caption` `colors.textMuted`: `{months} mo · {fmt(interest)} interest`.
  - Row surface `glassEffects.glass`, `radius.md`, `gap: spacing.md`, ≥ 44pt.
- The first row (rank ①) gets a faint `colors.success` left accent (`spacing.xs` rail) to
  signal "this one dies first" — a small win-signal, color paired with the ① rank so it's
  not color-only.

---

## 7. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed (§3). |
| **Loading** | **Skeleton, not a spinner.** Reuse `components/Skeleton.tsx`. Layout-matched: a tall `glassFloating` skeleton for the headline (eyebrow line + a wide hero bar + a 3-cell skeleton row + one callout line), then a `glass` skeleton for Levers (3 segment blocks + one input block + 3 preset chips + 3 list rows), then 2 skeleton summary rows + 3 skeleton payoff rows. No lone `ActivityIndicator` as the whole screen. A small header `ActivityIndicator` is allowed only for background refresh. |
| **Empty — no debts at all** (`debts.length === 0`) | The success/celebration state, kept and elevated: a centered `glass` card with `checkmark-circle` (`colors.success`), `"You're debt-free!"` (`typography.h3` `colors.text`), subcopy `"No outstanding debts to pay off. Add a debt to run a payoff scenario."` (`typography.small` `colors.textMuted`), and a secondary text CTA `"Add a debt"` → debts/goals screen. This is a *good* empty state — lean into it, don't make it look like an error. |
| **Empty — no debts selected** (`selectedIds.size === 0`) | Tier 1 headline stays visible but shows a neutral prompt instead of a date: `funnel-outline` (`colors.textMuted`) + `"Pick at least one debt below to see your payoff."` Metric cells and callout are hidden. Tier 3 breakdown collapses to the same prompt. The inline warning under the debt list (§5.3) also shows. Nothing errors — it's a valid "choose your inputs" moment. |
| **Error** (`GET /auth/debts` throws) | Inline glass card in place of the levers/breakdown: `alert-circle-outline` (`colors.error`), `"Couldn't load your debts."`, a `Retry` text button that re-runs `loadDebts`. Do **not** blank the whole screen and do **not** fall through to the debt-free empty state (the current bug — a caught error leaves `debts=[]` which looks identical to "no debts"). Track an explicit `error` flag so the two are distinguishable. |
| **Never-payable** (`totalMonths >= MAX_MONTHS`) | Headline shows `Over 50 years` + the "add an extra payment" nudge (§4.4). Metric cells still render (`50+ yr`, interest, cost). Breakdown still lists debts. |
| **Overflow — long debt names** | `numberOfLines={1}` + ellipsis on every debt/payoff name; the meta (`$ · % APR`, `mo · interest`) never truncates (`flexShrink: 0`). |
| **Overflow — many debts (10+)** | The debt list and payoff list simply grow the scroll; no inner scroll. Metric cells and headline stay pinned by scroll position at top. |
| **Keyboard open (extra-payment input focused)** | `paddingBottom` reserve (`spacing.xxxl`×2) keeps the input above the keyboard; the ScrollView auto-scrolls the focused input into view. Preset chips remain tappable to dismiss/replace the typed value. |

---

## 8. Accessibility

- **Touch targets:** strategy segments, preset chips, debt rows, select-all button, payoff
  rows, and Retry all ≥ 44×44pt (hit-slop where a chip is visually shorter).
- **Color independence:** every stateful signal pairs color with a shape/word:
  - Selected strategy/preset/debt → **fill + ✓ / filled checkbox glyph**, not color alone.
  - Interest-is-a-cost → `+` prefix + `alert-circle-outline` next to the red value.
  - Never-payable → `alert-circle-outline` + the word "years"/"barely cover interest", not
    just a color.
  - First-to-die accent (①) pairs `colors.success` with the numeric rank.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears WCAG
  AA. Dimmed *unselected* debt names use `colors.textMuted` at full opacity (not `colors.text`
  at reduced opacity) so they still clear 4.5:1. Status/accent tints are backgrounds only;
  the text/icon on them stays full-opacity semantic color.
- **Screen-reader order & labels:**
  - Headline reads as one node: `"Debt-free by March 2029, 42 months from now. Time to pay
    42 months. Interest $4,180. Total cost $34,000. Adding $250 a month saves 8 months and
    $1,940 in interest."`
  - Strategy: `role="radiogroup"`; each segment a radio with `selected` state; changing it
    announces `"Avalanche selected, highest APR first."`
  - Preset chips: `role="button"`, label `"Extra payment $250{, selected}"`.
  - Debt rows: `role="checkbox"`, `checked` state, label `"{name}, {balance}, {apr} percent
    APR{, included}."`; hint `"Double tap to include or exclude from payoff."`
  - Payoff rows: `"Number {n}, {name}, paid off in {months} months, {interest} interest."`
- **Reduced motion:** the hero-date cross-fade, segment/chip press-scales, and any
  savings-callout entrance use `animation.medium`/`animation.fast`; under reduce-motion they
  become instant value swaps (no fade, no scale).
- **Dynamic Type:** hero date and the extra-payment input reflow (no fixed heights that
  clip); the 3 metric cells wrap to a 2-line stack per cell before truncating a number.

---

## 9. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `payoff-calculator.tsx`) | Replace with token |
|---|---|
| gradient `['#0b1021', '#2b0f50', '#1b1039']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| header title `#f8fafc` / `fontSize:20/800` | `colors.text` / `typography.bodyBold` |
| accent `#c084fc` (result icons, input, rank text, select-all) | `colors.primary2` |
| `#34d399` (empty-state / debt-free / first-to-die) | `colors.success` |
| `#f87171` (interest / total-cost negative) | `colors.error` |
| `#64748b` (unselected icon, chip balance) | `colors.textDark` |
| `#94a3b8` / `#cbd5e1` / `#e5e7eb` (labels, meta, muted) | `colors.textMuted` (and `colors.text` for high-emphasis) |
| `#fff` on active buttons | `colors.text` |
| card fills `rgba(255,255,255,0.04 / 0.06)` | `glassEffects.glass` / `commonStyles.card` |
| the result headline card | `glassEffects.glassFloating` (only it floats) |
| active fills `rgba(168,85,247,0.1 / 0.18)` | `` `${colors.primary}0f` `` / `${colors.primary}2e`; active segment/chip = `colors.primary` fill |
| active borders `rgba(168,85,247,0.35 / 0.5)` | `colors.primary2` (or drop — active state carries via fill) |
| select-all pill `rgba(168,85,247,0.12)` | `` `${colors.primary}1f` `` |
| borders `rgba(255,255,255,0.06 / 0.08)` | `colors.borderGlass` / `colors.borderLight` |
| summary top border `rgba(255,255,255,0.06)` | `commonStyles.divider` |
| radii `14 / 16 / 10 / 12` | `radius.md (12) / lg (16) / xl (20 → headline)`, `radius.full` (chips) |
| paddings `16 / 14 / 12 / 10 / 8` | `spacing.lg / md / sm / xs` (headline padding `spacing.xl`) |
| gaps `12 / 10 / 8 / 4` | `spacing.md / sm / xs` |
| header/section font sizes (`20 / 28 / 15 / 14 / 13 / 12 / 11 / 10`) | `typography.h1 (hero) / h2 (input) / h3 / bodyBold / smallBold / small / caption` |
| `ActivityIndicator color="#c084fc"` full-screen | `components/Skeleton.tsx` layout-matched skeletons |
| empty icon `#34d399`, `#e5e7eb`, `#94a3b8` | `colors.success` / `colors.text` / `colors.textMuted` |

---

## 10. Developer notes

- **The math is untouched.** `computePayoff`, `EXTRA_PRESETS`, `MAX_MONTHS`, the strategy
  sort, and the `useMemo` recompute chain (`[focusedDebts, extraPayment, strategy]`) all
  stay. This is a re-layout + tokenization, not a logic change.
- **Savings callout diff (§4.1):** compute a second result with the same debts/strategy but
  `extraPayment = 0`:
  ```
  const base = computePayoff(focusedDebts, 0, strategy);
  const monthsSaved   = base.totalMonths   - result.totalMonths;   // ≥ 0
  const interestSaved = base.totalInterest - result.totalInterest; // ≥ 0
  ```
  Render only when `extraPayment > 0 && monthsSaved > 0`. Memoize `base` on
  `[focusedDebts, strategy]` so typing in the amount doesn't recompute it.
- **Distinguish error from empty:** add an explicit `error: boolean` state set in the
  `catch` of `loadDebts` and cleared on success/retry. Today the `catch` only logs and
  leaves `debts=[]`, which is indistinguishable from the legitimate debt-free state — that's
  the bug the Error state (§7) fixes.
- **Reuse, don't reimplement:** `GradientBackground` (`variant="bgDarkPurple"`) for the bg,
  `BackButton` (`fallback="/(tabs)/goals"` — keep) for the header, `Skeleton` for loading.
  `Sparkline` and `AttentionCard` are **not** needed here (no time-series, no action feed);
  do not force-fit them.
- **Header** matches the calendar/dashboard convention: `BackButton` left, centered title in
  `typography.bodyBold` `colors.text`, a `width: spacing.xxxl` spacer right to keep the
  title centered.
- **Keyboard:** wrap the scroll content so the numeric input scrolls into view; keep the
  generous `paddingBottom` so presets stay reachable above the keyboard.
- **`fmt` / currency:** the screen's local `fmt` (Intl currency, 2 decimals) can stay, or
  swap to `formatCurrency` from the design system — either is fine; prefer the design-system
  helper for consistency.
- The eyebrow "DEBT-FREE BY", the "months from now" sub-line, the savings-callout copy, and
  the never-payable nudge copy are intentional and should ship as written.

---

## 11. Handoff checklist

- [x] Archetype-consistent header (`BackButton` + centered title), `GradientBackground variant="bgDarkPurple"`
- [x] 3-tier hierarchy defined; result promoted to a pinned `glassFloating` headline (only it floats + uses `h1`)
- [x] Every input (strategy / extra payment / debt selection) preserved as tokenized "levers", live-recompute intact
- [x] Motivating savings callout (vs $0 extra) specified with diff math
- [x] Breakdown (cost summary + ordered payoff list) tokenized
- [x] All states designed: default, loading (skeleton), empty-no-debts (celebratory), empty-no-selection, error (distinct from empty), never-payable, overflow, keyboard
- [x] Error-vs-empty ambiguity called out and fixed (explicit `error` flag)
- [x] Every old hardcoded color/gradient/radius/spacing/font mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent state (fill/glyph + word + color), SR order/labels, reduced motion, Dynamic Type
- [x] Component specs written (`docs/design/components/payoff-calculator-*.json`)
```
