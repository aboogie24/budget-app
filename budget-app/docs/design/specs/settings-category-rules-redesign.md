# Category Rules Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route:** `settings/category-rules` · **File:** `budget-app/app/settings/category-rules.tsx`
**Archetype:** settings / list
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Sibling references (match these exactly):** `calendar-redesign.md`, `dashboard-redesign.md`

---

## 1. Why this redesign exists

The current screen is a fully bespoke island. It never imports the design system and
instead hardcodes:

- Its own gradient `['#0f0a1e','#1a1035','#0f0a1e']` via a raw `LinearGradient` — a
  *different* purple than the rest of the app (`gradients.bgDarkPurple`).
- Its own palette: `#a855f7`, `#c084fc`, `#f8fafc`, `#94a3b8`, `#64748b`, `#475569`,
  `#eab308`, `#3b82f6`, `#ef4444`, `#f87171` — all of which already exist as tokens.
- Its own surfaces (`rgba(255,255,255,0.05)` / `0.06`), borders (`rgba(255,255,255,0.08)`),
  radii (`12`, `14`, `24`), and ad-hoc font sizes/weights (`fontWeight:'800'`, `15`, `11`,
  `letterSpacing:1.2`) — none of which come from `glassEffects` / `radius` / `typography`.
- Its own header (a hand-rolled 20px `'800'` title) instead of the shared `h3` header row.
- A **spinner** (`ActivityIndicator`) as the loading state instead of skeletons, so the
  layout jumps when data arrives.
- A hand-rolled empty state instead of the shared `EmptyState`, and **no error state at
  all** — a failed fetch silently shows the empty state (misleading: "no rules" when the
  request actually failed).
- A hand-rolled bottom-sheet modal that repeats the form recipe rather than the shared
  form-sheet convention.

The result reads as a different app from `calendar` / `dashboard`. This redesign keeps the
screen **recognizably the same** (grouped rules, badges, add-rule sheet, swipe-free delete)
but re-skins every surface onto the design system and fixes the three information-architecture
gaps: **no real loading skeleton, no error state, and color-only status badges**.

### Information-architecture improvements (kept minimal, all defensible)

1. **Headline summary card.** The list currently opens straight into groups with only a
   tiny `"N rules total"` label. Per the list-archetype convention (one elevated headline
   card per screen), add a `glassFloating` hero that leads with the **total rule count** in
   `typography.h2` and a one-line breakdown (`N auto · N manual · N system`). This gives the
   screen a proper anchor and teaches the user what the three rule sources mean.
2. **Status is icon + word + color, never color alone.** The `Auto` / `Manual` / `System`
   badges stay, but every badge now pairs an icon **and** a word with its tint, and the
   destructive delete is guarded consistently.
3. **Committed-vs-tentative metaphor applies to rule *provenance*.** User-created rules
   (`manual`) are **solid** (fully editable, deletable). **System** rules are **ghosted**
   (dashed hairline, reduced-opacity, lock icon, no delete) — they read as "read-only,
   provided-for-you", exactly the solid-vs-ghosted language used for committed-vs-tentative
   money elsewhere. `Auto`-created rules are solid but carry a spark icon.

---

## 2. Layout structure

```
GradientBackground variant="bgDarkPurple"           (replaces raw LinearGradient)
└─ SafeAreaView
   ├─ Header row  (FIXED, outside the scroll)
   │    [BackButton]        Category Rules (h3)        [ + add action ]
   │
   └─ ScrollView  (FlatList) contentContainerStyle = scrollContent
        ├─ RulesSummaryHero            (glassFloating — the one elevated card)
        ├─ Description line            (typography.small, textMuted)
        ├─ RuleGroupSection  ×N        (flat glass; header = icon chip + title + count)
        │     └─ RuleRow ×M
        └─ AddRuleButton               (ghost primary button, footer)
```

Everything is a single vertical scroll. The header row lives **outside** the scroll so the
back/add controls stay pinned (matches calendar/dashboard).

---

## 3. Wireframes — all states

### 3a. Default / populated

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Category Rules                        [ + ]     │  ← fixed header, h3 title
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │  RULES                                                │ │  glassFloating hero
│ │  14                                                   │ │  ← total, typography.h2
│ │  rules auto-categorizing your transactions            │ │
│ │                                                       │ │
│ │  ⚡ 8 auto   ·   ◑ 4 manual   ·   🔒 2 system         │ │  ← source breakdown row
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ Rules assign categories to transactions automatically     │  small / textMuted
│ from merchant names or keywords.                           │
│                                                            │
│ ┌ [🏪] Merchant Rules ───────────────────────────  6  ┐  │  group header (flat)
│ │                                                       │  │
│ │ ┌──────────────────────────────────────────────────┐ │  │
│ │ │ Whole Foods                       ⚡ Auto    [🗑] │ │  │  solid glass row
│ │ │ → Groceries                          Used 42x    │ │  │  arrow tag + usage
│ │ └──────────────────────────────────────────────────┘ │  │
│ │ ┌──────────────────────────────────────────────────┐ │  │
│ │ │ Starbucks                        ◑ Manual    [🗑] │ │  │
│ │ │ → Dining Out                         Used 11x    │ │  │
│ │ └──────────────────────────────────────────────────┘ │  │
│ └───────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌ [T] Keyword Rules ────────────────────────────────  4 ┐ │
│ │ ┌──────────────────────────────────────────────────┐ │ │
│ │ │ subscription                     ◑ Manual    [🗑] │ │ │
│ │ │ → Entertainment                                   │ │ │
│ │ └──────────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌ [⚙] System Rules ─────────────────────────────────  2 ┐ │
│ │ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │ │  DASHED, ghosted
│ │ ╎ Venmo                             🔒 System       ╎ │ │  no delete (locked)
│ │ ╎ → Transfers                                       ╎ │ │
│ │ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │            ⊕  Add Rule                                 │ │  ghost primary footer btn
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3b. Loading (Skeleton — reuses `components/Skeleton.tsx`)

Header row renders normally (static). Body shows a skeleton hero + two skeleton groups. No
`ActivityIndicator` on first load — the spinner is only permitted in the header for a
background refresh (pull-to-refresh keeps the native `RefreshControl`).

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Category Rules                        [ + ]     │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │  ▭▭▭▭            (Skeleton w=64 h=14)                  │ │  glassFloating shell
│ │  ▭▭▭▭▭▭▭         (Skeleton w=96 h=32  → the number)   │ │
│ │  ▭▭▭▭▭▭▭▭▭▭▭▭▭   (Skeleton w=70% h=14)                │ │
│ │  ▭▭▭▭  ▭▭▭▭  ▭▭  (3 chips, Skeleton w=64 h=20)        │ │
│ └──────────────────────────────────────────────────────┘ │
│ ▭▭▭▭▭▭▭▭  (Skeleton group header w=140 h=16)              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ▭▭▭▭▭▭▭▭▭▭▭▭▭▭            ▭▭▭▭                         │ │  RuleRowSkeleton ×3
│ │ ▭▭▭▭▭▭▭▭                                               │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ▭▭▭▭▭▭▭▭▭▭                ▭▭▭▭                         │ │
│ │ ▭▭▭▭▭▭                                                 │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3c. Empty (no rules yet — genuine, request succeeded)

Uses the shared `EmptyState` component. Note it is only shown when `!loading && !error`.

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Category Rules                        [ + ]     │
├──────────────────────────────────────────────────────────┤
│                                                            │
│           ┌────────────────────────────────────┐          │
│           │              ╭────╮                 │          │
│           │              │ 🌿 │  (git-branch)   │          │  EmptyState (glass)
│           │              ╰────╯                 │          │
│           │        No category rules yet        │          │  title
│           │  Add a rule to auto-categorize your  │          │  description
│           │   transactions by merchant or word.  │          │
│           │        ┌──────────────────┐          │          │
│           │        │   Add first rule │          │          │  actionLabel → openAddModal
│           │        └──────────────────┘          │          │
│           └────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

### 3d. Error (fetch failed)

New state — the current screen has none. Uses shared `ErrorState`. Shown when the fetch
throws (track a new `error` boolean in place of the swallowed `console.error`).

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Category Rules                        [ + ]     │
├──────────────────────────────────────────────────────────┤
│           ┌────────────────────────────────────┐          │
│           │              ╭────╮                 │          │
│           │              │ ⚠  │  alert-circle   │          │  ErrorState (glass)
│           │              ╰────╯                 │          │
│           │      Couldn't load your rules        │          │  title
│           │  Check your connection and try again.│          │  message
│           │        ┌──────────────────┐          │          │
│           │        │  ↻  Try Again    │          │          │  onRetry → fetchRules()
│           │        └──────────────────┘          │          │
│           └────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

### 3e. Add Rule sheet (bottom sheet — shared form-sheet recipe)

Re-skinned onto the convention: `colors.surface2` sheet, `radius.xxl` top corners, glass
inputs, `gradients.primaryGradient` save button. Content unchanged (type toggle → match
value → category picker).

```
┌──────────────────────────────────────────────────────────┐
│                     (dimmed overlay)                       │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Add Rule                                        [✕]  │ │  surface2, radius.xxl top
│ │                                                       │ │
│ │  RULE TYPE                                            │ │  fieldLabel (smallBold)
│ │  ┌────────────────────┐ ┌────────────────────┐       │ │
│ │  │ 🏪  Merchant   ✓   │ │ T   Keyword        │       │ │  segmented (active=primary tint)
│ │  └────────────────────┘ └────────────────────┘       │ │
│ │                                                       │ │
│ │  MERCHANT NAME                                        │ │
│ │  ┌──────────────────────────────────────────────┐    │ │  glass input
│ │  │ e.g., Whole Foods, Starbucks                  │    │ │
│ │  └──────────────────────────────────────────────┘    │ │
│ │  Matches merchant name (case-insensitive)            │ │  inputHint (caption)
│ │                                                       │ │
│ │  TARGET CATEGORY                                      │ │
│ │  ┌──────────────────────────────────────────────┐    │ │
│ │  │ 🏷  Select category                        ›  │    │ │  → CategoryPicker
│ │  └──────────────────────────────────────────────┘    │ │
│ │                                                       │ │
│ │  ┌──────────────────────────────────────────────┐    │ │
│ │  │            ✓  Save Rule                        │    │ │  primaryGradient, disabled@0.4
│ │  └──────────────────────────────────────────────┘    │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3f. Edge cases

- **Long match value / category name:** `numberOfLines={1}` + ellipsis on both
  `match_value` and `category_name`; the badge and usage count are `flexShrink: 0` so they
  never truncate.
- **Group with 0 rules:** group is filtered out entirely (existing behavior — keep).
- **Only system rules exist:** hero shows `0 auto · 0 manual · N system`; the Add Rule
  footer button still shows so the user can create their first custom rule.
- **usage_count absent or 0:** hide the "Used Nx" line entirely (existing behavior — keep).

---

## 4. Token mapping — every hardcoded value → design-system token

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0f0a1e','#1a1035','#0f0a1e']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `container padding: 16 / paddingBottom: 48` | `spacing.lg` / `spacing.xxxl` (via `commonStyles.scrollContent`) |
| header title `#f8fafc`, `fontSize:20`, `fontWeight:'800'` | `colors.text` + `typography.h3` |
| `backBtn` hand-rolled 40×40 | shared `<BackButton fallback="/(tabs)/settings" color={colors.accent} size={20}/>` |
| `addHeaderBtn` `rgba(168,85,247,0.12)` bg, `rgba(168,85,247,0.3)` border, `#c084fc` icon | `colors.primary2` @ 12% bg, @ 30% border, icon `colors.accent`, `radius.md`, 44×44 target |
| `description` `#94a3b8`, `fontSize:13` | `colors.textMuted` + `typography.small` |
| `sectionLabel` `#64748b`, `fontSize:11`, `letterSpacing:1.2`, `'700'` uppercase | `colors.textDark` + `typography.caption` (uppercase, `letterSpacing` kept as caption motif) — replaced by the new hero breakdown row |
| `groupSection marginBottom:20` | `spacing.xl` |
| `groupIconCircle` `rgba(192,132,252,0.12)`, `30×30`, `radius 8` | `colors.accent` @ 12% bg, `radius.sm`; grow to `spacing.xxl` (32) |
| `groupTitle` `#e2e8f0`, `15/'700'` | `colors.text` + `typography.bodyBold` |
| `groupCountBadge` `rgba(255,255,255,0.08)` | `colors.glassMedium` bg, `radius.sm` |
| `groupCountText` `#94a3b8`, `12/'700'` | `colors.textMuted` + `typography.smallBold` |
| `ruleCard` `rgba(255,255,255,0.05)` bg, `rgba(255,255,255,0.08)` border, `radius 12`, `padding 12` | `glassEffects.glass` (`colors.glassLight` + `colors.borderGlass` + `radius.lg`) + `padding: spacing.md` |
| `matchValue` `#f8fafc`, `15/'700'` | `colors.text` + `typography.bodyBold` |
| `autoBadge` `rgba(234,179,8,0.12)` bg, `#eab308` text | `colors.warning` @ 12% bg + text (icon `flash-outline` + word "Auto") |
| `manualBadge` `rgba(59,130,246,0.12)` bg, `#3b82f6` text | `colors.info` @ 12% bg + text (icon `person-outline` + word "Manual") |
| `systemBadge` `rgba(100,116,139,0.2)` bg, `#94a3b8` text | `colors.textMuted` @ 12% bg + `colors.textMuted` text (icon `lock-closed-outline` + word "System") |
| `categoryTag` arrow `#a855f7` | icon `arrow-forward` in `colors.primary2` |
| `categoryName` `#a855f7`, `12/'600'` | `colors.primary2` + `typography.caption` (weight bumped to smallBold on the label) |
| `usageText` `#64748b`, `11/'600'` | `colors.textDark` + `typography.caption` |
| `deleteBtn` `rgba(239,68,68,0.08)` bg, `#f87171` icon, `32×32` | `colors.error` @ 8% bg (destructive uses the 8% recipe), icon `trash-outline` `colors.error`, tappable padded to 44 via hitSlop |
| `addRuleBtn` `rgba(168,85,247,0.12)` bg, `rgba(168,85,247,0.3)` border, `radius 14` | `colors.primary2` @ 12% bg, @ 30% border, `radius.lg` |
| `addRuleText` `#a855f7`, `15/'700'` | `colors.primary2` + `typography.bodyBold` |
| `emptyState` hand-rolled + `ActivityIndicator #a855f7` | loading → `Skeleton`; empty → shared `<EmptyState>`; error → shared `<ErrorState>` |
| `emptyText` `rgba(255,255,255,0.3)`, `emptyHint` `#475569` | handled by `EmptyState` title/description tokens |
| `modalContainer` `#0f0a1e` bg, `radius 24` top | `colors.surface2` + `radius.xxl` top corners, `colors.borderGlass` |
| `modalTitle` `#f8fafc`, `20/'800'` | `colors.text` + `typography.h3` |
| `closeBtn` `rgba(255,255,255,0.08)`, `#e5e7eb` icon | `colors.glassMedium` bg, icon `colors.text`, `radius.md`, 44 target |
| `fieldLabel` `#94a3b8`, `13/'700'` | `colors.textMuted` + `typography.smallBold` |
| `typeToggle` `rgba(255,255,255,0.04)` bg, `rgba(255,255,255,0.08)` border | `colors.glassLight` + `colors.borderGlass`, `radius.md` |
| `typeToggleActive` `rgba(192,132,252,0.12)` bg, `rgba(192,132,252,0.3)` border | `colors.accent` @ 12% bg, @ 30% border |
| `typeToggleText` `#64748b` / active `#c084fc` | `colors.textDark` / active `colors.accent` + `typography.smallBold` |
| `input` `rgba(255,255,255,0.06)` bg, `rgba(255,255,255,0.08)` border, `radius 12` | `colors.glassMedium` + `colors.borderGlass` + `radius.md`, text `colors.text` + `typography.body` |
| `input placeholderTextColor #475569` | `colors.textDark` |
| `inputHint #475569`, `11` | `colors.textDark` + `typography.caption` |
| `categorySelector` (same glass as input) | `colors.glassMedium` + `colors.borderGlass` + `radius.md` |
| `categorySelectorText #f8fafc` / placeholder `#64748b` | `colors.text` / `colors.textDark` |
| `categorySelector` icons `#a855f7` / `#64748b` | `colors.primary2` (selected) / `colors.textDark` (empty) |
| `saveBtn` `#7c3aed` solid, `radius 14` | `gradients.primaryGradient` (`LinearGradient`), `radius.lg`; disabled → `opacity 0.4` (keep) |
| `saveBtnText #fff`, `16/'800'` | `#fff` (on-gradient, exempt) + `typography.button` |
| `RefreshControl tintColor #a855f7` | `colors.primary2` |

**Hard rule:** after redesign, no literal hex/rgba/px in the file **except** the documented
12% / 8% semantic-tint composites and `#fff` on gradient/primary fills.

---

## 5. Component specs (implementable directly)

Reuse shared components where they fit: `GradientBackground`, `Skeleton`, `BackButton`,
`EmptyState`, `ErrorState`. New screen-local pieces below are specified as JSON in
`docs/design/components/settings-category-rules-*.json`.

### 5.1 Header row (fixed, reuses shared parts)
- Layout: `flexRow` + `flexBetween`, `paddingHorizontal: spacing.lg`, `paddingVertical:
  spacing.md`, outside the scroll.
- Left: `<BackButton fallback="/(tabs)/settings" color={colors.accent} size={20} />`.
- Center: `Text` `typography.h3` / `colors.text`, `"Category Rules"`.
- Right: add-action `TouchableOpacity`, 44×44, `colors.primary2` @ 12% bg + @ 30% border,
  `radius.md`, `Ionicons name="add" size={22} color={colors.accent}`. `onPress=openAddModal`.
  a11y label `"Add category rule"`.

### 5.2 RulesSummaryHero  (the one `glassFloating` card)
See `settings-category-rules-summary-hero.json`.
- `glassEffects.glassFloating`, `padding: spacing.lg`, `radius.xl`.
- Overline `"RULES"` (`typography.caption`, `colors.textMuted`, uppercase).
- Total count in `typography.h2` / `colors.text`.
- Caption line `"rules auto-categorizing your transactions"` (`typography.small`,
  `colors.textMuted`); pluralize/singularize.
- Breakdown row: three inline chips — `⚡ N auto` (`colors.warning`), `◑ N manual`
  (`colors.info`), `🔒 N system` (`colors.textMuted`) — each `icon + count + word`, tint at
  12% bg. States: `default`, `loading` (Skeleton shell), `zero` (chip shows `0`, dimmed).

### 5.3 RuleGroupSection
See `settings-category-rules-group-section.json`.
- Header: icon chip (`spacing.xxl` square, `colors.accent` @ 12%, `radius.sm`) + title
  (`typography.bodyBold`) + count badge (`colors.glassMedium`, `radius.sm`,
  `typography.smallBold`).
- Icons: merchant `storefront-outline`, keyword `text-outline`, system `settings-outline`.
- Body: vertical stack of `RuleRow`, `gap: spacing.sm`.

### 5.4 RuleRow
See `settings-category-rules-rule-row.json`.
- **Variants (provenance-driven, solid-vs-ghosted):**
  - `auto` — solid `glassEffects.glass`; badge `⚡ Auto` (`colors.warning`); deletable.
  - `manual` — solid `glassEffects.glass`; badge `◑ Manual` (`colors.info`); deletable.
  - `system` — **ghosted**: `borderStyle:'dashed'`, `colors.borderGlass`, near-transparent
    fill; text at reduced emphasis (`colors.textMuted` for the value); badge `🔒 System`
    (`colors.textMuted`); **no delete button** (locked). Tapping delete on a system rule is
    impossible (button absent) rather than firing the old "System rules cannot be deleted"
    Alert.
- Structure: top row = `match_value` (`typography.bodyBold`, `numberOfLines={1}`, flex) +
  status badge (icon+word+color) + delete (44 target, non-system only). Bottom row =
  category tag (`arrow-forward` `colors.primary2` + `category_name` `colors.primary2`,
  `numberOfLines={1}`) + `Used Nx` (`typography.caption`, `colors.textDark`, only if
  `usage_count > 0`).
- States: `default`, `pressed` (row scale/opacity via `animation.fast`; only if row becomes
  tappable — currently rows aren't tappable, keep non-interactive except delete),
  `deleting` (optimistic remove after Alert confirm).

### 5.5 RuleRowSkeleton  (loading)
See `settings-category-rules-rule-row-skeleton.json`.
- Same footprint as `RuleRow` so layout doesn't jump. Two `Skeleton` lines: top `width:'55%'
  height:16`, bottom `width:'35%' height:12`, plus a `width:56 height:20 borderRadius:radius.sm`
  badge shell. `padding: spacing.md`, `glassEffects.glass` shell.

### 5.6 AddRuleFooterButton
- Ghost primary: `colors.primary2` @ 12% bg, @ 30% border, `radius.lg`,
  `paddingVertical: spacing.md`, icon `add-circle-outline` + `"Add Rule"`
  (`typography.bodyBold`, `colors.primary2`). 44 target. Hidden while `loading`.

### 5.7 AddRuleSheet  (bottom sheet — shared form recipe)
See `settings-category-rules-add-sheet.json`.
- Sheet: `colors.surface2`, top corners `radius.xxl`, `colors.borderGlass`, `maxHeight:'80%'`.
- Header: title `typography.h3` + close button (44, `colors.glassMedium`, `radius.md`).
- Type segmented control: two options, active = `colors.accent` @ 12% bg / @ 30% border,
  label `typography.smallBold`; icons `storefront-outline` / `text-outline`.
- Match input: glass input recipe (`colors.glassMedium` + `colors.borderGlass` +
  `radius.md`), `typography.body`, placeholder `colors.textDark`. Hint `typography.caption`.
- Category selector: same glass recipe; `pricetag`/`pricetag-outline` icon; opens shared
  `CategoryPicker`.
- Save: `gradients.primaryGradient` `LinearGradient`, `radius.lg`, `typography.button`,
  `#fff` text; disabled (`!matchValue || !categoryId || saving`) → `opacity 0.4`; `saving`
  → `ActivityIndicator` (permitted here — it's an in-sheet action, not screen load).

---

## 6. Accessibility

- **Touch targets ≥ 44×44pt:** back button (shared, hitSlop'd), add-action (44×44),
  delete button (32 visual, `hitSlop 8` → 48 effective; keep or grow visual to 40), close
  button (44), segmented options (full-width, tall), save (tall). Verify every tap target.
- **Status is icon + word + color, never color alone.** Every badge renders an icon **and**
  its word (`Auto` / `Manual` / `System`) alongside its tint, so provenance survives for
  color-blind users. The solid-vs-dashed row treatment reinforces system-vs-user without
  relying on the grey tint.
- **Contrast (WCAG AA):** `colors.text` (#f8fafc) and `colors.textMuted` (#94a3b8) on dark
  glass both clear 4.5:1. The ghosted system row uses `colors.textMuted` at **full opacity**
  (not dimmed `colors.text`) so it still passes — do not lower opacity below what clears AA.
  Badge text uses each semantic color at full opacity on its 12% tint; verify
  `colors.warning` (#eab308) meets 4.5:1 — if borderline, pair with `typography.caption`
  weight and keep the word visible (the word carries meaning regardless).
- **Screen-reader order & labels:**
  - Hero: `"14 rules. 8 auto, 4 manual, 2 system."`
  - Group header: `"{title}, {count} rules"`.
  - Rule row: `"{match_value}, {auto|manual|system} rule, categorizes as {category_name}{, used N times}"`.
  - Delete: `accessibilityRole="button"`, label `"Delete rule for {match_value}"`, hint
    `"Double tap to delete"`.
  - System rows: expose `accessibilityHint="System rule, read-only"` so the missing delete
    is explained.
- **Reduced motion:** row press feedback and Skeleton pulse use `animation.fast`; under
  `reduce-motion`, skip the Skeleton pulse (render static block) and swap press
  scale/opacity for an instant state change. Bottom sheet `animationType="slide"` should
  fall back to `"none"`/fade under reduce-motion.
- **Keyboard avoidance:** the Add sheet is input-heavy — wrap in the existing keyboard
  avoidance pattern (`keyboardShouldPersistTaps="handled"` is already present; keep).

---

## 7. Developer notes

- Add a real **`error`** state: replace the silent `console.error` in `fetchRules` with a
  `setError(true)` (reset on retry). Render order in the list body:
  `loading → skeletons`; `error → <ErrorState onRetry={fetchRules}>`;
  `!rules.length → <EmptyState onAction={openAddModal}>`; else groups. Never show
  `EmptyState` while `error` is true (the current code conflates them).
- Drive all provenance styling off one predicate — keep the existing
  `isSystemRule(rule) = rule.rule_type ∈ {system, default} || rule.user_id === null`. The
  `system` row variant, the missing delete button, and the `🔒 System` badge all read from it.
- **Do not** re-implement `GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, or
  `ErrorState`. `EmptyState`/`ErrorState` currently pull from `ThemeContext`/`componentDefaults`
  — they already render on-theme; pass copy + `onAction`/`onRetry` only.
- Keep the group filtering (`.filter(g => g.rules.length > 0)`) and the `groupedRules`
  memo shape; only the **rendering** changes.
- Delete flow (`Alert.alert` confirm → optimistic `setRules(filter)`) is unchanged; only the
  button's tint moves to the `colors.error` @ 8% recipe.
- The hero's breakdown counts are cheap derived values:
  `auto = rules.filter(r => r.auto_created).length`,
  `system = rules.filter(isSystemRule).length`,
  `manual = rules.length - auto - system`.

---

## 8. Handoff checklist

- [x] Raw `LinearGradient` → `<GradientBackground variant="bgDarkPurple">`
- [x] Every hardcoded color/gradient/radius/spacing/font mapped to a token (§4)
- [x] One `glassFloating` headline hero; all other cards flat `glass`
- [x] All states designed: default, loading (Skeleton), empty (EmptyState), error (ErrorState), sheet, edge cases
- [x] Loading is Skeleton, not spinner (spinner only in the in-sheet save action)
- [x] New error state added (previously missing / conflated with empty)
- [x] Solid-vs-ghosted provenance metaphor (user rules solid, system rules dashed/locked)
- [x] Status = icon + word + color everywhere (Auto / Manual / System badges)
- [x] Shared form-sheet recipe (surface2, glass inputs, primaryGradient save)
- [x] Accessibility: 44pt targets, color-independent status, SR labels, reduced motion
- [x] Component specs written (`docs/design/components/settings-category-rules-*.json`)
- [x] Functionality preserved; recognizably the same screen
</content>
</invoke>
