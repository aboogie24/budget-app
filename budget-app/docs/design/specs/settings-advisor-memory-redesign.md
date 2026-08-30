# Advisor Memory Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke styling in `budget-app/app/settings/advisor-memory.tsx`
**Route:** `settings/advisor-memory` (a **pushed** detail screen off the Settings tab)
**Archetype:** settings / list — must read as the same app as `dashboard.tsx`,
`calendar.tsx`, and the redesigned `settings.tsx`.

---

## 1. Why this redesign exists

Like every pre-migration screen, Advisor Memory **works** but **fights the design
system**. Side by side with the redesigned dashboard/calendar it reads as a slightly
different app.

Concrete problems in the current file:

1. **Wrong background.** It uses a bespoke `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>`
   — a purple that is subtly *not* `gradients.bgDarkPurple` (`['#0f172a','#1a0a40','#0f172a']`).
   This is the exact off-hue mismatch the calendar redesign called out.
2. **Hardcoded everything.** Colors (`'#c084fc'`, `'#f8fafc'`, `'#f1f5f9'`, `'#e2e8f0'`,
   `'#94a3b8'`, `'#64748b'`, `'#475569'`, `'#f87171'`, `'#a855f7'`), surfaces
   (`'rgba(255,255,255,0.05)'`), borders (`'rgba(255,255,255,0.08)'`), tint fills
   (`'rgba(192,132,252,0.12)'`, `'rgba(239,68,68,0.08)'`), radii (`12 / 8`), paddings
   (`16 / 14 / 8`), gaps (`10 / 8`), and font sizes/weights are all inline literals. **No
   token is imported.** The header title is `fontSize:20 weight:'800'` — not on the type scale.
3. **Loading is a bare spinner, not a skeleton.** The archetype convention (and the
   calendar/dashboard/settings redesigns) is **`Skeleton` placeholders that hold layout**;
   `ActivityIndicator` is only permitted for background refresh in the header. The current
   screen shows a centered `ActivityIndicator` + "Loading memory…", so the layout jumps when
   data lands.
4. **No error state at all.** `load()` swallows fetch errors into `console.error` and shows
   the *empty* state ("Nothing remembered yet") on failure — a user with a network error is
   told, incorrectly, that the advisor remembers nothing. There must be a distinct error
   state with Retry.
5. **Header inconsistent with the archetype.** The header row is hand-rolled
   (`BackButton` + custom bold title + a `width:40` spacer). Pushed `/settings/*` detail
   screens should use the standard fixed header row: shared `<BackButton>` + `typography.h3`
   title, **outside** the scroll view. (The current header scrolls away inside the
   `FlatList` header — it should be pinned.)
6. **Status/scope conveyed largely by color.** The two groups (Shared vs Private) are
   distinguished by an accent icon in a purple chip; the "private" meaning leans on the lock
   icon alone. We keep the icon **and** add the word + a color-independent scope chip so the
   shared-vs-private distinction never depends on a single glyph or hue.

This redesign is a **re-layout of the exact same data and interactions** — two scope
groups of memory facts, each fact deletable via a confirm dialog, pull-to-refresh —
fully tokenized, with a real loading skeleton and a real error state added, and scope made
color-independent. It stays recognizably the same screen.

### What we deliberately preserve (functionality is not changed)

- The two scope groups **Shared** (`people-outline`, "Both partners can see these") and
  **Private to you** (`lock-closed-outline`, "Only you — never shown to your partner"),
  each rendered only when it has items, sorted Shared-first.
- Each memory is a card showing its `fact` text with a trash affordance that opens the
  **"Forget this?"** destructive `Alert` → `deleteAdvisorMemory(mem.id)` → optimistic
  removal from state (revert-with-Alert on failure).
- The intro/description paragraph explaining what advisor memory is.
- Pull-to-refresh (`RefreshControl`) re-fetching `fetchAdvisorMemories()`.
- The empty state ("Nothing remembered yet" + the friendly "as you chat…" hint) and its
  `sparkles-outline` motif.
- The group count badge showing how many facts are in each scope.

### Small IA improvements (keep it the same screen)

- **Pin the header** (BackButton + title) outside the scroll so it's always reachable
  (matches the pushed-detail archetype).
- **Add a total-count line** to the intro block ("Remembering N things about you") so the
  screen has a lightweight headline, consistent with "every list screen leads with a
  number." This replaces nothing — it sits in the intro card.
- **Group header becomes a scope chip** carrying icon + word + color, so Shared vs Private
  is color-independent and reads at a glance.
- **Split the loading (skeleton) from the empty state**, and add the missing **error**
  state, so a failed load is never mistaken for "nothing remembered."

---

## 2. The screen at a glance — pinned header + intro card + grouped memory cards

One vertical scroll of **grouped memory cards** under a pinned detail header, on the shared
gradient. Visual vocabulary matches the reference screens exactly:

| Element | Treatment | Token |
|---|---|---|
| Background | shared gradient | `<GradientBackground variant="bgDarkPurple">` |
| Header | pinned row: `<BackButton>` + centered title | `typography.h3`, `colors.text` |
| Intro card | the one slightly-richer card, leads with the total count | `glassEffects.glass`, `radius.lg` |
| Group header | scope chip (icon+word+color) + subtitle + count badge | see §5.2 |
| Memory card | flat glass row: fact text + delete affordance | `glassEffects.glass`, `radius.md` |
| Empty / Error | shared centered treatments | see §3.3 / §3.4 |

Nothing floats — a memory list has no single money hero, so (like the settings list) we use
flat `glass` throughout; hierarchy comes from the group scope chips + spacing, not elevation.
The intro card is `glass` too, just visually first by position.

---

## 3. Wireframes — all required states

iPhone 15 Pro (390×844). Screen padding `spacing.lg` (16) horizontal. Header is pinned;
everything below scrolls.

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Advisor Memory                                       │  ← PINNED header
│                                                                │     BackButton + h3 title
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ INTRO CARD (glass)
│  │  ✦  Remembering 5 things about you                        │ │  │ count line, bodyBold
│  │                                                            │ │  │ + sparkles glyph
│  │  Things your AI advisor remembers about you across         │ │  │ description, small,
│  │  conversations. It saves these as you chat — forget        │ │  │ colors.textMuted
│  │  anything you don't want it to keep.                       │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌ 👥 Shared ┐  Both partners can see these            [ 3 ]  │  ┐ GROUP HEADER
│                                                                │  │ scope chip + subtitle
│  ┌──────────────────────────────────────────────────────────┐ │  │   + count badge
│  │  We're saving for a house down payment by 2027.      🗑   │ │  │ MemoryCard ×3
│  └──────────────────────────────────────────────────────────┘ │  │ fact text + delete
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  Our combined take-home is about $9,200 a month.     🗑   │ │  │
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  We split shared bills 60/40 (Alex / Sam).           🗑   │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl
│  ┌ 🔒 Private to you ┐  Only you — never shown to Sam   [ 2 ] │  ┐ GROUP HEADER
│                                                                │  │ private scope chip
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  I want to build an emergency fund before investing. 🗑   │ │  │ MemoryCard ×2
│  └──────────────────────────────────────────────────────────┘ │  │
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  I get anxious when checking balances late at night. 🗑   │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
└──────────────────────────────────────────────────────────────┘
```

The scope chip (`👥 Shared` / `🔒 Private to you`) is a rounded pill carrying **icon + word
+ color** so the group is identified without relying on the glyph or hue alone.

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Cold load, before `fetchAdvisorMemories()` resolves. The **header renders immediately** (it's
static). The intro card renders **real** (its copy is static; the count line becomes a small
skeleton pill until data lands). Below it, render **one skeleton group header + 3 skeleton
memory cards** — shape-matched so nothing jumps when real groups arrive. A single background
`ActivityIndicator` may appear in the header only during pull-to-refresh (not cold load).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Advisor Memory                                       │  ← real, static
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  intro card (real copy)
│  │  ✦  ▭▭▭▭▭▭▭▭  (count skeleton, 140×14)                    │ │
│  │  Things your AI advisor remembers about you across …       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ▭▭▭▭▭▭  (scope-chip skeleton, 90×24 radius.full)     ▭▭ (28) │  group-header skeleton
│  ┌──────────────────────────────────────────────────────────┐ │  memory-card skeletons ×3
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭            ▢         │ │  text lines + delete box
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭                ▢         │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭                      ▢         │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton primitives (from `components/Skeleton.tsx`):
- count line → `Skeleton width={140} height={14} borderRadius={radius.sm}`
- scope-chip → `Skeleton width={90} height={24} borderRadius={radius.full}`
- count badge → `Skeleton width={28} height={20} borderRadius={radius.sm}`
- memory-card body → `SkeletonStack count={2}` (two text lines, second at 60%) inside a
  `glass` card, plus a `Skeleton width={32} height={32} borderRadius={radius.md}` delete box.

This is the same skeleton recipe used by the dashboard/settings redesigns, so the loading
states rhyme across the app.

### 3.3 Empty / first-time (no memories yet)

Advisor hasn't saved anything (new user, or everything forgotten). The intro card still
renders (it explains the feature), and below it a single centered **empty card** — reuse the
shared `EmptyState` recipe with the existing friendly copy and `sparkles-outline` motif. The
count line reads "Remembering nothing yet."

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Advisor Memory                                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  intro card (real copy)
│  │  ✦  Remembering nothing yet                               │ │
│  │  Things your AI advisor remembers about you across …       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  EmptyState (glass)
│  │                       ✦                                    │ │  sparkles-outline, textDark
│  │              Nothing remembered yet                        │ │  bodyBold, colors.text
│  │   As you chat with your advisor, it'll save important      │ │  small, colors.textMuted
│  │   facts here.                                              │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

No CTA button — there's no direct action a user takes to *create* a memory here (they emerge
from chatting), so this is a soft, informational empty state, matching the current copy.

### 3.4 Error (fetch failed)

Distinct from empty — this is the state the current screen is missing entirely. Intro card
still renders; below it an inline **error card** (reuse the shared `ErrorState` recipe) with a
Retry that re-calls `load()`. Never show the empty state on a load failure.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Advisor Memory                                       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  intro card (real copy)
│  │  ✦  Remembering …                                         │ │  count line hidden / em-dash
│  │  Things your AI advisor remembers about you across …       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ErrorState (glass)
│  │                      ⚠                                     │ │  alert-circle-outline, error
│  │            Couldn't load memory                            │ │  bodyBold, colors.text
│  │   Check your connection and try again.                     │ │  small, colors.textMuted
│  │              ┌────────────────────┐                        │ │  Retry button
│  │              │   ↻  Try Again     │                        │ │  colors.primary2 / accent
│  │              └────────────────────┘                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 Overflow / edge cases

- **Long fact text:** the memory card grows vertically (no `numberOfLines` clamp — the whole
  fact is meaningful and must be readable to decide whether to forget it). The delete affordance
  stays pinned top-right, vertically top-aligned (`alignItems: 'flex-start'`), `flexShrink: 0`.
- **Many memories in a scope:** the list scrolls; the count badge shows the true total. No cap.
- **Only one scope present:** the other group is omitted entirely (existing behavior — groups
  with zero items don't render), and the single group fills the screen normally.

---

## 4. Header — pinned detail row (matches the pushed `/settings/*` archetype)

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Advisor Memory                                       │
└──────────────────────────────────────────────────────────────┘
```

- **Has a BackButton.** Unlike the Settings *tab root*, this is a **pushed** `/settings/*`
  detail screen, so it uses the shared `<BackButton fallback="/(tabs)/settings" />`. Color
  the icon `colors.primary2` (replacing the current inline `#c084fc`), size `20`.
- **Pinned outside the scroll.** Move the header out of the `FlatList`/`ScrollView` header
  slot so it stays fixed (the current header scrolls away). Layout: row inside the safe area,
  `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`.
- **Title** `Advisor Memory` in `typography.h3` `colors.text`, centered, with a trailing
  spacer equal to the BackButton width so the title optically centers (keep the current
  three-slot row pattern, just tokenized: BackButton / flex-1 centered title / `width:40`
  spacer).

---

## 5. Component specs

### 5.1 `MemoryCard` (the workhorse — replaces the local `memoryCard`)

One memory fact with a destructive delete affordance.

**Props**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `fact` | `string` | yes | the remembered fact; `typography.small` `colors.text`, no line clamp |
| `onDelete` | `() => void` | yes | opens the "Forget this?" confirm `Alert` |
| `deleting` | `boolean` | no (default `false`) | disables the row + dims to 0.5 opacity during the optimistic delete |

**Layout / tokens**

- Card `glassEffects.glass`, `radius.md`, `padding: spacing.md` (14→`md`=12; use `spacing.md`),
  `marginBottom: spacing.sm`, row layout, `alignItems: 'flex-start'`, `gap: spacing.md`.
- Fact text: `flex: 1`, `typography.small` (14/20) `colors.text`.
- Delete button: 32×32, `radius.sm`, `backgroundColor: \`${colors.error}14\`` (~8% tint),
  `trash-outline` 16pt `colors.error`; `hitSlop` of 8 on all sides to reach a 44pt target;
  `flexShrink: 0`.

**States**

- `default`, `pressed` (delete button `activeOpacity 0.7`), `deleting` (row at 0.5 opacity,
  `pointerEvents="none"`), `long fact` (card grows, delete stays top-right).

**Accessibility**

- Card is not itself tappable (only the delete button is), so no row `accessibilityRole`.
- Delete button: `accessibilityRole="button"`, `accessibilityLabel={\`Forget: ${fact}\`}`,
  `accessibilityHint="Removes this from what your advisor remembers"`.

### 5.2 `MemoryGroupHeader` (replaces the local `groupHeader`)

A labeled scope group header: scope chip (icon + word + color) + subtitle + count badge.

**Props**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `scope` | `'shared' \| 'private'` | yes | drives icon + color (color-independent, paired with word) |
| `title` | `string` | yes | `Shared` / `Private to you` — the word inside the chip |
| `subtitle` | `string` | yes | `typography.caption` `colors.textMuted`, `numberOfLines={1}` |
| `count` | `number` | yes | number of facts in this scope |

**Scope → visual (color-independent)**

| `scope` | icon | chip fill | icon + word color |
|---|---|---|---|
| `shared` | `people-outline` | `\`${colors.primary2}1f\`` (~12%) | `colors.primary2` |
| `private` | `lock-closed-outline` | `\`${colors.info}1f\`` (~12%) | `colors.info` |

The chip is a `radius.full` pill: `paddingHorizontal: spacing.sm`, `paddingVertical: spacing.xs`,
row layout, `gap: spacing.xs`, 14pt icon + `typography.smallBold` word in the scope color.
Because the chip always shows an **icon + the literal word** ("Shared" / "Private to you"),
scope is never conveyed by color alone. Using `colors.info` for private (vs `primary2` for
shared) keeps the two hues distinct while both remain on-palette.

**Layout / tokens**

- Row: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.sm`,
  `marginBottom: spacing.md`, `marginTop: spacing.xl` (between groups).
- Subtitle sits below the chip in a `flex: 1` column, or inline to its right on wide layouts
  (either; pick one — inline-right matches the current look).
- Count badge: pill, `backgroundColor: colors.glassMedium`, `radius.sm`,
  `paddingHorizontal: spacing.sm`, `paddingVertical: 2`; text `typography.caption` bold
  `colors.textMuted`. `flexShrink: 0`, pinned right.

**Accessibility**

- Header announces as one label: `\`${title}, ${subtitle}, ${count} ${count === 1 ? 'memory' : 'memories'}\``.
- Not interactive; `accessibilityRole="header"`.

### 5.3 `MemoryIntroCard` (new — the lightweight headline)

The one slightly-richer card at the top: count line + description.

**Props**: `count: number`, `loading?: boolean`.

**Layout / tokens**

- Card `glassEffects.glass`, `radius.lg`, `padding: spacing.lg`, `marginBottom: spacing.lg`.
- Count line: row, `gap: spacing.sm`; `sparkles` (filled) 18pt `colors.primary2` +
  `typography.bodyBold` `colors.text` reading `Remembering {count} thing{s} about you`
  (or `Remembering nothing yet` when `count === 0`; hidden / em-dash when `loading` or error).
- Description: `typography.small` `colors.textMuted`, `marginTop: spacing.sm`, the existing
  copy verbatim.
- `loading`: replace the count text with a `Skeleton width={140} height={14}`.

Component JSONs for `MemoryCard` and `MemoryGroupHeader` are provided under
`docs/design/components/settings-advisor-memory-*.json`.

---

## 6. Interactions (unchanged behavior, tokenized feedback)

| Element | Behavior |
|---|---|
| Back button | `router.back()` / `fallback="/(tabs)/settings"` (existing) |
| Delete (trash) | opens `Alert` "Forget this?" with the fact quoted → on confirm: `deleteAdvisorMemory(mem.id)` → optimistic `setMemories(prev => prev.filter(...))`; on failure re-add + `Alert('Error', 'Failed to forget this memory.')` (existing logic; add optimistic-revert if not already) |
| Pull-to-refresh | `RefreshControl` → `load()`; `tintColor={colors.primary2}`, `colors={[colors.primary2]}` (replace inline `#a855f7`) |
| Retry (error state) | re-calls `load()` (new — pairs with the new error state) |

All press feedback uses `activeOpacity 0.7`; the `Skeleton` pulse and any state transitions
use `animation.fast` and honor reduce-motion (see §8).

---

## 7. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `advisor-memory.tsx`) | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `header` `#f8fafc fontSize:20 weight:'800'` | `typography.h3` `colors.text` |
| BackButton `color="#c084fc"` | `colors.primary2` |
| `description` `#94a3b8 fontSize:13 lineHeight:18` | `typography.small` `colors.textMuted` |
| `groupIconCircle` bg `'rgba(192,132,252,0.12)'` (shared) | `\`${colors.primary2}1f\`` |
| group icon `#c084fc` (shared) | `colors.primary2` |
| private scope (currently same purple) | `\`${colors.info}1f\`` fill + `colors.info` icon (distinct from shared) |
| `groupTitle` `#e2e8f0 fontSize:15 weight:'700'` | `typography.smallBold` `colors.text` (scope color inside chip) |
| `groupSubtitle` `#64748b fontSize:11` | `typography.caption` `colors.textMuted` |
| `groupCountBadge` bg `'rgba(255,255,255,0.08)'` | `colors.glassMedium` |
| `groupCountText` `#94a3b8 fontSize:12 weight:'700'` | `typography.caption` bold `colors.textMuted` |
| `memoryCard` bg `'rgba(255,255,255,0.05)'` + border `'rgba(255,255,255,0.08)'` | `glassEffects.glass` (`colors.glassLight` + `colors.borderGlass`) |
| `memoryCard` `borderRadius:12` | `radius.md` |
| `memoryText` `#f1f5f9 fontSize:14 lineHeight:20` | `typography.small` `colors.text` |
| `deleteBtn` bg `'rgba(239,68,68,0.08)'` + icon `#f87171` `borderRadius:8` | `\`${colors.error}14\`` + `colors.error` + `radius.sm` |
| `emptyText` `'rgba(255,255,255,0.3)'` | `colors.textDark` (via `EmptyState` title `colors.text`) |
| `emptyHint` `#475569` | `colors.textMuted` |
| empty icon `sparkles-outline` `'rgba(255,255,255,0.15)'` | `sparkles-outline` `colors.textDark` |
| `ActivityIndicator color="#a855f7"` (loading) | **removed** → `Skeleton` layout; spinner only for background refresh, `colors.primary2` |
| RefreshControl `#a855f7` / `#a855f7` | `colors.primary2` |
| container `padding:16 paddingBottom:48` | `paddingHorizontal: spacing.lg`, `paddingBottom: spacing.xxxl` |
| `groupSection marginBottom:22` | `marginBottom: spacing.xl` |
| ad-hoc gaps `10 / 8` | `spacing.md / sm` |
| ad-hoc paddings `14 / 8 / 3` | `spacing.md / sm / xs` |

**Hard rule:** after redesign there are no literal hex / rgba / px values except the
documented semantic tint alphas (`1f` ≈ 12%, `14` ≈ 8%) appended to token colors.

---

## 8. Accessibility

- **Touch targets:** the delete button visual is 32×32 but gets `hitSlop: 8` on all sides
  → ≥44pt tappable (matches the current `hitSlop`, now on a tokenized button). The Retry
  button in the error state is full-height ≥44pt.
- **Color independence:** scope (Shared vs Private) is **icon + word + color** in the scope
  chip — never hue alone; a color-blind user reads "Shared" / "Private to you" plus the
  people/lock glyph. Delete is a `trash-outline` glyph + a confirm dialog, not red-only.
  Error uses `alert-circle-outline` + the word "Couldn't load memory" + color.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` / scope colors
  (`primary2` / `info`) on dark glass, which clear WCAG AA (≥4.5:1). The ~12% / ~8% tint
  fills are backgrounds only; scope words render at full-opacity semantic color, not
  tinted-on-tint.
- **Screen-reader order:** header (Back button → "Advisor Memory") → intro card (count line →
  description) → for each group: group header announced as one label
  (`"{title}, {subtitle}, {n} memories"`) → each memory card: fact text, then its delete
  button (`"Forget: {fact}"`). The delete button is a distinct focus stop after its fact.
- **Reduced motion:** the `Skeleton` pulse and any press/opacity transitions honor
  reduce-motion — swap to instant state changes; skeletons may render as static dim blocks.
- **Dynamic Type:** memory cards use padding + `flex` (not fixed height) so long facts and
  scaled fonts reflow; the delete button stays `flexShrink: 0` and top-aligned so it never
  clips or overlaps the growing text.

---

## 9. Developer notes

- **Reuse, don't reimplement:** `GradientBackground` (`variant="bgDarkPurple"`), `Skeleton` /
  `SkeletonStack` (loading — same recipe as dashboard/settings), `BackButton` (pushed-detail
  header), and the shared `EmptyState` / `ErrorState` card recipes for §3.3 / §3.4. Do not
  hand-roll a spinner or a bespoke empty/error block.
- **Split load state into three:** track `loading` (cold) → skeleton, `error` (fetch threw) →
  ErrorState, and `!loading && !error && memories.length === 0` → EmptyState. The current
  `catch` must set an `error` flag instead of silently leaving `memories` empty (today a
  network error masquerades as the empty state — the bug this redesign fixes).
- **Optimistic delete + revert:** keep the existing optimistic `filter`; on
  `deleteAdvisorMemory` rejection, re-insert the removed item and Alert (the current code
  removes then only Alerts on failure without re-adding — add the revert so the UI stays
  truthful). Optionally set `deleting` on the card during the in-flight request.
- **No new endpoints.** `fetchAdvisorMemories()` and `deleteAdvisorMemory(id)` are unchanged.
  The `AdvisorMemory` type is `{ id, scope, fact }` — no timestamp — so the card shows the
  fact only (do not invent a date subtitle).
- **Grouping logic unchanged:** derive `shared` / `private` groups by filtering on `scope`,
  render Shared first, and omit any empty group (existing `.filter(g => g.items.length > 0)`).
- **Pinned header:** render the header row above the `ScrollView`/`FlatList`, not in its
  `ListHeaderComponent`, so it doesn't scroll away (a behavior change from the current file —
  intentional, matches the archetype).

---

## 10. Handoff checklist

- [x] Wrong bespoke gradient replaced with `<GradientBackground variant="bgDarkPurple">`
- [x] All required states designed (default/populated, loading skeleton, empty, error, overflow)
- [x] Loading is a `Skeleton` that holds layout — spinner only allowed for background refresh
- [x] Missing **error** state added (fixes network-error-looks-like-empty bug)
- [x] Every hardcoded color / gradient / surface / border / radius / spacing / font mapped to a token
- [x] `MemoryCard`, `MemoryGroupHeader`, `MemoryIntroCard` specced with props/states/tokens (JSONs written)
- [x] Shared components reused (`GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, `ErrorState`)
- [x] Scope (Shared/Private) made color-independent (icon + word + color chip)
- [x] Pushed-detail header (BackButton + h3 title), pinned outside scroll, justified vs the archetype
- [x] Accessibility: 44pt delete target, SR order + labels, reduced motion, Dynamic Type, WCAG-AA contrast
- [x] Functionality preserved — two scope groups, deletable facts, confirm dialog, pull-to-refresh
