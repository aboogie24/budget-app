# Partner Dashboard Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Archetype:** Summary (same family as `dashboard.tsx` / `calendar.tsx`)
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/partner-dashboard.tsx`

---

## 1. Why this redesign exists

The partner dashboard is a **household-summary** screen: one household, one combined view
of income/expenses/debt/savings, plus quick actions. It is functionally fine but visually
it is **a different app from the rest of CoupleFlow**, and its information architecture
buries the one thing a couple opens this screen to learn.

**Problem 1 — it fights the design system.** Every value is hardcoded:

- Its own gradient `['#0f172a', '#1a1040', '#0f172a']` — a *different* purple from the
  tokenized `gradients.bgDarkPurple` (`['#0f172a','#1a0a40','#0f172a']`) the redesigned
  dashboard and calendar now use. Side by side, the seam is visible.
- Its own colors: `#22c55e`, `#ef4444`, `#f59e0b` (not even the token `warning` `#eab308`),
  `#8b5cf6` (not `colors.primary`/`primary2`), `#a855f7`, `#cbd5e1` (no such token), plus
  `rgba(...)` surfaces and tint fills invented inline.
- Its own spacing (`padding: 20`, `16`, `12`, `8`) and radii (`16`, `12`, `8`, `4`) and
  font sizes (`20/18/14/13/12`) — none from `spacing` / `radius` / `typography`.

**Problem 2 — flat hierarchy, no verdict.** The screen is four equal-weight blocks
(household header, cash-flow card, debt/savings card, actions grid). Nothing is the top.
A couple opens this to answer **"how's our household doing together?"** and instead has to
read four cards and do the arithmetic themselves. Net cash flow — the single most important
number — is stuck *below the fold of the first card*, same size treatment as everything else.

**Problem 3 — no real states.** Loading is a bare centered `ActivityIndicator` (no skeleton,
so the layout jumps when data lands). There is an error state but **no empty state** — a
brand-new household with zeroes renders `$0.00` everywhere and reads as broken, not new.

This redesign keeps the screen **recognizably the same** (household name, combined cash
flow, debt & savings, quick actions) but:

1. **Fully tokenizes it** — every color, gradient, space, radius, and font comes from
   `design-system.ts`, matching the dashboard/calendar redesigns exactly.
2. **Imposes a hierarchy** borrowed from the home dashboard: one **Household Headline**
   centerpiece (the combined net cash flow, the answer), then supporting proof below.
3. **Adds the missing states** (skeleton, empty/new-household, tokenized error) using the
   shared `Skeleton`, `GradientBackground`, `BackButton`, and `Sparkline` components.

### Relationship to the home dashboard (why it stays a distinct screen)

The home `dashboard.tsx` has a **Household | Me** scope toggle; its Household scope overlaps
this screen. This partner dashboard is the **always-household, both-partners** view —
reached from the home dashboard's "Partner Dashboard" action. So it deliberately mirrors the
home dashboard's visual language (same headline card, same tier idea) but is **scoped to the
joint household only** and leans into **couples attribution** (who contributed what). It is
the "us, together" screen. Consistency with the home dashboard is the point, not redundancy.

---

## 2. Information architecture — the 4-tier hierarchy

Same north-star discipline as the home dashboard, scoped to the household. Top to bottom,
each tier visually subordinate to the one above (only the headline floats + uses `h1`):

1. **Household Headline** (centerpiece) — household name + member count, and the **combined
   net cash flow** as one hero number with its `in − out` sub-caption. `glassFloating`.
2. **Combined Cash Flow proof** — the income vs expenses split that *makes* the hero number,
   as one grouped `glass` card. (Demoted from a co-equal card to "the evidence behind the
   headline.")
3. **Debt & Savings** — the household's total debt and savings-goal progress, one `glass`
   card with a progress bar. (Kept, tokenized.)
4. **Quick Actions** — the 2×2 action grid, lowest. (Kept, tokenized, 44pt targets.)

Mapping from the current screen (nothing meaningful is lost):

| Current block | Becomes |
|---|---|
| Header (BackButton / title / settings) | Standard tokenized header (unchanged structure) |
| Household header card (name + members badge) | Folded **into** the Tier-1 headline card |
| "Combined Cash Flow" card (income/expense + net) | Split: net → **hero (Tier 1)**; income/expense → **Tier 2 proof** |
| "Debt & Savings" card | **Tier 3** (tokenized, unchanged shape) |
| "Quick Actions" grid | **Tier 4** (tokenized, unchanged) |

---

## 3. Wireframes

Default state, iPhone 15 Pro (390×844). Screen padding `spacing.lg` (16) horizontal.

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Partner Dashboard                          ⚙        │  ← header: BackButton
│                                                                │    title, settings
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  The Rivera Household                          ( 👥 2 )   │ │  │ TIER 1
│  │                                                          │ │  │ Household Headline
│  │  Together this month                                     │ │  │ glassFloating
│  │      +$1,860.00           ← hero (combined net cash flow)│ │  │ (centerpiece)
│  │      $6,420 in  −  $4,560 out                            │ │  │
│  │                                     ◑ Alex   ◐ Sam        │ │  │ partner chips
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  COMBINED CASH FLOW                                            │  ┐ tier 2 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 2
│  │   [↓]  Total Income            [↑]  Total Expenses        │ │  │ Cash-flow proof
│  │        $6,420.00                    $4,560.00             │ │  │ glass
│  │   ───────────────────────────────────────────────────    │ │  │  (divider)
│  │           Net Cash Flow          +$1,860.00              │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  DEBT & SAVINGS                                                │  ┐ tier 3 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 3
│  │   [📄]  Total Debt             [👛]  Savings Progress     │ │  │ Debt & Savings
│  │         $18,240.00                   54.7%                │ │  │ glass
│  │   ───────────────────────────────────────────────────    │ │  │
│  │   Saved            $8,200.00 / $15,000.00                 │ │  │
│  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  54.7%                     │ │  │  progress bar
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  QUICK ACTIONS                                                 │  ┐ tier 4 group label
│  ┌───────────────────────────┐  ┌───────────────────────────┐ │  │ TIER 4
│  │   [＋]  Add Transaction    │  │   [◔]  View Budgets       │ │  │ Actions grid 2×2
│  └───────────────────────────┘  └───────────────────────────┘ │  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐ │  │
│  │   [⚑]  Savings Goals       │  │   [📈]  My Dashboard      │ │  │
│  └───────────────────────────┘  └───────────────────────────┘ │  ┘
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Header renders immediately (BackButton + static title + settings). Body is layout-matched
skeleton so nothing jumps when data lands. Optional small `ActivityIndicator` in the header
right slot only for background refresh.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Partner Dashboard                        (spinner)   │  ← header stays real
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating shell
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭                        ( ▭▭ )              │ │  name + badge
│  │  ▭▭▭▭▭▭                                                  │ │  "together" line
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭  ← wide hero bar (height 36, r=md)    │ │  hero placeholder
│  │  ▭▭▭▭▭▭▭▭▭▭                                              │ │  sub-caption
│  └──────────────────────────────────────────────────────────┘ │
│  ▭▭▭▭▭▭▭▭  (group label skeleton)                             │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │  ▭▭  ▭▭▭▭▭▭            ▭▭  ▭▭▭▭▭▭                        │ │  2 stat placeholders
│  │  ─────────────────────────────────────────────           │ │
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭                                            │ │  net line
│  └──────────────────────────────────────────────────────────┘ │
│  ▭▭▭▭▭▭▭▭                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │  ▭▭  ▭▭▭▭▭            ▭▭  ▭▭▭▭▭                          │ │  debt/savings stats
│  │  ─────────────────────────────────────────────           │ │
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭  ← progress-bar skeleton         │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▭▭▭▭▭▭▭▭                                                     │
│  ┌────────────────┐  ┌────────────────┐                       │  2 action skeletons
│  ┌────────────────┐  ┌────────────────┐                       │  (r=md)
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Empty (new household — all totals zero, no linked accounts)

The headline still renders in an **onboarding voice** rather than a bare `+$0.00`. Tiers 2–4
collapse into a single friendly setup card so a new household never looks broken. Trigger:
`total_income === 0 && total_expenses === 0 && total_debt === 0 && total_savings_target === 0`.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Partner Dashboard                          ⚙        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating
│  │  The Rivera Household                          ( 👥 2 )   │ │
│  │                                                          │ │
│  │  [ℹ SET UP]                                              │ │  info chip (icon+word)
│  │  You're all set up together — link an account or add a   │ │  body, colors.text
│  │  transaction to see your household come to life.         │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │  primary CTA
│  │  │            Link an account                          │ │ │  primaryGradient
│  │  └────────────────────────────────────────────────────┘ │ │  radius.lg, 44pt
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  single empty card
│  │            [ 🏠 ]  (colors.textDark)                     │ │  (EmptyState-style)
│  │        Nothing to show yet                               │ │  title, colors.text
│  │  Your combined cash flow, debt, and savings fill in      │ │  message, textMuted
│  │  here as money starts moving.                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  QUICK ACTIONS                                                 │  ← actions still shown
│  ┌───────────────┐ ┌───────────────┐  … (2×2, unchanged)      │    (they're the way in)
└──────────────────────────────────────────────────────────────┘
```

### 3.4 Error (load failed — tokenized, non-blanking)

Inline glass card inside the normal scroll (header preserved), not a full replacement.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Partner Dashboard                          ⚙        │  ← header preserved
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glass (NOT floating)
│  │                                                          │ │
│  │              ⚠  (alert-circle-outline, colors.error)     │ │  icon
│  │        Couldn't load your household                      │ │  title, colors.text
│  │   Something went wrong fetching the summary.             │ │  message, textMuted
│  │                                                          │ │
│  │              ┌─────────────────┐                         │ │  Retry text button
│  │              │   Try Again     │                         │ │  primary2 outline,
│  │              └─────────────────┘                         │ │  44pt target
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 Overflow / edge cases

- **Long household name:** `numberOfLines={1}` + ellipsis in the headline title; the member
  badge is `flexShrink: 0` and never truncates.
- **Large hero number** (e.g. `−$128,430.00`): hero uses `typography.h1` with a min-height
  reserve and `adjustsFontSizeToFit` down to ~26 before wrapping; sub-caption wraps to 2 lines.
- **Savings over 100%:** progress bar caps fill at 100% (existing `Math.min` logic kept);
  the `%` label may read `>100%` and its bar tints `colors.success` fully.
- **Solo household (member_count < 2):** partner chips row hides; headline copy switches
  "Together this month" → "This month"; everything else unchanged (graceful degrade).

---

## 4. TIER 1 — Household Headline card (centerpiece)

Folds the old household-header card and the old net-cash-flow line into one floating card —
the answer to "how's our household doing together?"

- **Surface:** `glassEffects.glassFloating` (the ONLY card that floats), `radius.xl`,
  padding `spacing.xl`.
- **Title row:** household name in `typography.h3` `colors.text` (`numberOfLines={1}`) on
  the left; a **member badge** on the right — a `radius.md` chip, fill `` `${colors.primary2}1a` `` (~10%),
  `people` icon in `colors.primary2` + count in `typography.smallBold` `colors.text`. 44pt tall.
- **Context label:** `Together this month` (solo: `This month`) in `typography.caption`
  `colors.textMuted`, `spacing.md` above the hero.
- **Hero number:** combined `net_cash_flow` in `typography.h1` (32/700) — the single largest
  text on screen. Color by sign via `getValueColor()` (positive → `colors.success`, negative
  → `colors.error`), prefixed `+`/`−`. `formatCurrency` from design-system.
- **Sub-caption:** `$6,420 in  −  $4,560 out` in `typography.caption` `colors.textMuted`
  (from `total_income` / `total_expenses`), so the hero is legible without scrolling to Tier 2.
- **Partner chips (couples attribution):** a right-aligned row of up to 2 chips from the
  household members: `◑ Alex` (`colors.primary2`) and `◐ Sam` (`colors.info`), 14px glyph +
  first name in `typography.caption`. Purely decorative/identity; hidden for solo households
  and degrades to nothing if member identities aren't in the summary payload. Mirrors the
  calendar/dashboard partner-glyph rule exactly (A→`primary2`/`◑`, B→`info`/`◐`).

> Rule of thumb (matches dashboard redesign): **only this card floats and only this card
> uses `h1`.** If any lower card competes for "biggest thing on screen," the hierarchy broke.

---

## 5. TIER 2 — Combined Cash Flow (proof)

The income-vs-expense split that *produces* the hero number. Grouped as one `glass` card
under a `COMBINED CASH FLOW` label — evidence, not a co-equal headline.

- **Group label:** `COMBINED CASH FLOW` in `typography.caption` uppercase `colors.textMuted`,
  `spacing.sm` below (matches home dashboard group labels — replaces the old bespoke
  `sectionTitle` with letterSpacing).
- **Card:** `glassEffects.glass` / `commonStyles.card`.
- **Two stat columns** (equal width, `commonStyles.flexRow` + `gap: spacing.md`):

  | Column | Icon (chip) | Chip tint | Label | Value color |
  |---|---|---|---|---|
  | Total Income | `arrow-down-circle-outline` | `` `${colors.success}1a` `` | Total Income | `colors.success` |
  | Total Expenses | `arrow-up-circle-outline` | `` `${colors.error}1a` `` | Total Expenses | `colors.error` |

  Each: 44×44 icon chip (`radius.md`), label `typography.caption` `colors.textMuted`, value
  `typography.bodyBold`.
- **Divider:** `commonStyles.divider` (`colors.borderLight`, `spacing.md` vertical).
- **Net line:** `Net Cash Flow` label `typography.small` `colors.textMuted` + value
  `typography.h3` colored by `getValueColor()` with `+`/`−`. This restates the hero
  intentionally at a smaller weight (proof), not larger.

---

## 6. TIER 3 — Debt & Savings

Structurally the same as today's card, fully tokenized.

- **Group label:** `DEBT & SAVINGS` (`typography.caption` uppercase `colors.textMuted`).
- **Card:** `glassEffects.glass`. Two stat columns:

  | Column | Icon (chip) | Chip tint | Label | Value |
  |---|---|---|---|---|
  | Total Debt | `document-text-outline` | `` `${colors.warning}1a` `` | Total Debt | `colors.text`, `formatCurrency(total_debt)` |
  | Savings Progress | `wallet-outline` | `` `${colors.primary2}1a` `` | Savings Progress | `colors.text`, `savings_progress.toFixed(1)%` |

- **Divider:** `commonStyles.divider`.
- **Savings bar block:**
  - Label row: `Saved` (`typography.caption` `colors.textMuted`) left, `$8,200.00 / $15,000.00`
    (`typography.caption`, current in `colors.text`, `/ target` in `colors.textMuted`) right.
  - Progress bar: track `colors.glassLight`, height `spacing.sm` (8), `radius.full`; fill
    width `Math.min(savings_progress, 100)%`, `colors.primary` (**tokenized** — replaces the
    old `rgba(168,85,247,0.8)`). At ≥100% the fill tints `colors.success` to signal goal met
    (color paired with the visible `%` label — not color-only).

---

## 7. TIER 4 — Quick Actions

Kept as-is functionally (2×2 grid, same four destinations), tokenized and made accessible.

- **Group label:** `QUICK ACTIONS` (`typography.caption` uppercase `colors.textMuted`).
- **Grid:** `flexRow` + `flexWrap`, `gap: spacing.md`, each button `minWidth: 47%`.
- **Action button:** `glassEffects.glass`, `radius.md`, padding `spacing.lg`, centered,
  `gap: spacing.sm`, **min height 64** (icon + label comfortably clears 44pt).
- **Icon:** 28px in `colors.primary2` (tokenized — replaces `#a855f7`).
- **Label:** `typography.smallBold` `colors.text`, centered.
- **Destinations (unchanged):** Add Transaction → `/add-transaction`; View Budgets →
  `/(tabs)/budget`; Savings Goals → `/(tabs)/goals`; My Dashboard → `/(tabs)/dashboard`.
- **Press feedback:** `activeOpacity` press + optional `animation.fast` scale (instant under
  reduce-motion).

---

## 8. Header (standard, matches reference screens)

Same three-slot header pattern as calendar/dashboard redesigns:

```
‹        Partner Dashboard                          ⚙
```

- **Left:** `BackButton` with `fallback="/(tabs)/dashboard"` (unchanged). Icon `colors.text`,
  44pt target.
- **Center:** `Partner Dashboard` in `typography.bodyBold` `colors.text` (kept slim — must
  not compete with the Tier-1 hero; deliberately not `h1`).
- **Right:** `settings-outline` 24px `colors.text` → `/settings` (unchanged). 44pt target.
  In loading state this slot may host the small background-refresh `ActivityIndicator`
  (`colors.primary2`).
- Header uses `commonStyles.header` (marginBottom `spacing.xl`), inside the safe area.

---

## 9. Mapping to design-system tokens (no magic numbers)

Every hardcoded value in `partner-dashboard.tsx` → its token.

| Old hardcoded value | Replace with token |
|---|---|
| gradient `['#0f172a','#1a1040','#0f172a']` (loading, error, main) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `ActivityIndicator color="#a855f7"` | `colors.primary2` |
| income `#22c55e` | `colors.success` |
| expense `#ef4444` | `colors.error` |
| debt `#f59e0b` | `colors.warning` (token is `#eab308`) |
| savings `#8b5cf6` | `colors.primary` |
| accent `#a855f7` (icons, progress, retry) | `colors.primary2` |
| text `#f8fafc` | `colors.text` |
| muted `#94a3b8` | `colors.textMuted` |
| section title `#cbd5e1` (no token) | `colors.textMuted` |
| error text `#ef4444` | `colors.error` |
| card `rgba(255,255,255,0.06)` + `borderRadius:16` + `borderColor rgba(255,255,255,0.08)` | `glassEffects.glass` / `commonStyles.card` |
| headline card | `glassEffects.glassFloating` (only it floats) |
| icon-chip tints `rgba(34,197,94,0.1)` etc. | `` `${semanticToken}1a` `` (~10%) |
| member badge `rgba(168,85,247,0.1)` | `` `${colors.primary2}1a` `` |
| progress fill `rgba(168,85,247,0.8)` | `colors.primary` |
| progress track `rgba(255,255,255,0.08)` | `colors.glassLight` |
| divider `rgba(255,255,255,0.08)` | `colors.borderLight` (via `commonStyles.divider`) |
| retry btn `rgba(168,85,247,0.2)` fill + `#a855f7` border/text | `` `${colors.primary2}33` `` fill, `colors.primary2` border/text |
| `borderRadius: 16 / 12 / 8 / 4` | `radius.lg / md / sm / full` |
| `padding: 20 / 16 / 12 / 8` | `spacing.xl?→lg / lg / md / sm` (screen pad → `spacing.lg`) |
| `marginBottom: 24 / 12`, `marginTop: 20` | `spacing.xl / md / lg` |
| `gap: 16 / 12 / 8` | `spacing.lg / md / sm` |
| title `20/700`, cardTitle `18/700` | `typography.bodyBold` / `typography.h3` |
| statValue `18/700`, netValue `24/800` | `typography.bodyBold` / `typography.h1` (hero) |
| statLabel/subtitle `12–13/normal` | `typography.caption` |
| sectionTitle `14/600` uppercase | `typography.caption` uppercase `colors.textMuted` |
| retryButtonText `14/600` | `typography.smallBold` |
| `formatCurrency` (local `Intl`) | keep, or use `formatCurrency` from `design-system.ts` |

---

## 10. Component reuse

| Shared component | Used for |
|---|---|
| `GradientBackground` (`variant="bgDarkPurple"`) | screen background in **all** states (replaces raw `LinearGradient`) |
| `BackButton` (`fallback="/(tabs)/dashboard"`) | header left, unchanged |
| `Skeleton` / `SkeletonStack` (`components/Skeleton.tsx`) | loading state (§3.2) — headline block, cash-flow card, debt/savings card, action tiles |
| `EmptyState` (`components/EmptyState.tsx`) | the "Nothing to show yet" card in the empty state (§3.3) — pass `icon="home-outline"`, `title`, `message` |
| `ErrorState` (`components/ErrorState.tsx`) | error card (§3.4) if its API fits (`icon` + `title` + `message` + retry); else inline tokenized card |
| `Sparkline` (`components/Sparkline.tsx`) | **optional**, additive — a tiny cash-flow trend under the hero if a monthly-net history is available; degrades to nothing (<2 points) |
| `FloatingActionButton` | **not** used here (Quick Actions grid already covers "add"); keep the screen FAB-free to stay distinct from home dashboard |

No new shared components are required. Do **not** reimplement the gradient, skeleton, back
button, empty, or error primitives.

---

## 11. Accessibility

- **Touch targets:** header BackButton, settings button, member badge, all four action
  tiles, the CTA button, and the Retry button are ≥ 44×44pt (hit-slop where visual height
  is smaller). Action tiles are min-height 64.
- **Color independence:** every semantic signal pairs **color + icon + word/prefix**, never
  color alone:
  - Income/expense: distinct icons (`arrow-down-circle` vs `arrow-up-circle`) **and** labels
    "Total Income"/"Total Expenses" **and** `+`/`−` on the net.
  - Hero sign: `+`/`−` prefix in addition to green/red.
  - Empty-state chip: `ℹ SET UP` (icon + word), not a bare color.
  - Savings goal-met: the `%` label / `>100%` text carries the meaning, not just the green bar.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears WCAG
  AA (4.5:1). Icon-chip tints are backgrounds only; the icon on them stays full-opacity
  semantic color. Do not dim the hero or its sub-caption.
- **Screen-reader order & labels:**
  - Header: back → "Partner Dashboard" title → settings.
  - Headline reads as one summary node: `"The Rivera Household, 2 members. Together this
    month, combined cash flow positive $1,860. $6,420 in, $4,560 out."`
  - Cash-flow card: `"Total income $6,420. Total expenses $4,560. Net cash flow positive $1,860."`
  - Debt & Savings: `"Total debt $18,240. Savings progress 54.7 percent. Saved $8,200 of $15,000."`
  - Action tiles: each is `role="button"`, label = its text ("Add Transaction"), hint
    "Double tap to open."
  - Empty CTA: `role="button"`, label "Link an account."
- **Reduced motion:** action-tile press-scale, skeleton pulse, and any Sparkline draw-in use
  `animation.fast`; under reduce-motion they become instant. (The `Skeleton` pulse is a soft
  opacity loop — acceptable; if the OS reduce-motion flag is set, freeze it at mid-opacity.)
- **Dynamic Type:** hero uses a min-height reserve (not a fixed height) so it reflows;
  household name and sub-caption wrap rather than clip.

---

## 12. Developer notes

- **No new endpoints.** All data already comes from `/auth/households/me` →
  `/auth/households/summary` (`HouseholdSummary`). This is a **re-layout of existing data**
  plus the missing skeleton/empty states.
- **Empty detection:** treat as empty when `total_income`, `total_expenses`, `total_debt`,
  and `total_savings_target` are all `0` (new household). Render the onboarding headline +
  single empty card, but **keep Quick Actions** — they're the way out of empty.
- **Partner chips / attribution:** if the `summary` payload doesn't carry member identities,
  fetch/reuse `householdMembers` as the home dashboard does; if unavailable, omit the chips
  silently (nothing else changes). Glyph mapping is fixed for cross-screen consistency:
  A → `◑`/`colors.primary2`, B → `◐`/`colors.info`, shared/unknown → none.
- **Keep `net_cash_flow` locally derivable** (`total_income − total_expenses`) so the error
  state could optionally still show the hero number instead of blanking (nice-to-have,
  mirrors the home dashboard's graceful-degrade error).
- **Reuse, don't reimplement:** `GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`,
  `ErrorState`, `Sparkline`.
- **Solo household:** if `member_count < 2`, hide partner chips + member badge count reads
  "1", and swap headline copy "Together this month" → "This month".
- **`useFocusEffect` refetch** on focus is kept; on background refresh show the header
  spinner, not the full skeleton (skeleton is first-load only).

---

## 13. Handoff checklist

- [x] Why documented (bespoke gradient/colors/spacing + flat hierarchy + missing states)
- [x] 4-tier hierarchy defined; only the headline floats + uses `h1`
- [x] All states wireframed (default, loading skeleton, empty/new-household, error, overflow)
- [x] Skeleton reuses `components/Skeleton.tsx`; layout-matched (no jump)
- [x] Empty state added (was missing) with onboarding voice + CTA, keeps Quick Actions
- [x] Error state tokenized + non-blanking (header preserved)
- [x] Every hardcoded color/gradient/spacing/font mapped to a design-system token
- [x] Section/component specs implementable directly (surfaces, tints, tokens, states)
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, EmptyState, ErrorState, Sparkline)
- [x] Couples attribution added as additive, graceful-degrade partner chips
- [x] Accessibility: 44pt targets, color-independent status (icon+word+color), SR labels, reduced motion, Dynamic Type
- [x] Component specs written (`docs/design/components/partner-dashboard-*.json`)
```
