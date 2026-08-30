# Properties Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke styling in `budget-app/app/properties.tsx`
**Route:** `properties`
**Archetype:** list + summary (same family as dashboard's lower tiers and calendar's day list)

---

## 1. Why this redesign exists

The Properties screen already imports the design system and uses `<GradientBackground
variant="bgDarkPurple">`, `BackButton`, and `typography`/`colors`/`spacing`/`glassEffects`
tokens — so it is **further along than the pre-redesign calendar/dashboard were**. But it is
only *partially* on-theme, and it drifts in five concrete ways that make it read as a slightly
different app than the two reference screens:

1. **Magic colors for tinted chips and fills.** The home-icon chip uses
   `'rgba(167,139,250,0.15)'`, the refresh button `'rgba(167,139,250,0.12)'`, delete
   `'rgba(248,113,113,0.12)'`, the mortgage-active option `'rgba(168,85,247,0.18)'` /
   `'rgba(168,85,247,0.7)'`, the share toggle `'rgba(96,165,250,0.06)'` /
   `'rgba(96,165,250,0.15)'`, and the info card `'rgba(167,139,250,0.08)'`. None of these are
   tokens. The redesign expresses **all** tinted surfaces as `` `${token}1f` `` (≈12%) /
   `` `${token}29` `` (≈16%) derived from `colors.primary2` / `colors.error` / `colors.info`,
   exactly the pattern the dashboard redesign uses for badge/chip fills.

2. **Magic font sizes and weights.** `headerTitle` is `fontSize: 20, fontWeight: '800'`;
   `summaryValue` is `18/800`; `cardTitle` `15/700`; `valueLabel` `13`; `valueSource` `11`;
   `equityValue` `16/800`. These bypass the `typography` scale. The two reference screens use
   `typography.h3 / bodyBold / smallBold / small / caption` exclusively. This screen must too.

3. **The loading state is a bare `ActivityIndicator`.** Both reference screens replaced their
   spinners with **layout-matched `Skeleton`** blocks (calendar: skeleton grid + rows;
   dashboard: skeleton headline + week card + rows). Properties still shows a lone spinner at
   `marginTop: 40`, which is exactly the "feels dated" tell the redesign brief calls out.

4. **The header doesn't match the standard.** `BackButton` is present (good), but the title is
   a magic `20/800` and the `+` action is a naked `add-circle` icon with no 44pt-consistent
   touch treatment. Calendar's header is `typography.h2`-scale title + a tokenized `iconBtn`
   glass chip. Properties should adopt the same header grammar.

5. **The summary card is under-built for what it's summarizing.** It shows Total Value / Total
   Equity as two numbers, but properties are a couple's **net-worth asset** — the same data the
   dashboard's Trajectory strip cares about. There's an opportunity to make the summary the
   screen's headline (a `glassFloating` card, matching how both reference screens give their
   most important block elevation) and add lightweight, on-theme signal: equity share of value,
   and a per-property mini-breakdown, without adding new endpoints.

**What we are NOT changing:** the data model, the add/edit modal's fields, the
Zestimate/manual/mortgage/equity logic, delete, refresh, and the share-with-partner toggle. This
stays recognizably the same screen — a list of properties with a value/equity summary and a
form. We tokenize it, add the missing states, and lift the information architecture one notch.

---

## 2. The core visual idea — "one asset headline, then a clean equity list"

Two ideas, applied consistently and borrowed directly from the reference screens:

| Concept | Visual language | Tokens |
|---|---|---|
| **Portfolio headline** (Total Value / Equity) | the ONE block that floats — earns elevation like the dashboard Status Headline and calendar Summary Header | `glassEffects.glassFloating`, `radius.xl`, hero value in `typography.h2` |
| **Each property** | flat glass row-card, subordinate to the headline; value → mortgage → equity read top-to-bottom | `glassEffects.glass` / `commonStyles.card`, `radius.lg` |

Rule of thumb (same as dashboard): **only the portfolio summary floats and only it uses the
big type.** If a property card ever competes for "biggest thing on screen," the hierarchy broke.

A second consistent motif from calendar/dashboard: **value provenance is stated in words, never
color alone.** "Zestimate" vs "Manual" is a labeled chip with an icon, so a colorblind user
reads the source, not just a tint. Equity sign is encoded by **prefix (`-`) + color**, matching
`getValueColor()` usage across the app.

---

## 3. Full-screen wireframe (top to bottom)

Default state, populated. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Properties                                 [ + ]   │  ← standard header
│                                                                │     BackButton · title · add
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Portfolio                                    2 homes     │ │  │ HEADLINE
│  │                                                          │ │  │ glassFloating
│  │   Total value            Total equity                    │ │  │ (the centerpiece)
│  │   $1,240,000             $612,400                        │ │  │
│  │   ───────────            ─────────── 49% owned           │ │  │  equity share
│  │                                                          │ │  │
│  │   [▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░]  equity ▓  ·  mortgage ░        │ │  │  ownership bar
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  YOUR PROPERTIES                                               │  ┐ section label (caption)
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🏠] 123 Maple Street                          (◑ shared) │ │  │ property card
│  │      Brooklyn, NY 11201                                   │ │  │ glass, radius.lg
│  │                                                          │ │  │
│  │   Value                          $720,000  ⓘ Zestimate·2h│ │  │  provenance chip
│  │   Mortgage (Chase Home)          -$340,000               │ │  │  error color
│  │   ───────────────────────────────────────────           │ │  │  divider
│  │   Equity                          $380,000               │ │  │  success color
│  │                                                          │ │  │
│  │   [ ↻ Refresh ]   [ 🗑 Delete ]                          │ │  │  actions ≥44pt
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🏠] 88 Ocean Ave                                        │ │  │
│  │      Jersey City, NJ 07305                               │ │  │
│  │   Value                          $520,000   ✎ Manual     │ │  │
│  │   Equity                          $232,400               │ │  │  (no mortgage linked)
│  │   [ ↻ Refresh ]   [ 🗑 Delete ]                          │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal via `commonStyles.scrollContent`;
gap under the headline `spacing.lg`; gap between property cards `spacing.md`; section label
"YOUR PROPERTIES" is `typography.caption` uppercase in `colors.textMuted` with `spacing.sm`
below; scroll `paddingBottom: spacing.xxxl + spacing.xxl` (≈80, room for nothing-below).

---

## 4. Header — standard back / title / add

Matches the reference-screen header grammar (calendar `styles.header`, tokenized BackButton).

```
[‹]        Properties                                 [ + ]
```

- **Back** — `<BackButton fallback="/(tabs)/goals" color={colors.text} />` (unchanged from
  current; it's already the shared component). 40×40 with built-in 12pt hitSlop → ≥ 44pt.
- **Title** — `Properties` in `typography.h3` (24/600) `colors.text`. Replaces the magic
  `20/800`. Centered between back and add (existing `flexBetween` row keeps title centered via
  `flex` on a wrapping view, mirroring dashboard's `greetingWrap`).
- **Add** — a tokenized glass icon chip (reuse the calendar `iconBtn` pattern): 40×40,
  `glassEffects.glass`, `radius.md`, `Ionicons name="add"` size 22 `colors.primary2`, hitSlop
  to ≥ 44pt. Replaces the naked `add-circle`. `accessibilityLabel="Add property"`.
- **Background-refresh indicator** — when `loadedOnce && refreshing`, show a small
  `ActivityIndicator color={colors.primary2}` left of the add chip (same convention as
  calendar/dashboard headers).

---

## 5. Portfolio Headline (the centerpiece)

Replaces the current flat `summaryCard`. This is the ONE floating block.

```
┌──────────────────────────────────────────────────────────┐
│  Portfolio                                    2 homes     │  caption label + count pill
│                                                           │
│   Total value            Total equity                     │  two columns
│   $1,240,000             $612,400          49% owned      │  h2 value · share caption
│   ───────────            ───────────                      │
│                                                           │
│   [▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░]                                 │  ownership bar
│   equity ▓   ·   mortgage ░                               │  legend (icon+word+color)
└──────────────────────────────────────────────────────────┘
```

- **Card:** `glassEffects.glassFloating`, `padding: spacing.xl`, `radius.xl`. Only card on the
  screen that floats.
- **Label row:** `Portfolio` in `typography.caption` uppercase `colors.textMuted` (top-left);
  a count pill top-right — `{n} homes` in `typography.caption` `colors.textMuted` on a
  `colors.glassLight` pill, `radius.full`, `spacing.xs`/`spacing.sm` padding.
- **Two value columns** (`commonStyles.flexBetween`):
  - **Total value** — label `typography.caption` `colors.textMuted`; value `typography.h2`
    (28/700) `colors.text`. Sum of `effectiveValue(p)` (unchanged math).
  - **Total equity** — label `typography.caption` `colors.textMuted`; value `typography.h2`
    `colors.primary2` (equity is the couple's "what we own" number — brand-accent, as the
    current screen already tints it `colors.primary2`). Right-aligned.
- **Equity share** — `{equityPercent}% owned` in `typography.caption` `colors.success`
  under/next to the equity value, where `equityPercent = round(totalEquity / totalValue * 100)`
  (guard divide-by-zero → hide). This is the one *new* derived signal; it's cheap and it's the
  number a couple actually cares about ("how much of our homes do we own?").
- **Ownership bar** — a single horizontal stacked bar, height 8pt, `radius.full`, showing
  equity vs mortgage as a share of total value: equity segment `colors.primary2`, mortgage
  segment `colors.error` at ~40% opacity (`` `${colors.error}66` ``). Legend below: two tiny
  swatches + words `equity` / `mortgage` in `typography.caption` `colors.textMuted`. Encodes
  the split by **position + word + color**, not color alone. If total mortgage is 0, render a
  full-width equity bar and drop the mortgage legend chip.

Why upgrade the summary: it's the same instinct both reference screens followed — give the
"how are we doing" block elevation and a tiny bit more signal, and demote the list below it.

---

## 6. Property Card (the list row)

Flat glass card, subordinate to the headline. Preserves every element of the current card,
retokenized, with provenance made explicit.

```
┌──────────────────────────────────────────────────────────┐
│ [🏠] 123 Maple Street                          (◑ shared) │  icon chip · address · share
│      Brooklyn, NY 11201                                   │
│                                                           │
│   Value                          $720,000  ⓘ Zestimate·2h │  provenance chip inline
│   Mortgage (Chase Home)          -$340,000                │  error color, only if linked
│   ─────────────────────────────────────────              │  equityDivider
│   Equity                          $380,000                │  success/error by sign
│                                                           │
│   [ ↻ Refresh ]      [ 🗑 Delete ]                        │  action pills ≥44pt
└──────────────────────────────────────────────────────────┘
```

### 6.1 Card shell
- `glassEffects.glass` + `padding: spacing.lg` + `marginBottom: spacing.md` (=
  `commonStyles.card`), `radius.lg`. Whole card `TouchableOpacity` → `openEdit(p)`
  (unchanged), `activeOpacity: 0.7`.

### 6.2 Header row
- **Home icon chip** — 40×40 (was 36; bump to sit on the 44 rhythm), `radius.md`, fill
  `` `${colors.primary2}1f` `` (≈12% — replaces magic `rgba(167,139,250,0.15)`),
  `Ionicons name="home"` size 18 `colors.primary2`.
- **Address block** — street in `typography.smallBold` `colors.text` `numberOfLines={1}`;
  `city, state zip` in `typography.caption` `colors.textMuted` `numberOfLines={1}`.
- **Share indicator** (new, lightweight, matches the couples motif in calendar/dashboard):
  when `p.is_shared`, a tiny chip top-right — `◑ Shared` in `typography.caption`
  `colors.primary2` on `` `${colors.primary2}1f` `` pill, `radius.full`. When not shared,
  render nothing (private is the quiet default). Degrades gracefully — purely presentational
  off the existing `is_shared` flag.

### 6.3 Value section (unchanged logic, retokenized)
- **Value row** — label `Value` `typography.small` `colors.textMuted`; amount
  `typography.smallBold` `colors.text` right-aligned.
- **Provenance chip** (replaces `valueSource` free text) — a small inline chip beneath/after
  the amount stating where the number came from, **icon + word** so it's color-independent:
  - Zestimate → `Ionicons information-circle-outline` + `Zestimate` + `· {timeAgo}` in
    `typography.caption` `colors.textMuted` on `` `${colors.info}1f` `` pill.
  - Manual → `Ionicons create-outline` (pencil) + `Manual` in `typography.caption`
    `colors.textMuted` on `colors.glassLight` pill.
  - Only one chip renders, driven by the existing `isZestimate` / `p.manual_value` logic.
- **Mortgage row** — only when `p.debt_name`. Label `Mortgage ({debt_name})` `typography.small`
  `colors.textMuted` `numberOfLines={1}`; amount `-{fmt(mortgage)}` `typography.smallBold`
  `colors.error`.
- **Equity divider** — `commonStyles.divider` (1px `colors.borderLight`, `spacing.md`
  vertical) — replaces the magic `height:1 / marginVertical:6`. Only when a mortgage is linked
  (matches current behavior).
- **Equity row** — label `Equity` `typography.smallBold` `colors.text`; value
  `typography.bodyBold` colored by sign via `getValueColor(equity)` (success/error),
  prefix `-` when negative (unchanged math: `effectiveValue − debt_balance`). When no mortgage
  is linked, equity == value; still show the Equity row so every card reads consistently
  (currently it's hidden without a debt — showing it is clearer and costs nothing).

### 6.4 Actions
- **Refresh pill** — `flexRow`, `gap: spacing.xs`, `paddingVertical: spacing.sm`,
  `paddingHorizontal: spacing.md`, min height 44, fill `` `${colors.primary2}1f` ``
  (replaces `rgba(167,139,250,0.12)`), `radius.md`. `refresh-outline` 16 `colors.primary2` +
  `Refresh` `typography.smallBold` `colors.primary2`. While `refreshingId === p.id`, swap
  contents for `ActivityIndicator size="small" color={colors.primary2}`, keep the pill's
  footprint stable (min-width reserve so the row doesn't jump). `stopPropagation` preserved.
- **Delete pill** — same metrics, fill `` `${colors.error}1f` `` (replaces
  `rgba(248,113,113,0.12)`), `trash-outline` 16 `colors.error` + `Delete` `typography.smallBold`
  `colors.error`. Opens the existing destructive `Alert` (unchanged).
- Both pills ≥ 44×44 tap target (currently ~28pt tall — pad to 44).

---

## 7. Add / Edit modal (retokenize, keep behavior)

The bottom-sheet modal keeps every field and the save/validation flow. Only the styling moves
onto tokens; no field is added or removed.

```
┌──────────────────────────────────────────────────────────┐
│  Add Property                                        [✕]  │  h3 title · close
│                                                           │
│  Street Address                                           │  label (smallBold)
│  [ 123 Main Street                                    ]   │  input (glass)
│  City                                                     │
│  [ Brooklyn                                           ]   │
│  State           ZIP Code                                 │
│  [ NY  ]         [ 11201 ]                                │  two-up row
│  Manual Value (optional)                                  │
│  [ Override Zestimate                                 ]   │
│  Link Mortgage                                            │
│  [ None ] [ Chase Home ($340k) ] [ Auto Loan ($12k) ]    │  chip picker
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Share with partner                          (○──● )  │ │  toggle row
│  │ Visible to your household partner                   │ │
│  └─────────────────────────────────────────────────────┘ │
│  ⓘ We'll look up the Zestimate from Zillow when you save. │  info card (add only)
│  ┌─────────────────────────────────────────────────────┐ │
│  │                  Add Property                       │ │  primary gradient CTA
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Token mapping (all magic values → tokens):
- **Sheet** `modalContent` — `backgroundColor: colors.surface`, top corners `radius.xl` (was
  20), `padding: spacing.lg`, `maxHeight: '85%'`. Backdrop `rgba(0,0,0,0.6)` → keep (standard
  scrim). Add `KeyboardAvoidingView` wrapper (input-heavy sheet) — see Accessibility.
- **Title** `modalTitle` → `typography.h3` `colors.text`. Close `✕` 24 `colors.textMuted`,
  44pt hitSlop.
- **Labels** `label` → `typography.smallBold` `colors.text`, `marginBottom: spacing.xs`,
  `marginTop: spacing.md`.
- **Inputs** `input` → `backgroundColor: colors.glassLight`, `borderColor: colors.borderGlass`,
  `radius.md`, `paddingHorizontal: spacing.md`, `paddingVertical: spacing.md`, text
  `typography.body` `colors.text`, `placeholderTextColor: colors.textMuted`. Min height 44.
- **Mortgage chips** `mortgageOption` → `colors.glassLight` + `colors.borderGlass`, `radius.md`,
  `typography.small` `colors.text`; **active** → fill `` `${colors.primary2}29` `` (≈16%,
  replaces `rgba(168,85,247,0.18)`), border `` `${colors.primary2}b3` `` (≈70%, replaces
  `rgba(168,85,247,0.7)`), label `typography.smallBold`. Each chip ≥ 44pt tall.
- **Share toggle row** `sharedToggle` → fill `` `${colors.info}14` `` (≈8%, replaces
  `rgba(96,165,250,0.06)`), border `` `${colors.info}29` `` (replaces `rgba(96,165,250,0.15)`),
  `radius.lg`, `padding: spacing.md`. Label `typography.smallBold` `colors.text`; desc
  `typography.caption` `colors.textMuted`. `Switch` `trackColor.true` → `` `${colors.primary2}66` ``
  (replaces `rgba(168,85,247,0.4)`), `thumbColor` on → `colors.accent`, off → `colors.textDark`,
  `trackColor.false` → `colors.glassLight`.
- **Info card** `infoCard` (add-mode only) → fill `` `${colors.primary2}14` ``, border
  `` `${colors.primary2}29` ``, `radius.md`, `padding: spacing.md`. Icon
  `information-circle-outline` 16 `colors.primary2`; text `typography.caption` `colors.textMuted`.
- **Save CTA** `saveBtn` → `radius.lg`, `LinearGradient colors={gradients.primaryGradient}`
  (unchanged gradient), inner `paddingVertical: spacing.lg`, label `typography.button`
  `colors.text`. `accessibilityRole="button"`.

---

## 8. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed (headline + property cards). |
| **Loading** | **Skeleton, not the bare spinner.** Reuse `components/Skeleton.tsx`, layout-matched: one tall `Skeleton height={132} borderRadius={radius.xl}` for the portfolio headline, then a `typography.caption`-height `Skeleton width={120} height={12}` for the section label, then **2** property-card skeletons — each `Skeleton height={168} borderRadius={radius.lg}` (or a composed skeleton: 40×40 chip + two text lines + two value rows + two action pills). Keep a small header `ActivityIndicator` for background refresh only. |
| **Empty (no properties)** | Centered empty block (reuse the calendar/dashboard empty grammar): `Ionicons home-outline` 48 `colors.textDark`, title `No properties tracked yet` in `typography.bodyBold` `colors.text`, subcopy `Add your first home to track its value and equity` in `typography.small` `colors.textMuted`, and a **primary CTA button** `Add a property` (`gradients.primaryGradient`, `radius.lg`) that opens the add modal — matching how the dashboard empty state offers a gradient CTA rather than just text. The portfolio headline is hidden when there are zero properties. |
| **Error (load failed)** | Inline glass card, do NOT blank the screen. Reuse the app's inline error pattern (`alert-circle-outline` `colors.error`, title `Couldn't load your properties`, `Retry` → `loadData`, optional `Dismiss`). Header stays visible so the user can still back out or add. (The current screen already uses `ErrorState`; keep it but ensure it sits inside the tokenized layout, above the list region.) |
| **Refreshing a single property** | The tapped card's Refresh pill swaps to an inline `ActivityIndicator`; the rest of the card and screen stay interactive. Footprint reserved so the row doesn't reflow. On failure → existing `Alert` (unchanged). |
| **Overflow — long address / debt name** | Street, city line, and `Mortgage ({debt_name})` label all `numberOfLines={1}` + ellipsis; amounts and equity never truncate (`flexShrink: 0`). |
| **Overflow — many properties** | The `ScrollView` handles it; each card is fixed-height-ish and cards stack with `spacing.md`. No cap. |
| **Negative equity** | Equity value flips to `colors.error` with a `-` prefix (via `getValueColor`); the ownership bar's equity segment shrinks toward 0 and the card still reads correctly ("underwater" is legible by sign + color + the `-`). |

---

## 9. Accessibility

- **Touch targets:** header add chip, back button, Refresh/Delete pills, mortgage picker chips,
  and the whole property card all ≥ 44×44pt (pad the visually-smaller pills with height/hitSlop).
- **Color independence:** value provenance is a **labeled chip (icon + word "Zestimate"/
  "Manual")**, not a color; equity sign is **prefix `-` + color**; the ownership bar pairs each
  segment with a **legend word** ("equity"/"mortgage"). No status is conveyed by color alone.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` over dark glass (WCAG AA).
  Tinted chip fills (`${token}1f`) are backgrounds only; the label/icon on them stay full
  semantic color, verified ≥ 4.5:1 on the dark card.
- **Screen-reader order & labels:**
  - Headline reads as one node: `"Portfolio: 2 homes. Total value $1,240,000. Total equity
    $612,400, 49 percent owned."`
  - Property card label: `"{street_address}, {city} {state}. Value {value}, {Zestimate|Manual}.
    {Mortgage {debt_name} {mortgage}.} Equity {equity}.{ Shared with partner.}"` with hint
    `"Double tap to edit."`
  - Refresh button: label `"Refresh value for {street_address}"`; Delete: `"Delete
    {street_address}"`, `accessibilityRole="button"`.
  - Modal inputs: each `TextInput` gets an `accessibilityLabel` matching its visible label;
    the Switch announces `"Share with partner, {on|off}"`.
- **Keyboard avoidance:** wrap the modal body in `KeyboardAvoidingView` (behavior `padding` on
  iOS) so the ZIP/State/Manual-value inputs aren't hidden by the keyboard in the bottom sheet.
- **Reduced motion:** the ownership-bar fill, refresh-pill spinner swap, and card press-scale
  use `animation.fast`; under reduce-motion they become instant state changes (no grow-in).

---

## 10. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `properties.tsx`) | Replace with token |
|---|---|
| ad-hoc background (already `<GradientBackground variant="bgDarkPurple">`) | keep — this is already correct |
| `headerTitle` `fontSize:20, fontWeight:'800'` | `typography.h3` |
| `summaryValue` `18/800` | `typography.h2` (headline value) |
| `cardTitle` `15/700` | `typography.smallBold` |
| `cardAddress` inline caption | `typography.caption` |
| `valueLabel` `13` | `typography.small` |
| `valueAmount` `15/700` | `typography.smallBold` |
| `valueSource` `11` | `typography.caption` |
| `equityLabel` `13/700` | `typography.smallBold` |
| `equityValue` `16/800` | `typography.bodyBold` |
| `emptyText` `16/700` | `typography.bodyBold` |
| `emptySubtext` `13` | `typography.small` |
| `modalTitle` `18/800` | `typography.h3` |
| `label` `13/700` | `typography.smallBold` |
| `input` `fontSize:15` | `typography.body` |
| `mortgageText` `13` / `mortgageTextActive` | `typography.small` / `typography.smallBold` |
| `sharedLabel` `14/700` / `sharedDesc` `11` | `typography.smallBold` / `typography.caption` |
| `saveBtnText` `16/800` | `typography.button` |
| `refreshBtnText` / `deleteBtnText` `13/700` | `typography.smallBold` |
| home-icon chip `'rgba(167,139,250,0.15)'` | `` `${colors.primary2}1f` `` |
| refresh btn `'rgba(167,139,250,0.12)'` | `` `${colors.primary2}1f` `` |
| delete btn `'rgba(248,113,113,0.12)'` | `` `${colors.error}1f` `` |
| info card `'rgba(167,139,250,0.08)'` / border `'…,0.15)'` | `` `${colors.primary2}14` `` / `` `${colors.primary2}29` `` |
| mortgage active `'rgba(168,85,247,0.18)'` / border `'…,0.7)'` | `` `${colors.primary2}29` `` / `` `${colors.primary2}b3` `` |
| share toggle `'rgba(96,165,250,0.06)'` / border `'…,0.15)'` | `` `${colors.info}14` `` / `` `${colors.info}29` `` |
| switch track true `'rgba(168,85,247,0.4)'` | `` `${colors.primary2}66` `` |
| summary equity inline `colors.primary2` | keep — already a token |
| mortgage amount `colors.error`, equity `colors.success`/`colors.error` | keep — via `getValueColor()` |
| `equityDivider` `height:1, marginVertical:6` | `commonStyles.divider` |
| ad-hoc `borderRadius: 10 / 12 / 14 / 20` | `radius.md / md / lg / xl` |
| ad-hoc padding `6 / 10 / 14 / 20`, `marginTop:40` for spinner | `spacing.xs / sm / md / lg` + Skeleton |
| `summaryCard` (flat glass) | `glassEffects.glassFloating` (the ONE floating headline) |
| bare `ActivityIndicator` loading | `Skeleton` (layout-matched) |
| naked `add-circle` header icon | tokenized `iconBtn` glass chip (`glassEffects.glass` + `radius.md`) |

---

## 11. Developer notes

- **Everything is already fetched.** `loadData` already returns `properties` (with
  `zestimate` / `manual_value` / `debt_name` / `debt_balance` / `is_shared` /
  `last_fetched_at`) and `debts`. The redesign is a **re-layout of existing data** plus one
  cheap derived number (`equityPercent`) — no new endpoints.
- **Derived values (keep the existing helpers):** `effectiveValue(p) = manual_value ||
  zestimate || 0`; `totalValue = Σ effectiveValue`; `totalEquity = Σ (effectiveValue −
  debt_balance)`. Add `equityPercent = totalValue > 0 ? round(totalEquity / totalValue * 100)
  : null` (hide the "% owned" and ownership bar when null). For the ownership bar,
  `mortgageTotal = totalValue − totalEquity` (guard ≥ 0).
- **Provenance predicate:** `isZestimate = !p.manual_value && !!p.zestimate` (unchanged); drive
  the provenance chip off it. `timeAgo(p.last_fetched_at)` stays.
- **Reuse, don't reimplement:** `GradientBackground` (bg — already in place), `Skeleton`
  (loading), `BackButton` (header — already in place), the inline error card. **No new shared
  component is required** — the portfolio headline, property card, and provenance chip are
  local to this screen (optional component JSONs are provided for handoff clarity, not as a
  mandate to extract).
- **`AttentionCard` / `Sparkline` are NOT used here** — they belong to the dashboard. This
  screen's archetype is list+summary; it borrows the *grammar* (floating headline, glass
  rows, skeleton loading, caption section labels, `${token}1f` chip fills) from the reference
  screens, not those specific components.
- **Keep totals locally computable** so the error state can still show the portfolio numbers
  if the render partially fails (same principle as the dashboard error fallback).
- **Modal:** wrap body in `KeyboardAvoidingView`; everything else about the add/edit/save/
  validation/delete/refresh flow is unchanged.

---

## 12. Handoff checklist

- [x] Portfolio headline defined as the ONE floating block (`glassFloating`, `h2` values, +
      equity-% and ownership bar) — hierarchy matches the reference screens
- [x] Property card retokenized (chip fills → `${token}1f`, fonts → typography scale,
      divider → `commonStyles.divider`), provenance stated as icon+word chip
- [x] Standard header (BackButton · `h3` title · tokenized add chip · bg-refresh indicator)
- [x] Add/Edit modal fully mapped to tokens; behavior/fields unchanged; keyboard-avoidance added
- [x] All states designed (default, loading=Skeleton, empty=+CTA, error=inline, single-refresh,
      overflow, negative equity)
- [x] Every hardcoded color/gradient/spacing/font mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent provenance/equity/ownership, SR order &
      labels, reduced motion, keyboard avoidance
- [x] Component specs written (`docs/design/components/properties-*.json`)
```