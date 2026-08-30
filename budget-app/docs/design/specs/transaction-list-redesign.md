# Transaction List Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `transaction/list` — `budget-app/app/transaction/list.tsx`
**Archetype:** list
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Match targets:** `calendar-redesign.md`, `dashboard-redesign.md`, `(tabs)/calendar.tsx`, `(tabs)/dashboard.tsx`
**Reuses:** `GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, `ErrorState`, `CategoryPicker`, and the row idiom from `components/dashboard/RecentActivity.tsx`

---

## 1. Why this redesign exists

The current screen is entirely bespoke and reads as a different app from the rest of CoupleFlow:

- **Off-theme background gradient.** It hardcodes `LinearGradient colors={['#0b1021','#1b0d30','#2d0c53']}` instead of the app-standard `<GradientBackground variant="bgDarkPurple">`. Every other redesigned screen (calendar, dashboard) uses the shared background — this one is a visibly different purple.
- **A private, drifting palette.** Amounts use `#4ade80 / #f87171 / #94a3b8`; the source badge invents `#f59e0b / #60a5fa / #34d399 / #38bdf8 / #facc15`; the category chip uses `rgba(168,85,247,*)`; icons use a one-off `#f472b6` pink. None of these are design-system tokens, and several (green `#4ade80`, red `#f87171`) are *near* but not equal to `colors.success` / `colors.error`, which is the worst kind of drift.
- **Magic-number layout.** `padding: 14/16`, `borderRadius: 14`, `gap: 10`, inline `fontSize/fontWeight` throughout — no `spacing`, `radius`, or `typography` tokens.
- **No loading state.** There is no skeleton and no header refresh affordance — the list simply pops in. The convention (calendar/dashboard) is `Skeleton` placeholders that hold layout.
- **Header is off-spec.** Custom `header` text at `fontSize:18/weight:800` instead of `typography.h3`; a dead `iconBtn` style is defined but unused; there is no primary action affordance in the header even though "Add transaction" is the obvious one.
- **Flat information architecture.** All rows are one undifferentiated stream. There is no headline number, no date grouping, and the active filter (category / single day, passed via params) is only expressed in the title — the user can't see or clear it.

This redesign keeps the screen **recognizably the same** (a scrollable list of transactions you can tap to open, re-categorize inline, and pull-to-refresh) while making it a first-class member of the design system and giving it the list-archetype structure used elsewhere: standard header → one elevated headline card → grouped flat rows → full state coverage.

---

## 2. Information architecture

Entering context (unchanged, preserved): the screen is reached three ways, driven by params.

| Entry | Params | Title | Filter behavior |
|---|---|---|---|
| Global "All transactions" | none | `All Transactions` | none |
| From a budget category | `category_id`, `category_name` | `{category_name}` | filter to that category |
| From a calendar day / dashboard weekly bar | `date` (YYYY-MM-DD) | `{Weekday, Mon D}` | filter to that calendar day |

**IA improvements (additive, do not remove any function):**

1. **Headline summary card** (one `glassFloating` per screen). Leads with the money number for the *currently visible* set: **net for the filtered list**, with the income/expense split beneath it and a count. When a filter is active, this is where the split for that category/day lives.
2. **Active-filter pill** inside the headline card when `category_id` or `date` is set — shows what's filtering and a tap-to-clear (`×`) that routes back to unfiltered `All Transactions`. Today the filter is invisible and unclearable from this screen.
3. **Date-grouped rows.** Instead of one flat stream, rows are grouped under sticky-ish day headers (`Today`, `Yesterday`, then `Weekday, Mon D`). This is the natural scan pattern for a transaction ledger and matches the "grouped, muted `groupLabel`" idiom already in `RecentActivity` / the calendar day detail. When a single-`date` filter is active there is only one group, so the group header is suppressed (the screen title already names the day).
4. **Every row keeps its two existing jobs:** tap the row → open `transaction/[id]`; tap the inline category chip → open `CategoryPicker` to reassign. Both preserved verbatim.

Primary action: **Add transaction** (header action icon + the empty-state CTA). Secondary: refresh (pull-to-refresh + background spinner in header). Tertiary: clear filter.

---

## 3. Wireframes

### 3.1 Default / populated (All Transactions)

```
┌──────────────────────────────────────────────────────────┐
│  ‹  All Transactions                              [ + ]    │  header: BackButton + h3 + action
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐   │
│  │  NET THIS LIST                                      │   │  glassFloating headline card
│  │  +$1,240.00                                         │   │  typography.h2, getValueColor
│  │  ▲ In $3,480.00   ·   ▆ Out $2,240.00   ·  42 items │   │  split + count (caption/muted)
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ── TODAY ─────────────────────────────────────────────   │  group label (caption/muted/upper)
│  ┌────────────────────────────────────────────────────┐   │
│  │ [▦] Whole Foods                          -$84.20   │   │  glass row, error amount
│  │     ⌁ Groceries ⌄        🕓 2:14 PM   [Teller]     │   │  category chip + time + source
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [▲] Paycheck                            +$1,900.00 │   │  income → success amount
│  │     ⌁ Income ⌄           🕓 9:02 AM   [Manual]     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ── YESTERDAY ─────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [⇄] Transfer to Savings                    $500.00 │   │  transfer → textMuted, no sign
│  │     ⌁ Set category ⌄     🕓 6:40 PM   [Plaid]     │   │  unset chip = ghosted style
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ── FRIDAY, JUL 3 ─────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [▦] Xfinity                              -$120.00  │   │
│  │     ⌁ Utilities ⌄        🕓 11:00 AM  [Bank]      │   │
│  └────────────────────────────────────────────────────┘   │
│     ⋮ (scrolls)                                            │
└──────────────────────────────────────────────────────────┘
  [ ⌁ Groceries ⌄ ] category chip tap → CategoryPicker bottom sheet
```

### 3.2 Filtered by category (or day)

```
┌──────────────────────────────────────────────────────────┐
│  ‹  Groceries                                     [ + ]    │  title = category_name
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐   │
│  │  ( ⌁ Groceries  × )                                │   │  active-filter pill, × clears
│  │  SPENT IN THIS CATEGORY                             │   │
│  │  -$412.60                                           │   │  h2, error color (all-expense)
│  │  ▆ Out $412.60      ·                     8 items  │   │  income column omitted if $0
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ── THIS WEEK ─────────────────────────────────────────   │  (day groups as usual)
│  ┌────────────────────────────────────────────────────┐   │
│  │ [▦] Whole Foods                          -$84.20   │   │
│  │     ⌁ Groceries ⌄        🕓 Tue      [Teller]     │   │
│  └────────────────────────────────────────────────────┘   │
│     ⋮                                                      │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Loading (skeleton — reuses `components/Skeleton.tsx`)

Header renders immediately (real title + back). Body = 1 skeleton headline block + 1 skeleton group label + 4 skeleton rows that hold the exact row layout so nothing jumps on load.

```
┌──────────────────────────────────────────────────────────┐
│  ‹  All Transactions                              [ + ]    │  real header (title known from params)
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐   │
│  │  ▓▓▓▓▓▓▓            (glassFloating shell)           │   │  Skeleton 90w×12  (label)
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓                                       │   │  Skeleton 160w×28  (net number)
│  │  ▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓  ▓▓▓▓                             │   │  Skeleton row (split)
│  └────────────────────────────────────────────────────┘   │
│  ▓▓▓▓▓                                                     │  Skeleton 70×12 (group label)
│  ● ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                          ▓▓▓▓▓▓        │  4× skel rows:
│    ▓▓▓▓▓▓▓                                                │   36×36 chip + 60%/40% lines
│  ● ▓▓▓▓▓▓▓▓▓▓▓                              ▓▓▓▓▓         │   + 60w amount
│    ▓▓▓▓▓                                                  │
│  ● ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                           ▓▓▓▓▓▓        │
│  ● ▓▓▓▓▓▓▓▓                                 ▓▓▓▓          │
└──────────────────────────────────────────────────────────┘
```

### 3.4 Empty

Reuses shared `EmptyState`; copy switches on whether a filter is active (current behavior preserved).

```
┌──────────────────────────────────────────────────────────┐
│  ‹  All Transactions                              [ + ]    │
├──────────────────────────────────────────────────────────┤
│                                                            │
│                       ( 🧾 )                               │  receipt-outline, textDark
│                No transactions yet                         │  typography.bodyBold / text
│      Your transactions will appear here once you add them  │  typography.small / textMuted
│                                                            │
│                 ┌───────────────────┐                      │
│                 │  + Add Transaction │                     │  primaryGradient CTA
│                 └───────────────────┘                      │
│                                                            │
└──────────────────────────────────────────────────────────┘
  Filtered variant title/copy:
    "No transactions in this category" /
    "Transactions assigned to this category will appear here"
```

### 3.5 Error

Inline (do not blank the header). Reuses shared `ErrorState` inside a padded body, under the real header.

```
┌──────────────────────────────────────────────────────────┐
│  ‹  All Transactions                              [ + ]    │
├──────────────────────────────────────────────────────────┤
│                     ( ⚠ )                                  │  alert-circle-outline, error
│              Something went wrong                          │  typography.bodyBold
│           Failed to load transactions                     │  typography.small / textMuted
│                 [   Retry   ]                              │  text button, primary2
└──────────────────────────────────────────────────────────┘
```

---

## 4. Token mapping (every hardcoded value → design-system token)

| Old hardcoded value (current `list.tsx`) | Replace with token |
|---|---|
| `LinearGradient colors={['#0b1021','#1b0d30','#2d0c53']}` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| header `color:'#f8fafc', fontSize:18, fontWeight:'800'` | `typography.h3` + `colors.text` |
| `headerRow padding:16` | `paddingHorizontal: spacing.lg`, `paddingVertical: spacing.md` |
| `card` `backgroundColor:'rgba(255,255,255,0.06)'` + `borderColor:'rgba(255,255,255,0.08)'` + `borderWidth:1` | `glassEffects.glass` (`colors.glassLight` + `colors.borderGlass`) |
| `card borderRadius:14` | `radius.lg` |
| `card padding:14` | `spacing.lg` |
| list `gap:10` | `spacing.md` |
| list `padding:16 / paddingBottom:32` | `paddingHorizontal: spacing.lg`, `paddingBottom: spacing.xxl` |
| `iconCircle` 32×32 `rgba(255,255,255,0.08)` | icon chip 36×36 `radius.md`, fill = `${semanticColor}1f` (12%) — matches `RecentActivity.iconChip` |
| income icon `#22c55e` | `colors.success` |
| expense icon `#f472b6` (pink) | `colors.primary2` (matches `RecentActivity` expense icon) |
| transfer icon `#94a3b8` | `colors.textMuted` |
| amount income `#4ade80` | `colors.success` (via `getValueColor(+amount)`) |
| amount expense `#f87171` | `colors.error` (via `getValueColor(-amount)`) |
| amount transfer `#94a3b8` | `colors.textMuted` |
| `title` `#f8fafc / 700 / 15` | `typography.smallBold` + `colors.text` |
| `meta` / `sub` `#cbd5e1 / 12` | `typography.caption` + `colors.textMuted` |
| `time-outline` icon `#cbd5e1` | `colors.textMuted` |
| categoryChip `rgba(168,85,247,0.12)` fill + `rgba(168,85,247,0.25)` border | `${colors.primary2}1f` (12%) fill + `${colors.primary2}3d` border |
| categoryChip icon `#c084fc` / chevron `#a855f7` | `colors.accent` / `colors.primary2` |
| categoryChipText `#e2e8f0 / 11 / 600` | `typography.caption` (weight 600) + `colors.text` |
| categoryChip `paddingV:3/H:8`, `radius:8`, `gap:4` | `spacing.xs`/`spacing.sm`, `radius.sm`, `spacing.xs` |
| **source badge** all colors (`#f59e0b/#60a5fa/#34d399/#38bdf8/#facc15`) | tokenized set — see §5.4. Teller `colors.warning`, Plaid `colors.info`, Flinks/Bank `colors.success`, Manual `colors.textMuted`; badge fill = color at 12% |
| sourceBadge `paddingH:10/V:6`, `radius:10` | `spacing.sm`/`spacing.xs`, `radius.sm` |
| sourceText `700 / 12` | `typography.caption` (weight 700) |
| `RefreshControl tintColor/colors '#a855f7'` | `colors.primary2` |
| unused `iconBtn` style | delete |

**Hard rule:** after redesign, the only literal alpha values allowed are the documented semantic tints — `1f` (12%, chip/badge fills) and `3d` (~24%, chip borders). No other hex/rgba/px.

---

## 5. Component specs

### 5.1 Screen shell & header

- **Root:** `<GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>` → `SafeAreaView`.
- **Header** (fixed row OUTSIDE the FlatList, matches list-archetype convention):
  - Left: shared `<BackButton fallback="/(tabs)/budget" size={20} />`.
  - Center: title `Text` in `typography.h3` / `colors.text`, `numberOfLines={1}` (derived from params exactly as today).
  - Right: **action icon** — 44×44 tap target, `add` (`Ionicons`), routes `router.push('/transaction/add')`. When a background refresh is in flight show `ActivityIndicator size="small" color={colors.primary2}` in this slot instead (same pattern as dashboard header). This replaces the dead `width:40` spacer.
  - Padding: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`.

### 5.2 Headline summary card — `TransactionListSummary`

One `glassEffects.glassFloating` card, the only elevated surface on the screen.

- **Filter pill (conditional):** when `category_id` or `date` is set, a small pill at the top — `⌁`/`calendar-outline` icon + label + `×` close. Tap `×` → `router.replace('/transaction/list')` (clears params). Pill: `${colors.primary2}1f` fill, `radius.full`, min 44×44 tap on the `×`.
- **Label:** `typography.caption`, `colors.textMuted`, uppercase — `NET THIS LIST` (unfiltered/mixed), `SPENT IN THIS CATEGORY` (category filter, all-expense), or `ON THIS DAY` (date filter).
- **Hero number:** `typography.h2`, colored via `getValueColor(net)` (net = income − expense − transfers are excluded from net). For an all-expense category filter show `-$total` in `colors.error`.
- **Split row:** `▲ In {sum income}` (`colors.success`) · `▆ Out {sum expense}` (`colors.error`) · `{n} items` (`colors.textMuted`). Omit a split column whose value is `0` (e.g. a Groceries filter has no income column). Split labels `typography.caption`.
- Derives entirely from the already-computed `visible` array — no new fetch.

**States:** default (as above) · loading (`Skeleton` shell — see §5.6) · single-item / all-transfer (net may be `$0.00`; render neutrally in `colors.textMuted`).

### 5.3 Day group header — `TxDayGroup`

- Rows are bucketed by local calendar day of `t.date`, groups sorted newest-first (preserves current sort).
- Label: `typography.caption`, `colors.textMuted`, uppercase, `letterSpacing: 0.6` — `TODAY`, `YESTERDAY`, else `Weekday, Mon D` (e.g. `FRIDAY, JUL 3`). Reuses the `groupLabel` style from `RecentActivity`.
- `marginTop: spacing.lg`, `marginBottom: spacing.sm`.
- **Suppressed** when a single-`date` filter is active (only one day; the title already names it).

### 5.4 Transaction row — `TransactionRow`

Direct evolution of the current card, aligned to the `RecentActivity` row idiom. **All rows are "actual" (solid glass)** — this screen has no projected/tentative money, so the solid-vs-ghosted metaphor applies only to the *category chip* (set vs unset), see below.

Container: `glassEffects.glass`, `padding: spacing.md`, `borderRadius: radius.lg`, `minHeight: 64`. `activeOpacity={0.7}`. `onPress` → existing `router.push('/transaction/[id]', {...})` (unchanged param set).

Layout — two rows inside the card:

**Top row** (`flexRow`, `alignItems:'center'`, `gap: spacing.md`):
- **Icon chip** 36×36, `radius.md`, fill `${iconColor}1f`:
  - income → `trending-up`, `colors.success`
  - expense → `card-outline`, `colors.primary2`
  - transfer → `swap-horizontal`, `colors.textMuted`
- **Title** (`flex:1`, `minWidth:0`): `t.note || t.category_name || 'Transaction'`, `typography.smallBold`, `colors.text`, `numberOfLines={1}`.
- **Amount** (`flexShrink:0`): `typography.smallBold`.
  - income → `+{money}`, `getValueColor(+amount)` = `colors.success`
  - expense → `-{money}`, `getValueColor(-amount)` = `colors.error`
  - transfer → `{money}` no sign, `colors.textMuted`

**Bottom row** (`flexRow`, `alignItems:'center'`, `gap: spacing.sm`, `marginTop: spacing.sm`):
- **Category chip** (tap → `openPicker(item.id)`, min 44 tap height via `hitSlop`):
  - **Set:** `⌁ {category_name} ⌄` — `pricetag` icon `colors.accent`, text `typography.caption` `colors.text`, chevron `colors.primary2`; fill `${colors.primary2}1f`, border `${colors.primary2}3d`, `radius.sm`. (Solid.)
  - **Unset:** `⌁ Set category ⌄` — same shape but **dashed border** (`borderStyle:'dashed'`, `colors.borderGlass`), transparent fill, text `colors.textMuted`. Reuses the solid-vs-ghosted convention: an unassigned category is the one "tentative" thing here, so it reads as a ghost prompting action.
- **Spacer** (`flex:1`).
- **Time** `🕓 {relative or clock}` — `time-outline` `colors.textMuted` + `typography.caption`. In grouped view the day is redundant, so show clock time (`2:14 PM`); fall back to short date if time absent.
- **Source badge** — see below.

**Source badge** (`TransactionSourceBadge`): `{label}` in `typography.caption` (weight 700), fill = `${color}1f`, `radius.sm`, `paddingH: spacing.sm`, `paddingV: spacing.xs`.

| source | label | token |
|---|---|---|
| `teller` | Teller | `colors.warning` |
| `plaid` | Plaid | `colors.info` |
| `flinks` | Flinks | `colors.success` |
| `bank` | Bank | `colors.info` |
| (default) | Manual | `colors.textMuted` |

> Bank shares `colors.info` with Plaid; the **word** disambiguates (label is always present), keeping status color-independent.

**States:** default · pressed (`activeOpacity 0.7`) · category-unset (dashed chip) · long title (ellipsis, amount never truncates — `flexShrink:0`) · loading (skeleton row).

### 5.5 Category picker (unchanged)

Keep shared `<CategoryPicker>` as the reassignment sheet — it already matches the bottom-sheet convention. No visual change; only the trigger chip is restyled per §5.4.

### 5.6 Loading skeleton — `TransactionListSkeleton`

Reuse `components/Skeleton.tsx`. Render while `!loadedOnce`. Header shows the real title.

- Headline shell: `glassFloating` container with `Skeleton width={90} height={12}` (label), `Skeleton width={160} height={28}` (net), and a row of three `Skeleton width={70} height={12}`.
- One `Skeleton width={70} height={12}` group label.
- 4× skeleton rows, each: `Skeleton 36×36 borderRadius={radius.md}` + column (`Skeleton 60% h12`, `Skeleton 40% h10`) + `Skeleton width={60} height={14}` — identical geometry to §5.4 so no layout jump. (This is the exact `skelRow` recipe already in `dashboard.tsx`.)
- Background refresh (list already loaded) → NO skeleton; show header `ActivityIndicator` only.

### 5.7 Empty & error (shared components)

- **Empty:** shared `<EmptyState icon="receipt-outline" title=… description=… actionLabel="Add Transaction" onAction=…>` with the exact filtered/unfiltered copy the screen already uses. Centered in the FlatList `ListEmptyComponent`.
- **Error:** shared `<ErrorState title="Something went wrong" message={error} onRetry={…}>` inside a `spacing.lg`-padded body, rendered under the real header (do not blank the header — improvement over current, which already keeps the header).

---

## 6. Accessibility

- **Touch targets:** every interactive element ≥ 44×44pt. Header action icon 44×44. Category chip and `×` filter-clear get `hitSlop` to reach 44 even though the visible chip is shorter. Row `minHeight: 64` (well over 44).
- **Color-independent status:** the source badge always pairs **word + color + tint**, never color alone (critical since Bank and Plaid share `colors.info`). Amount direction is conveyed by the `+ / -` sign and icon glyph, not color only. Category "unset" is conveyed by the dashed border + the word "Set category", not by dimming alone.
- **Screen-reader order & labels:** header (back → title → add) then, per group, the day label announced once, then rows top-to-bottom. Row `accessibilityRole="button"`, label: `"{title}, {income|expense|transfer} {amount}, {category or 'no category'}, {date}, via {source}."` The category chip is a nested control with its own label: `"Category {name}, double tap to change"` / `"No category, double tap to set."` Headline card label: `"Net for this list {net}. Income {in}, expenses {out}, {n} items."`
- **Reduced motion:** the only motion is `Skeleton`'s opacity pulse (already `useNativeDriver`, gentle) and press feedback via `activeOpacity`. Under reduce-motion, press feedback stays (opacity, not transform) and no additional entrance animation is added. Pull-to-refresh uses the platform `RefreshControl` (respects OS motion settings).
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass — meets WCAG AA. No opacity-dimmed text is used for meaning (dashed chip uses `colors.textMuted` at full opacity, not dimmed `colors.text`).

---

## 7. Edge cases

| Case | Behavior |
|---|---|
| Long merchant/note | `numberOfLines={1}` ellipsis on title; amount `flexShrink:0` never truncates. |
| Long category name in chip | chip `maxWidth` + `numberOfLines={1}`; `⌄` chevron stays visible. |
| Very large list | FlatList virtualization retained; day grouping via `SectionList` or pre-bucketed `FlatList` with sticky headers. |
| All transfers (net $0) | headline net renders `$0.00` in `colors.textMuted`, In/Out columns omitted if zero. |
| Category filter with only expenses | headline label `SPENT IN THIS CATEGORY`, In column omitted. |
| Single-day filter | one group, group header suppressed; time column shows clock time. |
| Unknown/missing source | falls to default `Manual` badge (`colors.textMuted`). |
| Missing time on `date` | time column falls back to short date string. |

---

## 8. Developer notes

- **Do not blend numbers before display** — keep income / expense sums separate in the headline; net is derived last. (Same regression-guard discipline as the calendar spec.)
- Reuse, do not re-implement: `GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, `ErrorState`, `CategoryPicker`. The row's icon-chip + name/subtitle + amount geometry is deliberately identical to `components/dashboard/RecentActivity.tsx` — lift that structure for visual consistency and to make "See all" → this screen feel continuous.
- Grouping: derive day buckets from local calendar components of `t.date` (mirror the existing single-day match logic in the current `visible` filter, which already compares local `y/m/d`).
- The `add` route: current empty-state CTA uses `/transaction/add`; use the same for the header action for consistency.
- Transfers currently render with no sign and muted color — preserved. They are excluded from the net and from the In/Out split.
- Delete the unused `iconBtn` style and all local color constants (`getSourceBadge`'s hex map) — replace with the token table in §5.4.

---

## 9. Handoff checklist

- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Standard list-archetype header (BackButton + h3 + gradient/accent action, 44pt, refresh spinner)
- [x] One `glassFloating` headline card leading with the money number (`typography.h2`)
- [x] All states designed: default, filtered, loading (Skeleton), empty, error, overflow
- [x] Every hardcoded color/gradient/spacing/font mapped to a token (§4)
- [x] Status color-independent: source badge = icon-word + color + tint; sign for direction
- [x] Solid-vs-ghosted applied to the one tentative element (unset category chip = dashed)
- [x] Semantic tints only at documented 12% (`1f`) / 24% (`3d`) alphas
- [x] Accessibility: 44pt targets, SR labels/order, reduced motion, contrast
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, EmptyState, ErrorState, CategoryPicker)
- [x] Component specs written under `docs/design/components/transaction-list-*.json`
```

