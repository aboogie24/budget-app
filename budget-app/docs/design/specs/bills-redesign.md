# Bills Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `bills` → `budget-app/app/bills.tsx`
**Archetype:** list (mirrors `calendar.tsx` / `dashboard.tsx` conventions)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Sibling references:** `calendar-redesign.md`, `dashboard-redesign.md`

---

## 1. Why this redesign exists

The Bills screen is a **standalone visual island**. Like the pre-redesign calendar, it
hardcodes its own palette and surfaces instead of consuming the design system:

- Its own gradient background: `['#0f0a1e','#1a1035','#0f0a1e']` — **not** any
  `gradients.*` entry, so it reads as a slightly different app from calendar/dashboard.
- Its own status palette: `STATUS_CONFIG` uses `#34d399 / #fbbf24 / #f87171` — hand-mixed
  greens/yellows/reds that are *near* but **not equal to** `colors.success / warning /
  error`. Two screens showing "overdue" in two different reds is exactly the inconsistency
  the calendar redesign set out to kill.
- Its own owner palette (`OWNER_COLORS` `#a855f7 / #ec4899 / #06b6d4`) that doesn't match
  the couples-attribution convention the dashboard/calendar already settled on
  (Partner A `colors.primary2`, Partner B `colors.info`).
- Ad-hoc surfaces everywhere: `rgba(255,255,255,0.04)` cards, `rgba(255,255,255,0.06)`
  borders, raw `borderRadius: 16`, raw paddings `20 / 16 / 14 / 12 / 8`, and inline font
  sizes/weights (`fontSize: 22/24/16/14/11`) — none tokenized.
- A **spinner-only** loading state (`<ActivityIndicator color="#c084fc">`), where the rest
  of the app now uses `Skeleton` placeholders that hold layout.
- The header is bespoke (`headerRow` + inline title) rather than the standard
  `BackButton` + title row the sibling screens share.

Everything below swaps those hardcoded values for design-system tokens and shared
components, and tightens the information architecture — **without changing what the screen
does**. Every current capability is preserved: summary hero (progress ring + totals),
month timeline, auto-detect, bank-derived suggestions, status/owner filters, the bill list
with mark-paid / edit / delete, and the add/edit modal with its pickers.

### The IA problem we also fix

Today the top of the screen stacks five separate blocks before the first bill: hero card,
timeline, auto-detect button, suggestions section, filter tabs, owner legend. That is a
lot of chrome above the actual list. This redesign keeps all of it but **groups and
prioritizes** it so the primary job — "what do I owe and what's overdue" — is answered in
the first card, and secondary tools (auto-detect, suggestions) fold into a consistent
rhythm of glass sections.

### The "committed vs. upcoming" money split (borrowed from calendar)

Bills carry the same actual-vs-projected duality the calendar redesign formalized:

- A **paid** bill is real money already gone.
- An **unpaid** bill is a **projection** — it *will* leave the account this period but
  hasn't yet. **Overdue** is an unpaid bill that's late.

We reuse the calendar's rule so the two screens read identically:
**paid = solid, unpaid/overdue = outlined/ghosted with a word-label.** This is applied to
the summary split and to each bill row's status, and it is **never color-only** (icon +
word + color together).

---

## 2. Token & convention mapping (no magic numbers)

Every hardcoded value in `bills.tsx` → its design-system replacement.

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `STATUS_CONFIG.paid.color '#34d399'` | `colors.success` |
| `STATUS_CONFIG.unpaid.color '#fbbf24'` | `colors.warning` |
| `STATUS_CONFIG.overdue.color '#f87171'` | `colors.error` |
| status chip bg `rgba(52,211,153,0.12)` etc. | semantic color at 12% (`rgba(34,197,94,0.12)` / `rgba(234,179,8,0.12)` / `rgba(239,68,68,0.12)`) — same tint recipe as `CalendarEventRow.json` |
| `OWNER_COLORS.You '#a855f7'` | Partner A → `colors.primary2` |
| `OWNER_COLORS.Partner '#ec4899'` | Partner B → `colors.info` |
| `OWNER_COLORS.Joint '#06b6d4'` | Shared → `colors.textMuted` (neutral, no strong hue — matches calendar "shared = neutral") |
| autopay badge `#60a5fa` / `rgba(96,165,250,0.12)` | `colors.info` / `rgba(59,130,246,0.12)` |
| debt badge `#f472b6` / `rgba(236,72,153,0.12)` | `colors.primary2` / `rgba(168,85,247,0.12)` |
| card amount `#c084fc` | `colors.accent` |
| suggestions accent `#f59e0b` / `rgba(245,158,11,*)` | `colors.warning` / `rgba(234,179,8,*)` |
| suggestion "Add" `#34d399` | `colors.success` |
| auto-detect `#60a5fa` / `rgba(96,165,250,0.08)` | `colors.info` / `rgba(59,130,246,0.08)` |
| progress ring track `rgba(255,255,255,0.08)`, fill `#34d399` | reuse `components/ProgressRing.tsx`; fill `colors.success` |
| timeline progress `['#7c3aed','#a855f7']` | `gradients.primaryGradient` |
| timeline `todayMarker '#a855f7'` | `colors.primary2` |
| card / glassCard `rgba(255,255,255,0.04)` fill | `glassEffects.glass` (`colors.glassLight`) |
| hero card `rgba(124,58,237,0.12)` fill + `rgba(168,85,247,0.2)` border | `glassEffects.glassFloating` (hero earns elevation, matches calendar summary header) |
| all borders `rgba(255,255,255,0.06/0.08)` | `colors.borderGlass` / `colors.borderLight` |
| `borderRadius: 16` (cards) / `12` (chips/inputs) / `10` (small) | `radius.lg` / `radius.md` / `radius.sm` |
| paddings `20 / 16 / 14 / 12 / 8 / 6 / 4` | `spacing.xl / lg / md / sm / xs` |
| `headerTitle fontSize:22/700` | `typography.h3` |
| `totalDueAmount fontSize:24/800` | `typography.h2` |
| `cardTitle / suggestionName 14/700` | `typography.bodyBold` |
| `cardAmount 16/800` | `typography.bodyBold` (color `colors.accent`) |
| detail / meta `11–12` | `typography.caption` |
| section titles (uppercase 12) | `typography.smallBold`, `letterSpacing 0.5`, `colors.textMuted` |
| modal bg `#1a1a2e` | `colors.surface2` (`#1e293b`) |
| input bg `rgba(255,255,255,0.06)` | `glassEffects.glass` fill + `colors.borderGlass` |
| input/label text `#f8fafc / #e5e7eb / #94a3b8` | `colors.text` / `colors.text` / `colors.textMuted` |
| picker active `rgba(168,85,247,0.18)` | `rgba(124,58,237,0.18)` (primary tint, matches calendar selected cell) |
| save button `['#a855f7','#7c3aed']` | `gradients.primaryGradient` |
| header add button `['#7c3aed','#a855f7']` | `gradients.primaryGradient` |
| `ActivityIndicator` loading | `components/Skeleton.tsx` (see §4 loading) |
| `EmptyState` / `ErrorState` components | keep as-is (already shared & tokenized) |
| `BackButton` | keep (already standard) |

**Rule:** after this pass there are **no** literal hex/rgba/px in `bills.tsx` except the
12%-tint status backgrounds, which are the documented semantic-tint recipe.

---

## 3. Redesigned layout & information architecture

Ordered top→bottom, each block a tokenized glass section with `spacing.lg` between:

1. **Header row** — standard `BackButton` + `Bills` title (`typography.h3`) on the left,
   gradient `+` add button on the right. Matches sibling screens exactly.
2. **Summary hero** (`glassFloating`) — progress ring + the **committed/upcoming split**.
   This is the headline and earns elevation.
3. **Month timeline** (`glass`) — unchanged capability, retokenized. Only shown when
   `bills.length > 0`.
4. **Filter tabs** — horizontal segmented scroller (All / Upcoming / Paid / Overdue) with
   count badges. Promoted directly under the hero so filtering is the first interaction.
5. **Tools row** — auto-detect + suggestions, grouped. Suggestions only render when
   present; auto-detect is a full-width secondary button.
6. **Bill list** — the core. Grouped by status when filter = All (Overdue → Upcoming →
   Paid); flat when a specific filter is active. Owner legend collapses into an inline
   caption above the list rather than its own block.

### Wireframe — Default / populated

```
┌──────────────────────────────────────────────────────────┐
│  ‹ Bills                                          [ + ]   │  ← BackButton + h3 + add
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │        ╭───────╮   TOTAL DUE                        │  │  glassFloating (hero)
│  │        │  8 of │   $2,340.00 /mo                    │  │
│  │        │  12   │                                    │  │  ProgressRing (success)
│  │        ╰───────╯   ▆ Paid $1,475   ▢ Due $865       │  │  split: solid / dashed
│  │                    ⚠ 2 overdue · $210               │  │  overdue line (error+word)
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  JULY TIMELINE                        Today: 10th   │  │  glass
│  │  ●──────�────●──│──◌────◌──────●──────◌              │  │  progress fill + dots
│  │  ● Paid   ◌ Upcoming   ⚠ Overdue                    │  │  legend (icon+word)
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  [ All ·12 ] [ Upcoming ·3 ] [ Paid ·8 ] [ Overdue ·2 ]  │  ← filter tabs (scroll)
│                                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ⟲  Auto-detect from bank                           │  │  secondary button (info)
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ✦ SUGGESTED BILLS (2)                              │  │  glass, warning accent
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │ Spotify        $10.99·monthly·4 charges       │  │  │
│  │  │                              [ + Add ]  [ × ] │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ◐ You   ◑ Partner   ○ Joint                              │  ← inline owner legend
│                                                            │
│  ── OVERDUE ──────────────────────────────────────────    │  group label (muted)
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     │
│  ╎ ◐ Rent                              ⚠OVERDUE ~$1,800  │  dashed / ghosted (unpaid)
│  ╎    Due 1st · Housing                              ╎     │
│  ╎    [ ✓ Mark Paid ]                          [ 🗑 ] ╎     │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘     │
│                                                            │
│  ── UPCOMING ─────────────────────────────────────────    │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     │
│  ╎ ○ Internet — Xfinity      [AUTO] ⏱DUE  ~$120.00  ╎     │  dashed, AUTO + DUE chips
│  ╎    Due 17th · Utilities                    [ 🗑 ] ╎     │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘     │
│                                                            │
│  ── PAID ─────────────────────────────────────────────    │
│  ┌──────────────────────────────────────────────────┐     │
│  │ ◑ Netflix                          ✓PAID  $15.49  │     │  SOLID card (paid = actual)
│  │    Paid Jul 3 · Entertainment                     │     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

**Key IA changes vs. today:**
- The hero's flat "Paid / Remaining / Overdue" mini-columns become the **committed vs.
  upcoming split** (solid Paid, dashed Due) plus a dedicated overdue line — same language
  as the calendar summary header.
- Owner legend demoted from a standalone block to a one-line inline caption.
- When filter = All, the list is **grouped by status** (Overdue first) so the most urgent
  bills are never buried below paid ones. Any specific filter renders a flat list.

---

## 4. State wireframes

### Loading (skeleton — reuse `components/Skeleton.tsx`)

Do **not** ship the bare `ActivityIndicator`. Hold the layout:

```
┌──────────────────────────────────────────────────────────┐
│  ‹ Bills                                          [ + ]   │  header renders immediately
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │  ◐▒▒▒▒     ▒▒▒▒▒▒▒▒▒▒▒▒▒                            │  │  hero skeleton:
│  │           ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                      │  │  circle + 2 lines
│  └────────────────────────────────────────────────────┘  │
│  [▒▒▒] [▒▒▒▒] [▒▒▒] [▒▒▒▒]                                │  4 pill skeletons
│  ┌────────────────────────────────────────────────────┐  │
│  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒              ▒▒▒▒▒▒                 │  │  ×4 row skeletons
│  │ ▒▒▒▒▒▒▒▒                                           │  │  (height ~72)
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- Hero: `Skeleton` circle (64×64, `borderRadius: radius.full`) + two `Skeleton` lines
  (`SkeletonStack count={2}`).
- Filter tabs: 4 `Skeleton` pills (`width: 72, height: 32, borderRadius: radius.md`).
- List: 4 row skeletons, each a `glass` card `height ~72` with a `SkeletonStack count={2}`
  inside — matches the real `BillRow` height so nothing jumps when data arrives.
- Background refresh (data already loaded once): keep a small header `ActivityIndicator`
  instead of swapping the whole list to skeleton — same pattern as dashboard.

### Empty (no bills tracked)

Reuse the existing shared `EmptyState` component (already tokenized), unchanged copy:

```
┌──────────────────────────────────────────────────────────┐
│  ‹ Bills                                          [ + ]   │
├──────────────────────────────────────────────────────────┤
│                                                            │
│                     ▢  (document-text-outline)            │  colors.textDark icon
│                  No bills tracked                          │  typography.bodyBold
│      Add your first bill to start tracking recurring       │  caption, textMuted
│                     payments                               │
│                    [  Add Bill  ]                          │  primaryGradient CTA
│                                                            │
└──────────────────────────────────────────────────────────┘
```

> Note: if `suggestions.length > 0` while `bills.length === 0`, still surface the
> Suggested Bills card **above** the empty state — a first-time user with detectable
> recurring charges should see the one-tap path to populate the screen. This is the one
> case where a section renders in the empty state.

### Error

Reuse the shared `ErrorState` (already used, keep). It renders inline (glass card,
`alert-circle-outline` in `colors.error`, "Something went wrong", `Retry`) — the header and
any already-loaded chrome stay; don't blank the screen.

### Overflow / edge cases

- **Long bill/payee names:** `numberOfLines={1}` + ellipsis on name; **amount never
  truncates** (`flexShrink: 0`).
- **Many bills:** the outer `ScrollView` handles it; group labels are sticky-optional (not
  required). `paddingBottom: spacing.xxxl * 2` keeps the last row clear of the FAB/tab bar.
- **Many suggestions:** cap visible at 5, then a "Show N more" text button inside the
  suggestions card (keeps the tools zone from dominating the fold).
- **Approximate amounts:** suggestion/projected amounts prefixed `~` (`amount_variance ===
  'approximate'` already drives the `(avg)` label — reuse the `~` convention from
  `CalendarEventRow`).
- **Zero overdue:** hero overdue line hides entirely (don't show "0 overdue").

---

## 5. Component specs

All components consume tokens from `design-system.ts`. Reuse shared components where noted;
new sub-components are colocated helpers within `bills.tsx` (like the calendar's
colocated cell/row helpers) unless the team prefers extraction.

### 5.1 `BillsHeader` (reuse pattern, not new)
Standard header row identical to sibling screens.
- Left: `<BackButton fallback="/(tabs)/goals" />` + `Text` title (`typography.h3`,
  `colors.text`).
- Right: `TouchableOpacity` → `LinearGradient colors={gradients.primaryGradient}`,
  40×40, `radius.md`, `+` icon (`colors.text`, 22).
- Touch target ≥ 44 (BackButton already 40 + hitSlop 12).

### 5.2 `BillsSummaryHero`
| Aspect | Spec |
|---|---|
| Container | `glassEffects.glassFloating`, `padding: spacing.xl`, `borderRadius: radius.lg` |
| Ring | reuse `components/ProgressRing.tsx`; `percent={paidPct}`, `color={colors.success}`, center shows `{paidCount}` (`typography.bodyBold`) / `of {total}` (`caption`, `textMuted`) |
| Total due | label `TOTAL DUE` (`caption`, `textMuted`, uppercase, `letterSpacing 0.5`); value `fmt(totalDue)` (`typography.h2`, `colors.text`) + `/mo` suffix (`caption`, `textMuted`) |
| Split | two inline stats: **Paid** `▆` solid swatch + `fmt(paidAmount)` in `colors.success`; **Due** `▢` dashed swatch + `fmt(unpaidAmount)` in `colors.warning`. Encodes committed-vs-upcoming (solid vs dashed) — matches calendar |
| Overdue line | only if `overdueCount > 0`: `⚠` icon (`warning-outline`, `colors.error`) + `{overdueCount} overdue · {fmt(overdueAmount)}` in `colors.error`. Icon + word + color (not color-only) |
| States | default, loading (skeleton per §4), empty (hero hidden when 0 bills — EmptyState takes over) |

### 5.3 `BillTimeline` (retokenized, capability unchanged)
- Container `glassEffects.glass`, `padding: spacing.lg`.
- Title `{month} TIMELINE` (`smallBold`, uppercase, `textMuted`); `Today: {ordinal}`
  (`caption`, `textMuted`).
- Track `colors.borderLight`; progress fill `gradients.primaryGradient`; today marker
  `colors.primary2`.
- Dots use the **status token** for the bill: `colors.success` (paid) / `colors.warning`
  (upcoming) / `colors.error` (overdue).
- Legend items are **icon + word** (`✓ Paid`, `⏱ Upcoming`, `⚠ Overdue`) so status isn't
  color-only.
- Dot size ≥ 14 with 2px border in the background color (keep current border-separation
  trick, but border color = the gradient's dark base, not a literal).

### 5.4 `FilterTabs`
Horizontal segmented scroller. Model on `ScopeToggle` styling but multi-segment + counts.
| Aspect | Spec |
|---|---|
| Tab (inactive) | `glassEffects.glass`, `radius.md`, `paddingV: spacing.sm`, `paddingH: spacing.md`; text `smallBold` `colors.textMuted` |
| Tab (active) | fill `rgba(124,58,237,0.2)`, border `rgba(124,58,237,0.4)`; text `colors.primary2` |
| Count badge | pill, `radius.sm`; inactive `colors.glassMedium` bg + `textMuted`; active primary tint + `colors.primary2` |
| A11y | `role="tab"`, `accessibilityState={{ selected }}`, announce filter change |
| Target | each tab ≥ 44 tall (pad to it) |

### 5.5 `AutoDetectButton`
Full-width secondary button.
- Idle: `flexRow` centered, `scan-outline` (`colors.info`) + "Auto-detect from bank"
  (`smallBold`, `colors.info`); bg `rgba(59,130,246,0.08)`, border `rgba(59,130,246,0.15)`,
  `radius.md`, `paddingV: spacing.md` (≥44 tall).
- Detecting: `ActivityIndicator` (`colors.info`) + "Scanning…", button `disabled`.

### 5.6 `SuggestionsCard` + `SuggestionRow`
- Card: `glassEffects.glass` with a `colors.warning` accent border tint
  (`rgba(234,179,8,0.18)`), `padding: spacing.md`.
- Header: `sparkles-outline` (`colors.warning`) + `SUGGESTED BILLS (n)` (`smallBold`,
  uppercase, `colors.warning`).
- Row: name (`bodyBold`, `numberOfLines 1`) over meta
  `{~amount} · {frequency} · {n} charges [· category]` (`caption`, `textMuted`).
- `Add` button: `success` tint pill (`rgba(34,197,94,0.12)` bg, `colors.success` text),
  ≥44 target; shows `ActivityIndicator` (`colors.success`) while `acceptingId` matches.
- Dismiss: `close` icon (`colors.textMuted`), `hitSlop` to reach 44.
- Amount prefixed `~` when `amount_variance === 'approximate'`.

### 5.7 `BillRow` (the core — actual vs projected, mirrors `CalendarEventRow`)
Single predicate drives the two visual modes: `isPaid = status === 'paid'`.

| Aspect | PAID (actual) | UNPAID / OVERDUE (projected) |
|---|---|---|
| Card | `glassEffects.glass` (solid) | ghosted glass: `borderStyle: 'dashed'`, `borderColor: colors.borderGlass`, near-transparent fill |
| Name | `bodyBold`, `colors.text`, opacity 1.0 | `bodyBold`, opacity ~0.85 (verify contrast — see §7) |
| Amount | `fmt(amount)`, `colors.accent`, exact | `~fmt(amount)` prefixed `~`, `colors.warning` (overdue → `colors.error`) |
| Status chip | `✓ PAID` `colors.success` @12% | `⏱ DUE` `colors.warning` @12% / `⚠ OVERDUE` `colors.error` @12% |
| Owner glyph | leading dot: A `colors.primary2` / B `colors.info` / shared `colors.textMuted` | same |
| Autopay | `[AUTO]` pill `colors.info` (`flash` icon) | same |
| Debt link | `[DEBT]` pill `colors.primary2` (`link` icon) | same |
| Subtitle | `Paid {date} · {category}` (`caption`, `textMuted`) | `Due {ordinal} · {category}` incl. word if projected (`caption`, `textMuted`) |
| Actions | delete only (`trash-outline`, `colors.error`) | `✓ Mark Paid` (`success` pill) + delete |

- Layout: min height 72, `padding: spacing.md`, `gap: spacing.md`, whole row tappable →
  `openEdit(bill)`; action buttons `stopPropagation`.
- Amount `flexShrink: 0`; name `numberOfLines 1`.
- Status is conveyed by **icon + word + color** — never color alone.

### 5.8 `BillFormModal` (retokenized, capability unchanged)
Bottom-sheet modal, all fields preserved (name, amount, due day, frequency picker, payee,
category picker, linked-debt picker, autopay switch, shared switch, save).
- Sheet bg `colors.surface2`, `borderTopRadius: radius.xl`, `padding: spacing.xl`.
- Title `typography.h3` (`Add Bill` / `Edit Bill`), close `× ` (`colors.textMuted`, ≥44
  hitSlop).
- Labels `smallBold` `colors.text`; inputs `glass` fill + `colors.borderGlass` border,
  `radius.md`, text `colors.text`, placeholder `colors.textMuted`, min height 44.
- Picker buttons: `glass` row, chevron `colors.textMuted`; picker sheets reuse the same
  `surface2` bottom-sheet; active option tint `rgba(124,58,237,0.18)` + `colors.text`.
- Switches: autopay track/thumb `colors.info`; shared track/thumb `colors.primary2`.
- Save: `LinearGradient colors={gradients.primaryGradient}`, `radius.lg`, min height 52,
  text `button` `colors.text`.
- Keyboard avoidance: wrap in the same keyboard-avoiding pattern siblings use for
  input-heavy sheets; numeric fields (`amount`, `due day`) use `keyboardType="numeric"`
  (already do).

---

## 6. Interactions

- **Add:** header `+` → open modal in create mode (reset form). Same for EmptyState CTA.
- **Edit:** tap a `BillRow` → open modal prefilled.
- **Mark paid:** row `✓ Mark Paid` → `POST /pay`; optimistic — the row can transition from
  ghosted (projected) to solid (actual) immediately, then reconcile on refetch. Transition
  uses `animation.medium`; under reduce-motion, snap.
- **Delete:** row `🗑` → confirm `Alert` → `DELETE` → refetch. (Keep destructive `Alert`.)
- **Filter:** tab tap re-filters instantly; grouped view only when `All`.
- **Auto-detect:** button → scan; result surfaced via `Alert`; refetch bills + suggestions.
- **Accept suggestion:** `+ Add` → optimistic remove from list + refetch bills.
- **Dismiss suggestion:** `×` → optimistic remove, fire-and-forget (existing behavior).
- **Press feedback:** rows/buttons `activeOpacity ~0.7` or scale 0.97 (matches
  `ScopeToggle`); durations from `animation.fast`.
- **Pull-to-refresh:** add `RefreshControl` (tint `colors.primary2`) to the list
  `ScrollView` — sibling dashboard has it; bills should match.

---

## 7. Accessibility

- **Touch targets ≥ 44×44pt:** filter tabs, `+`, Mark Paid, delete, dismiss, picker rows,
  switches. Pad where the visual is smaller (delete icon, dismiss `×`) via `hitSlop`.
- **Color-independent status:** every status is **icon + word + color** — `✓ PAID`,
  `⏱ DUE`, `⚠ OVERDUE`. The paid-vs-unpaid *card* distinction is also encoded structurally
  (solid vs **dashed** border) so it survives grayscale/color-blindness. Never rely on the
  yellow/red hue alone.
- **Contrast:** all text on dark glass uses `colors.text` / `colors.textMuted`. The
  projected-row name at reduced opacity **must still clear 4.5:1** — verify `colors.text`
  at 0.85 over the glass fill; if it fails, use `colors.textMuted` at full opacity instead
  of dimming `colors.text` (same guidance as calendar spec §8).
- **Screen-reader order & labels:**
  - Hero: "8 of 12 bills paid. Total due 2,340 dollars per month. Paid 1,475. Due 865.
    2 overdue, 210 dollars."
  - `BillRow` label: `"{name}, {paid | upcoming bill | overdue}, {amount}{, autopay}{,
    linked to debt}, due {ordinal}"`; hint "Double tap to edit."
  - Mark Paid / delete are separate focusable buttons with explicit labels
    (`"Mark {name} paid"`, `"Delete {name}"`).
  - Filter tabs: `role="tab"` + `accessibilityState={{ selected }}`; announce
    "Showing {filter}" on change (mirror `ScopeToggle`).
- **Reduced motion:** the mark-paid solid↔dashed transition and any progress-ring/skeleton
  pulse respect reduce-motion — swap animated transitions for instant state changes;
  skeleton may hold a static 0.6 opacity.

---

## 8. Developer notes

- Reuse, don't reinvent: `GradientBackground` (variant `bgDarkPurple`), `BackButton`,
  `EmptyState`, `ErrorState`, `ProgressRing`, `Skeleton` / `SkeletonStack`. These are all
  present and tokenized already.
- Drive all projected-vs-actual styling off one predicate `isPaid = status === 'paid'`
  (and `isOverdue` for the error accent) — exactly the `CalendarEventRow` pattern, so the
  two screens stay consistent. The existing `getBillStatus()` helper already yields
  `'paid' | 'unpaid' | 'overdue'`; keep it.
- Keep the existing data flow untouched: `loadBills`, `loadDropdownData`,
  `loadSuggestions`, and all handlers stay; this is a styling + IA pass only.
- Owner mapping: replace `OWNER_COLORS` with the shared convention — Partner A
  `colors.primary2`, Partner B `colors.info`, shared/joint `colors.textMuted`. If the API
  gives real partner identity, map to A/B; otherwise "You/Partner/Joint" degrades to
  those three tokens. This matches `RecentActivity`'s partner-glyph convention.
- Status-tint recipe: chip backgrounds are the semantic color at **12%** opacity
  (`rgba(34,197,94,0.12)` / `rgba(234,179,8,0.12)` / `rgba(239,68,68,0.12)`) — the same
  recipe documented in `CalendarEventRow.json`; do not invent new tints.
- `~` estimate prefix and the literal word "projected"/"DUE"/"OVERDUE" are intentional
  copy — keep them for the color-independence guarantee.
- The FAB/tab bar overlaps the list bottom → keep generous `paddingBottom`.

---

## 9. Handoff checklist

- [x] Why documented (bespoke palette/surfaces/spinner vs. design system)
- [x] All states designed (default, loading-skeleton, empty, error, overflow)
- [x] Every hardcoded color / gradient / spacing / font mapped to a token
- [x] Gradient swapped for `<GradientBackground variant="bgDarkPurple">`
- [x] Committed-vs-upcoming split defined (solid vs dashed + word label), consistent w/ calendar
- [x] Component specs written for every section (props/states/tokens)
- [x] Shared components reused (GradientBackground, BackButton, ProgressRing, Skeleton, EmptyState, ErrorState)
- [x] Accessibility: 44pt targets, icon+word+color status, SR labels/order, reduced motion
- [x] Component JSONs emitted (`docs/design/components/bills-*.json`)
- [x] Functionality preserved — recognizably the same Bills screen
```