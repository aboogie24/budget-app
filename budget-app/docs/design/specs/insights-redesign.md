# Spending Insights Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** partially-tokenized styling in `budget-app/app/insights.tsx`
**Archetype:** analytics (charts + breakdowns) — must read as the same app as
`app/(tabs)/dashboard.tsx` and `app/(tabs)/calendar.tsx`.

---

## 1. Why this redesign exists

Insights is the *most* on-theme of the screens redesigned so far — it already wraps in
`<GradientBackground variant="bgDarkPurple">`, uses the standard `BackButton`, and pulls
`colors` / `spacing` / `glassEffects` / `typography` from the design system. So this is a
**tightening + information-architecture** pass, not a rescue. Three concrete problems:

1. **It still smuggles in magic numbers and off-palette colors.** Expenses render in a
   hardcoded pink `#f472b6` that appears nowhere in the token set; the category chart falls
   back to a bespoke `defaultColors` array (`'#f472b6'`, `'#fbbf24'`, `'#fb923c'` …) that
   isn't derived from the palette; summary/net values use inline `fontSize: 20/24,
   fontWeight: '800'` instead of `typography`; spacing uses raw `10 / 14 / 6 / 9 / 11`
   instead of the `spacing` scale; radii `2 / 3 / 5` are ad-hoc. The rest of the app was
   just purged of exactly these; Insights should match.

2. **The loading and empty states are below the bar the other screens now set.** Loading is
   a bare `ActivityIndicator` (calendar and dashboard both switched to layout-matched
   **skeletons** via `components/Skeleton.tsx`). Empty is a single centered line of text
   with no glass card and no CTA. The month nav can strand the user on a month with no data
   and nothing to do.

3. **The information architecture buries the answer.** The screen's job is to answer
   *"where did our money go this month, and is that better or worse than last month?"* Today
   the two most important facts — **net** and **how spending changed vs. last month** — are
   scattered: Income/Expenses sit in equal cards, Net is a third undifferentiated card
   below, and the trend arrows are tiny 14px glyphs. Nothing is clearly the headline. We
   impose a light hierarchy (headline → chart → breakdown) that mirrors the dashboard's
   "one clear top" principle, scaled to an analytics screen.

**What stays the same (this is recognizably the same screen):** the month `‹ Jul 2026 ›`
selector, the Income / Expenses / Net summary, the daily-spending chart, and the ranked
category breakdown. Same data (`GET /auth/insights`), same navigation, same functionality.

---

## 2. Information architecture — three tiers

Mirrors the dashboard's "one clear top, everything below is evidence," scaled to analytics:

1. **Month Summary headline** (`glassFloating`, the only floating card) — Net is the hero
   number; Income and Expenses are the two supporting figures; each of the three carries a
   **trend chip vs. last month** (arrow + word + %). This is the "how are we doing vs. last
   month" answer, top of screen.
2. **Daily Spending** (`glass`) — the shape of the month: when money moved and how much.
   The evidence behind the Expenses figure over time.
3. **By Category** (`glass`) — where the money went, ranked. The evidence behind the
   Expenses figure by bucket.

Group labels `DAILY SPENDING` / `BY CATEGORY` are `typography.caption` uppercase in
`colors.textMuted` — same treatment as the dashboard's `THIS WEEK` / `RECENT ACTIVITY`.

---

## 3. Full-screen wireframe — default / populated

iPhone 15 Pro (390×844). Household, July 2026, net positive.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Spending Insights                                  │  ← header row (BackButton + title)
│                                                                │
│              ‹      July 2026      ›                           │  ← month selector (centered)
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  NET THIS MONTH                                          │ │  │ TIER 1
│  │                                                          │ │  │ Month Summary
│  │       +$3,060.00        ▼ 8.4% vs last month            │ │  │ glassFloating
│  │                                                          │ │  │ (net = hero)
│  │  ──────────────────────────────────────────────────     │ │  │
│  │   ▲ Income              ▼ Expenses                       │ │  │
│  │   $6,420.00            $3,360.00                         │ │  │
│  │   ▲ 3.1% vs last mo    ▼ 12.0% vs last mo               │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  DAILY SPENDING                                                │  ┐ tier 2 label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 2
│  │  ▂  ▅ ▃ ▇   ▄ ▁  ▂▆ ▃  ▁   ▅ ▂ ▇ ▄  ▃ ▁ ▂  ▅ ▃  ▁▄ ▂    │ │  │ glass
│  │  1              8             15   17         26      31   │ │  │
│  │  ──────────────────────────────────────────────────      │ │  │
│  │  Avg $108/day        Highest  Jul 17  ·  $412            │ │  │  ← footer summary
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg gap
│  BY CATEGORY                                                   │  ┐ tier 3 label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 3
│  │  ● Groceries                              $842.10   25%   │ │  │ glass
│  │    ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │ │  │ ranked rows
│  │                                                          │ │  │
│  │  ● Dining                                 $612.40   18%   │ │  │
│  │    ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │ │  │
│  │                                                          │ │  │
│  │  ● Transport                              $410.00   12%   │ │  │
│  │    ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         │ │  │
│  │                                                          │ │  │
│  │  ● Utilities · Shopping · +4 more         $1,495   45%   │ │  │  ← overflow row (optional)
│  └──────────────────────────────────────────────────────────┘ │  ┘
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal, `paddingTop: spacing.xl`,
`paddingBottom: spacing.xxl + spacing.xl` (safe scroll under any tab bar). Tier gap under
the headline is `spacing.xl`; between lower tiers `spacing.lg`. Header title
`typography.h3`-weight but sized as the existing 20pt title — keep at `typography.bodyBold`
size bumped, see §9 mapping (the calendar/dashboard use a 20/700-ish header title).

---

## 4. States — wireframes

### 4.1 Loading (skeleton — reuse `components/Skeleton.tsx`)

Layout-matched, never a bare spinner. Header + month selector render immediately (they're
static / from local state); only the data region below shows skeletons.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Spending Insights                                  │  real
│              ‹      July 2026      ›                           │  real
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating shell
│  │  ▬▬▬▬▬▬▬▬                                                 │ │  Skeleton w120 h12  (label)
│  │  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬          ▬▬▬▬▬▬▬                          │ │  Skel w180 h32 · w96 h16
│  │  ────────────────────────────────────────────────        │ │
│  │  ▬▬▬▬▬▬▬          ▬▬▬▬▬▬▬                                 │ │  two Skel w100 h20
│  │  ▬▬▬▬▬          ▬▬▬▬▬                                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▬▬▬▬▬▬▬  (DAILY SPENDING)                                     │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │  ▁▃▂▅▄▁▂▆▃▁▅▂▇▄▃▁▂▅▃▁▄▂  (row of ~24 short skeleton bars) │ │  height 120, bottom-aligned
│  └──────────────────────────────────────────────────────────┘ │
│  ▬▬▬▬▬▬  (BY CATEGORY)                                         │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │  ●  ▬▬▬▬▬▬▬▬▬▬▬                     ▬▬▬▬                   │ │  ┐ 4× SkeletonStack-style rows:
│  │     ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                            │ │  │ dot + name line + track bar
│  │  ●  ▬▬▬▬▬▬▬                          ▬▬▬                   │ │  │
│  │     ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                                    │ │  ┘
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton primitives: reuse `Skeleton` for every block (label `w120 h12`, hero `w180 h32`,
trend chip `w96 h16 r=full`, income/expense figures `w100 h20`); the chart is a row of
`Skeleton` bars each `width: barWidth, height: random-ish 30–100%, borderRadius: radius.sm`;
category rows are dot (`w10 h10 r=full`) + name `Skeleton w120 h14` + amount `w48 h14` +
track `Skeleton w100% h6 r=full`. No `ActivityIndicator` as the primary loader; a small
one may sit in the header for a *background* refresh only.

### 4.2 Empty — month has no transactions

Distinct from error. The headline still renders its shell so the month nav stays anchored,
but the data region collapses to one friendly glass card with a CTA back to activity.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Spending Insights                                  │
│              ‹      July 2026      ›                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │                    ( 📊  bar-chart-outline )              │ │  icon colors.textDark, 48
│  │                                                          │ │
│  │              No spending in July 2026                     │ │  typography.bodyBold, text
│  │      Nothing was logged this month. Add a transaction    │ │  typography.small, textMuted
│  │        or pick another month to see your insights.       │ │
│  │                                                          │ │
│  │            [  Add a transaction  ]                       │ │  primary CTA, gradients.primaryGradient
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The month `‹ ›` nav remains fully usable here (this is how the user escapes an empty month).

### 4.3 Error — insights fetch failed

Keep the existing `ErrorState` component (already wired), but rendered inline inside the
data region so the header + month selector persist — never blank the whole screen.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Spending Insights                                  │
│              ‹      July 2026      ›                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                   ( ⚠ alert-circle-outline )             │ │  ErrorState (colors.error)
│  │                 Couldn't load insights                    │ │  title
│  │        We couldn't reach your spending data.              │ │  message
│  │           [ ↻ Try Again ]     [ Dismiss ]                 │ │  onRetry=loadInsights
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 Overflow / edge cases

- **Many categories (> 6):** show the top 6 ranked rows; collapse the remainder into a
  single trailing **"+N more"** row whose amount = summed remainder and bar = summed
  percent (see wireframe §3). Tapping it expands to the full list (progressive disclosure).
  If expansion isn't built in v1, cap at top 8 and drop the collapse row — note in dev
  notes.
- **Long category name:** `numberOfLines={1}` + ellipsis on the name; amount + percent are
  `flexShrink: 0` and never truncate.
- **Long month with sparse data / single spend day:** chart bars scale to the single max;
  zero-value days render a 2px `colors.glassMedium` stub so the day axis stays legible.
- **Net near zero / exactly $0:** hero shows `$0.00` in `colors.textMuted`, no `+`/`−`.
- **No prior month (first month of data):** trend chips render `—  new` in
  `colors.textMuted` instead of a percentage (never divide-by-zero into `Infinity%`).

---

## 5. TIER 1 — Month Summary headline (`glassFloating`)

The one floating card; the only place `typography.h1` appears. Replaces the old three flat
equal cards (Income card, Expenses card, Net card) with a single hierarchy: **Net is the
hero**, Income/Expenses are the supporting split beneath a divider.

### 5.1 Layout

```
NET THIS MONTH                                            ← caption label, textMuted, uppercase
   +$3,060.00            ▼ 8.4% vs last month            ← h1 (sign-colored) + trend chip
──────────────────────────────────────────────           ← commonStyles.divider
 ▲ Income              ▼ Expenses                          ← two equal columns
 $6,420.00            $3,360.00                            ← bodyBold, semantic color
 ▲ 3.1% vs last mo    ▼ 12.0% vs last mo                  ← per-figure trend chip (caption)
```

- **Hero — Net:** `typography.h1` (32/700). Color via `getValueColor(net)` — positive
  `colors.success`, negative `colors.error`, exactly `$0` → `colors.textMuted`. Prefix `+`
  when `net > 0`. This is the largest text on the screen.
- **Net trend chip** (top-right of the hero line): `radius.full` pill, arrow + `%` + `"vs
  last month"`. Direction from `net` vs previous-month net (derive as `prev_income −
  prev_expenses`; if the API doesn't return a net-change field, compute client-side).
- **Divider:** `commonStyles.divider` (1px `colors.borderLight`, `spacing.md` vertical).
- **Income / Expenses columns:** two equal-width columns. Label row = tiny direction icon
  (`arrow-up` income / `arrow-down` expenses) + word in `typography.caption`
  `colors.textMuted`. Value `typography.bodyBold` — **Income `colors.success`, Expenses
  `colors.error`** (replaces the off-palette `#f472b6`). Each column carries its own trend
  chip in `typography.caption`.

### 5.2 Trend chip — the color-independent "vs last month" signal

One reusable chip used four times (net + two figures + potentially chart). Direction is
conveyed by **arrow icon + word + color together**, never color alone:

| Situation | Icon | Word | Color | Reasoning |
|---|---|---|---|---|
| Spending/expense **down** vs last month | `trending-down` | `less` (or `↓ X%`) | `colors.success` | less spending is good |
| Spending/expense **up** vs last month | `trending-up` | `more` | `colors.error` | more spending is worse |
| Income **up** | `trending-up` | `↑` | `colors.success` | more income is good |
| Income **down** | `trending-down` | `↓` | `colors.error` | less income is worse |
| No change (0.0%) | `remove` | `flat` | `colors.textMuted` | neutral |
| No prior month | `remove` | `new` | `colors.textMuted` | avoid Infinity% |

This preserves the existing `changeColor(pct, isExpense)` logic exactly — expense-up is red,
income-up is green — but now the direction is also stated in a word/icon so it's readable
without color. The chip background is `` `${semanticColor}1f` `` (~12% tint), matching the
dashboard's badge convention. Percentages format as `Math.abs(pct).toFixed(1)%`.

---

## 6. TIER 2 — Daily Spending (`glass`)

Same bar-chart concept as today, tokenized and given a summary footer so the chart *says
something* rather than being a raw shape.

- **Card:** `commonStyles.card` (`glass` + `spacing.lg` padding). Group label
  `DAILY SPENDING` above it in `typography.caption` uppercase `colors.textMuted`.
- **Bars:** one per day of the month. Height ∝ `day.amount / maxDaily`. Fill
  **`colors.primary`** for the base (replaces the lighter `colors.accent`, to match the
  dashboard weekly chart which uses `colors.primary`); the **single highest-spend day** caps
  in `colors.primary2` so the peak reads at a glance. Zero-value days → 2px
  `colors.glassMedium` stub. `borderRadius: radius.sm` on each bar (replaces raw `2`).
  Chart height stays `120`; `gap` between bars `1`.
- **Axis labels:** first, mid, last day numbers only (keep current sparse labeling) in
  `typography.caption` `colors.textMuted`.
- **Footer summary** (divider above, `commonStyles.divider`): `Avg $X/day` on the left
  (`typography.smallBold` `colors.text` for the value, `/day` muted) and
  `Highest {Mon DD} · $X` on the right. Both derived from `daily_spending` client-side.
  This is the small IA win that turns a decorative chart into an insight.

**Empty within populated month** (income but zero spend days): show the axis + a centered
`typography.small` `colors.textMuted` "No spending days this month" instead of an all-stub
chart.

---

## 7. TIER 3 — By Category (`glass`)

Ranked spend-by-category, tokenized. Structurally the current list, cleaned up.

- **Card:** `commonStyles.card`. Group label `BY CATEGORY` above.
- **Row (per category):**
  - **Color dot** `10×10`, `radius.full`, `marginTop: spacing.xs` — uses the category's
    own `cat.color` when the API supplies it; otherwise a **palette-derived** fallback
    rotation (see §7.1), never the ad-hoc `#f472b6 / #fbbf24 / #fb923c` array.
  - **Header line:** name (`typography.smallBold` `colors.text`, `numberOfLines={1}`) on the
    left; amount (`typography.smallBold` `colors.text`) + percent (`typography.caption`
    `colors.textMuted`) right-aligned, `flexShrink: 0`.
  - **Progress track:** full-width, `height: 6`, `borderRadius: radius.full`, track
    `colors.borderGlass`, fill width = `cat.percent%` in the row's dot color. `marginTop:
    spacing.sm`.
  - Row vertical rhythm: `spacing.md` between rows (replaces raw `14`).
- **Empty (no expenses but month has income):** single line "No expenses this month" in
  `typography.small` `colors.textMuted` inside the card (keeps the card, not a bare string).
- **Ranking:** rows come pre-sorted by amount desc from the API; if not guaranteed, sort
  client-side. Overflow collapse row per §4.4.

### 7.1 Palette-derived category fallback colors

When `cat.color` is absent, cycle a fixed, on-brand ordered list built **only** from
existing tokens so category colors never drift off-palette:

`[colors.primary2, colors.info, colors.success, colors.warning, colors.accent,
colors.error, colors.primary]`

Index by rank (`i % list.length`). Document this list in the component JSON so the frontend
doesn't reinvent it. (This replaces the current `defaultColors` array's two off-palette
hexes.)

---

## 8. Month selector (unchanged behavior, tokenized)

Keep the centered `‹  July 2026  ›` control exactly as-is functionally (prev/next month,
year rollover). Tokenize: chevrons `Ionicons` `chevron-back`/`chevron-forward` size 22
`colors.textMuted`; label `typography.bodyBold` `colors.text`; container gap `spacing.lg`
(replaces raw `20`), `marginBottom: spacing.lg`. Each chevron gets a 44×44 hit target
(`hitSlop` — the visible glyph stays 22). It sits between the header row and the data region
so it's a stable anchor across all states.

---

## 9. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `insights.tsx`) | Replace with token |
|---|---|
| gradient wrapper (already correct) | keep `<GradientBackground variant="bgDarkPurple">` |
| expenses `'#f472b6'` | `colors.error` |
| chart bar `colors.accent` | `colors.primary` (base) / `colors.primary2` (peak day) |
| `defaultColors = ['#f472b6','#fbbf24','#fb923c', …]` | palette-derived list §7.1 (all tokens) |
| zero-bar `colors.glassLight` | `colors.glassMedium` (2px stub, more legible) |
| header title `fontSize: 20, fontWeight: '800'` | keep 20/700 — align with calendar/dashboard header title |
| `summaryValue fontSize: 20, fontWeight: '800'` | `typography.bodyBold` (16/600) for figures; hero uses `typography.h1` |
| `netValue fontSize: 24, fontWeight: '800'` | `typography.h1` (32/700) — Net is the hero now |
| `summaryLabel` caption (already `typography.caption`) | keep `typography.caption` `colors.textMuted` |
| `sectionTitle fontSize: 14, fontWeight: '700'` | group label `typography.caption` uppercase `colors.textMuted` |
| `catName / catAmount fontSize: 14, fontWeight: '700'` | `typography.smallBold` |
| `catPercent fontSize: 11` | `typography.caption` |
| `barLabel fontSize: 9` | `typography.caption` `colors.textMuted` |
| `changeText` caption (ok) + inline color logic | keep `changeColor()`; wrap in trend-chip §5.2 |
| card `glassEffects.glass` + padding | `commonStyles.card` (glass + `spacing.lg` + `marginBottom`) |
| headline (summary) card | `glassEffects.glassFloating` (only it floats) |
| `summaryRow gap: 10 / marginBottom: 10` | `spacing.md` |
| `monthSelector gap: 20` | `spacing.lg` |
| `catRow marginBottom: 14 / gap: 10` | `spacing.md` / `spacing.md` |
| `changeRow gap: 4 / marginTop: 6` | `spacing.xs` / `spacing.sm` |
| `catBarTrack marginTop: 6`, `catBarFill radius: 3` | `spacing.sm`, `radius.full` |
| `catDot borderRadius: 5`, `bar borderRadius: 2` | `radius.full`, `radius.sm` |
| `catBarTrack backgroundColor colors.borderGlass` | keep `colors.borderGlass` |
| `emptyText / emptySubtext` inline sizes | `typography.bodyBold` / `typography.small` + empty card §4.2 |
| `ActivityIndicator` loader | `Skeleton` layout-matched loading §4.1 |

---

## 10. Component reuse

| Component | Where | Notes |
|---|---|---|
| `GradientBackground` (`variant="bgDarkPurple"`) | screen background | already used — keep |
| `BackButton` (`fallback="/(tabs)/dashboard"`) | header left | already used — keep |
| `Skeleton` / `SkeletonStack` (`components/Skeleton.tsx`) | loading state §4.1 | **new** — replaces spinner |
| `ErrorState` (`components/ErrorState.tsx`) | error state §4.3 | already used — keep, render inline |
| `Sparkline` (`components/Sparkline.tsx`) | *optional* net-trend mini-line in headline | only if a short net history is available; degrades to nothing (<2 pts). Not required for v1 |
| `AttentionCard` | not used here | insights is analytics, not action-items — intentionally omitted |

Two new **insights-specific** presentational pieces are spec'd as component JSONs (they're
local to this screen, not shared): `insights-trend-chip` and `insights-category-row`.

---

## 11. Accessibility

- **Touch targets:** month `‹`/`›` chevrons and the empty-state CTA ≥ 44×44pt (hit-slop on
  the 22pt chevrons). Category rows are display-only (no tap in v1) so they have no target
  requirement; if the overflow "+N more" row is tappable, it's ≥ 44pt tall.
- **Color independence:** every trend/direction pairs **icon + word + color** (`trending-up`
  + `more` + red; `trending-down` + `less` + green; `remove` + `flat`/`new` + muted). Net
  sign uses a `+`/`−` prefix. A red figure is never *only* red. Category identity is a
  labeled row (name + amount), not color-only — the dot is decorative reinforcement.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears WCAG
  AA. Trend-chip text stays full-opacity semantic color on a ~12% tint (verified ≥ 4.5:1 on
  the dark card); do not dim it.
- **Screen-reader order & labels:**
  - Headline reads as one node: `"Net this month, positive $3,060, down 8.4 percent versus
    last month. Income $6,420, up 3.1 percent. Expenses $3,360, down 12 percent."`
  - Daily chart: expose an accessible summary label rather than 31 bars —
    `"Daily spending, average $108 per day, highest on July 17 at $412."` Individual bars
    `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`.
  - Category rows: `"{name}, {amount}, {percent} percent of spending."`
  - Month selector: `‹` = `"Previous month"`, label = `"July 2026"`, `›` = `"Next month"`.
- **Reduced motion:** bar grow-in and month-change cross-fade use `animation.fast`; under
  reduce-motion they become instant. `Skeleton`'s pulse already respects platform settings
  minimally — acceptable as-is; if a global reduce-motion flag exists, freeze the pulse.
- **Dynamic Type:** hero uses a min-height reserve, not a fixed height, so the Net number
  reflows; figures and category names wrap/ellipsize rather than clip.

---

## 12. Developer notes

- **Re-layout, not new data.** `GET /auth/insights` already returns `income`, `expenses`,
  `net`, `prev_income`, `prev_expenses`, `income_change`, `expense_change`, `categories[]`
  (`name`, `color?`, `amount`, `percent`), and `daily_spending[]` (`date`, `amount`). The
  redesign re-arranges these into the three-tier IA.
- **Net trend:** if the API returns no explicit net-change %, compute from
  `prevNet = prev_income − prev_expenses`; guard `prevNet === 0` → render `new` (no %).
- **Chart derivations (client-side):** `maxDaily = max(daily_spending.amount, 1)`;
  `avgPerDay = expenses / daysWithData` (or `/ daily_spending.length`); `highestDay =
  argmax(daily_spending)`. Keep `chartBarWidth` responsive as today
  (`(SCREEN_WIDTH − 2*spacing.lg*2)/n − 2`, re-derived from tokens not raw 64).
- **Empty vs error are distinct:** empty = fetch succeeded but `expenses === 0 &&
  income === 0 && daily_spending` all-zero → §4.2 card. Error = fetch threw → `ErrorState`.
  Loading = `Skeleton`. Never show a bare `ActivityIndicator` as the whole-screen loader.
- **Reuse, don't reimplement:** `Skeleton`, `ErrorState`, `GradientBackground`, `BackButton`
  are all already imported or trivially importable — no new shared components.
- **Category fallback palette** is a fixed token-derived list (§7.1) — put it in one const,
  index by rank, so it stays on-brand and stable across renders.
- **Overflow "+N more"** collapse is a progressive-disclosure nicety; if not built for v1,
  cap the list at the top 8 and note it — do not render an unbounded list.

---

## 13. Handoff checklist

- [x] Three-tier IA defined (Net-hero headline → daily chart → category breakdown), only the headline floats + uses h1
- [x] All states designed (default, skeleton loading, empty-month w/ CTA, inline error, overflow/edge cases)
- [x] Every hardcoded color/size/space/radius mapped to a design-system token (incl. off-palette `#f472b6` and the `defaultColors` array)
- [x] Trend "vs last month" made color-independent (icon + word + color), preserving existing expense/income color logic
- [x] Chart given an insight footer (avg/day, highest day) and tokenized bars (primary / primary2 peak)
- [x] Category fallback colors derived from tokens, not ad-hoc hexes
- [x] Loading uses `Skeleton` (layout-matched), error keeps `ErrorState` inline, empty distinct from error
- [x] Accessibility: 44pt targets, color-independent trends, SR summary for chart + labels, reduced motion, Dynamic Type
- [x] Component reuse table (GradientBackground, Skeleton, ErrorState, BackButton, optional Sparkline)
- [x] Component specs written (`docs/design/components/insights-*.json`)
