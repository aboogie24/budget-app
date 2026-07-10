# Dashboard (Home) Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the 1,685-line monolith at `budget-app/app/(tabs)/dashboard.tsx`

---

## 1. Why this redesign exists

The current dashboard has two problems, and the redesign fixes both at once.

**Problem 1 — it fights the design system.** Like the old calendar, the dashboard
hardcodes its own colors (`#10b981`, `#ef4444`, `rgba(16,185,129,0.15)` …), its own
gradient (`#0f0a1e` — a subtly *wrong* purple that differs from `gradients.bgDarkPurple`),
and its own spacing/radius everywhere. It reads as a different app. This redesign is
**fully tokenized** — every color, space, radius, font, and surface comes from
`design-system.ts`, exactly as the calendar redesign now is.

**Problem 2 — it has no answer to the one question that matters.** The screen today is a
flat pile of roughly equal cards: an AI nudge card, a framework-level card, a weekly
spend card, a weekly Sun/Mon recap, a net-worth card, an achievements badge row, mini
budget/savings/bills tiles, recent transactions. Nothing is clearly the top. The user
scans eight things to answer "are we OK?" — and there is **no loading skeleton, no empty
state, and no error state**.

### The north star (decided with the product owner)

> The dashboard answers **ONE** question at a glance: **"How are we doing right now?"** —
> household by default. Everything else on the screen exists only to support or prove that
> answer.

So the redesign imposes a strict **5-tier hierarchy**, top to bottom, where each tier is
visually subordinate to the one above it:

1. **Status Headline** (the centerpiece) — a synthesized plain-language verdict + one hero
   number. Earns the most visual weight (`glassFloating`).
2. **Attention** — action items, only when non-empty.
3. **This-week proof** — the weekly bar chart + a condensed Budget/Savings/Bills mini-row,
   grouped as *the evidence behind the headline*.
4. **Trajectory strip** — net worth + framework progress condensed into ONE compact row
   (the "over time" view, demoted from two full cards).
5. **Recent activity** — the last few transactions, lowest.

### What was cut (do not design; noted here so the frontend agent removes them)

- **Achievements badge row** → relocated to a dedicated progress screen.
- **Sun/Mon weekly recap card** → deleted (its signal is absorbed into the headline).
- **Standalone single-nudge AI insight card** → deleted; its job is merged into the
  Status Headline (the warm sentence) and the Attention tier (the action).

---

## 2. Visual hierarchy — how the headline is made unmistakably the top

The hierarchy is not implied by order alone; it is enforced by **five compounding signals**
so the eye lands on the headline first, every time:

| Signal | Headline (tier 1) | Everything below |
|---|---|---|
| **Surface** | `glassEffects.glassFloating` (only card that floats — shadow + `radius.xl`) | `glassEffects.glass` (flat, `radius.lg`) |
| **Type scale** | hero number in `typography.h1` (32) | values in `h3`/`bodyBold` or smaller |
| **Vertical space** | `spacing.xl` (24) gap below it before tier 2 | `spacing.lg` (16) between all lower tiers |
| **Color energy** | a full-width status accent (success/warning/error tint + gradient wash) | neutral glass, semantic color used only on values |
| **Width / density** | one thing, full-width, generous padding (`spacing.xl`) | multi-column, denser, `spacing.lg` padding |

Rule of thumb for the frontend agent: **only the headline floats and only the headline
uses `h1`.** If a second card ever competes for "biggest thing on screen," the hierarchy
has broken.

---

## 3. Full-screen wireframe (top to bottom)

Default state, Household scope, status = 🟢 Good. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  ☰   Good morning, Alex          (◑)(◐)   [ Household | Me ]   │  ← slim header row
│                                                                │     avatars + toggle
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ● GOOD                                     this month ▾  │ │  ┐
│  │                                                          │ │  │ TIER 1
│  │  You're $240 under budget and every bill's covered —     │ │  │ Status Headline
│  │  nice week.                                              │ │  │ glassFloating
│  │                                                          │ │  │ (the centerpiece)
│  │      +$1,860        ← hero number (this month cash flow) │ │  │
│  │      Cash flow · $6,420 in − $4,560 out                  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  ⚠ NEEDS YOUR ATTENTION                                   │ │  │ TIER 2
│  │  [🧾] Rent is due in 2 days           $2,100    [ Pay ]   │ │  │ Attention
│  │  [🔌] Chase disconnected              reconnect [ Fix ]   │ │  │ (only if non-empty)
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  THIS WEEK                                                     │  ┐ tier 3 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 3
│  │  Spent this week   $412 / $650          ▼ 12% under       │ │  │ This-week proof
│  │   ▂ ▅ ▃ ▇ ▄ ▁ ▁                                          │ │  │ (chart + mini-row)
│  │   M  T  W  T  F  S  S                                     │ │  │ glass
│  │  ────────────────────────────────────────────────        │ │  │
│  │  Budget          Savings         Bills                    │ │  │
│  │  63% used        $8.2k / $15k    4 / 6 paid               │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 4
│  │  Net worth  $84,320  ▲2.1% ⌐‾‾⌐   ·  L3 Stability  ▓▓▓░ 72%│ │  │ Trajectory strip
│  └──────────────────────────────────────────────────────────┘ │  ┘ (ONE compact row)
│                                                                │  ← spacing.lg
│  RECENT ACTIVITY                                    See all ›  │  ┐ tier 5 group label
│  [🛒] Whole Foods        Groceries · ◑ Alex        -$84.20     │  │ TIER 5
│  [💵] Paycheck           Income · ◐ Sam           +$2,600.00   │  │ Recent activity
│  [☕] Blue Bottle        Coffee · ◑ Alex           -$5.75      │  ┘
│                                                                │
│                                                    ( + FAB )   │  ← existing FAB kept
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal; the header row sits inside the
safe area; tier gaps are `spacing.xl` under the headline and `spacing.lg` elsewhere; group
labels ("THIS WEEK", "RECENT ACTIVITY") are `typography.caption` uppercase in
`colors.textMuted` with `spacing.sm` below.

---

## 4. TIER 1 — Status Headline Card (the centerpiece)

This is the whole redesign in one card. It replaces the old arbitrary mood-emoji with a
**synthesized, worst-signal-wins verdict** across three inputs, plus **one hero number**.

### 4.1 The status model (worst-signal-wins)

Three independent checks feed one overall status. The **worst** of the three wins.

| Check | 🟢 Good | 🟡 Watch | 🔴 Alert |
|---|---|---|---|
| **Bills** | all covered / on track | one due soon, not yet late | a bill is overdue / unpayable |
| **Spending** | within weekly budget | slightly over (≤ ~20%) | well over budget |
| **Cash flow** | positive this month | flat / near zero | negative this month |

Overall = `min(good, watch, alert)` by severity. One red check ⇒ the whole card is Alert.

### 4.2 The three status states — color, icon, tone

All three use **semantic tokens**, and status is conveyed by **icon + word + color
together** (never color alone — accessibility):

| State | Token | Icon (Ionicons) | Chip word | Sentence tone |
|---|---|---|---|---|
| 🟢 **Good** | `colors.success` | `checkmark-circle` | `GOOD` | warm, affirming — "nice week" |
| 🟡 **Watch** | `colors.warning` | `alert-circle` (outline) | `WATCH` | gentle heads-up — "keep an eye on…" |
| 🔴 **Alert** | `colors.error` | `warning` | `ALERT` | calm, direct, actionable — never alarmist |

The card gets a **status accent**: a thin (`spacing.xs` = 4pt) left rail OR a top-edge
gradient wash in the status color at low opacity (`{statusColor}14` ≈ 8%), so the card's
whole mood shifts with status without shouting. The status chip (pill, `radius.full`) sits
top-left with the icon + word.

### 4.3 The hero number

Beneath the sentence: **this month's cash flow** = money in − money out.

- Rendered in `typography.h1` (32/700) — the single largest text on the screen.
- Color by sign via `getValueColor()`: positive → `colors.success`, negative →
  `colors.error`. (Note: sign color is independent of status color — a Good week is
  usually positive cash flow, but a huge one-off deposit could show green cash flow while
  status is Watch for overspending. Keep them decoupled.)
- Sub-caption in `typography.caption` `colors.textMuted`:
  `Cash flow · $6,420 in − $4,560 out` — so the number is legible without tapping.

### 4.4 The sentence

One AI-authored sentence in `typography.body` `colors.text`. The design contract:
- **One sentence, ≤ ~90 chars**, warm and plain-language.
- Never a number the hero already shows verbatim; it *contextualizes* ("$240 under
  budget", "every bill's covered").
- Frontend gets it as a ready string from the status endpoint. If the string is missing,
  fall back to a deterministic template per state (see Developer Notes) — **never** show
  an empty headline.

### 4.5 Wireframes — all three states

**🟢 GOOD**
```
┌──────────────────────────────────────────────────────────┐
│ ▏● GOOD                                     this month ▾  │  chip: success
│ ▏                                                         │  left rail: success 4pt
│ ▏ You're $240 under budget and every bill's covered —    │  body text
│ ▏ nice week.                                             │
│ ▏                                                        │
│ ▏    +$1,860                                             │  h1, success (positive)
│ ▏    Cash flow · $6,420 in − $4,560 out                  │  caption, muted
└──────────────────────────────────────────────────────────┘
```

**🟡 WATCH**
```
┌──────────────────────────────────────────────────────────┐
│ ▏◐ WATCH                                    this month ▾  │  chip: warning
│ ▏                                                         │  left rail: warning 4pt
│ ▏ Spending's running a bit hot this week — you're $90     │
│ ▏ over. Bills are still covered.                         │
│ ▏                                                        │
│ ▏    +$430                                               │  h1, success (still +)
│ ▏    Cash flow · $5,100 in − $4,670 out                  │
└──────────────────────────────────────────────────────────┘
```

**🔴 ALERT**
```
┌──────────────────────────────────────────────────────────┐
│ ▏⚠ ALERT                                    this month ▾  │  chip: error
│ ▏                                                         │  left rail: error 4pt
│ ▏ Heads up — rent is overdue and you're spending more     │
│ ▏ than you're bringing in this month.                    │
│ ▏                                                        │
│ ▏    −$320                                               │  h1, error (negative)
│ ▏    Cash flow · $4,100 in − $4,420 out                  │
└──────────────────────────────────────────────────────────┘
```

The `this month ▾` control top-right is a lightweight period label (fixed to "this month"
for v1 — the hero is defined as *this month's* cash flow — but rendered as an affordance so
a future "this week / this month" switch can slot in without a redesign). Ship it
non-interactive/disabled-styled for v1 if the switch isn't built; note in dev notes.

---

## 5. TIER 2 — Attention

Reuses the existing `AttentionCard` (`budget-app/components/AttentionCard.tsx`), which
already renders the prioritized list from `GET /auth/dashboard/attention` and returns
`null` when empty. Two changes for the redesign:

1. **Tokenize it.** Today it hardcodes `#f59e0b`, `#f8fafc`, `rgba(...)`, and raw
   16/14/10 spacing. Map to tokens (see §9). Per-item `item.color` stays (it's data-driven
   from the API), but the card shell, header, dividers, and text adopt tokens.
2. **Position:** directly under the headline with a `spacing.xl` gap above (it's the
   headline's "what to do about it"), then `spacing.lg` below. When empty, it renders
   nothing and tier 3 moves up — no placeholder.

The Attention header keeps the warning motif but uses `colors.warning`. It is deliberately
NOT a floating card — it must read as subordinate to the headline (`glass`, not
`glassFloating`).

---

## 6. TIER 3 — This-week proof (grouped evidence)

The insight: the weekly bar chart and the Budget/Savings/Bills mini-row are **not three
separate cards** — they are one grouped "here's the proof behind the verdict" block, under
a single `THIS WEEK` label. Grouping is by Gestalt proximity: one `glass` card, an internal
divider (`commonStyles.divider`) between the chart and the mini-row.

### 6.1 Weekly spend chart (top half of the card)

```
Spent this week   $412 / $650          ▼ 12% under
 ▂ ▅ ▃ ▇ ▄ ▁ ▁
 M  T  W  T  F  S  S
```

- Title `Spent this week` in `typography.smallBold` `colors.text`; the `$412 / $650`
  (spent / weekly budget) in `typography.small`, spent in `colors.text`, `/ $650` in
  `colors.textMuted`.
- **Delta badge** top-right (`radius.full` pill): under budget → `▼ 12% under` in
  `colors.success` on `{success}1f`; over → `▲ 12% over` in `colors.error` on `{error}1f`.
  Encoded by **arrow + word + color**, not color alone.
- **7 bars**, one per weekday (Mon-first), height ∝ that day's spend. Bar fill
  `colors.primary` at full for real spend; the **day that crosses the daily-limit** tints
  `colors.warning`. Today's bar gets a `colors.primary2` cap so "where we are in the week"
  is visible. Baseline gridline in `colors.borderGlass`.
- Weekday letters in `typography.caption` `colors.textMuted`.

### 6.2 Budget / Savings / Bills mini-row (bottom half)

Three equal columns, divider above them:

| Column | Primary value | Sub | Token |
|---|---|---|---|
| **Budget** | `63% used` | thin progress bar | bar `colors.primary`; ≥100% → `colors.error` |
| **Savings** | `$8.2k / $15k` | `savings_progress`% bar | bar `colors.success` |
| **Bills** | `4 / 6 paid` | `paid/total` | text `colors.text`, "paid" muted |

Each column: label in `typography.caption` `colors.textMuted` (top), value in
`typography.smallBold` `colors.text`, optional 3pt progress bar (`radius.full`). The whole
row is tappable per-column to deep-link (Budget → budget tab, Savings → goals, Bills →
calendar/bills). Tap target ≥ 44pt tall.

---

## 7. TIER 4 — Trajectory strip (the "over time" view, condensed)

The old dashboard spent **two full cards** on net worth and framework level. The north star
demotes both: over-time context matters, but not more than right-now. Compress both into
**ONE horizontal `glass` row**, `spacing.md` vertical padding, split by a center dot
divider.

```
┌──────────────────────────────────────────────────────────┐
│  Net worth  $84,320  ▲2.1% ⌐‾‾⌐   ·   L3 Stability ▓▓▓░ 72%│
└──────────────────────────────────────────────────────────┘
```

**Left half — Net worth:**
- Label `Net worth` `typography.caption` `colors.textMuted`.
- Value `$84,320` `typography.bodyBold` `colors.text`.
- Delta `▲2.1%` colored by sign (`getValueColor`), `typography.caption`.
- A tiny **sparkline** (reuse `components/Sparkline.tsx`) from `netWorthHistory`, ~48×20pt,
  stroke `colors.primary2`. Degrades to nothing if history has < 2 points.

**Center divider:** a `·` / 1px vertical rule in `colors.borderGlass`, `spacing.md` each
side.

**Right half — Framework level:**
- `L3 Stability` — `L{current_level}` + `level_name`, `typography.smallBold` `colors.text`.
- A compact segmented progress bar (`progress_percent`), fill `colors.primary`, track
  `colors.glassLight`, `radius.full`, plus `72%` in `typography.caption` `colors.textMuted`.

Tapping the strip → progress/net-worth screen. On very narrow widths the right label
(`Stability`) truncates before the numbers; numbers never truncate (`flexShrink: 0`).

---

## 8. TIER 5 — Recent activity

The last **3** transactions (`See all ›` → transactions screen). Each row reuses the
actual-vs-projected metaphor from the calendar redesign — but recents are all *actual*
(real transactions), so they're always solid; no projected/dashed rows here.

```
[🛒] Whole Foods        Groceries · ◑ Alex        -$84.20
```

- Icon chip `radius.md`, tinted with category/semantic color at ~12%.
- Name `typography.smallBold` `colors.text`, `numberOfLines={1}`.
- Subtitle `typography.caption` `colors.textMuted`: `{category} · {partner glyph}{name}`.
- Amount `typography.smallBold`, `getValueColor()` (income `+`/`colors.success`, expense
  `-`/`colors.error`), `flexShrink: 0` (never truncates).

### Couples attribution (partner glyph) — same rule as calendar

Lightweight, additive, graceful-degrade. A 14px glyph in the subtitle showing whose
transaction it is (matched to `tx.user_id` against `householdMembers`):
- Partner A → `◑` tinted `colors.primary2`; Partner B → `◐` tinted `colors.info`.
- Household/shared or unknown owner → no glyph.
- If `user_id`/members unavailable, omit silently — nothing else changes.

In **Me** scope the glyph is redundant (everything is you) → suppress it.

---

## 9. Header — greeting, partner avatars, and the Household | Me toggle

```
☰   Good morning, Alex          (◑)(◐)   [ Household | Me ]
```

- **☰ / drawer** — keep the existing `DrawerNavigation` trigger, tokenized (icon
  `colors.text`, 44pt target).
- **Greeting** — `Good morning/afternoon/evening, {firstName}` in `typography.bodyBold`
  `colors.text`. Time-of-day driven. Deliberately *slim* — it must not compete with the
  headline, so it's `bodyBold`, not `h1`.
- **Partner avatars** — overlapping circle stack (up to 2) from `householdMembers`, 28px,
  `radius.full`, 1.5px `colors.bg` ring so they read as stacked. Initials on
  `colors.primary` / `colors.info` fills. Hidden for solo users.
- **ScopeToggle** — the segmented control (§9.1). Hidden entirely for solo users
  (`householdMembers.length < 2`).

### 9.1 ScopeToggle (Household | Me)

A compact segmented control that **re-scopes the entire screen** — every tier below
recomputes for the selected scope.

```
┌───────────────┬──────────┐         ┌───────────┬──────────────┐
│  Household ✓  │    Me    │   or    │ Household  │    Me ✓      │
└───────────────┴──────────┘         └───────────┴──────────────┘
   active         inactive
```

- Container: `glassEffects.glass`, `radius.full`, 2px inner padding, height 32pt.
- **Active segment:** fill `colors.primary`, text `colors.text` (`typography.smallBold`),
  subtle press scale.
- **Inactive segment:** transparent, text `colors.textMuted`, ≥ 44pt-wide tap target
  (visually 32 tall but hit-slop padded).
- **Default = Household.** Selection persists per-session; changing it triggers the same
  refresh path as pull-to-refresh but scoped. Animate the active pill sliding between
  segments with `animation.fast` (instant under reduce-motion).
- **Solo users:** component returns `null` (there is no "household"). The screen renders
  Me-scope data with no toggle and no avatars.

Scope semantics: **Household** = the joint summary (`/auth/households/summary`,
`net_cash_flow`, joint bills/savings). **Me** = the current user's own transactions,
budgets, and bills only. The Status Headline, hero number, and every proof re-derive from
the active scope.

---

## 10. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed. |
| **Loading** | **Skeletons, not a spinner.** Reuse `components/Skeleton.tsx`. Layout-matched: a tall floating `glassFloating` skeleton block for the headline (chip line + 2 text lines + a wide hero bar), then a skeleton `THIS WEEK` card (7 skeleton bars + 3 mini columns), a 1-line skeleton for the trajectory strip, and 3 skeleton transaction rows. Header greeting + avatars can render immediately (from cached user). Keep a small `ActivityIndicator` in the header only for background refresh. |
| **Empty (new household, no data)** | The headline still renders, in a dedicated **onboarding voice**: chip `SET UP` (`colors.info`, `information-circle`), sentence "Let's get your first numbers in — link an account or add a transaction," hero number replaced by a **primary CTA button** (`gradients.primaryGradient`, `radius.lg`) "Link an account." Tiers 3–5 collapse to a single friendly empty card ("Nothing to show yet — this fills in as money moves"). No bar chart skeleton left hanging. |
| **Error (status endpoint failed)** | The headline degrades gracefully instead of blanking: neutral `glass` (not floating), `alert-circle-outline` `colors.error`, "Couldn't load your status right now," a `Retry` text button, and — critically — **still show the raw hero cash-flow number if it's locally computable** from transactions, so the user isn't left with nothing. Lower tiers that failed each show their own inline `Retry` rather than taking down the whole screen. |
| **Partial error** | Any single tier whose data failed shows an inline mini-error ("Couldn't load — Retry") in that card only; the rest of the screen is unaffected. |
| **Overflow — long AI sentence** | Headline sentence `numberOfLines={3}` + ellipsis; hero number is never pushed off — it's pinned below with a min-height reserve. |
| **Overflow — long merchant/partner names** | Recent-activity name `numberOfLines={1}`; amount `flexShrink: 0`. |
| **Disabled** | ScopeToggle inactive segment isn't "disabled," it's just unselected. The `this month ▾` control ships disabled-styled in v1 if the period switch isn't built. |

---

## 11. Accessibility

- **Touch targets:** ScopeToggle segments, mini-row columns, trajectory strip, and
  transaction rows all ≥ 44×44pt (hit-slop where visual height is smaller, e.g. the 32pt
  toggle).
- **Color independence:** every status/semantic signal pairs color with an **icon + word**
  — status chip (`GOOD`/`WATCH`/`ALERT` + icon), delta badges (arrow + "under/over"),
  cash-flow sign (`+`/`−` prefix). A red card is never *only* red.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears
  WCAG AA. Status tints are backgrounds only — the text/icon on them stays full-opacity
  semantic color, verified ≥ 4.5:1 on the dark card. Do **not** dim the headline sentence.
- **Screen-reader order & labels:**
  - Headline reads as one summary node: `"Status: Good. You're $240 under budget and
    every bill's covered — nice week. Cash flow this month, positive $1,860."`
  - ScopeToggle: `role="tablist"`; each segment a tab with `selected` state; changing it
    announces `"Showing household"` / `"Showing me."`
  - Trajectory strip: `"Net worth $84,320, up 2.1 percent. Level 3, Stability, 72 percent."`
  - Recent rows: `"{merchant}, {category}, {expense|income} {amount}{, by Alex}."`
- **Reduced motion:** the ScopeToggle pill slide, bar-chart grow-in, and card press-scales
  all use `animation.fast`; under reduce-motion they become instant state swaps.
- **Dynamic Type:** headline sentence and hero number must reflow (no fixed heights that
  clip); hero uses a min-height reserve, not a fixed height.

---

## 12. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current dashboard / AttentionCard) | Replace with token |
|---|---|
| gradient `['#0f0a1e', …]` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `#10b981` / `#16a34a` (positive) | `colors.success` |
| `#ef4444` / `#f87171` (negative) | `colors.error` |
| `#f59e0b` (attention/warn) | `colors.warning` |
| `#3b82f6` (info/partner B) | `colors.info` |
| `#a855f7` (accent/partner A) | `colors.primary2` |
| `#7c3aed` (primary/CTA) | `colors.primary` |
| `#f8fafc` / `rgba(255,255,255,0.55)` text | `colors.text` / `colors.textMuted` |
| `rgba(16,185,129,0.15)` etc. badge fills | `` `${semanticToken}1f` `` (12%) |
| card `rgba(255,255,255,0.05)` + `borderRadius:16` | `glassEffects.glass` / `commonStyles.card` |
| the headline card | `glassEffects.glassFloating` (only it floats) |
| ad-hoc `borderRadius: 16 / 20 / 9999` | `radius.lg / xl / full` |
| ad-hoc paddings `16 / 14 / 12 / 10 / 8` | `spacing.lg / md / sm / xs` |
| inline font sizes/weights | `typography.h1 / bodyBold / smallBold / small / caption` |
| `borderColor 'rgba(255,255,255,0.08/0.1)'` | `colors.borderLight` / `colors.borderGlass` |

---

## 13. Developer notes

- **Everything is already fetched.** The current `loadDashboard` already produces
  `net_cash_flow` (household summary), `thisWeekTotal` + `weeklyBudget`, `savings_progress`,
  `billsSummary`, `frameworkLevel`, `netWorth` + `netWorthHistory`, `householdMembers`,
  `attention`, and transactions with `user_id`. The redesign is a **re-layout of existing
  data**, not new endpoints — except the status verdict string (see below).
- **Status verdict:** ideally comes from the status/dashboard endpoint as
  `{ status: 'good'|'watch'|'alert', headline: string, cashFlow: number, in: number,
  out: number }`. If the endpoint doesn't yet return `status`/`headline`, compute status
  client-side with worst-signal-wins (`bills`, `spending`, `cashFlow` checks in §4.1) and
  fall back to a deterministic sentence template per state. **Never render an empty
  headline.**
- **Worst-signal-wins helper:** `overallStatus = severityMin(billsStatus, spendStatus,
  cashFlowStatus)` where severity order is `good < watch < alert`.
- **Scope:** thread a single `scope: 'household' | 'me'` state through the derivations.
  Household uses the joint summary; Me filters transactions/budgets/bills to
  `tx.user_id === userId`. Default `'household'`; force `'me'` (and hide the toggle) when
  `householdMembers.length < 2`.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `Skeleton` (loading),
  `AttentionCard` (tier 2 — just tokenize it), `Sparkline` (trajectory), the existing
  `FloatingActionButton` and `DrawerNavigation`.
- **Keep hero cash-flow locally computable** (`income − expense` over the current month
  from `transactions`) so the error state can still show a number.
- Partner glyph mapping mirrors the calendar redesign exactly (A → `primary2`/`◑`,
  B → `info`/`◐`, shared → none) for cross-screen consistency.
- The `this month ▾` control is a forward-compat affordance; ship disabled-styled if the
  period switch isn't in scope for v1.

---

## 14. Handoff checklist

- [x] 5-tier hierarchy defined with explicit visual-weight signals (only headline floats + uses h1)
- [x] Status Headline designed in all 3 states (good/watch/alert) with semantic tokens, icon+word (color-independent)
- [x] Hero number (this-month cash flow) defined, sign-colored, decoupled from status color
- [x] Attention tier positioned + tokenization of existing `AttentionCard` specified
- [x] This-week proof grouped (chart + mini-row) as one evidence card
- [x] Trajectory strip condensed from two cards into one horizontal row
- [x] Recent activity with graceful-degrade partner attribution
- [x] ScopeToggle (Household | Me) spec'd, default Household, hidden for solo, re-scopes screen
- [x] Loading (skeleton), empty (new household + CTA), error (status endpoint), partial-error states
- [x] Every old hardcoded value mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Component specs written (`docs/design/components/*.json`)
- [x] Tokens extracted (`docs/design/tokens/dashboard-tokens.json`)
