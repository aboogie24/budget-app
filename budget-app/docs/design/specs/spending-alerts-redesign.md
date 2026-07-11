# Spending Alerts Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke styling in `budget-app/app/spending-alerts.tsx`
**Route:** `spending-alerts` (pushed detail screen, entered from dashboard / attention items)
**Archetype:** list + settings (health list on top, configurable alert rows below, threshold
picker in a bottom sheet) — must read as the same app as `dashboard.tsx`, `calendar.tsx`, and
the `settings-tab` redesign.

---

## 1. Why this redesign exists

The screen is functional but — exactly like the pre-redesign calendar and settings — it
**fights the design system** instead of using it, so it reads as a slightly different app.

Concrete problems in the current file:

1. **Wrong background.** It uses a bespoke `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>`
   — a purple that is subtly *not* `gradients.bgDarkPurple` (`['#0f172a','#1a0a40','#0f172a']`).
   Side by side with the dashboard or calendar it looks off-hue. It should wrap in the shared
   `<GradientBackground variant="bgDarkPurple">`.
2. **Hardcoded everything.** Colors (`'#f8fafc'`, `'#cbd5e1'`, `'#c084fc'`, `'#eab308'`,
   `'#22c55e'`, `'#ef4444'`, `'#f87171'`, `'#6b7280'`, `'#404854'`), surfaces
   (`'rgba(255,255,255,0.06)'`), borders (`'rgba(255,255,255,0.08)'`), radii (`24 / 16 / 12 / 8`),
   paddings (`16 / 12 / 8 / 4`), and font sizes/weights are all inline literals. Not one token is
   imported. The progress-bar color logic even re-hardcodes `'#ef4444' / '#eab308' / '#22c55e'`
   that already exist as `colors.error / warning / success`.
3. **Weak loading state.** Loading shows a bare centered "Loading alerts..." text — no skeleton,
   so the list pops in and the layout jumps. The reference screens (calendar, settings, dashboard)
   all use `components/Skeleton.tsx` shape-matched placeholders.
4. **Off-theme EmptyState / ErrorState usage.** The screen imports the legacy `EmptyState` /
   `ErrorState` components, which pull from the *other* theme system (`useTheme()` /
   `componentDefaults`) rather than `design-system.ts`. They look close but not identical to the
   inline notice cards used on the redesigned calendar. We standardize on the calendar's inline
   `noticeCard` pattern (tokenized glass card) so all four screens' empty/error states rhyme.
5. **Status conveyed largely by color.** The percent number and progress bar change color
   (green → yellow → red) with no accompanying word or icon for most of the range. Only the
   "Over limit" badge pairs an icon + word. Color-blind users can't read "healthy vs approaching
   vs over" from a bar hue alone. We add an **icon + status word** to every health row.
6. **Bespoke modal chrome.** The threshold picker modal hardcodes `backgroundColor: '#1b1039'`,
   `borderRadius: 24`, and its own option-chip styling — none tokenized, and the sheet color is a
   third purple that matches neither the gradient nor a glass surface.

This redesign is a **re-layout of the exact same data and navigation** — active-alert health
list on top, per-budget alert configuration below, threshold picker in a bottom sheet — fully
tokenized, with a real skeleton, and status made color-independent. It stays recognizably the
same Spending Alerts screen.

### What we deliberately preserve (functionality is not changed)

- The two logical sections: **Budget Health** (read-only, from `checkBudgetThresholds()`) and
  **Configure Alerts** (interactive, from `fetchSpendingAlerts()`).
- Per-config **enable/disable Switch** and **threshold %** button → bottom-sheet picker with
  options `[50, 60, 70, 80, 90]`, persisting via `upsertSpendingAlert(budgetId, threshold, enabled)`.
- Pull-to-refresh, the `updatingBudgetId` in-flight disable, and error capture.
- `BackButton fallback="/(tabs)/dashboard"` header (this is a *pushed* screen, not a tab root — so
  it keeps the BackButton, unlike the settings tab).
- Empty state when no budgets are configured; the "Over limit" badge on breached budgets.

### One small IA improvement (keeps it the same screen)

The current header is a bare centered title with no context — the screen never tells the couple
"how many budgets are in trouble right now." We add a **single-line health summary strip** under
the header (e.g. `2 of 5 budgets near or over limit`) driven off the already-loaded
`activeAlerts`. It is a derived read of existing data — no new API — and gives the list a headline
the way the calendar's summary header and settings' group labels orient those screens. If the
frontend prefers to ship without it in v1, every row spec below is unchanged.

---

## 2. The screen at a glance — header + two grouped sections on `bgDarkPurple`

The whole screen is one vertical scroll under a standard pushed-screen header, on the shared
gradient. The visual vocabulary matches the reference screens exactly:

| Element | Treatment | Token |
|---|---|---|
| Background | shared gradient | `<GradientBackground variant="bgDarkPurple">` |
| Header | BackButton + centered title + spacer (pushed-screen pattern) | `typography.bodyBold`, `colors.text` |
| Health summary strip | one derived status line under header | `typography.small`, icon + word + color |
| Section label | uppercase caption above each section | `typography.caption`, `colors.textMuted` |
| Health card | flat glass card w/ progress bar + status word | `glassEffects.glass`, `radius.lg` |
| Config row | glass row: name/limit + threshold pill + Switch, ≥44pt | `glassEffects.glass`, `radius.lg` |
| Threshold picker | bottom sheet on a glass surface | `glassEffects.glassStrong`, `radius.xxl` top |
| Empty / error / loading | inline notice cards + skeleton | matches calendar `noticeCard` |

Nothing floats — like the settings list, this screen has no single hero, so all cards are flat
`glass`; hierarchy comes from section labels + spacing, not elevation.

---

## 3. Wireframes — all required states

iPhone 15 Pro (390×844). Screen padding `spacing.lg` (16) horizontal; section label →
`spacing.sm` below → card; `spacing.xl` gap between sections; `spacing.md` gap between cards
within a section.

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Spending Alerts                        (spacer)│  ← BackButton + title
│                                                                │
│  ⚠ 2 of 5 budgets near or over limit                          │  ← health summary strip
│                                                                │     (icon + word + color)
│  BUDGET HEALTH                                                 │  ┐ section label (caption)
│  ┌──────────────────────────────────────────────────────────┐ │  │ HealthCard (over)
│  │ Groceries                          ⛔ Over   112%         │ │  │ status word + icon + %
│  │ ████████████████████████████████████████████░░           │ │  │ progress bar (error)
│  │ $448.00 of $400.00              [⚠ Over limit]           │ │  │ amount + breach badge
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │ HealthCard (approaching)
│  │ Dining Out                         ⚠ Nearing  84%        │ │  │
│  │ ██████████████████████████████████░░░░░░░░░░░░           │ │  │ progress bar (warning)
│  │ $252.00 of $300.00                                       │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl
│  CONFIGURE ALERTS                                              │  ┐ section label
│  ┌──────────────────────────────────────────────────────────┐ │  │ ConfigRow ×N
│  │ Groceries                                                │ │  │ name + limit
│  │ Limit: $400.00                          [ 80% ]  (•—)    │ │  │ threshold pill + Switch
│  │──────────────────────────────────────────────────────────│ │  │ hairline divider
│  │ Dining Out                                               │ │  │
│  │ Limit: $300.00                          [ 70% ]  (•—)    │ │  │
│  │──────────────────────────────────────────────────────────│ │  │
│  │ Subscriptions                                            │ │  │
│  │ Limit: $60.00                           [ 90% ]  (—•)    │ │  │ disabled: Switch off
│  └──────────────────────────────────────────────────────────┘ │  ┘
└──────────────────────────────────────────────────────────────┘
```

Notes:
- **Health cards** only render for budgets returned by `checkBudgetThresholds()` (budgets at/over
  their threshold). If none are near/over, the whole Budget Health section collapses to a single
  positive strip (see §3.5). This mirrors current behavior (`hasActiveAlerts`).
- **Config rows** are grouped into **one** glass card with hairline dividers between rows (like
  the settings groups), rather than each row being its own floating card as today. This tightens
  the settings feel and removes the current `marginBottom` gaps between identical rows.

### 3.2 Threshold picker (bottom sheet)

Slide-up sheet, `glassEffects.glassStrong` surface with `radius.xxl` (24) top corners, over a
`rgba(0,0,0,0.5)` scrim. Tapping an option persists immediately and dismisses (current behavior);
the current selection is filled purple.

```
                    ░░░░░░░ scrim (rgba(0,0,0,0.5)) ░░░░░░░
┌──────────────────────────────────────────────────────────────┐
│  ╶╶╶╶╶  (grab handle, colors.borderGlass)                     │
│                                                                │
│  Alert threshold — Groceries                            [✕]   │  ← title + close (44pt)
│  Alert me when spending reaches:                              │  ← subtitle, textMuted
│                                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐                             │
│  │  50%   │ │  60%   │ │  70%   │                             │  ← option chips (grid)
│  └────────┘ └────────┘ └────────┘                             │
│  ┌────────┐ ┌────────┐                                        │
│  │ [80%]  │ │  90%   │                                        │  ← [80%] = selected (filled)
│  └────────┘ └────────┘                                        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                       Done                                 │ │  ← primary CTA
│  └──────────────────────────────────────────────────────────┘ │  primaryGradient
└──────────────────────────────────────────────────────────────┘
```

Improvement: the sheet title now names the budget being edited (`Alert threshold — Groceries`)
so the user knows which row they're configuring — the current modal just says "Alert Threshold"
with no context.

### 3.3 Loading (skeleton — reuse `components/Skeleton.tsx`)

Cold load, before `checkBudgetThresholds()` + `fetchSpendingAlerts()` resolve. The header + title
render immediately (static). The summary strip, both section labels, and shape-matched card/row
skeletons stand in. Layout is shape-matched so nothing jumps when data arrives.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Spending Alerts                        (spacer)│  ← real, static
│                                                                │
│  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭  (summary strip skeleton, 60%×16)          │
│                                                                │
│  ▭▭▭▭▭  (section label skeleton, 90×10)                       │
│  ┌──────────────────────────────────────────────────────────┐ │  2 health-card skeletons
│  │  ▭▭▭▭▭▭▭▭                            ▭▭▭▭                 │ │  height ~92, radius.lg
│  │  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                          │ │  bar line
│  │  ▭▭▭▭▭▭▭▭▭▭                                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▭▭▭▭▭  (section label skeleton)                              │
│  ┌──────────────────────────────────────────────────────────┐ │  3 config-row skeletons
│  │  ▭▭▭▭▭▭▭▭▭▭                          ▭▭▭   ▢▢▢▢          │ │  in one card, dividers
│  │  ▭▭▭▭▭▭▭▭                            ▭▭▭   ▢▢▢▢          │ │  pill + switch shapes
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭                        ▭▭▭   ▢▢▢▢          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton primitives (from `components/Skeleton.tsx`): summary strip `Skeleton height={16}
width="60%"`; section label `Skeleton width={90} height={10}`; health card `Skeleton height={92}
borderRadius={radius.lg}` (or a composed card: title line 40%, bar line 100%×8, amount line 50%);
config row title `Skeleton height={12} width="55%"`, subtitle `height={10} width="35%"`, threshold
pill `Skeleton width={44} height={24} borderRadius={radius.sm}`, switch `Skeleton width={44}
height={26} borderRadius={radius.full}`. Reuse `SkeletonStack` for the config-row group if
convenient. This is the same skeleton-row recipe used in the settings + dashboard redesigns, so
the screens' loading states rhyme.

`showSkeleton = loading && activeAlerts.length === 0 && alertConfigs.length === 0` — on
pull-to-refresh with data already present, keep the existing content and show a small
`ActivityIndicator` in the header instead (matching calendar's `loading && loadedOnce` pattern),
so a refresh doesn't blank the list.

### 3.4 Empty (no budgets configured)

Solo user or a household that hasn't created a shared budget yet. `alertConfigs.length === 0`.
Replaces the legacy `EmptyState` component with the tokenized inline `noticeCard` pattern from the
calendar redesign, so it matches exactly.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Spending Alerts                        (spacer)│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  noticeCard (glass, centered)
│  │                    [🔕]                                    │ │  notifications-off-outline
│  │             No alerts configured                          │ │  bodyBold, colors.text
│  │   Create a shared budget with your partner to get         │ │  small, colors.textMuted
│  │   alerts before you overspend.                            │ │
│  │        ┌────────────────────────────────┐                 │ │  primary CTA
│  │        │        Set up a budget          │                 │ │  primaryGradient → /(tabs)/budget
│  │        └────────────────────────────────┘                 │ │  radius.md
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Improvement over current copy: a **CTA button** that routes to `/(tabs)/budget` so the empty state
is actionable, not a dead end — matching the calendar empty-month card's "Add a transaction" CTA.

### 3.5 All-healthy (budgets configured, none near/over)

`alertConfigs.length > 0` but `activeAlerts.length === 0`. The Budget Health section collapses to
a single positive strip instead of an empty section; Configure Alerts renders normally below.

```
│  BUDGET HEALTH                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │  glass, success-tinted
│  │  ✅  All budgets on track                                 │ │  checkmark-circle, colors.success
│  │      You're under every threshold this month.            │ │  small, colors.textMuted
│  └──────────────────────────────────────────────────────────┘ │
```

### 3.6 Error (a load failed)

`error` set and no data. Do **not** blank the screen if any data is already present — show the
inline notice strip. Replaces the legacy `ErrorState` component with the calendar's tokenized
`noticeCard`:

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Spending Alerts                        (spacer)│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  noticeCard (glass, centered)
│  │              ⚠  (alert-circle-outline, error)             │ │
│  │           Couldn't load your alerts                       │ │  bodyBold, colors.text
│  │                    Retry                                  │ │  colors.primary2 text button
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

An action that fails mid-flight (toggle / threshold change) surfaces the same `error` string; if
content is already on screen, show it as a thin inline strip **above** the section that failed
rather than replacing the whole screen — the list stays visible.

### 3.7 Overflow / edge cases

- **Long budget name:** `numberOfLines={1}` + ellipsis on name; the threshold pill, Switch, and
  percent never truncate (`flexShrink: 0`).
- **Percent > 100%:** progress bar fill caps at 100% width (existing `Math.min`), status word
  reads `Over`, the raw percent still shows numerically (e.g. `112%`) so the overage is legible.
- **Many budgets:** the whole screen scrolls; no inner scroll views. Config rows stay in one card
  regardless of count.
- **Disabled alert:** a config row whose alert `is_enabled === false` still shows its threshold
  pill and Switch (off); the row is not greyed — it's simply toggled off, and can still be
  re-enabled.
- **In-flight (`updatingBudgetId`):** the row's Switch + threshold pill disable and the pill shows
  a tiny `ActivityIndicator` in place of the `%` (matching AttentionCard's busy pattern) until the
  refresh completes.

---

## 4. Header — standard pushed-screen row

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Spending Alerts                        (spacer)│
└──────────────────────────────────────────────────────────────┘
```

- **Keeps `BackButton`** with `fallback="/(tabs)/dashboard"` — this is a *pushed* detail screen
  (reached from dashboard/attention), so unlike the settings **tab** it has a back affordance.
  Use the shared `BackButton` component as-is (`iconName="chevron-back"` is fine to keep).
- **Title** `Spending Alerts` centered, `typography.bodyBold` `colors.text`.
- **Right spacer** `width: 40` to balance the BackButton's 40pt target and keep the title centered
  (current code uses `width: 24`; bump to 40 to match the BackButton footprint).
- On background refresh, a small `ActivityIndicator` (`colors.primary2`) may occupy the right slot
  in place of the spacer.
- Header metrics: `paddingHorizontal: spacing.lg`, `marginBottom: spacing.md` (before the summary
  strip). `RefreshControl tintColor={colors.primary2}` (keep current, but token the color).

---

## 5. Component specs

### 5.1 `AlertHealthSummary` (new, derived — the headline strip)

One line under the header summarizing how many budgets need attention. Pure derived read of
`activeAlerts` — no new data.

- **Layout:** row, `gap: spacing.xs`, `marginBottom: spacing.lg`. Leading icon + text.
- **Content logic:**
  - `overCount = activeAlerts.filter(a => a.percent_used >= 100).length`
  - `nearCount = activeAlerts.length` (all returned rows are at/over threshold)
  - If `nearCount === 0` → icon `checkmark-circle`, `colors.success`, text
    `All budgets on track` (this strip stands in for the whole Health section per §3.5).
  - Else → icon `warning`, `colors.warning` (or `colors.error` if `overCount > 0`), text
    `{nearCount} of {totalBudgets} budgets near or over limit`.
- **Tokens:** icon + `typography.small` `colors.text` for the count, matching color on the icon
  and the leading number only.
- **A11y:** the icon + the words "near or over limit" carry the meaning, not color alone.

### 5.2 `BudgetHealthCard`

Read-only card for one budget at/over its threshold. Replaces the current `alertCard`.

- **Props:** `{ budgetName: string; spentAmount: number; budgetAmount: number; percentUsed:
  number; thresholdPercent: number; overThreshold: boolean }`.
- **Layout:** `glassEffects.glass`, `padding: spacing.lg`, `radius.lg`, `marginBottom: spacing.md`.
  Three stacked rows:
  1. Name (left, `numberOfLines={1}`) — status chip + percent (right).
  2. Progress bar (full width, `height: 8`, `radius.sm`, track `colors.glassMedium`).
  3. `{spent} of {budget}` (left, `typography.caption`, `colors.textMuted`) — `[⚠ Over limit]`
     badge (right, only if `overThreshold`).
- **Status tiers (drives bar color + status word + icon — the color-independence fix):**

  | Tier | Condition | Word | Icon | Color token |
  |---|---|---|---|---|
  | Over | `percentUsed >= 100` | `Over` | `alert-circle` | `colors.error` |
  | Nearing | `percentUsed >= thresholdPercent` | `Nearing` | `warning` | `colors.warning` |
  | Watch | `percentUsed >= 60` | `Watch` | `eye-outline` | `colors.warning` |
  | Healthy | else | `On track` | `checkmark-circle` | `colors.success` |

  (This preserves the current `getProgressBarColor` breakpoints — `>=100` red, `>=threshold`
  yellow, `>=60` yellow, else green — but now attaches a **word + icon** to each so status is
  never color-only. The status chip sits inline before the percent: `⚠ Nearing  84%`.)
- **States:** default (as above); the percent + bar animate on mount via `animation.medium`,
  respecting reduced motion (see §6). No pressed state — it's read-only.
- **Tokens:** name `typography.bodyBold` `colors.text` (was `#f8fafc`/15/700); percent
  `typography.bodyBold` fontWeight 800 in the tier color (was `#…`/16/800); amount
  `typography.caption` `colors.textMuted`; badge bg `${colors.error}22`, text `colors.error`.

### 5.3 `AlertConfigRow`

One configurable alert inside the shared Configure Alerts card. Replaces the current standalone
`configCard`. Rows live in **one** glass card separated by hairline dividers (`colors.borderLight`).

- **Props:** `{ budgetName: string; budgetAmount: number; thresholdPercent: number; isEnabled:
  boolean; isUpdating: boolean; onPressThreshold: () => void; onToggle: () => void; showDivider:
  boolean }`.
- **Layout:** row, `alignItems: center`, `gap: spacing.md`, `minHeight: 56` (≥44pt target),
  `paddingVertical: spacing.md`. Left column (flex 1): name (`typography.bodyBold` `colors.text`,
  `numberOfLines={1}`) over `Limit: {formatCurrency}` (`typography.caption` `colors.textMuted`).
  Trailing: **threshold pill** then **Switch**.
- **Threshold pill:** tappable, `paddingHorizontal: spacing.md`, `paddingVertical: spacing.sm`,
  `radius.sm`, bg `${colors.primary2}26` (~15%), border `${colors.primary2}4d` (~30%), text
  `{thresholdPercent}%` in `colors.primary2` `typography.smallBold`. Min touch target 44×44 (pad
  hitSlop if the visual pill is shorter). While `isUpdating`, replace the `%` with a small
  `ActivityIndicator color={colors.primary2}` and disable.
- **Switch:** `trackColor={{ false: colors.border, true: `${colors.primary2}40` }}`,
  `thumbColor={isEnabled ? colors.primary2 : colors.textMuted}`. Disabled while `isUpdating`.
- **Divider:** `showDivider && { borderTopWidth: 1, borderTopColor: colors.borderLight }` on all
  rows after the first (mirrors AttentionCard's `rowDivider`).
- **A11y:** the pill has `accessibilityRole="button"`, label `Alert threshold for {name}, currently
  {threshold}%`; the Switch has `accessibilityRole="switch"`, label `Spending alert for {name}`,
  and `accessibilityState={{ checked: isEnabled }}`.

### 5.4 `ThresholdPickerSheet`

Bottom-sheet picker for choosing a threshold. Replaces the bespoke modal.

- **Props:** `{ visible: boolean; budgetName?: string; current?: number; options: number[];
  onSelect: (n) => void; onClose: () => void }`.
- **Presentation:** RN `Modal` `animationType="slide"` `transparent`; overlay
  `rgba(0,0,0,0.5)`, content pinned bottom. Sheet: `glassEffects.glassStrong` on a solid
  `colors.surface2` base (so it reads opaque over the scrim, not see-through), top corners
  `radius.xxl` (24), `paddingHorizontal: spacing.lg`, `paddingTop: spacing.md`, `paddingBottom:
  spacing.xxl` (safe-area padded). Grab handle: 36×4, `radius.full`, `colors.borderGlass`, centered.
- **Title row:** `Alert threshold — {budgetName}` (`typography.bodyBold` `colors.text`,
  `numberOfLines={1}`) + close button (`close`, 24, `colors.textMuted`, 44pt target).
- **Subtitle:** `Alert me when spending reaches:` `typography.small` `colors.textMuted`.
- **Option grid:** wrap row, `gap: spacing.md`, each chip `minWidth: 30%`, `paddingVertical:
  spacing.lg`, `radius.md`, centered `{n}%` `typography.bodyBold`. Default: bg `colors.glassLight`,
  border `colors.borderGlass`, text `colors.textMuted`. Selected (`n === current`): bg
  `${colors.primary2}33`, border `colors.primary2`, text `colors.primary2`.
- **Done CTA:** full-width, `gradients.primaryGradient` (LinearGradient), `radius.md`,
  `paddingVertical: spacing.md`, white `typography.button` label. Tapping an option persists +
  auto-dismisses (current behavior); Done is the explicit dismiss.
- **A11y:** each option `accessibilityRole="button"`, `accessibilityState={{ selected: n ===
  current }}`, label `{n} percent`; sheet uses `onRequestClose` for the Android back gesture.

---

## 6. Accessibility

- **Touch targets:** BackButton (40×40 + hitSlop), close button, threshold pill, Switch, and each
  option chip are ≥44×44pt. Config rows are ≥56pt tall. Pad any visually-shorter control's hitSlop
  to reach 44.
- **Color independence — the key fix:** budget health status is encoded by **status word + icon +
  color** (`⛔ Over`, `⚠ Nearing`, `👁 Watch`, `✅ On track`) plus the numeric percent and the
  `Over limit` badge, never by bar/number hue alone. The summary strip likewise pairs its icon +
  words with color. This passes for color-blind users.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` / `colors.textDark` on dark glass
  (WCAG AA verified in the reference screens). Status words on their tint backgrounds (e.g.
  `colors.error` on `${colors.error}22`) must clear 4.5:1 for the small text — if a tier's text on
  its own tint is borderline, render the word in `colors.text` and keep the color only on the icon.
- **Screen-reader order:** header (back, title) → summary strip → Budget Health cards top-to-bottom
  (each: `{name}, {status word}, {percent} percent, {spent} of {budget}{, over limit}`) → Configure
  Alerts rows (each: name + limit, then threshold button, then switch). In the sheet: title →
  subtitle → options → Done.
- **Reduced motion:** the health bar/percent mount animation (`animation.medium`) and the sheet
  slide use the tokened easings; under `AccessibilityInfo.isReduceMotionEnabled`, render the bar at
  final width instantly and present the sheet without the slide (fade or immediate). The pulsing
  `Skeleton` already respects nothing special — it's a subtle opacity loop; if reduce-motion is on,
  render skeletons at static mid-opacity.

---

## 7. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `headerTitle` `'#f8fafc'` / 20 / 700 | `colors.text` + `typography.bodyBold` |
| header spacer `width: 24` | `width: 40` (match BackButton footprint) |
| `sectionTitle` `'#cbd5e1'` / 14 / 700 | `colors.textMuted` + `typography.caption` (uppercase, letterSpacing) |
| `alertCard` / `configCard` bg `'rgba(255,255,255,0.06)'` | `glassEffects.glass` (`colors.glassLight`) |
| card border `'rgba(255,255,255,0.08)'` | `colors.borderGlass` |
| card `borderRadius: 16` | `radius.lg` |
| card `padding: 16`, gaps `12` | `spacing.lg`, `spacing.md` |
| `budgetName` / `configBudgetName` `'#f8fafc'` / 15 / 700 | `colors.text` + `typography.bodyBold` |
| `percentText` 16 / 800 | `typography.bodyBold` fontWeight 800, color = tier color |
| `getProgressBarColor` returns `'#ef4444'` | `colors.error` |
| `getProgressBarColor` returns `'#eab308'` | `colors.warning` |
| `getProgressBarColor` returns `'#22c55e'` | `colors.success` |
| `progressBarContainer` bg `'rgba(255,255,255,0.08)'`, `height: 8`, `radius: 4` | `colors.glassMedium`, `height: 8`, `radius.sm` |
| `amountText` / `configAmountText` `'#cbd5e1'` / 12 | `colors.textMuted` + `typography.caption` |
| `warningBadge` bg `'#ef444433'` | `${colors.error}22` |
| `warningText` `'#f87171'` / 11 | `colors.error` + `typography.caption` |
| `thresholdButton` bg `'rgba(192,132,252,0.15)'`, border `'rgba(192,132,252,0.3)'`, `radius: 8` | `${colors.primary2}26`, `${colors.primary2}4d`, `radius.sm` |
| `thresholdText` `'#c084fc'` / 13 / 700 | `colors.primary2` + `typography.smallBold` |
| Switch `trackColor` `'#404854'` / `'#c084fc40'` | `colors.border` / `${colors.primary2}40` |
| Switch `thumbColor` `'#c084fc'` / `'#6b7280'` | `colors.primary2` / `colors.textMuted` |
| `loadingText` `'#cbd5e1'` / 16 | replaced by `Skeleton` (see §3.3) |
| legacy `<EmptyState>` (other theme system) | tokenized `noticeCard` (calendar pattern) + CTA |
| legacy `<ErrorState>` (other theme system) | tokenized `noticeCard` + `colors.primary2` Retry |
| `modalContent` bg `'#1b1039'`, `radius: 24` | `glassEffects.glassStrong` on `colors.surface2`, `radius.xxl` top |
| `modalOverlay` `'rgba(0,0,0,0.5)'` | keep value; it's a standard scrim (or `colors` alpha helper) |
| `modalTitle` `'#f8fafc'` / 18 / 700 | `colors.text` + `typography.bodyBold` |
| `modalSubtitle` `'#cbd5e1'` / 14 | `colors.textMuted` + `typography.small` |
| `modalHeader` close `'#e5e7eb'` | `colors.textMuted` |
| `thresholdOption` bg `'rgba(255,255,255,0.06)'`, border `'rgba(255,255,255,0.08)'`, `radius: 12` | `colors.glassLight`, `colors.borderGlass`, `radius.md` |
| `thresholdOptionActive` bg `'rgba(192,132,252,0.2)'`, border `'#c084fc'` | `${colors.primary2}33`, `colors.primary2` |
| `thresholdOptionText` `'#cbd5e1'` / 16 / 700 | `colors.textMuted` + `typography.bodyBold` |
| `thresholdOptionTextActive` `'#c084fc'` | `colors.primary2` |
| `modalCloseButton` bg `'#c084fc'`, `radius: 12` | `gradients.primaryGradient` LinearGradient, `radius.md` |
| `modalCloseButtonText` `'#fff'` / 16 / 700 | white + `typography.button` |
| `RefreshControl tintColor="#c084fc"` | `colors.primary2` |
| unused `errorCard` / `retryButton` / `emptyState*` styles | delete (dead code once notice cards adopted) |

---

## 8. Developer notes

- **Reuse, don't rebuild:** `GradientBackground` (variant `bgDarkPurple`), `Skeleton` /
  `SkeletonStack`, and `BackButton` are shared components — import them. Do **not** re-implement the
  gradient wrapper or a local loading text.
- **Drop the legacy `EmptyState` / `ErrorState` imports** for this screen. They pull from the
  `useTheme()` / `componentDefaults` theme, which is a *different* system from `design-system.ts`
  and produces subtly off visuals vs. the redesigned calendar. Use the inline tokenized
  `noticeCard` pattern (copyable from `calendar.tsx` styles) instead, so all four screens match.
- **Status tiers are one helper:** replace `getProgressBarColor(percent, threshold)` with a single
  `getHealthTier(percent, threshold) => { word, icon, color }` and drive the bar color, status
  chip word, and icon all off it — one source of truth, guaranteeing color + word + icon never
  disagree.
- **`formatCurrency`:** keep the existing `toLocaleString` currency formatter (it already matches
  the app); you may also use `design-system`'s `formatCurrency` for parity with other screens —
  pick one and be consistent within the file.
- **Skeleton gate:** `showSkeleton = loading && activeAlerts.length === 0 && alertConfigs.length ===
  0`. On refresh-with-data, show a header `ActivityIndicator` and keep content mounted (calendar's
  `loading && loadedOnce` pattern) so pull-to-refresh doesn't blank the list.
- **Config rows in one card:** render the `Configure Alerts` list as a single `glass` card with
  `AlertConfigRow`s separated by `colors.borderLight` dividers (last row no divider) — not N
  separate cards. This is the settings-group convention and removes the current inter-row gaps.
- **`ProgressRing` / `Sparkline` / `AttentionCard`** are available but **not** a fit here: health is
  a linear budget-vs-limit bar (ring implies a goal %, sparkline implies a time series, AttentionCard
  is the dashboard's action list). A simple tokenized progress bar is the right primitive; don't
  force a shared component that changes the meaning. (Noted per brief — evaluated and deliberately
  not used.)
- **The health summary strip and CTA** are additive; if the frontend ships v1 without them, no row
  spec changes — they degrade gracefully.

---

## 9. Handoff checklist

- [x] All states designed (default, threshold sheet, loading skeleton, empty, all-healthy, error, overflow)
- [x] Bespoke gradient swapped for `<GradientBackground variant="bgDarkPurple">`
- [x] Every old hardcoded color / gradient / radius / spacing / font mapped to a token (§7)
- [x] Loading uses `components/Skeleton.tsx`, shape-matched, gated to not blank on refresh
- [x] Legacy `EmptyState`/`ErrorState` replaced with tokenized notice cards matching the calendar
- [x] Status made color-independent (word + icon + color) across health cards and summary strip
- [x] Component specs written (`AlertHealthSummary`, `BudgetHealthCard`, `AlertConfigRow`, `ThresholdPickerSheet`)
- [x] Accessibility: 44pt targets, color-independent status, SR order, reduced motion
- [x] Functionality preserved (two sections, toggle, threshold picker, refresh, back nav)
- [x] IA improvement (summary strip + grouped config card + actionable empty CTA) proposed as additive
