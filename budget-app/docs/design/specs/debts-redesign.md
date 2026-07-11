# Debts Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/debts.tsx`
**Archetype:** list (hero summary → attention → context card → filter → expandable rows)

---

## 1. Why this redesign exists

The debts screen is a **different app** from the rest of CoupleFlow. Like the pre-redesign
calendar and dashboard, it declares its own private palette (`const C = { … }`), its own
wrong-purple gradient, and its own surface/border/radius/font values everywhere:

```
const C = {
  bg: '#0f0a1e',                       // ≠ colors.bg (#0f172a)
  surface: 'rgba(255,255,255,0.06)',   // ≠ glassEffects.glass
  border: 'rgba(255,255,255,0.08)',    // ≈ borderLight, but hand-rolled
  accent: '#a855f7',  accentDark: '#7c3aed',
  pink: '#ec4899',    income: '#34d399',
  attack: '#f87171',  structured: '#60a5fa',  warning: '#fbbf24',
  …
};
<LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} … />
```

None of those match the design system. `#f87171` is a *lighter* red than `colors.error`
(`#ef4444`); `#34d399` is a *different* green than `colors.success` (`#22c55e`); the
background gradient is a subtly-off purple vs `gradients.bgDarkPurple`. Placed next to the
redesigned calendar/dashboard, this screen looks foreign.

This redesign does two things:

1. **Adopts the design system fully** — every color, radius, space, font, gradient, and
   surface comes from `design-system.ts`. The local `C` object is deleted. The
   `LinearGradient` wrapper is replaced by `<GradientBackground variant="bgDarkPurple">`.
2. **Sharpens the information architecture** for the list archetype so it matches the
   calendar/dashboard conventions — a standard `BackButton` header, one elevated hero,
   an attention slot driven by the shared `AttentionCard`, a demoted context card, then
   the tokenized list — plus the **loading-skeleton / empty / error** states the screen
   is currently missing (today it shows only a bare `ActivityIndicator`).

### The two conceptual buckets we keep and make consistent

Debts split into **Attack** (pay aggressively) and **Structured** (pay minimums, e.g.
mortgage). That distinction is good and stays. But today it is drawn with two off-palette
colors (`attack #f87171`, `structured #60a5fa`) and communicated by color + a lowercase
word. We keep the two-bucket model but re-encode it on the token palette and make it
**color-independent** (icon + word + color), the same discipline the calendar redesign
applied to actual-vs-projected.

| Bucket | Meaning | Icon (filled) | Color token |
|---|---|---|---|
| **Attack** | pay off aggressively with extra payments | `flame` | `colors.error` (`#ef4444`) |
| **Structured** | pay minimums on schedule (mortgage-style) | `shield-checkmark` | `colors.info` (`#3b82f6`) |

Attack maps to `error` (urgency/heat), Structured to `info` (steady/managed). Both always
ship with their icon + label so the bucket never rides on hue alone.

---

## 2. Screen hierarchy (list archetype, top → bottom)

The screen answers one question first — **"how much do we owe and is it shrinking?"** —
then lets the couple drill into individual debts. Enforced tiers:

1. **Header** — `BackButton` + "Debts" title + add (`+`) button. Standard, tokenized.
2. **Hero Debt Summary** — total owed, min payment, avg APR, account count, and the
   Attack/Structured split. The only **floating** card (`glassFloating`). Earns `h1`.
3. **Attention** — debt-related AI nudges, rendered via the shared **`AttentionCard`**
   pattern (only when non-empty).
4. **Payoff Timeline** — a demoted context card (`glass`) showing per-debt payoff bars +
   a Calculator link. Supporting evidence, not a headline.
5. **Filter tabs** — All / Attack / Structured segmented control.
6. **Debt list** — the tokenized `DebtRow` list, expandable per row.
7. **Add-debt CTA** — dashed tokenized affordance at the list foot.

Rule of thumb (same as dashboard): **only the hero floats and only the hero uses `h1`.**

---

## 3. Wireframes

### 3.1 Default / populated

iPhone 15 Pro (390×844). `<GradientBackground variant="bgDarkPurple">` behind everything.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Debts                                              ( + )   │  ← header, BackButton
│                                                                │     + add button
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Total debt                              ▾ -$847/mo       │ │  │ TIER 2
│  │                                                          │ │  │ Hero Summary
│  │  $48,320.00                        ← h1 hero number      │ │  │ glassFloating
│  │                                                          │ │  │
│  │   Min. payment     Avg. APR        Accounts              │ │  │
│  │   $847.00          14.2%           5                     │ │  │
│  │  ────────────────────────────────────────────────────    │ │  │
│  │  ┌────────────────────────┐ ┌───────────────────────┐   │ │  │
│  │  │ 🔥 ATTACK    $12.4k    │ │ 🛡 STRUCTURED  $35.9k │   │ │  │  split tiles
│  │  └────────────────────────┘ └───────────────────────┘   │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 3
│  │  ✦ Your Chase card APR jumped to 24.9% — consider      × │ │  │ Attention
│  │    attacking it first.                        [ Ask AI ] │ │  │ (AttentionCard,
│  └──────────────────────────────────────────────────────────┘ │  ┘  only if nudges)
│                                                                │  ← spacing.lg
│  PAYOFF TIMELINE                                  Calculator › │  ┐ tier 4 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 4
│  │  Chase Card   ▓▓▓▓▓░░░░░░░░░░░░░░░░  Mar '26            │ │  │ Payoff Timeline
│  │  Car Loan     ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  Nov '27            │ │  │ (glass, demoted)
│  │  Student      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  Aug '31            │ │  │
│  │           Mortgage excluded · based on min payments      │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  [ All 5 ]  [ 🔥 Attack 2 ]  [ 🛡 Structured 3 ]              │  ← filter tabs
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │ (◔) Chase Card  ATTACK          $4,210.00     18% paid  ⌄ │ │  │ DebtRow
│  │  ● Shared · 24.9% APR · Due 15th                         │ │  │ (collapsed)
│  │  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │ │  │  progress bar
│  └──────────────────────────────────────────────────────────┘ │  ┘
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │ (◑) Car Loan   ATTACK           $8,190.00     41% paid  ⌃ │ │  │ DebtRow
│  │  ● Personal · 6.4% APR · Due 3rd                         │ │  │ (expanded)
│  │  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │ │  │
│  │  ┌─────────────┐┌─────────────┐┌─────────────┐          │ │  │  stat grid
│  │  │ 💵 Min pmt   ││ 📅 Payoff   ││ 🚩 Strategy │          │ │  │
│  │  │ $220.00      ││ Nov '27     ││ Avalanche   │          │ │  │
│  │  └─────────────┘└─────────────┘└─────────────┘          │ │  │
│  │  [ 💵 Make Payment ]        [ Edit Details ]             │ │  │  actions
│  │  [ 🔥 Attack ] [ 🧾 View Bill ] [ 🔗 Link Bill ]         │ │  │  chips
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │
│  ╎              +  Add New Debt                            ╎ │  ← dashed CTA
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Never a bare spinner. Mirror the real layout so nothing jumps when data lands.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Debts                                              ( + )   │  ← real header stays
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating shell
│  │  ▭▭▭▭▭▭                                                   │ │  Skeleton w120 h12
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭                     ← Skeleton w180 h34    │ │  (hero number)
│  │  ▭▭▭▭      ▭▭▭▭      ▭▭▭▭          ← 3× Skeleton w56 h12  │ │
│  │  ┌───────────────┐ ┌───────────────┐                     │ │  2× Skeleton tiles
│  │  │ ▭▭▭▭▭▭▭▭▭▭▭ │ │ ▭▭▭▭▭▭▭▭▭▭▭ │  h48                  │ │
│  │  └───────────────┘ └───────────────┘                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  3× DebtRow skeletons
│  │ (○)  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭            ▭▭▭▭▭▭▭             │ │  circle + 2 lines
│  │      ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭             │ │  + full-width bar
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ (○)  ▭▭▭▭▭▭▭▭▭▭▭▭                ▭▭▭▭▭▭             │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Skeleton fill is the component's built-in `rgba(255,255,255,0.08)` pulse — do not
  restyle it.
- Use `SkeletonStack` for the row's two text lines; a single `Skeleton` (circle,
  `borderRadius: radius.full`) for the debt icon slot.
- Header + add button render immediately (no skeleton) so navigation stays responsive.

### 3.3 Empty (no debts tracked)

Reuse the existing shared `EmptyState`, now sitting on the tokenized background.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Debts                                              ( + )   │
│                                                                │
│                                                                │
│                         ╭──────────╮                           │
│                         │    ↘↘    │   ← trending-down-outline │
│                         ╰──────────╯      colors.textMuted     │
│                                                                │
│                     No debts tracked          ← typography.h3  │
│         Add your first debt to start tracking and             │
│                    managing them.             ← textMuted      │
│                                                                │
│                   ┌──────────────────┐                        │
│                   │   +  Add Debt    │   ← primaryGradient CTA │
│                   └──────────────────┘                        │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

- `icon="trending-down-outline"`, `title="No debts tracked"`,
  `description="Add your first debt to start tracking and managing them"`,
  `actionLabel="Add Debt"`, `onAction={openAddForm}`. (Copy unchanged — it's good.)
- Vertically centered via `commonStyles.emptyState`.

### 3.4 Error (load failed)

Reuse the shared `ErrorState`, inline — do not blank the header.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹  Debts                                              ( + )   │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    ⊘  ← alert-circle-outline, colors.error │ │
│  │              Something went wrong                          │ │
│  │           We couldn't load your debts.                    │ │
│  │                   [  Retry  ]     ← text button, primary2  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- `title="Something went wrong"`, `message="We couldn't load your debts."`,
  `onRetry={() => { setError(null); setLoading(true); loadDebts(); }}`.

### 3.5 Edge cases in-wireframe

- **Long debt name** → `numberOfLines={1}` + ellipsis on name; balance never truncates
  (`flexShrink: 0`).
- **No due day** → omit the `· Due 15th` fragment (already handled).
- **APR 0 / min payment 0** → payoff month shows `—` rather than `999 mo`; stat reads
  "No min. pmt".
- **Single debt** → timeline card still renders (one bar); filter tabs still render.
- **Timeline all-mortgage** → timeline card is hidden (nothing left after mortgage
  exclusion), matching current behavior.

---

## 4. Token mapping (no magic numbers)

Every hardcoded value in `debts.tsx` → its design-system token.

### Background & container

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `C.bg '#0f0a1e'` | `colors.bg` (`#0f172a`) — for any opaque surface |
| `ScrollView paddingBottom: 120` | keep 120 (FAB/tab clearance) but source horizontal pad from `spacing.lg` |
| `paddingHorizontal: 16` (list, cards) | `spacing.lg` |
| `paddingHorizontal: 20` (header) | `spacing.lg` (align header to body gutter) |

### Colors

| Old hardcoded value | Replace with token | Notes |
|---|---|---|
| `C.accent '#a855f7'` | `colors.primary2` | purple accent |
| `C.accentDark '#7c3aed'` | `colors.primary` | gradient dark stop |
| `[C.accent, C.accentDark]` gradients | `gradients.primaryGradient` | Make-Payment btn, nudge icon |
| `C.income '#34d399'` | `colors.success` (`#22c55e`) | positive / paydown badge |
| `['#34d399','#059669']` payment gradient | `gradients.successGradient` | Apply-Payment button |
| `C.attack '#f87171'` | `colors.error` (`#ef4444`) | Attack bucket |
| `C.structured '#60a5fa'` | `colors.info` (`#3b82f6`) | Structured bucket |
| `['#3b82f6','#2563eb']` bill gradient | `gradients.infoGradient` | Create-Bill button |
| `C.warning '#fbbf24'` | `colors.warning` (`#eab308`) | Avg. APR value |
| `C.pink '#ec4899'` (shared dot) | `colors.primary2` (partner A) / `colors.info` (partner B) | see §7 attribution |
| `C.textPrimary '#f8fafc'` | `colors.text` | |
| `C.textMuted '#94a3b8'` | `colors.textMuted` | |
| `C.textDim 'rgba(255,255,255,0.3)'` | `colors.textDark` (`#475569`) | chevrons, hints |
| `C.surface 'rgba(255,255,255,0.06)'` | `glassEffects.glass` / `colors.glassMedium` | card fills |
| `C.border 'rgba(255,255,255,0.08)'` | `colors.borderGlass` | |
| `'rgba(255,255,255,0.06)'` progress track | `colors.glassMedium` | mini-ring + bar track |
| `catColor + '18'` (12% tint chips) | `colors.error`/`info` at ~`18` alpha | keep alpha suffix pattern on the *token* hex |
| `'rgba(0,0,0,0.2)'` stat boxes | `colors.glassLight` on `glass` | inset stats read as recessed glass |

### Radius

| Old | Token |
|---|---|
| `borderRadius: 20` (hero, modals) | `radius.xl` |
| `borderRadius: 16` (cards, rows) | `radius.lg` |
| `borderRadius: 14` (nudge, CTA, buttons) | `radius.lg` (consolidate to 16) |
| `borderRadius: 12` (stat box, inputs) | `radius.md` |
| `borderRadius: 10` (chips, tabs, action btns) | `radius.md` |
| `borderRadius: 8 / 6 / 4` (badges, tracks) | `radius.sm` (8); progress tracks may keep visual 2–4 as `radius.sm`/2 |
| mini-ring / partner dot circles | `radius.full` |

### Spacing

| Old | Token |
|---|---|
| `20` (hero pad, header pad) | `spacing.lg` (align to 16 gutter) or `spacing.xl` for hero inner |
| `16` (card pad, gaps, list gutter) | `spacing.lg` |
| `14 / 12` (row pad, gaps) | `spacing.md` |
| `10 / 8` (chip pad, inner gaps) | `spacing.sm` |
| `6 / 4 / 2` (tight gaps) | `spacing.xs` |
| `marginBottom: 16` between cards | `spacing.lg` (`spacing.xl` below the hero only) |

### Typography

| Old inline style | Token |
|---|---|
| hero balance `fontSize: 30, fontWeight: '800'` | `typography.h1` (32/700) |
| header title `fontSize: 22, fontWeight: '800'` | `typography.h3` (24/600) |
| debt balance `fontSize: 15, fontWeight: '700'` | `typography.bodyBold` |
| debt name `fontSize: 14, fontWeight: '700'` | `typography.smallBold` |
| stat/summary values `fontSize: 13–14, '700'` | `typography.smallBold` |
| subtitles / labels `fontSize: 10–12` | `typography.caption` |
| bucket badge `fontSize: 8, uppercase` | `typography.caption` at 10 + `letterSpacing: 0.5`, uppercase |
| modal title `fontSize: 18, '800'` | `typography.h3` (or `bodyBold` for sheets) |
| button text `fontSize: 16, '800'` | `typography.button` |

### Glass surfaces

| Element | Token |
|---|---|
| Hero Summary card | `glassEffects.glassFloating` (only floating card) |
| Payoff Timeline card | `glassEffects.glass` |
| DebtRow card | `glassEffects.glass` |
| Attention (nudge) | `AttentionCard` shared component (already tokenized) |
| Stat boxes (inside expanded row) | `glassEffects.glass` w/ `colors.glassLight` fill |
| Modals / bottom sheets | `glassEffects.glassStrong` over `colors.surface2` (`#1e293b`) instead of `#1a1a2e` |

---

## 5. Component specs

Shared components reused as-is: **`GradientBackground`**, **`BackButton`**,
**`EmptyState`**, **`ErrorState`**, **`Skeleton` / `SkeletonStack`**, **`AttentionCard`**.
New screen-local components below get JSON specs under
`docs/design/components/debts-*.json`.

### 5.1 Header

- `BackButton` (shared) `fallback="/(tabs)/goals"`, `color={colors.textMuted}`, `size={20}`.
- Title "Debts" in `typography.h3`, `colors.text`.
- Add button: 44×44 tappable (visual 34×34 chip `radius.md`, `glass` fill,
  `colors.borderGlass` border), `+` icon `colors.primary2`. `accessibilityLabel="Add debt"`.
- Container: `spacing.lg` horizontal, aligned to body gutter (no more 20 vs 16 mismatch).

### 5.2 `DebtSummaryHero` (glassFloating)  → `debts-summary-hero.json`

- **Top row:** "Total debt" label (`caption`, `textMuted`) + paydown badge
  (`▾ -$847/mo`, `colors.success` on `success@12%`, `arrow-down` icon). The badge shows the
  monthly min-payment outflow as debt *reduction* — icon + sign + color, never color alone.
- **Hero number:** `formatCurrency(totalBalance)` in `typography.h1`, `colors.text`.
- **Stat trio:** Min. payment / Avg. APR / Accounts, divided by 1px `colors.borderLight`
  rules. Avg. APR value in `colors.warning`; others `colors.text`; all `smallBold`.
  Labels `caption` `textMuted`.
- **Split tiles:** two side-by-side tiles (`glass`, `radius.md`):
  - Attack tile — `flame` icon `colors.error`, "ATTACK" `caption`, `fmtShort(attackTotal)`.
  - Structured tile — `shield-checkmark` `colors.info`, "STRUCTURED", `fmtShort(structuredTotal)`.
  - Each tile is tappable → sets the filter to that bucket (nice IA shortcut; optional).
- States: default; **zero-debt never reaches here** (empty state intercepts).

### 5.3 Attention slot (shared `AttentionCard`)

- The current bespoke `aiInsightCard` map is **replaced** by the shared `AttentionCard`
  pattern for visual consistency with the dashboard. Feed it the debt-filtered nudges
  (`debt_progress`, `debt_category_suggestion`, `debt_reclassification`,
  `structured_debt_milestone`) adapted to `AttentionItem` shape.
- If the nudge payload can't be mapped to an `AttentionCard` action cleanly, keep a
  thin local `DebtNudgeCard` that mirrors `AttentionCard`'s tokens exactly
  (`colors.primary` gradient icon chip, `glass`, `radius.lg`, dismiss `close` in
  `textDark`). Spec: `debts-nudge-card.json`.
- Renders nothing when there are no debt nudges (component returns null; caller shows no
  fallback).

### 5.4 `PayoffTimeline` card  → `debts-payoff-timeline.json`

- Header: `time-outline` `colors.primary2` + "Payoff Timeline" (`smallBold`) on the left;
  a "Calculator ›" text button on the right (`colors.primary2`, `radius.md` chip,
  `primary@10%` fill) → `router.push('/payoff-calculator')`.
- Rows: `{ name (caption, textMuted, right-aligned, w70), bar (flex, h8, track
  glassMedium), estDate (caption, textMuted, w50) }`.
- **Bar color by bucket, not one gradient:** Attack rows use `colors.error →
  error@88`; Structured rows use `colors.info → info@88` (was `C.attack`/`C.structured`).
- Footer: "Mortgage excluded · Based on minimum payments" in `caption`, `colors.textDark`.
- Empty: card hidden when `timelineDebts.length === 0`.

### 5.5 `DebtFilterTabs`  → `debts-filter-tabs.json`

- Segmented row: All / Attack / Structured, each with a count badge.
- Active tab: bucket color tint (`error@18` Attack, `info@18` Structured, `primary@18`
  All) fill + border; icon + label in bucket color. Inactive: `glassLight` fill,
  `borderGlass`, `textMuted`.
- Attack tab shows `flame`; Structured shows `shield-checkmark` (icon reinforces the
  bucket beyond color).
- Count badge: `glassMedium` pill, `caption` `smallBold`.
- Each tab ≥ 44pt tall tappable; `radius.md`.

### 5.6 `DebtRow`  → `debts-row.json`

The list primitive. Collapsed by default, expands in place.

**Collapsed:**
- Card `glass`, `radius.lg`, `colors.borderGlass`, `marginBottom: spacing.sm`.
- **Progress ring + icon:** 42px `MiniRing` (keep SVG component) — track
  `colors.glassMedium`, progress stroke = bucket color (`error`/`info`). Centered
  liability icon in bucket color. Tappable area padded to ≥44pt.
- **Info:** name (`smallBold`, `numberOfLines={1}`) + bucket badge
  (`caption` uppercase, bucket color on bucket@18 tint). Subtitle: a `radius.full` dot
  (`colors.primary2` shared / `colors.textMuted` personal) + `Shared/Personal · {apr}% APR
  · Due {n}th` in `caption` `textMuted`.
- **Trailing:** balance (`bodyBold`, `colors.text`) + "{n}% paid" (`caption`, `textMuted`)
  + chevron (`chevron-down`, `colors.textDark`).
- **Full-width progress bar** below: `h4`, track `glassMedium`, fill bucket-color
  gradient to `{paidPercent}%`, `radius.sm`.

**Expanded (adds):**
- Divider `colors.borderLight`, `spacing.md`.
- **Stat grid** (3): Min payment / Payoff date / Strategy — each a `glass` box
  (`glassLight` fill, `radius.md`), outline icon `colors.textDark`, label `caption`
  `textMuted`, value `smallBold` `colors.text`.
- **Primary actions:** `[💵 Make Payment]` (`gradients.primaryGradient`, `radius.md`,
  white `button` text) + `[Edit Details]` (`glass` secondary, `textMuted`).
- **Chip row:** bucket-toggle chip (Attack/Structured, bucket color on bucket@12),
  `[🧾 View Bill]` / `[+ Create Bill]` (`colors.info` on info@12), and `[🔗 Link Bill]`
  (`colors.primary2` on primary@12, only when no bill exists).
- States: `default`, `pressed` (activeOpacity 0.7 / scale via `animation.fast`),
  `expanded`, `loading` (skeleton variant §3.2), `overdue` (if a linked bill is overdue,
  ring stroke → `colors.error` regardless of bucket + `[OVERDUE]` chip in the subtitle).

### 5.7 Modals / bottom sheets (Add-Edit, Payment, Create-Bill, Link-Bill)

Not restructured functionally — just re-tokenized so they stop being `#1a1a2e` islands:

- Sheet surface: `colors.surface2` (`#1e293b`) with `glassStrong` border, `radius.xl` top
  corners. Backdrop `rgba(0,0,0,0.6)` (keep).
- Inputs: `glassMedium` fill, `colors.borderGlass`, `radius.md`, text `colors.text`,
  placeholder `colors.textMuted`, `typography.body`.
- Labels: `typography.smallBold`, `colors.text`.
- Segmented pickers (liability type, frequency, strategy, category): active =
  `primary@18` fill + `primary` border (or bucket color for the category picker), inactive
  = `glassMedium`. Uses `radius.md`, `caption`/`small` text.
- Switches: `trackColor` on → `primary@40`, thumb → `colors.accent` (`#c084fc`); off →
  `glassMedium` track, `colors.textMuted` thumb. (Tokenizes the current `#c084fc`.)
- Primary buttons: Save/Add → `gradients.primaryGradient`; Apply Payment →
  `gradients.successGradient`; Create Bill → `gradients.infoGradient`. `radius.lg`,
  `typography.button`.
- Add-debt form fields (Name, Balance, APR, Min Payment, Due Day, Type, Category,
  Strategy, Share toggle, Create-bill toggle) — order and behavior unchanged.

---

## 6. Interactions

- **Tap DebtRow** → expand/collapse in place; chevron flips; height animates over
  `animation.medium`. Only one row expanded at a time (existing single-`expandedId`).
- **Tap Make Payment** → payment bottom sheet (`animationType="fade"`), amount input,
  Apply → `PATCH …/payment`, refresh.
- **Tap bucket chip** → optimistic `toggleCategory` (`PUT …/category`), row re-tints
  instantly; reverts on error.
- **Tap filter tab** → filters list; no navigation.
- **Tap split tile** (optional) → sets filter to that bucket.
- **Tap Calculator** → `router.push('/payoff-calculator')`.
- **Tap add (+) / Add New Debt CTA** → Add-Debt sheet.
- **Pull-to-refresh** → re-run `loadDebts()` (add `RefreshControl` tinted `colors.primary2`
  — currently missing, recommended for the list archetype).
- All transitions use `animation.fast`/`medium`; honor reduced motion (§8).

---

## 7. Couples nuance — whose debt is it

CoupleFlow is a two-partner app; `is_shared` already exists on each debt. Keep it
**lightweight** (same discipline as calendar §6):

- Subtitle dot: **Shared** → `colors.primary2`; **Personal** → `colors.textMuted` (not the
  off-palette `#ec4899`). Always paired with the literal word "Shared"/"Personal" so it's
  not color-only.
- If per-partner attribution becomes available later, use partner A `colors.primary2`,
  partner B `colors.info`, as a 14px initial glyph in the subtitle — additive, graceful
  degrade to the Shared/Personal dot when absent.
- Never encode ownership by changing the balance color; amounts stay neutral `colors.text`.

---

## 8. Accessibility

- **Touch targets:** DebtRow header, filter tabs, chips, add button, and all sheet
  buttons ≥ 44×44pt. The 34px add chip and 42px ring sit inside 44pt padded hit areas.
- **Color independence:** Attack vs Structured = **icon (`flame` vs `shield-checkmark`)
  + uppercase word + color**. Overdue = `[OVERDUE]` word + `error` color + icon. Shared vs
  Personal = word + dot. Nothing rides on hue alone.
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears
  WCAG AA. Verify the bucket badge text (bucket color on bucket@18 tint) at 4.5:1; if
  `colors.warning` on its tint fails for small text, darken the tint or use `colors.text`.
- **Screen-reader order & labels:**
  - Hero: "Total debt {amount}, minimum payment {x}, average APR {y} percent, {n}
    accounts. Attack {a}, Structured {b}."
  - DebtRow: `accessibilityRole="button"`, label
    `"{name}, {Attack|Structured}, balance {amount}, {percent} percent paid,
    {Shared|Personal}"`, hint "Double tap to expand details."
  - Filter tabs: `accessibilityRole="tab"`, `accessibilityState={{ selected }}`,
    label "{label}, {count} debts".
  - Progress ring/bar: `accessibilityLabel="{percent} percent paid off"`; the SVG ring is
    `accessibilityElementsHidden` (the text label carries it).
- **Reduced motion:** row expand, chevron flip, and chip re-tint use `animation.fast`;
  under `AccessibilityInfo.isReduceMotionEnabled`, swap the height/opacity animation for an
  instant toggle. Skeleton pulse also respects reduced motion (disable the loop).

---

## 9. Developer notes

- Delete the local `const C = {…}` object entirely; import `colors, gradients,
  glassEffects, spacing, radius, typography, commonStyles` from `@/utils/design-system`.
- Replace the outer `<LinearGradient colors={['#0f0a1e',…]}>` with
  `<GradientBackground variant="bgDarkPurple">`; keep the inner `SafeAreaView` +
  `ScrollView` (`paddingBottom: 120` for FAB/tab clearance).
- Keep `MiniRing` and `PayoffTimeline` SVG components — only swap their hardcoded colors
  for tokens (bucket color params instead of `C.attack`/`C.structured`; track
  `colors.glassMedium`).
- Reuse `components/Skeleton.tsx` (`Skeleton`, `SkeletonStack`) for the loading state and
  the shared `AttentionCard` for nudges — do not re-implement either.
- `getPaidPercent` is a heuristic (`1 - balance/(balance*1.3)`), so it's always ~23% — flag
  for the backend to return an `original_balance` so the ring/bar reflect real progress.
  Until then, keep the heuristic but label it honestly ("est.") to avoid implying precision.
- Keep split fields (`attackTotal`, `structuredTotal`, `totalMinPayment`, `weightedApr`)
  as separate derived values end-to-end; never blend Attack + Structured into one bar —
  the split is the point.
- Add a `RefreshControl` (`tintColor={colors.primary2}`) to the ScrollView for the list
  archetype; it's currently absent.

---

## 10. Handoff checklist

- [x] All states designed (default, loading-skeleton, empty, error, overflow, overdue)
- [x] Local `C` palette + off-palette gradient fully mapped to design-system tokens
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Attack/Structured re-encoded on token palette, color-independent (icon+word+color)
- [x] Only the hero floats / uses `h1`; timeline + rows demoted to flat `glass`
- [x] Shared components reused (GradientBackground, BackButton, EmptyState, ErrorState,
      Skeleton, AttentionCard)
- [x] Component specs written (`docs/design/components/debts-*.json`)
- [x] Accessibility: 44pt targets, color-independent status, SR labels, reduced motion
- [x] Couples attribution kept lightweight and graceful-degrade
