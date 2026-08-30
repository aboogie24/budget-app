# Investments Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** partially-themed styling in `budget-app/app/investments.tsx`
**Archetype:** list + summary (same family as bills, debts, accounts)

---

## 1. Why this redesign exists

The Investments screen is **already on the theme's doorstep** — it uses
`GradientBackground variant="bgDarkPurple"`, `BackButton`, and several
`design-system` tokens. But it stops halfway, and the gaps are exactly what make
it feel like a lesser screen than the redesigned calendar and dashboard:

1. **Magic numbers everywhere the tokens don't reach.** The summary/holding cards
   hardcode `fontSize: 18 / 16 / 15 / 11`, `fontWeight: '800'`, the ticker badge's
   `rgba(168,85,247,0.18)` fill + `rgba(168,85,247,0.4)` border, `paddingVertical: 3`,
   `borderRadius: 6`, and `marginTop: 60` on the empty state. None of these come
   from the scale. A dashboard/calendar row uses `typography.smallBold` +
   `radius.sm` + `spacing`; this screen invents its own.

2. **No loading skeleton.** It shows a bare `ActivityIndicator` centered at
   `marginTop: 40`. Every redesigned screen replaced spinners with layout-matched
   **`components/Skeleton.tsx`** so the page doesn't jump when data lands. This one
   still spins.

3. **Off-theme error state.** It imports `ErrorState`, which renders through the
   **legacy `useTheme()` / `componentDefaults`** path (hardcoded `#ef4444`, its own
   `GlassCard`) — a *different* theming system from `design-system.ts`. The rest of
   the app now uses an **inline glass error card** with a `Retry` text button.

4. **The header title is undersized and off-scale.** `fontSize: 20, fontWeight: '800'`
   is a bespoke value that matches neither `typography.h3` (24/600, used by section
   titles) nor the standard screen-header pattern. The centered title also fights the
   `BackButton`-left / action-right layout the other list screens use.

5. **Weak information architecture — it's a flat dump of rows.** The screen answers
   "what do I own and what's it worth" but not the two questions an investor actually
   opens this screen for: **"how is the whole portfolio trending"** and **"what am I
   most concentrated in / where's the money."** Holdings are unsorted and ungrouped.

This redesign keeps the screen **recognizably the same** (summary on top, holdings
list below, sync in the header) while (a) finishing the tokenization, (b) adding
skeleton/empty/error parity, and (c) sharpening the IA with a portfolio hero, an
allocation strip, and sorted/grouped holdings.

---

## 2. The core idea — "one portfolio verdict, then the evidence"

Mirror the dashboard's north-star discipline at screen scale. The Investments screen
answers **ONE** question at a glance: **"How is our portfolio doing?"** Everything
below the hero exists to prove or break down that answer.

A strict 4-tier hierarchy, top to bottom, each visually subordinate to the one above:

1. **Portfolio Hero** (centerpiece) — total value + gain/loss + return %, in a
   `glassFloating` card. The only card that floats and the only one using `h1`.
2. **Allocation strip** — a single compact row showing composition by security type
   (Stocks / ETF / Crypto / Cash…), so "where's the money" is answered without
   scrolling. `glass`, condensed.
3. **Holdings list** — the existing per-holding cards, now tokenized, **sorted by
   value descending**, under a `HOLDINGS` group label.
4. *(implicit)* **Sync affordance** — moved into the header action + a "last synced"
   caption under the hero, so refresh is discoverable but never competes for weight.

Rule of thumb for the frontend agent: **only the Portfolio Hero floats and only it
uses `h1`.** If a holding card ever looks as heavy as the hero, hierarchy has broken.

---

## 3. Full-screen wireframe (default / populated)

Household scope, gains positive. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Investments                                     ⟳ Sync   │  ← standard header
│                                                                │     BackButton + action
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Total value                                             │ │  │ TIER 1
│  │                                                          │ │  │ Portfolio Hero
│  │      $48,213.90                                          │ │  │ glassFloating
│  │                                                          │ │  │ (centerpiece, h1)
│  │      ▲ +$6,540.12  ·  +15.7% all time                    │ │  │
│  │  ────────────────────────────────────────────────────   │ │  │
│  │  Invested $41,673.78   ·   ◷ Synced 2h ago               │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ALLOCATION                                                    │  ┐ tier 2 label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 2
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░▒▒▒▒▒▒▒░░░  (stacked bar)     │ │  │ Allocation strip
│  │  ● Stocks 52%   ● ETF 31%   ● Crypto 11%   ● Cash 6%      │ │  │ glass
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  HOLDINGS · 7                                        Value ▾   │  ┐ tier 3 label + sort
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 3
│  │ [AAPL] Apple Inc.                            $12,480.00   │ │  │ Holdings list
│  │  Equity                                                  │ │  │ (glass rows,
│  │  64 shares @ $195.00        ▲ +$2,140.00 (+20.7%)        │ │  │  sorted by value)
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [VTI]  Vanguard Total Stock Market ETF       $9,905.40   │ │  │
│  │  ETF                                                     │ │  │
│  │  38 shares @ $260.67        ▲ +$1,204.40 (+13.8%)        │ │  │
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [ETH]  Ethereum                              $5,312.10   │ │  │
│  │  Cryptocurrency                                          │ │  │
│  │  1.7241 units @ $3,081.00   ▼ −$418.30 (−7.3%)          │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                     ( scrolls ) │
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal; hero → allocation gap is
`spacing.xl` (24); allocation → holdings gap `spacing.lg`; between holding cards
`spacing.md`; group labels (`ALLOCATION`, `HOLDINGS · 7`) are `typography.caption`
uppercase in `colors.textMuted` with `spacing.sm` below.

---

## 4. States

### 4.1 Loading — skeleton (NOT a spinner)

Reuse `components/Skeleton.tsx`. Layout-matched so nothing jumps when data lands:
a tall `glassFloating`-shaped hero skeleton (a wide value bar + a delta line + a
divider + a caption line), a short allocation-bar skeleton, then 3 skeleton holding
rows. Keep a small `ActivityIndicator` (`colors.primary2`) in the header **only** for
background refresh (when `loadedOnce && syncing`).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Investments                                     ⟳        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ▁▁▁▁▁▁▁▁▁▁▁                                              │ │  hero skeleton
│  │  ██████████████████████                (wide value bar)  │ │  (glassFloating shape)
│  │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁                                          │ │
│  │  ────────────────────────────────────────────────────    │ │
│  │  ▁▁▁▁▁▁▁▁▁▁▁▁                                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▁▁▁▁▁▁▁▁  (ALLOCATION label skel)                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ████████████████████████████████████  (bar skeleton)    │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ▁▁▁▁  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁                     ▁▁▁▁▁▁▁         │ │  3× holding skel
│  │       ▁▁▁▁▁▁▁▁                            ▁▁▁▁▁▁▁         │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Empty — no holdings

Keep the current friendly copy and CTA intent; upgrade to a full glass card with a
primary CTA (link a brokerage) so the screen isn't a dead end.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Investments                                     ⟳ Sync   │
│                                                                │
│                    ┌───────────────────────┐                   │
│                    │      ↗ (trending-up)   │                   │  colors.textDark icon
│                    │                        │                   │
│                    │  No investments yet    │                   │  typography.bodyBold
│                    │                        │                   │
│                    │  Link a brokerage to   │                   │  small, textMuted
│                    │  see your holdings and │                   │
│                    │  portfolio value here. │                   │
│                    │                        │                   │
│                    │  [  Link a brokerage ] │                   │  primaryGradient CTA
│                    └───────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

The hero does **not** render its own zeroed `$0.00` in empty state — the empty card
replaces the whole body (no allocation, no list). Avoids a confusing "$0.00 · +0%".

### 4.3 Error — inline glass card (replace legacy `ErrorState`)

Do **not** route through the legacy `ErrorState` (`useTheme`/`componentDefaults`) —
render an inline glass card matching the calendar/dashboard pattern. Keep the header
and hero region; the error card sits where the list would be. If holdings were
previously loaded (a *sync* failed), keep showing the stale hero + list and surface
the error as a thin dismissible banner instead of blanking.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Investments                                     ⟳ Sync   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │   ⚠  Couldn't load your investments                       │ │  alert-circle-outline
│  │                                                          │ │  colors.error
│  │      Check your connection and try again.                │ │  small, textMuted
│  │                                            [ Retry ]     │ │  text button, primary2
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 State matrix

| State | Treatment |
|---|---|
| **Default / populated** | Hero + allocation + sorted holdings, as wireframed. |
| **Loading (first load)** | Skeleton hero + allocation bar + 3 holding rows. No spinner in body. |
| **Refreshing (sync / pull-to-refresh)** | Keep content; small `ActivityIndicator` (`colors.primary2`) in header; sync icon animates. |
| **Empty (no holdings)** | Full glass empty card + `Link a brokerage` CTA. No hero/allocation/list. |
| **Error (initial load failed)** | Inline glass error card in place of the body; `Retry`. |
| **Error (sync failed, data exists)** | Keep stale hero + list; thin dismissible error banner above the list. |
| **Overflow — long security name** | `numberOfLines={1}` + ellipsis on name; value never truncates (`flexShrink: 0`). |
| **Overflow — many holdings** | List scrolls; no cap (unlike calendar day markers). Allocation "Cash 6%"-style legend wraps to a second line ≥ 5 buckets, "+N more" collapse beyond 6. |
| **Missing cost basis** | Holding renders value only; gain/loss line + return chip are **omitted** (not shown as $0/0%). Hero return % is computed only over holdings that *have* cost basis, with an `est.` marker if any are missing (see §7). |
| **Missing ticker** | Ticker badge omitted; fall back to security name or "Unknown" as today. |

---

## 5. Section / component specs

### 5.1 Screen header (standard list-screen header)

Adopt the same header shape the other list screens use — `BackButton` left, title
in the token scale, action right.

- Container: `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`, `marginBottom: spacing.lg`.
- **Left:** `<BackButton fallback="/(tabs)/goals" color={colors.text} />` (unchanged).
- **Title:** "Investments" in **`typography.h3`** (24/600) `colors.text` — replaces the
  bespoke `fontSize: 20, fontWeight: '800'`. Left-aligned next to back button (not
  centered), matching the redesigned screens.
- **Right — Sync action:** a 44×44 tappable icon button.
  - Idle: `sync-outline` in `colors.primary2` (was `colors.accent` — align to primary2, the app's action-accent).
  - Syncing: `sync` in `colors.textMuted`, spun via `animation.medium` rotation loop; disabled.
  - Add `accessibilityLabel="Sync investments"` + `accessibilityState={{ disabled: syncing }}`.

### 5.2 TIER 1 — Portfolio Hero (`InvestmentsPortfolioHero`)

The one card that floats (`glassEffects.glassFloating`, `radius.xl`, `padding: spacing.xl`).

| Element | Value | Token |
|---|---|---|
| Label | `Total value` | `typography.caption`, `colors.textMuted` |
| Hero number | `$48,213.90` (`totalValue`) | `typography.h1` (32/700), `colors.text` |
| Gain/loss + return | `▲ +$6,540.12 · +15.7% all time` | `typography.smallBold`; color via `getValueColor(totalGain)` → `colors.success` / `colors.error` |
| Divider | — | `commonStyles.divider` (`colors.borderLight`) |
| Footer left | `Invested $41,673.78` (`totalCostBasis`) | `typography.caption`, `colors.textMuted` |
| Footer right | `◷ Synced 2h ago` | `typography.caption`, `colors.textMuted`, `time-outline` icon |

- **Direction is color-independent:** gain uses **arrow glyph (▲/▼) + `+`/`−` sign +
  color**, never color alone. Loss shows `▼ −$418.30 · −7.3%`.
- **Return % omission:** if `totalCostBasis <= 0`, drop the `· +15.7% all time`
  segment and the `Invested …` footer (mirrors the current guard `totalCostBasis > 0`).
- **Empty/error:** hero is not rendered in the empty state; in initial-load error it
  is replaced by the error card. During refresh-error it stays with last-known values.
- **Props:** `{ totalValue: number; totalGain: number; gainPercent: number|null; totalCostBasis: number; lastSyncedLabel?: string; loading?: boolean }`.
- **Loading:** renders the skeleton described in §4.1 (self-contained when `loading`).

### 5.3 TIER 2 — Allocation strip (`InvestmentsAllocationStrip`)

A single condensed `glass` card that answers "where's the money."

- **Stacked bar:** full-width, height `spacing.sm` (8), `radius.full`, segments sized
  by each bucket's share of `totalValue`. Track `colors.glassLight`.
- **Buckets** = grouped by `security_type` (normalize: `equity`/`stock` → "Stocks",
  `etf`/`mutual fund` → "ETF/Fund", `cryptocurrency` → "Crypto", `cash`/`money market`
  → "Cash", else "Other"). Sorted by share descending.
- **Segment palette** (fixed, ordered so identity is stable across renders):
  Stocks `colors.primary`, ETF/Fund `colors.primary2`, Crypto `colors.accent`,
  Cash `colors.info`, Other `colors.textMuted`.
- **Legend:** wrap row of chips, each `● {label} {pct}%` — dot in the segment color
  (`typography.caption`), label `colors.textMuted`, pct `colors.text`. The dot pairs
  with the label text so composition is **not color-only**.
- **Degrade:** with a single bucket, render the full bar in that color + one legend
  chip (still useful — confirms "100% Stocks"). Hidden entirely in empty/loading/error.
- **Props:** `{ buckets: { label: string; value: number; color: string }[]; total: number; loading?: boolean }`.

### 5.4 TIER 3 — Holdings list + `HoldingCard`

- **Group label row:** `HOLDINGS · {count}` left (`typography.caption` uppercase,
  `colors.textMuted`); **sort control** right — a small `Value ▾` pill
  (`typography.caption`, `colors.textMuted`, `chevron-down`), 44pt tap target.
  - Sort options: **Value** (default, desc), **Gain %** (desc), **Name** (A–Z).
  - v1 may ship the sort pill **disabled-styled** (forward-compat affordance) if the
    menu isn't built — default sort **by value descending** is applied regardless.
    Note in dev notes. Sorting by value is the single highest-value IA improvement.

- **`HoldingCard`** — the existing card, fully tokenized:

| Element | Current (bespoke) | Redesigned token |
|---|---|---|
| Card shell | `glassEffects.glass` + `padding: spacing.lg` | keep (`commonStyles.card` equivalent), `radius.lg` |
| Ticker badge fill | `rgba(168,85,247,0.18)` | `` `${colors.primary2}2e` `` (~18%) |
| Ticker badge border | `rgba(168,85,247,0.4)` | `` `${colors.primary2}66` `` (~40%) |
| Ticker badge radius | `borderRadius: 6` | `radius.sm` (8) |
| Ticker badge padding | `paddingVertical: 3`, `paddingHorizontal: spacing.sm` | `paddingVertical: spacing.xs`, `paddingHorizontal: spacing.sm` |
| Ticker text | `fontWeight: '800'` + `typography.caption` | `typography.caption` + `fontWeight: '700'`, `colors.accent` |
| Name | `fontWeight: '700', fontSize: 15` | `typography.smallBold`, `colors.text`, `numberOfLines={1}` |
| Type label | `fontSize: 11, textTransform: 'capitalize'` | `typography.caption`, `colors.textMuted`, `textTransform: 'capitalize'` |
| Value | `fontWeight: '800', fontSize: 16` | `typography.bodyBold`, `colors.text`, `flexShrink: 0` |
| Shares detail | `typography.caption`, `colors.textMuted` | keep |
| Gain detail | `typography.caption` + inline `success/error` | `typography.caption`; prefix `▲`/`▼` + `+`/`−`; `getValueColor(gain)` |

- **Card layout tokens:** header row `space-between`, `alignItems: 'flex-start'`;
  detail row `space-between`, `marginTop: spacing.sm`; ticker↔name gap `spacing.sm`.
- **Row height:** naturally ≥ 44pt (two lines + padding). If `onPress` is added (see
  below), the whole card is the 44pt target.
- **Optional deep-link:** wrap the card in a `TouchableOpacity` → holding detail (future).
  Currently there's no per-holding detail route, so ship **non-tappable** and note the
  hook in dev notes. Press feedback (when enabled): scale `0.98` over `animation.fast`.
- **Props:** `{ ticker?: string; name: string; type?: string; value: number; quantity: number; price: number; gain: number|null; gainPercent: number|null; onPress?: () => void }`.

---

## 6. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `investments.tsx`) | Replace with token |
|---|---|
| gradient (already `bgDarkPurple`) | keep `<GradientBackground variant="bgDarkPurple">` |
| header title `fontSize: 20, fontWeight: '800'` | `typography.h3` |
| sync icon `colors.accent` | `colors.primary2` (app action-accent) |
| summary card `glassEffects.glass` + `padding: spacing.lg` | **upgrade to** `glassEffects.glassFloating` (hero earns elevation) |
| summary value `fontSize: 18, fontWeight: '800'` | hero → `typography.h1`; secondary → `typography.bodyBold` |
| summary label | `typography.caption` (keep) |
| summary pct `typography.caption, fontWeight: '700'` | `typography.smallBold` |
| `totalGain >= 0 ? colors.success : colors.error` | keep, via `getValueColor()` helper |
| holding name `fontWeight: '700', fontSize: 15` | `typography.smallBold` |
| holding value `fontWeight: '800', fontSize: 16` | `typography.bodyBold` |
| type text `fontSize: 11` | `typography.caption` |
| ticker badge `rgba(168,85,247,0.18)` fill | `` `${colors.primary2}2e` `` |
| ticker badge `rgba(168,85,247,0.4)` border | `` `${colors.primary2}66` `` |
| ticker badge `borderRadius: 6` | `radius.sm` |
| ticker badge `paddingVertical: 3` | `spacing.xs` |
| detail/gain text ad-hoc | `typography.caption` |
| empty state `marginTop: 60` | `commonStyles.emptyState` (`paddingVertical: 60` centered) |
| empty text `fontSize: 16 / 13` | `typography.bodyBold` / `typography.small` |
| `ActivityIndicator style={{ marginTop: 40 }}` (body loader) | **replace** with `Skeleton` layout (§4.1) |
| `ErrorState` (legacy `useTheme` component) | **replace** with inline glass error card (§4.3) |
| inline gaps `gap: 8`, `marginLeft: spacing.md` | `spacing.sm` / `spacing.md` |
| `paddingBottom: 120` scroll pad | keep (matches dashboard FAB clearance) |

---

## 7. Developer notes

- **This is a re-layout of existing data — no new endpoints.** `fetchInvestmentHoldings()`
  and `syncPlaidInvestments()` stay. `totalValue`, `totalCostBasis`, `totalGain`,
  `gainPercent` are already computed in the current screen; keep that math verbatim.
- **Allocation buckets** are derived client-side by grouping `holdings` on
  `security_type` and summing `institution_value`. Normalize types with a small map
  (see §5.3). No API change.
- **Sort** is a pure client-side `useMemo` over `holdings`. Default `value desc`.
  The sort pill can ship disabled if the menu isn't in scope for v1 — but **always
  apply the default sort**, because an unsorted broker dump is the current weakest point.
- **`lastSyncedLabel`:** derive from the max `price_as_of` across holdings (relative
  time, e.g. "2h ago"); if absent, omit the "Synced …" caption rather than showing "—".
- **Cost-basis honesty:** compute the hero return % only over holdings where
  `cost_basis > 0`. If some holdings lack cost basis, the hero `% all time` is a partial
  figure — append a subtle `est.` marker in `colors.textMuted` and keep the per-holding
  gain line omitted for those rows (never render fabricated `$0.00 (0%)`).
- **Reuse, don't reimplement:** `GradientBackground` (bg), `BackButton` (header),
  `Skeleton` (loading). Do **not** reuse the legacy `ErrorState` — inline the glass
  error card so the screen stays on `design-system.ts`, not `useTheme`.
- **Sync spin:** rotate the `sync` icon with `animation.medium`; under reduce-motion,
  swap the spin for the static `sync` glyph + the header `ActivityIndicator` only.
- **Couples note:** holdings are currently household-level (no per-partner attribution
  in the data), so — unlike dashboard/calendar rows — **no partner glyph** here. If a
  future `user_id`/`account owner` field appears, a lightweight glyph can be added the
  same way (A → `primary2`/`◑`, B → `info`/`◐`, shared → none). Additive, not structural.

---

## 8. Accessibility

- **Touch targets:** sync button, sort pill, and (if enabled) holding cards are all
  ≥ 44×44pt — hit-slop the sync/sort icons whose visual box is smaller.
- **Color independence:** gain/loss is encoded by **arrow (▲/▼) + sign (+/−) + color**
  everywhere (hero and each holding), so red/green is never the sole signal. Allocation
  composition pairs each color segment with a **dot + text label + %** in the legend.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears
  WCAG AA. Semantic colors (`success`/`error`) are used on text/glyphs at full opacity,
  not as low-contrast fills behind text.
- **Screen-reader order & labels:**
  - Hero reads as one node: `"Total portfolio value $48,213.90, up $6,540.12, up
    15.7 percent all time. Invested $41,673.78. Synced 2 hours ago."`
  - Allocation strip: `"Allocation: Stocks 52 percent, E T F 31 percent, Crypto 11
    percent, Cash 6 percent."`
  - Holding row: `"{name}, {type}, value {value}, {up|down} {gain}, {gainPercent}
    percent."` (omit the gain clause when cost basis is missing).
  - Sync button: `accessibilityLabel="Sync investments"`, announces `"Syncing…"` while active.
- **Reduced motion:** skeleton pulse, sync-icon spin, and any card press-scale honor
  reduce-motion → become static/instant.
- **Dynamic Type:** hero number and holding names reflow (no fixed heights that clip);
  hero uses a min-height reserve, values keep `flexShrink: 0` so they never truncate.

---

## 9. Handoff checklist

- [x] Why documented (unfinished tokenization, spinner, legacy ErrorState, weak IA)
- [x] 4-tier hierarchy defined (only hero floats + uses h1)
- [x] Portfolio Hero spec'd with color-independent gain/loss (arrow + sign + color)
- [x] Allocation strip added (composition answered without scrolling, color + label + %)
- [x] Holdings list tokenized + sorted-by-value default; sort affordance forward-compat
- [x] All states designed (default, loading skeleton, empty + CTA, error inline, sync-error banner, overflow, missing cost basis)
- [x] Every old hardcoded value mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Reuses GradientBackground, BackButton, Skeleton; drops legacy ErrorState for inline glass card
- [x] Component specs written (`docs/design/components/investments-*.json`)
```
