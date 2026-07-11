# Accounts Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Route / file:** `accounts` → `budget-app/app/accounts.tsx`
**Archetype:** summary + list (same family as calendar/dashboard)
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke, locally-styled screen currently in `accounts.tsx`

---

## 1. Why this redesign exists

The accounts screen is a good *layout* wearing the wrong *skin*. Structurally it already
does the right things — a net-worth hero, an allocation bar, grouped Assets/Debts sections,
per-account rows, an empty state. The problem is that **none of it uses the design system**,
so it reads as a different app from the two screens that were already migrated
(`dashboard.tsx`, `calendar.tsx`).

Concrete offenders in the current file:

- **Its own background gradient** `['#0f0a1e','#1a1035','#0f0a1e']` via a raw
  `LinearGradient`, instead of the shared `<GradientBackground variant="bgDarkPurple">`
  (`gradients.bgDarkPurple = ['#0f172a','#1a0a40','#0f172a']`). This is the same "subtly
  wrong purple" the dashboard redesign called out — it's the #1 reason the screen looks
  off-brand next to its siblings.
- **A private `TYPE_CONFIG` color palette** (`#60a5fa`, `#f87171`, `#fbbf24`, `#34d399`,
  `#94a3b8`) that duplicates and drifts from `colors.info / error / warning / success /
  textMuted`.
- **Hardcoded status colors** for debt/asset totals (`'#ef4444'`, `'#10b981'`) instead of
  `colors.error` / `colors.success`.
- **Magic numbers everywhere** — `borderRadius: 20`, `padding: 22`, `fontSize: 34`,
  `paddingHorizontal: 20`, ad-hoc `rgba(255,255,255,0.0x)` glass fills — none tokenized.
- **A raw `ActivityIndicator` loading screen** and no error state, while the reference
  screens use `components/Skeleton.tsx` and inline error cards.
- **A hand-rolled header** (`styles.header`, `styles.headerTitle`, a `backBtn` style that
  is defined but unused) instead of the standard `BackButton` + tokenized header row the
  other screens share.

This redesign changes **skin, not skeleton**. Every section below maps 1:1 to something the
screen already renders. We keep it recognizably the same screen — net worth on top,
allocation, grouped account list, sync + hide-balance affordances, link CTA — and only swap
the styling to tokens and the shared components, while making three information-architecture
improvements that clearly help (see §3).

---

## 2. Shared conventions this screen must obey (from calendar/dashboard)

Because this is one screen in a unified app, it adopts the exact patterns the reference
screens established for this archetype:

| Convention | Rule (matches dashboard/calendar) |
|---|---|
| **Background** | `<GradientBackground variant="bgDarkPurple">` wrapping a `SafeAreaView`. Never a local `LinearGradient`. |
| **Header row** | `flexDirection:'row'`, `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`; `BackButton` at left; title in `typography.bodyBold`; right-side icon actions with a background-refresh `ActivityIndicator` (`colors.primary2`) shown only during silent refresh. |
| **Scroll padding** | `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: 120` (clears the FAB / tab bar). |
| **Cards** | `glassEffects.glass` (flat, `radius.lg`) for normal cards; `glassEffects.glassFloating` (`radius.xl` + shadow) reserved for the ONE hero card at top — same "only the headline floats" rule as dashboard. |
| **Group labels** | Uppercase `typography.caption`, `colors.textMuted`, `letterSpacing: 0.6`, `fontWeight:'700'` — identical to `RecentActivity`'s `groupLabel`. |
| **List rows** | icon chip 36×36 `radius.md` tinted `${color}1f` (12% hex-alpha), name in `typography.smallBold` `colors.text`, subtitle in `typography.caption` `colors.textMuted`, right-aligned amount `flexShrink: 0`, row `minHeight: 44`. This is the `RecentActivity` row contract, reused verbatim. |
| **Loading** | `Skeleton` / `SkeletonStack` matching final layout; no full-screen spinner. |
| **Error** | inline glass card with `alert-circle-outline` (`colors.error`) + Retry, never a blank screen. |
| **Partner attribution** | lightweight glyph `◑` (`colors.primary2`) / `◐` (`colors.info`), additive and graceful-degrading — same as dashboard/calendar. |
| **Refresh** | `RefreshControl tintColor={colors.primary2}`. |

---

## 3. Information-architecture improvements (kept minimal, each justified)

The screen keeps every existing capability. Three small IA changes make it read better
without making it a different screen:

1. **Promote net worth from "Net Balance" and add a real trend.** The hero currently shows
   a static "Net Balance" number. The dashboard already computes and snapshots net worth
   with a `Sparkline` in its `TrajectoryStrip`. Accounts is the *canonical* net-worth screen,
   so the hero becomes a **Net Worth** card with an inline `Sparkline` and a delta chip
   (`+2.4% · 30d`) driven by the same `recordNetWorthSnapshot` history the dashboard uses.
   *Why:* it turns a dead number into the "are we building wealth?" answer this screen is
   the home for. Degrades gracefully: <2 snapshots → Sparkline renders its own
   "Collecting…" placeholder, delta chip hidden.
2. **Move the sync/last-synced state out of a footnote and into a status line under the
   hero.** Currently "Last synced …" is a faint line at the very bottom. Surface it as a
   compact, color-independent **freshness chip** (icon + word + relative time) right under
   the hero, so the user trusts the numbers they're reading.
3. **Assets and Debts become two distinct glass cards** instead of two collapsible sections
   inside one card. Grouping into one card blurred the asset/debt boundary; two cards with
   their own group-label header make the "what we own vs. what we owe" split first-class —
   the same solid-vs-outline clarity philosophy the calendar redesign used for
   actual-vs-projected. **Keep the collapse/expand affordance** on each card header (good
   progressive disclosure), defaulting Assets expanded, Debts expanded.

Everything else (hide-balance eye toggle, per-type icons/colors, allocation bar, link CTA,
pull-to-refresh, manual sync) is preserved.

---

## 4. Full-screen wireframe

Default state, balances visible, populated. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Accounts                         (◐ refresh)  (👁)  (⟳)  │  ← BackButton + title + actions
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← HERO (glassFloating, radius.xl)
│  │  NET WORTH                                                 │ │
│  │  $48,210.55                              ╱╲    ╱          │ │  ← h1 amount + Sparkline (right)
│  │  ▲ +2.4%  ·  30d                    ╱  ╲╱  ╲╱             │ │  ← delta chip (success/error) + sparkline
│  │                                                            │ │
│  │  ┌────────────────────────┬────────────────────────────┐  │ │
│  │  │ Assets                 │ Debts                       │  │ │  ← split summary (2 cols)
│  │  │ $61,940  (success)     │ $13,730  (error)            │  │ │
│  │  │ 5 accounts             │ 2 accounts                  │  │ │
│  │  └────────────────────────┴────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│   ✓ Synced 4m ago                                              │  ← freshness chip (icon+word+time)
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← ALLOCATION card (glass)
│  │  ASSET ALLOCATION                                          │ │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░  (segmented bar)         │ │
│  │  ● Cash 62%     ● Investments 33%     ● Other 5%           │ │  ← legend: dot + label + pct
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← ASSETS card (glass)
│  │  ▾  ASSETS · 5                              $61,940.00     │ │  ← collapsible header, total (success)
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ [💳] Everyday Checking            ◑        $4,210.55  │ │ │  ← account row (RecentActivity contract)
│  │  │      Chase · ••4021 · Checking                        │ │ │  ← subtitle: institution · mask · subtype
│  │  ├──────────────────────────────────────────────────────┤ │ │
│  │  │ [📈] Brokerage                             $28,004.00 │ │ │
│  │  │      Fidelity · ••8890 · Investment    $27.9k avail   │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← DEBTS card (glass)
│  │  ▾  DEBTS · 2                               $13,730.00     │ │  ← total (error)
│  │  │ [💳] Sapphire Card                 ◐       $2,130.00  │ │ │
│  │  │      Chase · ••1180 · Credit Card                     │ │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │  ← Link CTA (dashed, primary2)
│  │             ⊕  Link New Account                          │ │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4a. Loading (skeleton — reuse `components/Skeleton.tsx`)

Header renders immediately (static). Body is a skeleton that matches the final layout so
nothing jumps when data lands.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Accounts                                     (👁)  (⟳)  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating shell
│  │  ▨▨▨▨▨▨                                                     │ │  Skeleton w80 h12  (label)
│  │  ▨▨▨▨▨▨▨▨▨▨▨▨▨                       ▨▨▨▨▨▨▨▨               │ │  Skeleton w180 h32 + w100 h44 (sparkline box)
│  │  ┌───────────────────────┬────────────────────────────┐   │ │
│  │  │ ▨▨▨▨   ▨▨▨▨▨▨          │ ▨▨▨▨   ▨▨▨▨▨▨               │   │ │  two skeleton summary cols
│  │  └───────────────────────┴────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │  ▨▨▨▨▨▨  (allocation label)                                │ │
│  │  ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨  (bar, h8)          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ▨▨▨▨▨▨   ▨▨▨▨   (header)                                  │ │
│  │  [▨▨] ▨▨▨▨▨▨▨▨▨▨          ▨▨▨▨▨▨    ← account skel row ×3   │ │
│  │  [▨▨] ▨▨▨▨▨▨              ▨▨▨▨▨▨                            │ │
│  │  [▨▨] ▨▨▨▨▨▨▨▨▨▨          ▨▨▨▨▨▨                            │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton account row (reuse dashboard's exact skel-row shape):
`Skeleton 36×36 radius.md` chip · `Skeleton 60% h12` name over `Skeleton 40% h10` sub ·
`Skeleton 60 h14` amount, wrapped in a `flexDirection:'row'`, `gap: spacing.md` row.

### 4b. Empty (no accounts linked)

Keep the current friendly copy; retokenize it.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Accounts                                     (👁)  (⟳)  │
│                                                                │
│                                                                │
│                        ╭──────────╮                            │
│                        │    🏦     │        ← 80×80 circle,     │
│                        ╰──────────╯           colors.primary2  │
│                                               tint             │
│                  No accounts linked           ← typography.h3  │
│                                               colors.text      │
│         Connect your bank accounts to track balances,         │  ← typography.small
│         spending, and net worth together as a couple.         │    colors.textMuted
│                                                                │
│              ┌──────────────────────────────┐                 │
│              │  ⊕  Link Bank Account         │                 │  ← primaryGradient button
│              └──────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

### 4c. Error (fetch failed, no cached data)

Inline glass card, screen not blanked. Header still interactive so the user can retry via
sync as well.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Accounts                                     (👁)  (⟳)  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glass card
│  │                       ⚠  (colors.error)                    │ │
│  │              Couldn't load your accounts                   │ │  typography.bodyBold
│  │        Check your connection and try again.                │ │  typography.small textMuted
│  │                   [  ⟳  Retry  ]                           │ │  text button, colors.primary2
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4d. Balances hidden (eye toggle off)

Every currency value → `••••••` (`colors.textMuted`); Sparkline still renders (shape isn't
sensitive); delta chip hides its percentage → `▲ ••%`. Allocation bar still renders (ratios
aren't the dollar amounts). This preserves the existing hide-balance privacy feature.

### 4e. Overflow / edge cases

- **Long account name** → `numberOfLines={1}` + ellipsis; amount never truncates
  (`flexShrink: 0`). Same rule as `RecentActivity`.
- **Long institution + subtype subtitle** → single line, ellipsized; mask always shown
  (it's short and identifying).
- **Many accounts** in a section → the section card grows; the whole screen scrolls (no
  inner scroll). Collapse the section to tame very long lists.
- **Only assets, no debts** (or vice-versa) → render only the present card; hero split
  still shows both columns with `$0 · 0 accounts` for the empty side.
- **Single asset type** → allocation card is **hidden** (matches current
  `allocationSegments.length > 1` guard).
- **Negative net worth** → hero amount in `colors.error`, delta chip logic unchanged.

---

## 5. Token mapping — every hardcoded value → design-system token

| Old hardcoded value (in `accounts.tsx`) | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| Hero `['rgba(124,58,237,0.15)','rgba(16,185,129,0.06)']` wash | `glassEffects.glassFloating` surface (drop the custom wash; keep it neutral like dashboard's headline) |
| `TYPE_CONFIG.depository.color '#60a5fa'` | `colors.info` |
| `TYPE_CONFIG.credit.color '#f87171'` | `colors.error` |
| `TYPE_CONFIG.loan.color '#fbbf24'` | `colors.warning` |
| `TYPE_CONFIG.investment.color '#34d399'` | `colors.success` |
| `TYPE_CONFIG.other.color '#94a3b8'` | `colors.textMuted` |
| `TYPE_CONFIG.*.bgColor 'rgba(…,0.12)'` | `` `${typeColor}1f` `` (12% hex-alpha, matches `iconChip` in `RecentActivity`) |
| section total `'#ef4444'` / `'#10b981'` | `colors.error` / `colors.success` |
| account balance `'#ef4444'` / `config.color` | `colors.error` (debt) / type token (asset) |
| hero amount `'#f8fafc'` / `'#f87171'` | `colors.text` / `colors.error` |
| `heroLabel / heroSummaryLabel 'rgba(255,255,255,0.5/0.4)'` | `colors.textMuted` |
| `glassCard 'rgba(255,255,255,0.04)'` + `border 'rgba(255,255,255,0.06)'` | `glassEffects.glass` (`colors.glassLight` + `colors.borderGlass`) |
| `accountCard 'rgba(255,255,255,0.03)'` fill + border | plain row on the card (no per-row fill), `RecentActivity` row contract; divider = `colors.borderLight` |
| `countBadge / subtypeBadge 'rgba(255,255,255,0.06/0.08)'` | `colors.glassMedium` fill, `colors.textMuted` text |
| `addAccountBtn 'rgba(168,85,247,0.3/0.04)'` dashed | `colors.primary2` border (dashed) + `${colors.primary2}0a` fill |
| `syncedText 'rgba(255,255,255,0.2)'` | freshness chip: `colors.textMuted` + `colors.success` check icon |
| `allocationBarTrack 'rgba(255,255,255,0.06)'` | `colors.glassMedium` |
| `legendLabel 'rgba(255,255,255,0.6)'` / `legendPct '#f8fafc'` | `colors.textMuted` / `colors.text` |
| header `'#c084fc'` / `'rgba(255,255,255,0.5)'` icon colors | `colors.primary2` (active) / `colors.textMuted` (idle) |
| `headerTitle '#f8fafc' 20/700` | `typography.bodyBold` + `colors.text` |
| `heroAmount fontSize:34/800` | `typography.h1` (32/700), `colors.text` |
| `heroSummaryValue 17/700` | `typography.bodyBold` |
| `sectionTitle 14/600` | uppercase `typography.caption` group-label (matches `RecentActivity`) |
| `accountName 14/600` | `typography.smallBold` |
| `accountMeta / availableText 11/10` | `typography.caption`, `colors.textMuted` |
| `emptyTitle 20/700` / `emptyText 14` | `typography.h3` / `typography.small` |
| `linkBtn ['#7c3aed','#a855f7']` | `gradients.primaryGradient` |
| `borderRadius: 20 / 16 / 12` | `radius.xl` (hero) / `radius.lg` (cards) / `radius.md` (chips) |
| `padding: 22 / 20 / 16 / 14` | `spacing.xl` (hero) / `spacing.lg` / `spacing.md` |
| `paddingHorizontal: 20` (header/scroll) | `spacing.lg` |
| `ActivityIndicator` full-screen loader | `Skeleton` layout (§4a) |
| `spinAnim` sync rotation | keep, but color `colors.primary2` while active |
| `formatCurrency` (local) | keep local, or use `formatCurrency` from `design-system.ts` |

**Rule:** after this pass, `accounts.tsx` should import `colors, gradients, glassEffects,
spacing, radius, typography` from `design-system.ts` and contain **zero** hex/rgba literals
and **zero** raw numeric spacing/radius/font values.

---

## 6. Section / component specs

Reuse shared components; only two small new sub-components are proposed
(`AccountsHero`, `AccountRow`), both filename-prefixed `accounts-` in
`docs/design/components/`.

### 6.1 Header (reuse pattern, not a new component)

- Row: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`.
- Left: `<BackButton fallback="/(tabs)/dashboard" color={colors.primary2} />`.
  (Current fallback is `/(tabs)/goals`; keep whatever the router history dictates —
  `dashboard` is the canonical parent for the linked-accounts flow. Confirm at implementation.)
- Center: title `Accounts` in `typography.bodyBold`, `colors.text`.
- Right actions (each a 40×40 touch target, `hitSlop` to reach 44):
  - background-refresh `ActivityIndicator` (`colors.primary2`, `size="small"`) — visible
    only while a silent refresh runs (mirrors dashboard).
  - eye toggle: `eye-outline` / `eye-off-outline`, idle `colors.textMuted`, active
    `colors.primary2`. `accessibilityLabel` toggles "Hide balances" / "Show balances".
  - sync: `sync-outline`, rotates while `syncing` (keep `spinAnim`), `colors.primary2`
    while active / `colors.textMuted` idle. Disabled while syncing.

### 6.2 `AccountsHero` (new — `glassFloating`, the ONE floating card)

- Props: `netWorth:number`, `history:number[]` (net-worth snapshots), `deltaPercent:number|null`,
  `deltaDays:number` (default 30), `totalAssets:number`, `assetCount:number`,
  `totalDebts:number`, `debtCount:number`, `balanceVisible:boolean`.
- Layout: `glassEffects.glassFloating`, `padding: spacing.xl`, `radius.xl`.
  - Label `NET WORTH` (uppercase caption group-label).
  - Row: left column = amount in `typography.h1` (`colors.text`, or `colors.error` if <0)
    with a delta chip below (`▲/▼ {deltaPercent}% · {deltaDays}d`, `colors.success`/`colors.error`,
    icon + arrow + word so it's not color-only); right = `<Sparkline values={history}
    width={100} height={44} autoColor />` (renders its own "Collecting…" when <2 points).
  - Split summary: a nested row, `backgroundColor: colors.glassLight`, `radius.md`,
    `padding: spacing.md`, two columns divided by a 1px `colors.borderLight` rule:
    - **Assets**: label caption `colors.textMuted`; value `typography.bodyBold`
      `colors.success`; `{assetCount} accounts` caption.
    - **Debts**: same, value `colors.error`.
  - When `balanceVisible === false`: amounts → `••••••`, delta % → `••%`.
- States: `default`, `loading` (skeleton shell per §4a), `hidden` (masked), `negative`.
- A11y: hero labeled `"Net worth {amount}, {up|down} {pct} percent over {days} days.
  Assets {assets}, debts {debts}."`

### 6.3 Freshness chip (small inline element)

- Icon `checkmark-circle-outline` (`colors.success`) + `Synced {relativeTime}` in
  `typography.caption` `colors.textMuted`.
- If never synced: `time-outline` (`colors.textMuted`) + `Not synced yet`.
- If last sync failed: `alert-circle-outline` (`colors.warning`) + `Sync failed · Retry`
  (tappable → `handleSync`). Status conveyed by icon + word + color (not color alone).
- Sits directly under the hero, left-aligned, `marginTop: spacing.sm`.

### 6.4 `AllocationCard` (retokenize existing `AllocationBar`)

- `glassEffects.glass` card, group-label `ASSET ALLOCATION`.
- Track: `height: 8`, `radius.sm`, `backgroundColor: colors.glassMedium`, segments filled
  with the per-type token color, joined edges rounded only at the two ends (keep current
  logic).
- Legend: wrap row of `dot (8px, type color) + label (caption, colors.textMuted) + pct
  (caption, colors.text, weight 600)`.
- Rendered only when `allocationSegments.length > 1` (unchanged guard).
- A11y: bar has `accessibilityLabel` summarizing all segments, e.g.
  `"Asset allocation: Cash 62 percent, Investments 33 percent, Other 5 percent."`

### 6.5 `AccountSectionCard` (collapsible group — Assets / Debts)

- One `glassEffects.glass` card per group.
- Header (44 min height, `TouchableOpacity`, `activeOpacity: 0.7`):
  - left: chevron `chevron-down`/`chevron-forward` (`colors.textMuted`) + uppercase
    group-label (`ASSETS` / `DEBTS`) + count badge (`colors.glassMedium` pill, caption
    `colors.textMuted`).
  - right: section total in `typography.bodyBold`, `colors.success` (assets) /
    `colors.error` (debts), or `••••••` when hidden.
- Body: list of `AccountRow`, separated by `colors.borderLight` 1px dividers (no per-row
  background — cleaner than current per-row glass fill).
- Collapse state persists in `expandedSection`-style local state; default both expanded.
- A11y: header `accessibilityRole="button"`, label
  `"{group}, {count} accounts, total {amount}, {expanded|collapsed}. Double tap to toggle."`

### 6.6 `AccountRow` (new — implements the `RecentActivity` row contract)

- Props: `name`, `institutionName?`, `mask?`, `subtype?`, `type` (`depository|credit|loan|
  investment|other`), `currentBalance`, `availableBalance?`, `isDebt`, `balanceVisible`,
  `partner?` (`{glyph,color,name}|null`), `onPress?`.
- Layout: row `flexDirection:'row'`, `gap: spacing.md`, `paddingVertical: spacing.sm`,
  `minHeight: 44`.
  - icon chip 36×36 `radius.md`, `backgroundColor: ${typeColor}1f`, Ionicon per type
    (`wallet-outline` cash, `card-outline` credit, `document-text-outline` loan,
    `trending-up-outline` investment, `ellipsis-horizontal-outline` other), tinted
    `typeColor`.
  - middle (`flex:1, minWidth:0`): name `typography.smallBold` `colors.text`
    `numberOfLines={1}`; subtitle `typography.caption` `colors.textMuted` `numberOfLines={1}`
    = `{institution} · ••{mask} · {subtype}` with an optional inline partner glyph
    (`◑`/`◐` in `partner.color`) matching `RecentActivity`.
  - right (`flexShrink:0`, `alignItems:'flex-end'`): balance `typography.smallBold`,
    `colors.error` if debt else `typeColor`; optional `{available} avail` caption in
    `colors.textMuted` when available ≠ current. Masked → `••••••`.
- States: `default`, `pressed` (`activeOpacity: 0.7`), `hidden` (masked).
- A11y: `accessibilityRole="button"`, label
  `"{name}, {subtype} at {institution}, {debt|balance} {amount}{, available X}."`

### 6.7 Link CTA (retokenize existing)

- Dashed border button, `borderColor: colors.primary2`, `backgroundColor: ${colors.primary2}0a`,
  `radius.lg`, `paddingVertical: spacing.md`, `minHeight: 44`. Icon `add-circle-outline`
  (`colors.primary2`) + `Link New Account` in `typography.smallBold` `colors.primary2`.
  Routes to `/link-account` (unchanged).

### 6.8 Empty & Error states

- **Empty**: 80×80 circle `backgroundColor: ${colors.primary2}1a`, `business-outline`
  (`colors.primary2`), title `typography.h3`, body `typography.small` `colors.textMuted`,
  primary button using `gradients.primaryGradient` (`radius.lg`, `paddingVertical: spacing.md`,
  `minHeight: 44`) → `/link-account`.
- **Error**: `glassEffects.glass` card, `alert-circle-outline` (`colors.error`), title
  `typography.bodyBold`, body `typography.small` `colors.textMuted`, text `Retry` button
  (`colors.primary2`, 44 target) → re-`load()`.

---

## 7. Accessibility

- **Touch targets ≥ 44×44:** header icon buttons are 40×40 + `hitSlop` to 44; account rows
  and section headers use `minHeight: 44`; CTA / Retry buttons `minHeight: 44`.
- **Color-independent status:** every status is icon + word + color, never color alone —
  freshness chip (`✓ Synced` / `⚠ Sync failed`), net-worth delta (`▲/▼` arrow + word + %),
  asset-vs-debt (distinct labels `Assets`/`Debts` + section headers, not just green/red),
  account type (distinct icon per type, not just tint). A red/green-blind user still parses
  the whole screen.
- **Screen-reader order:** header → hero (net worth → delta → assets → debts) → freshness →
  allocation summary → Assets header → asset rows → Debts header → debt rows → link CTA.
- **Masked balances:** when hidden, expose `accessibilityLabel="balance hidden"` so VoiceOver
  doesn't read `bullet bullet bullet`.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass; the muted
  captions must clear 4.5:1 — `colors.textMuted (#94a3b8)` on the glass surface passes.
  Do not dim `colors.text` below full opacity for meaningful text; use `textMuted` instead.
- **Reduced motion:** the sync spinner and Skeleton pulse respect reduce-motion — under it,
  the sync icon shows a static "in-progress" state and Skeleton renders at a fixed opacity.
  Collapse/expand uses `animation.fast`; instant under reduce-motion.

---

## 8. Developer notes

- Wrap the screen in `<GradientBackground variant="bgDarkPurple">` → `SafeAreaView`; delete
  the local `LinearGradient` and the unused `backBtn` style.
- Delete the private `TYPE_CONFIG` **colors** but keep its structure — derive color from a
  small map onto `colors.info/error/warning/success/textMuted` and icon from the same map.
  Keep the labels.
- Reuse `components/Skeleton.tsx` for §4a, `components/Sparkline.tsx` for the hero trend,
  `components/BackButton.tsx`, and `<GradientBackground>` — do not re-implement any of them.
- Net-worth history + delta: reuse the dashboard's `recordNetWorthSnapshot(..., 30)` result
  (`snapshots`) and its first-vs-last delta math. If the accounts screen shouldn't *write*
  a snapshot, read the trailing window via the same endpoint; the Sparkline degrades to
  "Collecting…" with <2 points, so a missing history is safe.
- Keep `balanceVisible`, `syncing`/`spinAnim`, `refreshing`, and `expandedSection` state as
  is; they already model the interactions correctly.
- Partner attribution is additive: if the account API doesn't return an owner `user_id`,
  pass `partner={null}` and the glyph simply doesn't render.
- Amounts: keep the local `formatCurrency`/`formatCompact` helpers (they already handle sign
  + compacting), or swap `formatCurrency` for the design-system export — both are fine; do
  not introduce a third formatter.

---

## 9. Handoff checklist

- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] All states designed (default, loading skeleton, empty, error, hidden, overflow)
- [x] Every hardcoded color/gradient/spacing/font mapped to a design-system token (§5)
- [x] Header + list-row + group-label conventions match dashboard/calendar (archetype-consistent)
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, Sparkline)
- [x] Net-worth hero + trend is the single `glassFloating` card ("only the hero floats")
- [x] Accessibility: 44pt targets, color-independent status (icon+word+color), SR order, masked-balance labels, reduced motion
- [x] Component specs written (`docs/design/components/accounts-*.json`)
- [x] Functionality preserved; screen stays recognizably the same
