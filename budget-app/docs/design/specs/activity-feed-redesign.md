# Activity Feed Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route:** `activity-feed` · **File:** `budget-app/app/activity-feed.tsx`
**Archetype:** list (feed)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/activity-feed.tsx`

---

## 1. Why this redesign exists

The activity feed is a household audit log — "who did what, when" across both partners.
It works functionally but is **visually a different app** from the two reference screens
(`dashboard.tsx`, `calendar.tsx`) that now live in the design system. Concretely:

1. **It fights the design system.** It hardcodes its background gradient
   (`['#0f172a','#1a1040','#0f172a']` — the *wrong* purple; the tokenized one is
   `gradients.bgDarkPurple` = `['#0f172a','#1a0a40','#0f172a']`), its own semantic colors
   (`'#22c55e'`, `'#ef4444'`, `'#a855f7'`, `'#94a3b8'`), its own surfaces
   (`'rgba(255,255,255,0.06)'`), radii (`16`, `12`), and every font size/weight inline.
   No token is imported. That is *the* reason it reads as dated next to the redesigned
   screens.

2. **Its list row diverges from the app's established row.** The dashboard's
   `RecentActivity` row (the canonical list-row for this archetype) uses a **36×36
   `radius.md` icon chip tinted at ~12% opacity**, `smallBold` name, `caption` subtitle
   with an inline partner glyph, and a `flexShrink:0` semantic amount. The activity feed
   invents a *different* row: a 40×40 icon at `radius.md`(12) but a different tint scheme,
   a `#a855f7` username, and no partner glyph. One screen, two row languages. This
   redesign makes the feed row a **sibling** of `RecentActivity` so the whole app reads as
   one product.

3. **Its non-happy states are thin.** Loading is a bare centered `ActivityIndicator` (no
   skeleton — every other redesigned screen uses `components/Skeleton.tsx`). The header
   uses a bespoke bordered bar instead of the standard `BackButton` + centered-title
   pattern. Empty and error already reuse the shared `EmptyState` / `ErrorState`, which we
   keep.

### What we deliberately preserve (this is recognizably the same screen)

- Reverse-chronological feed of `ActivityEvent`s, **grouped by date bucket**
  (Today / Yesterday / This Week / Earlier) with sticky-feeling group headers.
- Relative-time formatting (`just now`, `5m ago`, `Yesterday at 2:14 PM`, …).
- Per-event icon keyed off `event_type`, actor name, description, optional amount.
- Pull-to-refresh, infinite scroll (`onEndReached`, 50-per-page), footer loader.
- Empty and error states via the shared components.

### Information-architecture improvements (small, high-value)

- **Actor attribution becomes a first-class glyph**, matched to the dashboard's
  partner-glyph convention (`◑` you / `◐` partner), instead of a raw purple username.
  This is what a *couples* audit log is for.
- **Amount sign is encoded by icon + word + color**, not color alone (accessibility).
- **Group headers become tokenized section labels** consistent with `RecentActivity`'s
  `RECENT ACTIVITY` / calendar's group labels (uppercase `caption`, `textMuted`).
- **Tappable rows** — the row already carries an `entity_id`/`entity_type`; make it
  navigable to the underlying entity when present (progressive, graceful-degrade).

---

## 2. The row model — a sibling of `RecentActivity`

The feed row and the dashboard's `RecentActivity` row must look like the **same
component family**. Shared anatomy (do not deviate):

```
[ icon chip 36×36 ]   Name (smallBold, text)                    +$84.20
  radius.md, tint@12%  Subtitle (caption, textMuted): actor · relative-time   (semantic, flexShrink:0)
```

Differences the feed legitimately needs (and only these):

- The subtitle carries **actor + relative time** (`◑ Alex · 2h ago`), where
  `RecentActivity` carried **category + partner**. Same visual grammar, feed-appropriate
  content.
- The amount is **optional** — many events (`budget_created`, `goal_created`) have none.
  When absent, the row is just chip + text, right edge empty.
- The icon + tint are keyed off `event_type` (see §5 mapping table), not just
  income/expense.

Amount semantics reuse the dashboard rule:
`isIncome = event_type ∈ { savings_contribution, income }` → `colors.success`, `+` prefix;
everything else with an amount → `colors.error`, `-` prefix (via `getValueColor`).

---

## 3. Wireframes

### 3.1 Default / populated (iPhone 15 Pro, 390×844)

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Activity                        (◑)(◐)         │  ← standard header
│                                                                │     BackButton · title · avatars
├──────────────────────────────────────────────────────────────┤
│                                                                │  ↕ pull-to-refresh (primary2)
│  TODAY                                                         │  ← group label (caption/muted/upper)
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [🛒]  Whole Foods                          -$84.20    │    │  actual expense (error)
│  │       ◑ Alex · 2h ago                                 │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [↑]   Emergency Fund contribution          +$200.00   │    │  contribution (success)
│  │       ◐ Sam · 4h ago                                  │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [👛]  Created "Groceries" budget                       │    │  no amount → right edge empty
│  │       ◑ Alex · 6h ago                                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  YESTERDAY                                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [✓]   Paid Xfinity Internet                -$120.00   │    │  bill_paid (error)
│  │       ◐ Sam · Yesterday at 9:02 AM                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  THIS WEEK                                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [↓]   Car loan payment                     -$450.00   │    │  debt_payment (error)
│  │       ◑ Alex · Mon, Jul 6                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│              · · · (footer spinner while paging) · · ·         │  ListFooterComponent
└──────────────────────────────────────────────────────────────┘
```

Header: `[‹]` is the shared `<BackButton fallback="/(tabs)/dashboard" iconName="chevron-back">`
(40×40, its own bordered glass style). Title `Activity` centered in `typography.bodyBold`.
Right slot holds the couple avatar cluster (reused visual from dashboard header) OR a 40px
spacer for solo households so the title stays centered. **No** bottom border bar — the old
`borderBottomWidth` header divider is dropped in favor of the reference screens' borderless
header.

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Shown only on first load (`loading && events.length === 0`). Header renders normally; the
list area is replaced by one skeleton group label + 5 skeleton rows shaped like the real
row (so layout does not jump). No full-screen spinner.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Activity                                       │
├──────────────────────────────────────────────────────────────┤
│  ▒▒▒▒▒          (skeleton group label — 60×12)                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ (▓36)   ▒▒▒▒▒▒▒▒▒▒▒▒ 60%              ▒▒▒▒▒ 56×14     │    │  ← Skeleton row ×5
│  │         ▒▒▒▒▒▒ 40%                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ (▓36)   ▒▒▒▒▒▒▒▒▒▒ 55%                ▒▒▒▒▒          │    │
│  │         ▒▒▒▒▒ 35%                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                        … (rows 3–5) …                         │
└──────────────────────────────────────────────────────────────┘
```

Each skeleton row mirrors the dashboard skeleton row exactly:
`Skeleton 36×36 radius.md` chip · `flex:1` column with `Skeleton "60%" h12` + `Skeleton "40%" h10` (gap `spacing.sm`) · trailing `Skeleton 56×14`. Row gap `spacing.md`.

### 3.3 Empty (first-time / no activity)

Unchanged in intent — keep the shared `EmptyState`, now centered inside the tokenized
scroll area. Copy preserved.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Activity                                       │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│                        ┌─────────┐                            │
│                        │  (pulse)│   ← EmptyState glass card   │
│                        └─────────┘                            │
│                     No activity yet                            │
│         When you or your partner make changes,                │
│                they'll show up here                            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

`<EmptyState icon="pulse-outline" title="No activity yet"
description="When you or your partner make changes, they'll show up here" />`

### 3.4 Error (initial load failed, no cached events)

Keep the shared `ErrorState` inside the tokenized header + scroll frame — do **not** blank
the screen (matches calendar's "inline glass card, don't blank" rule). Copy preserved.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]            Activity                                       │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│                     (alert-circle)                            │
│                Something went wrong                            │
│              <error message from API>                         │
│                     [  Retry  ]                               │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

`<ErrorState title="Something went wrong" message={error} onRetry={…} />`.
**Refresh error (events already on screen):** do NOT swap to this full state — keep the
list, surface a lightweight inline toast/banner (`colors.error` text on `glassLight`,
auto-dismiss). Feed data staleness is non-fatal.

### 3.5 Overflow / edge cases

- **Long description / merchant:** `numberOfLines={1}` + ellipsis on name and subtitle;
  amount is `flexShrink:0` and never truncates.
- **Missing actor name:** subtitle falls back to just the relative time (no orphan `·`).
- **Missing amount:** right column omitted; row height unchanged.
- **Unknown `event_type`:** default icon `receipt-outline`, neutral tint (`glassMedium`),
  `colors.primary2` glyph — same as today's fallback.
- **Very long list:** paging via `onEndReached` at 0.5 threshold, footer spinner while
  fetching; unchanged.

---

## 4. Section / component specs

### 4.1 `ActivityHeader` (inline, not a new shared component)

| Element | Spec |
|---|---|
| Container | `flexDirection:'row'`, `alignItems:'center'`, `paddingHorizontal:spacing.lg`, `paddingTop:spacing.sm`, `paddingBottom:spacing.md`. No border. |
| Left | `<BackButton fallback="/(tabs)/dashboard" iconName="chevron-back" size={22} />` |
| Center | `Text` `Activity` — `typography.bodyBold`, `colors.text`, absolutely centered or `flex:1` + `textAlign:'center'`. |
| Right | Couple avatar cluster (reuse dashboard `avatars`/`avatar` styles: 28×28, `radius.full`, overlap −10, `colors.primary`/`colors.info`) when `members ≥ 2`; else a 40px spacer to balance the back button. A background-refresh `ActivityIndicator size="small" color={colors.primary2}` sits left of the avatars while `refreshing && events.length>0`. |

### 4.2 `ActivityRow` — the feed list row

See `docs/design/components/activity-feed-row.json`. Summary:

- **Layout:** `flexDirection:'row'`, `alignItems:'center'`, `gap:spacing.md`,
  `paddingVertical:spacing.md`, `paddingHorizontal:spacing.lg`, `minHeight:44`.
  Card surface `glassEffects.glass` (`colors.glassLight` fill, `colors.borderGlass`
  border, `radius.lg`), `marginBottom:spacing.md`.
- **Icon chip:** 36×36, `radius.md`, `backgroundColor: `${tintColor}1f`` (~12% —
  matches `RecentActivity`'s `${iconColor}1f`). `Ionicons size={18}`.
- **Text column:** `flex:1, minWidth:0`. Name = `description` in `typography.smallBold`
  `colors.text` `numberOfLines={1}`. Subtitle = `caption` `colors.textMuted`,
  `numberOfLines={1}`: partner glyph (colored) + first name + ` · ` + relative time.
- **Amount:** optional; `typography.smallBold`, `flexShrink:0`, `marginLeft:spacing.sm`,
  color via `getValueColor`, prefix `+`/`-`.
- **States:** `default`; `pressed` (`activeOpacity={0.7}` when `onPress` present, i.e.
  event has an `entity_id`); non-interactive rows render as `View` (no press feedback).

### 4.3 `ActivityGroupLabel`

`Text`, `typography.caption`, `colors.textMuted`, `textTransform:'uppercase'`,
`letterSpacing:0.6`, `fontWeight:'700'`, `marginTop:spacing.lg`, `marginBottom:spacing.sm`,
`paddingHorizontal:spacing.xs`. Identical to `RecentActivity`'s `groupLabel`. Values:
`TODAY` / `YESTERDAY` / `THIS WEEK` / `EARLIER`.

### 4.4 `ActivityFeedSkeleton`

See `docs/design/components/activity-feed-skeleton.json`. One `Skeleton` group label +
5 skeleton rows as described in §3.2. Reuses `components/Skeleton.tsx` only — no new
pulsing logic.

### 4.5 List container

`FlatList` (unchanged data-flattening approach: `[{type:'header'}, {type:'event'}…]`).
`contentContainerStyle`: `paddingHorizontal:spacing.lg`, `paddingTop:spacing.sm`,
`paddingBottom:120` (clears the FAB zone, matching dashboard). `RefreshControl`
`tintColor={colors.primary2} colors={[colors.primary2]}`. Footer loader
`ActivityIndicator size="small" color={colors.primary2}` in a `paddingVertical:spacing.lg`
centered row.

---

## 5. Full token mapping (no magic numbers)

### Background & chrome

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f172a','#1a1040','#0f172a']}>` (all 3 states) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `<ActivityIndicator color="#a855f7">` (full-screen loader) | **replaced by `ActivityFeedSkeleton`**; inline spinners use `colors.primary2` |
| header `borderBottomColor:'rgba(255,255,255,0.08)'` + `borderBottomWidth:1` | **removed** (borderless header, per reference screens) |
| header `paddingHorizontal:16 / paddingVertical:12` | `spacing.lg` / `spacing.sm`+`spacing.md` |
| `headerTitle` `fontSize:18, fontWeight:'700', color:'#f8fafc'` | `typography.bodyBold` + `colors.text` |

### Row / card

| Old hardcoded value | Replace with token |
|---|---|
| `eventCard` `backgroundColor:'rgba(255,255,255,0.06)'` | `colors.glassLight` (via `glassEffects.glass`) |
| `eventCard` `borderColor:'rgba(255,255,255,0.08)'`, `borderWidth:1` | `colors.borderGlass` (via `glassEffects.glass`) |
| `eventCard` `borderRadius:16` | `radius.lg` |
| `eventCard` `padding:14` | `paddingVertical:spacing.md` + `paddingHorizontal:spacing.lg` |
| `eventCard` `marginBottom:10` | `spacing.md` |
| `eventIcon` `40×40`, `borderRadius:12`, `marginRight:12` | `36×36`, `radius.md`, `gap:spacing.md` (sibling of `RecentActivity` chip) |
| icon tint `'rgba(34,197,94,0.1)'` / `'rgba(239,68,68,0.1)'` / `'rgba(255,255,255,0.08)'` | `` `${tintColor}1f` `` where `tintColor` = `colors.success` / `colors.error` / `colors.primary2` |
| `Ionicons size={20}` | `size={18}` (matches chip downsizing) |

### Text & semantics

| Old hardcoded value | Replace with token |
|---|---|
| `eventDescription` `fontSize:15, fontWeight:'600', color:'#f8fafc'` | `typography.smallBold` + `colors.text` |
| `eventUser` `fontSize:12, fontWeight:'600', color:'#a855f7'` | `typography.caption` + partner glyph color (`colors.primary2` you / `colors.info` partner) |
| `eventTime` `fontSize:12, color:'#94a3b8'` | `typography.caption` + `colors.textMuted` |
| `eventAmount` `fontSize:15, fontWeight:'700'` | `typography.smallBold` |
| `amountColor = isIncome ? '#22c55e' : '#ef4444'` | `getValueColor(isIncome ? amt : -amt)` → `colors.success` / `colors.error` |
| icon color `'#22c55e'`/`'#ef4444'`/`'#a855f7'` | `colors.success` / `colors.error` / `colors.primary2` |
| `groupHeader` `color:'#94a3b8', fontSize:13, fontWeight:'700'` | `typography.caption` + `colors.textMuted` + `textTransform:'uppercase'`, `letterSpacing:0.6` |
| `groupHeader` paddings `4/12/16`, `marginTop:8` | `paddingHorizontal:spacing.xs`, `marginTop:spacing.lg`, `marginBottom:spacing.sm` |

### List & spacing

| Old hardcoded value | Replace with token |
|---|---|
| `listContent` `paddingHorizontal:12, paddingVertical:12, paddingBottom:32` | `paddingHorizontal:spacing.lg`, `paddingTop:spacing.sm`, `paddingBottom:120` |
| `RefreshControl tintColor="#a855f7"` | `tintColor={colors.primary2} colors={[colors.primary2]}` |
| footer `ActivityIndicator color="#a855f7"`, `paddingVertical:16` | `color={colors.primary2}`, `spacing.lg` |
| unused `retryButton`/`emptyState*`/`errorText` styles | delete (superseded by shared `EmptyState`/`ErrorState`) |

### `event_type` → icon + tint (single source of truth)

| `event_type` | Icon (`Ionicons`) | Tint color | Amount sign |
|---|---|---|---|
| `transaction_added` | `cart-outline` | `colors.error` | `-` |
| `bill_paid` | `checkmark-circle-outline` | `colors.error` | `-` |
| `debt_payment` | `trending-down-outline` | `colors.error` | `-` |
| `savings_contribution` | `trending-up-outline` | `colors.success` | `+` |
| `income` | `cash-outline` | `colors.success` | `+` |
| `budget_created` | `wallet-outline` | `colors.primary2` | none |
| `goal_created` | `flag-outline` | `colors.primary2` | none |
| *(fallback)* | `receipt-outline` | `colors.primary2` | derived |

The tint color drives both the icon color and the `${tint}1f` chip background — a single
`tintForEvent(event_type)` helper, exactly analogous to the calendar's `isProjected`
predicate pattern.

---

## 6. Accessibility

- **Touch targets:** interactive rows `minHeight:44`; `BackButton` is 40×40 with 12pt
  `hitSlop` (≈64pt effective); avatar/refresh affordances are display-only.
- **Color independence:** money direction is conveyed by **icon shape (up/down/cart) +
  sign prefix (`+`/`-`) + color**, never color alone — a red-green-blind user still reads
  `-$120.00` with a down-trend icon. Partner attribution uses a **glyph + name**
  (`◑ Alex`), not color alone.
- **Screen-reader order per row:** `description` → actor → relative time → amount.
  Row `accessibilityRole="button"` (only when navigable), else no role.
  `accessibilityLabel`: `"{description}, by {actor}, {relativeTime}{, income|expense
  {amount} when present}."` Group labels announced as headings
  (`accessibilityRole="header"`).
- **Contrast:** all text on `glassLight` uses `colors.text` / `colors.textMuted` — both
  clear WCAG AA on the dark gradient (same combination validated for the reference
  screens). No dimmed/low-opacity text is introduced.
- **Reduced motion:** the `Skeleton` pulse and pull-to-refresh spinner are the only
  motion; under `AccessibilityInfo.isReduceMotionEnabled()`, render skeleton blocks at a
  static mid-opacity (no loop) — matches how the other redesigned screens treat Skeleton.
- **Dynamic Type:** all sizes come from `typography.*`; rows grow with `minHeight` rather
  than clipping; name/subtitle keep `numberOfLines={1}` with ellipsis.

---

## 7. Developer notes

- Reuse, do not re-implement: `GradientBackground` (variant `bgDarkPurple`), `Skeleton`,
  `BackButton`, `EmptyState`, `ErrorState`, and the dashboard header avatar styles.
- The `ActivityRow` should be near-copy of `components/dashboard/RecentActivity.tsx`'s row
  internals (chip + text column + amount) — consider extracting a shared row later, but
  for this pass a sibling row that matches its tokens is sufficient and lower-risk.
- Partner glyph resolution mirrors dashboard's `resolvePartner`: `event.user_id === me`
  → `{ '◑', colors.primary2, myFirstName }`; a known partner → `{ '◐', colors.info,
  partnerFirstName }`; unknown/solo → no glyph (subtitle shows only relative time).
  Degrades gracefully if household members aren't loaded.
- Make a row navigable only when `entity_id` + `entity_type` are present (e.g.
  `transaction` → `/transaction/[id]`); otherwise render a non-pressable `View`. Keep the
  existing data-flattening for `FlatList`; swap `renderGroupHeader` styling to the
  tokenized group label.
- Keep all existing paging/refresh logic untouched — this is a pure visual + IA reskin.
- Delete the now-dead `styles` (`retryButton`, `emptyState*`, `errorText`) once shared
  components own those states.

---

## 8. Handoff checklist

- [x] All states designed (default, loading skeleton, empty, error, overflow, refresh-error)
- [x] Row aligned to the app's canonical list-row (`RecentActivity`) — same chip/type/amount grammar
- [x] Every old hardcoded color/gradient/radius/space/font mapped to a design-system token
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Loading reuses `components/Skeleton.tsx`; empty/error reuse shared components
- [x] Accessibility: 44pt targets, icon+word+color status, SR order/labels, reduced motion
- [x] Couples attribution added as a graceful-degrade partner glyph
- [x] Component specs written (`docs/design/components/activity-feed-*.json`)
