# Finances (Goals tab) Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/(tabs)/goals.tsx` (route `(tabs)/goals`)
**Sibling references:** `calendar-redesign.md`, `dashboard-redesign.md`

> **Naming note.** The route is `(tabs)/goals` but the screen it renders is titled
> **"Finances"** — it is the household net-worth / assets / debts overview, not a
> savings-goals list. This redesign keeps that scope and title ("Finances"); it does not
> repurpose the screen. Wherever this doc says "the screen," it means the Finances screen
> served at `(tabs)/goals`.

---

## 1. Why this redesign exists

The current screen has the same two problems the calendar and dashboard had before their
redesigns — and this one is arguably the worst offender.

**Problem 1 — it is a parallel design system.** Nothing here comes from `design-system.ts`.
It hardcodes:

- Its **own wrong gradient** `['#0f0a1e','#1a1035','#0f0a1e']` — the same subtly-off purple
  the dashboard/calendar redesigns already replaced with `gradients.bgDarkPurple`
  (`['#0f172a','#1a0a40','#0f172a']`). Side-by-side with the redesigned tabs, this screen
  reads as a different app.
- Its **own color literals** everywhere: `#10b981`/`#059669` (income/success),
  `#ef4444`/`#dc2626` (expense/error), `#a855f7`/`#b26ef8` (accent), `#3b82f6` (cash),
  `#7c3aed` (property), `#f59e0b` (progress), plus dozens of `rgba(255,255,255,0.xx)`
  surface/text values.
- Its **own spacing / radius / type**: raw `20 / 16 / 14 / 12 / 10 / 8` paddings,
  `borderRadius: 20 / 16 / 12 / 10`, and inline `fontSize: 32 / 24 / 16 / 13 / 12 / 11 / 10
  / 9` with hand-set weights — none tokenized.
- Its **own bespoke chrome**: a left-aligned `Finances` title with no standard header /
  `BackButton`, a floating `+` FAB with a one-off `#b26ef8` fill, and a dashed
  "Link New Account" CTA in one-off purple.

**Problem 2 — no real states + a trust-eroding data smell.** There is a full-screen
`ActivityIndicator` (no skeleton), **no empty state** (a brand-new household sees empty
charts and `$0.00` heroes, not an onboarding prompt), and the error is a thin inline banner
that still renders synthetic charts behind it. Worse, the screen **fabricates history**:
net-worth history, per-account trend sparklines, and 5 of 6 cash-flow months are generated
with `Math.random()` variance. In a couples finance app that is a credibility risk — two
partners comparing the screen will see different "history" on each render.

This redesign does three things at once:

1. **Fully tokenizes** the screen — every color, gradient, space, radius, and font comes
   from `design-system.ts`. Zero magic numbers. Background becomes
   `<GradientBackground variant="bgDarkPurple">`.
2. **Aligns the archetype chrome** — standard header (`BackButton` + title + actions),
   `glass` cards, tokenized section headers and list rows — so it is recognizably the same
   family as the redesigned calendar/dashboard/list screens.
3. **Stops faking data** — real snapshots only. Where history isn't available yet, degrade
   honestly (reuse `components/Sparkline.tsx`, which already shows a "Collecting…"
   placeholder for `< 2` points) instead of inventing a trend line.

Everything the screen *does* — net worth hero, asset allocation, cash flow, expandable
Assets/Debts account lists, debt-payoff progress, link-account — is **preserved**. The IA
is re-tiered for scan-ability, but it is the same screen.

---

## 2. Information architecture — a 5-tier hierarchy

Today the screen is a flat stack of roughly equal cards (quick-access chips → hero →
allocation donut → cash flow → accounts → debt payoff → CTA). The one question this screen
answers is **"What are we worth, and what's it made of?"** So the redesign imposes a tier
order where net worth is unmistakably the top, and everything below is evidence for it.

| Tier | Block | Surface | Role |
|---|---|---|---|
| **1** | **Net Worth Hero** (combined net worth + Assets/Debts split + real sparkline) | `glassFloating` (only card that floats) | the headline number |
| **2** | **Composition** (Asset Allocation donut + legend) | `glass` | what the assets are made of |
| **3** | **Cash Flow** (6-mo in/out chart + this-month in/spent/saved) | `glass` | how money is moving |
| **4** | **Accounts** (expandable Assets / Debts sections of account rows) | `glass` | the itemized proof |
| **5** | **Debt Payoff Progress** (per-debt progress bars) | `glass` | forward-looking, lowest |

Quick-access chips move up **under the header** (they're navigation, not content). The
dashed "Link New Account" CTA and the `+` FAB are consolidated (see §9) — one primary "add"
affordance, tokenized.

Rule of thumb for the frontend agent: **only the hero floats and only the hero uses the
biggest number.** If a second card competes for "biggest thing on screen," the hierarchy
has broken. This mirrors the dashboard redesign's contract exactly.

---

## 3. Full-screen wireframe — default / populated

Household with data. iPhone 15 Pro (390×844). `<GradientBackground variant="bgDarkPurple">`.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]   Finances                          [👁]  [⟳]            │  ← standard header
│                                                                │     Back · title · actions
│  [Debts][Bills][Savings][Budget][Priorities][Plans][Txns] →   │  ← quick-access chips (scroll)
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Combined Net Worth                          ⌐‾‾\_        │ │  │ TIER 1
│  │  $312,480.00                                 sparkline   │ │  │ Net Worth Hero
│  │  ▲ +2.1%  ·  +$6.4k this month                          │ │  │ glassFloating
│  │  ┌────────────────────────┬───────────────────────────┐  │ │  │
│  │  │ Total Assets           │ Total Debts               │  │ │  │
│  │  │ ▲ $486,200.00          │ ▼ $173,720.00             │  │ │  │  (icon+color+word)
│  │  └────────────────────────┴───────────────────────────┘  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 2
│  │  Asset Allocation                                         │ │  │ Composition
│  │   ╭────╮      ● Property        58%                       │ │  │ glass
│  │   │TOTAL│     ● Investments     29%                       │ │  │
│  │   │$486k│     ● Cash            13%                       │ │  │
│  │   ╰────╯                                                  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 3
│  │  Cash Flow                                   6 months     │ │  │ Cash Flow
│  │   ▊▊ ▊▊ ▊▊ ▊▊ ▊▊ ▊▊                                      │ │  │ glass
│  │   Feb Mar Apr May Jun Jul                                 │ │  │
│  │   ● Income   ● Expenses                                   │ │  │
│  │  ──────────────────────────────────────────────────      │ │  │
│  │  Jul Income      Jul Spent        Saved                   │ │  │
│  │  $8,900.00       $5,840.00        +$3,060.00              │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 4
│  │  ▾ Assets                       [4]      ▲ $486,200.00     │ │  │ Accounts
│  │    [🏠] 1247 Oak St     Austin, TX      $420,000.00       │ │  │ glass
│  │    [💼] Investments     6 holdings      $142,300.00       │ │  │  (expand/collapse)
│  │    [🏦] Ally Savings    Ally ··4821      $18,900.00       │ │  │
│  │  ──────────────────────────────────────────────────      │ │  │
│  │  ▸ Debts                        [3]      ▼ $173,720.00     │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 5
│  │  Debt Payoff Progress                        View plan ›  │ │  │ Debt Payoff
│  │  Mortgage             $148,200 left · Aug 2041           │ │  │ glass
│  │  ▓▓▓▓░░░░░░░░░░░  28% paid off                            │ │  │
│  │  Auto Loan            $14,320 left · Mar 2027            │ │  │
│  │  ▓▓▓▓▓▓▓▓▓░░░░  64% paid off                             │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │
│                                                    ( + FAB )   │  ← single add affordance
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal; tier gap `spacing.xl` (24)
below the hero, `spacing.lg` (16) between all lower tiers; card padding `spacing.lg`; the
header row sits inside the safe area (`edges={['top']}`).

---

## 4. TIER 1 — Net Worth Hero (the centerpiece)

The one card that floats (`glassEffects.glassFloating`), the one place the biggest number
lives. It preserves the current hero's content — combined net worth, monthly delta, and the
Assets/Debts split bar — but tokenizes it and fixes the color-only status.

### Structure

```
┌──────────────────────────────────────────────────────────┐
│  Combined Net Worth                          ⌐‾‾\_        │  caption, textMuted + sparkline
│  $312,480.00                                             │  h1 (32/700), text
│  ▲ +2.1%  ·  +$6.4k this month                          │  delta badge + caption
│  ┌────────────────────────┬───────────────────────────┐  │
│  │ Total Assets           │ Total Debts               │  │  split bar (inset)
│  │ ▲ $486,200.00          │ ▼ $173,720.00             │  │
│  └────────────────────────┴───────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **Label** `Combined Net Worth` — `typography.caption`, `colors.textMuted`, letter-spacing
  kept via caption style.
- **Hero value** — `typography.h1` (32/700), `colors.text`. Respects the `balanceVisible`
  eye toggle (masked → `••••••`). The single largest text on the screen.
- **Delta badge** (`radius.full` pill) — up → `▲ +2.1%` in `colors.success` on
  `` `${colors.success}1f` `` (12%); down → `▼ -1.4%` in `colors.error` on
  `` `${colors.error}1f` ``. **Icon (arrow) + sign + color together** — never color alone.
  Followed by `· +$6.4k this month` in `typography.caption` `colors.textMuted`.
- **Sparkline** — reuse `components/Sparkline.tsx` (do **not** reimplement the inline SVG),
  ~90×44, `values={netWorthHistory}`, `color={colors.primary2}`. With `< 2` real snapshots
  it renders its built-in "Collecting…" placeholder — **this replaces the current
  `Math.random()` fabricated history.**
- **Assets / Debts split bar** — an inset row on `` `${colors.bg}33` `` (dark inset) with
  `radius.md`, divided by a 1px `colors.borderGlass` rule:
  - **Total Assets** — label `typography.caption` `colors.textMuted`; value
    `typography.bodyBold` `colors.success`, prefixed with an `arrow-up` glyph.
  - **Total Debts** — value `colors.error`, prefixed with an `arrow-down` glyph.
  - The up/down glyph is what makes assets-vs-debts legible without relying on green/red
    alone.

### Hero states
- **Populated:** as above.
- **Masked** (`balanceVisible === false`): value + split values render `••••••`; delta badge
  hides; sparkline stays (it's a shape, not a number).
- **Zero / new household:** hero not shown in this form — see §7 Empty.

---

## 5. TIER 2 — Composition (Asset Allocation)

Preserves the donut + legend, tokenized. `glass` card, `radius.lg`, `spacing.lg` padding.

- **Title** `Asset Allocation` — `typography.smallBold`, `colors.text`.
- **Donut** (`GoalsAllocationDonut`, extracted from the current inline `DonutChart`) — 120px,
  16px stroke, background ring `colors.glassLight` (was `rgba(255,255,255,0.04)`), center
  label `TOTAL` (`typography.caption` `colors.textMuted`) + value (`typography.smallBold`
  `colors.text`, masked with the eye toggle).
- **Segment colors** — drawn from a **tokenized category palette**, not literals:
  - Property → `colors.primary` (`#7c3aed`)
  - Investments → `colors.success` (`#22c55e`)
  - Cash → `colors.info` (`#3b82f6`)
  - "No assets" placeholder → `colors.glassStrong`
- **Legend rows** — a `colors.{token}` 8px dot + label (`typography.small` `colors.textMuted`)
  + `pct%` (`typography.smallBold` `colors.text`). **Each legend row also shows its `$`
  amount** (currently only in the code, not surfaced) so the segment meaning isn't
  color-only — label + amount + percent all present.

---

## 6. TIER 3 — Cash Flow

Preserves the 6-month income/expense bar chart and the this-month in/spent/saved summary,
tokenized. `glass` card.

- **Header row** — `Cash Flow` (`typography.smallBold` `colors.text`) left, `6 months`
  (`typography.caption` `colors.textMuted`) right.
- **Bar chart** (`GoalsCashFlowChart`, extracted from inline `CashFlowChart`) — per month a
  paired income/expense bar:
  - Income bar → `gradients.successGradient` (was `['#10b981','#059669']`).
  - Expense bar → `gradients.errorGradient` (was `['#ef4444','#dc2626']`), 0.8 opacity.
  - Month labels `typography.caption` `colors.textMuted`.
- **Honesty rule:** only render months for which a **real** `netWorthHistory` /
  transactions-derived value exists. **Remove the `Math.random()` variance** for the 5 prior
  months — if only the current month is real, show one bar (or the "Collecting…" note),
  not five invented ones. See Developer Notes.
- **Legend** — `colors.success` dot "Income", `colors.error` dot "Expenses"
  (`typography.caption` `colors.textMuted`), separated from the chart by
  `commonStyles.divider`.
- **This-month summary** — three columns on a `` `${colors.bg}26` `` inset, divided by 1px
  `colors.borderGlass`:
  | Column | Value color | Token |
  |---|---|---|
  | `{month} Income` | `colors.success` | `typography.smallBold` |
  | `{month} Spent` | `colors.error` | `typography.smallBold` |
  | `Saved` | `colors.primary2` (positive) / `colors.error` (negative) via `getValueColor`-style | `typography.smallBold` |
  All three respect the eye toggle.

---

## 7. TIER 4 — Accounts (expandable Assets / Debts)

Preserves the current expandable section pattern (one section open at a time), tokenized.
One `glass` card containing two `GoalsSectionHeader`s (Assets, Debts) separated by
`commonStyles.divider`, each expanding to a list of `GoalsAccountRow`s.

### GoalsSectionHeader
```
▾ Assets                       [4]      ▲ $486,200.00
```
- Chevron (`chevron-down` expanded / `chevron-forward` collapsed) `colors.textMuted`.
- Title `typography.smallBold` `colors.text`.
- Count badge — pill on `colors.glassMedium`, `radius.full`, count in `typography.caption`
  `colors.textMuted`.
- Section total — `typography.smallBold`; assets positive → `colors.success`, debts
  negative → `colors.error`. Respects eye toggle. **Tap target ≥ 44pt tall** (currently
  `paddingVertical: 12` → 44 with text; keep ≥ 44).

### GoalsAccountRow
```
[🏠] 1247 Oak St        Austin, TX      $420,000.00
```
- Row surface `colors.glassLight` on `radius.md`, 1px `colors.borderGlass`, `spacing.md`
  padding, `spacing.md` gap. **Min height 44pt.**
- Icon chip — 38px, `radius.md`, tinted `` `${iconColor}18` `` where `iconColor` is a
  **token** (property `colors.primary`, cash `colors.info`, investments `colors.success`,
  debt `colors.error`) — no literals.
- Name `typography.smallBold` `colors.text` `numberOfLines={1}`; subtitle
  `typography.caption` `colors.textMuted` `numberOfLines={1}`.
- Optional inline sparkline — reuse `components/Sparkline.tsx` (small, `filled` off),
  **only when real trend data exists**. Per the honesty rule, drop the current
  `bal * 0.9 … bal` synthetic trend arrays; pass real history or omit the sparkline.
- Balance — `typography.smallBold`; negative (debt) → `colors.error`, else `colors.text`.
  `flexShrink: 0` (never truncates). Respects eye toggle.
- Tappable → deep-links to `/properties` `/accounts` `/investments` `/debts` (unchanged).

---

## 8. TIER 5 — Debt Payoff Progress

Preserves per-debt progress bars, tokenized. `glass` card; only rendered when
`debts.length > 0`.

- **Header** — `Debt Payoff Progress` (`typography.smallBold` `colors.text`) left,
  `View plan ›` (`typography.caption` `colors.primary2`) right → `/plans`.
- **Per debt** (`GoalsDebtProgressRow`):
  - Name `typography.small` `colors.text`; right-aligned `{amount} left · {eta}` in
    `typography.caption` `colors.textMuted` (eta omitted if unknown).
  - Progress bar — track `colors.glassLight` (was `rgba(255,255,255,0.06)`), `radius.full`,
    height `spacing.sm - 2`≈6; fill is `gradients.primaryGradient` **plus a tokenized
    status tint** so progress isn't color-only:
    - `< 30%` paid → `colors.error` fill + label word "Just started"
    - `30–60%` → `colors.warning` fill + "In progress"
    - `> 60%` → `colors.success` fill + "On track"
  - `{n}% paid off` caption `typography.caption` `colors.textDark`.

> Note: the current `original = current * 1.3` payoff estimate is a synthetic guess. Prefer a
> real original-balance/opening-balance field if the debt API exposes one; otherwise keep the
> estimate but it stays internal — the bar shows `% paid` + the status word, so a rough
> estimate never reads as a precise claim.

---

## 9. Header, quick-access, and the add affordance

### Standard header (matches the archetype)
```
[‹]   Finances                          [👁]  [⟳]
```
- **BackButton** — reuse `components/BackButton.tsx` with `fallback="/(tabs)/dashboard"`
  (so a deep-linked entry has a canonical parent). This is a **root tab**, so on normal tab
  navigation `router.canGoBack()` is false and the button self-hides — which is correct;
  the header then reads as title + actions, consistent with the other tabs that also lack a
  back affordance at root. Include it for deep-link safety, not as required chrome.
- **Title** `Finances` — `typography.h3` (24/600) `colors.text` (was inline 24/700).
- **Actions** (right): eye toggle (`eye` / `eye-off`) and refresh (`refresh`), each a
  **44pt** target, icon `colors.textMuted`. The refresh spinner during background refresh
  uses a small `ActivityIndicator` `colors.primary2` (matches dashboard pattern).

### Quick-access chips
Kept, moved directly under the header (navigation, not content). Horizontal scroll of pills:
- Pill surface `colors.glassLight`, 1px `colors.borderLight`, `radius.md`, `spacing.sm`
  vertical / `spacing.md` horizontal padding.
- Icon `colors.primary2`, label `typography.caption` `colors.text`.
- Each pill ≥ 44pt tall tap target.

### One add affordance
Today there are **two** competing "add" controls: a dashed "Link New Account" CTA and a
`+` FAB, both in one-off purple. Consolidate to a **single** `FloatingActionButton`
(reuse `components/FloatingActionButton.tsx`, as dashboard does) with actions:
`Link Account`, `Add Property`, `Add Debt` (routes unchanged). Remove the dashed CTA and the
bespoke `#b26ef8` FAB. If a persistent inline "Link account" is still wanted for empty-ish
states, it appears **only** in the empty state (§10), not alongside the FAB.

---

## 10. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed in §3. |
| **Loading** | **Skeletons, not the full-screen spinner.** Reuse `components/Skeleton.tsx`, layout-matched: a floating `glassFloating` skeleton for the hero (label line + wide hero bar + a 2-column split), a `glass` skeleton with a round donut block + 3 legend lines, a `glass` skeleton with 6 skeleton bars + 3 summary columns, and 3 skeleton account rows (`Skeleton` chip + 2 lines + right value — same shape the dashboard skeleton uses). Header + quick-access render immediately. See `GoalsSkeleton` component spec. |
| **Empty (new household, no accounts/data)** | Hero is replaced by an onboarding card: `wallet-outline` (`colors.textDark`), title "Let's see your net worth" (`typography.bodyBold` `colors.text`), subcopy "Link an account or add a property to build the full picture." (`typography.small` `colors.textMuted`), and a **primary CTA button** (`gradients.primaryGradient`, `radius.lg`, `typography.button`) "Link an account" → `/link-account`. Tiers 2–5 collapse to nothing (no empty donut, no `$0` charts, no fabricated bars). FAB still present. |
| **Error** | Inline **glass card** (not a thin banner, and it must **replace** the charts, not sit in front of them): `alert-circle-outline` (`colors.error`), "Couldn't load your finances", a `Retry` text button (`colors.primary2`) → `loadData()`. If net worth is locally derivable from already-loaded partial data, still show the hero number above the error so the user isn't left blank (mirrors dashboard error handling). |
| **Partial error** | Any single tier whose fetch failed (e.g. holdings) shows an inline mini "Couldn't load — Retry" inside that card only; the rest of the screen is unaffected. |
| **Overflow — many accounts** | Section list grows within the card; the outer `ScrollView` handles length. No inner cap needed (unlike the calendar grid). |
| **Overflow — long account / debt names** | `numberOfLines={1}` + ellipsis on name and subtitle; balance/amount `flexShrink: 0`, never truncates. |
| **Masked balances** | Eye toggle → all currency renders `••••••`; percentages, chart shapes, and section counts remain (they're not sensitive amounts). Delta badge hides while masked. |

---

## 11. Accessibility

- **Touch targets:** header action icons, quick-access chips, section headers, account rows,
  `View plan ›`, and FAB actions all ≥ 44×44pt (hit-slop where visual height is smaller).
- **Color independence:** every status/directional signal pairs color with an **icon +
  word/sign** — net-worth delta (`▲/▼` + `+/-` + %), Assets/Debts split (`arrow-up` /
  `arrow-down` glyphs, not just green/red), debt-payoff status (fill color + the word
  "Just started / In progress / On track"), allocation legend (dot + label + amount +
  percent). Nothing is conveyed by color alone.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` / `colors.textDark` over
  dark glass — verified WCAG AA. Semantic value colors (`success`/`error`) on the dark hero
  and inset surfaces clear 4.5:1; do **not** dim them below full opacity.
- **Screen-reader order & labels:**
  - Hero reads as one node: `"Combined net worth, $312,480, up 2.1 percent this month.
    Assets $486,200, debts $173,720."`
  - Allocation: donut labeled `"Asset allocation, property 58 percent, investments 29
    percent, cash 13 percent."`
  - Section header: `"Assets, 4 accounts, total $486,200. Collapsed/Expanded. Double tap to
    toggle."`
  - Account row: `"{name}, {subtitle}, {balance}. Double tap to open."`
  - Debt row: `"{name}, {amount} left, {percent} paid off, {status word}."`
  - Masked state: values announce as "hidden."
- **Reduced motion:** section expand/collapse, bar grow-in, and card press-scales use
  `animation.fast`; under reduce-motion they become instant state swaps. The `Skeleton`
  pulse already respects the platform; no bespoke animation added.
- **Dynamic Type:** hero number and labels reflow (no fixed-height clipping); the hero uses
  a min-height reserve, not a fixed height.

---

## 12. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `goals.tsx`) | Replace with token |
|---|---|
| gradient `['#0f0a1e','#1a1035','#0f0a1e']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `#10b981` / `#059669` (income / positive) | `colors.success` / `gradients.successGradient` |
| `#ef4444` / `#dc2626` / `#f87171` (expense / negative) | `colors.error` / `gradients.errorGradient` |
| `#a855f7` / `#b26ef8` (accent / FAB) | `colors.primary2` |
| `#7c3aed` (property / primary) | `colors.primary` / `gradients.primaryGradient` |
| `#3b82f6` (cash / info) | `colors.info` |
| `#f59e0b` (debt-progress mid) | `colors.warning` |
| hero card `rgba(124,58,237,0.12)…` gradient + `borderRadius:20` | `glassEffects.glassFloating` |
| `glassCard rgba(255,255,255,0.04)` + `borderRadius:16` + `borderColor rgba(255,255,255,0.06)` | `glassEffects.glass` / `commonStyles.card` |
| account/summary inset `rgba(0,0,0,0.2)` / `rgba(0,0,0,0.15)` | `` `${colors.bg}33` `` / `` `${colors.bg}26` `` |
| donut bg ring `rgba(255,255,255,0.04)` | `colors.glassLight` |
| progress track `rgba(255,255,255,0.06)` | `colors.glassLight` |
| count badge `rgba(255,255,255,0.08)` | `colors.glassMedium` |
| borders `rgba(255,255,255,0.06 / 0.08 / 0.1)` | `colors.borderLight` / `colors.borderGlass` |
| text `#fff` / `#f8fafc` | `colors.text` |
| text `rgba(255,255,255,0.5 / 0.4 / 0.35)` | `colors.textMuted` |
| text `rgba(255,255,255,0.3 / 0.2)` | `colors.textDark` |
| ad-hoc `borderRadius: 20 / 16 / 12 / 10 / 3` | `radius.xl / lg / md / sm / full` |
| ad-hoc paddings `20 / 16 / 14 / 12 / 10 / 8 / 4` | `spacing.xl / lg / md(≈14) / md / sm / xs` |
| inline `fontSize 32/24/16/14/13/12/11/10/9` + weights | `typography.h1 / h3 / body / small / smallBold / caption` |
| full-screen `ActivityIndicator` loading | `Skeleton` layout (see §10 + `GoalsSkeleton`) |
| inline SVG `Sparkline` (fabricated data) | reuse `components/Sparkline.tsx` (real data / "Collecting…") |
| dashed "Link New Account" CTA + one-off FAB | single `FloatingActionButton` (empty-state CTA excepted) |
| bespoke left-title header | `BackButton` + `typography.h3` title + tokenized actions |

---

## 13. Developer notes

- **Everything is already fetched.** `loadData` already produces debts, bills, holdings,
  accounts, properties, and budgets, and derives `totalAssets`, `totalDebts`, `netWorth`,
  `allocationSegments`, and the this-month income/expenses. This redesign is a **re-layout +
  tokenization of existing data**, not new endpoints — except the honesty fixes below.
- **Stop fabricating history (the one behavioral change).** Remove the `Math.random()`
  variance in `cashFlowData`, the `netWorth * 0.94 … netWorth` `netWorthHistory` array, and
  the `bal * 0.9 … bal` per-account/property trend arrays. Replace with:
  - Net-worth history from **real snapshots** (the dashboard already calls
    `recordNetWorthSnapshot` and gets back a trailing window — read that same
    `NetWorthSnapshotPoint[]` here). Feed it to `components/Sparkline.tsx`, which shows
    "Collecting…" for `< 2` points. No invented deltas.
  - Cash-flow months from real transaction history where available; render only real
    months. Monthly delta % must derive from real first-vs-last snapshot, like the
    dashboard's `netWorthDeltaPercent`.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `Skeleton` (loading),
  `BackButton` (header), `Sparkline` (hero + optional row trends),
  `FloatingActionButton` (single add affordance). Extract the inline `DonutChart`,
  `CashFlowChart`, `AccountRow`, `SectionHeader` into tokenized components
  (`GoalsAllocationDonut`, `GoalsCashFlowChart`, `GoalsAccountRow`, `GoalsSectionHeader`) —
  they're screen-specific enough to stay local but must consume tokens only.
- **Eye toggle** (`balanceVisible`) threads through every currency value exactly as today —
  keep it; just tokenize the icon color and mask string (`••••••`).
- **One section open at a time** (`expandedSection`) — keep the existing progressive-
  disclosure behavior; default `'assets'` open.
- **Partner attribution is out of scope** for this screen — net worth/accounts are
  household-level, not per-transaction, so no partner glyph here (unlike calendar/dashboard).
  Noted so the frontend agent doesn't add it.

---

## 14. Handoff checklist

- [x] 5-tier hierarchy defined (only hero floats + uses h1)
- [x] All states designed (default, loading skeleton, empty + CTA, error, partial-error, masked, overflow)
- [x] Every old hardcoded color/gradient/spacing/font mapped to a design-system token
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, Sparkline, FloatingActionButton)
- [x] Fabricated `Math.random()` history removed; real snapshots + "Collecting…" fallback specified
- [x] Two competing add affordances consolidated into one FAB
- [x] Accessibility: 44pt targets, color-independent status (icon+word+color), SR order/labels, reduced motion, Dynamic Type
- [x] Component specs written (`docs/design/components/goals-tab-*.json`)
```
