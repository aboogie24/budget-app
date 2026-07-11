# Financial Priorities Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/priorities.tsx`
**Archetype:** list (ranked list + add/edit modal) — must read identically to `bills` and the calendar/dashboard list rows.

---

## 1. Why this redesign exists

The Priorities screen works, but — exactly like the pre-redesign calendar and dashboard — it
is **visually a different app** from the rest of CoupleFlow. Concretely, it:

1. **Hardcodes its own background gradient** `['#0b1021', '#2b0f50', '#1b1039']` — a purple
   that is subtly *wrong* versus the app-standard `gradients.bgDarkPurple`
   (`['#0f172a','#1a0a40','#0f172a']`). Side-by-side with the calendar/dashboard it reads as
   a slightly different hue, which is the single biggest "this feels off" tell.
2. **Invents its own colors** — rank medals `#fbbf24 / #94a3b8 / #cd7f32 / #64748b`, a pink
   `#f472b6` for "Remove", chevrons `#cbd5e1`, accent `#c084fc`, modal surface `#1a1a2e` —
   none of which exist in the design system.
3. **Uses magic numbers everywhere** — `borderRadius: 16`, paddings `16/14/12/10/8/6`,
   font sizes `20/18/15/14/13/12` with weights `800/700` — instead of `radius.*`,
   `spacing.*`, `typography.*`.
4. **Has no loading skeleton** (bare `ActivityIndicator`), no tokenized empty/error surface,
   and a hand-rolled `card` / `input` / `saveBtn` that duplicate `commonStyles.card`,
   the standard form field, and `gradients.primaryGradient`.

This redesign is a **re-skin + light IA cleanup**, not a rebuild. It stays recognizably the
same screen: a back-navigable, ranked, reorderable list of financial priorities with an
add/edit bottom-sheet. Everything it renders now comes from `design-system.ts` — no magic
numbers, no local color constants — and it adopts the shared shells (`GradientBackground`,
`Skeleton`, `BackButton`, standard header, standard form field, primary-gradient CTA) so it
sits in the same family as every other list screen.

### Light IA improvements (kept minimal, each clearly earns its place)

- **A slim "purpose" header context strip** replaces the free-floating grey subtitle so the
  intro reads as part of the standard header block, not orphaned body text.
- **Rank as a tier, not a medal-color lottery.** The old code color-codes rank 1/2/3 as
  gold/silver/bronze and everything else grey — meaning is carried *by color alone*
  (accessibility fail) and the metaphor ("bronze = 3rd priority") is noise. We keep a rank
  badge but make it a **single tokenized accent** with the **number** doing the work, and add
  a **"Top priority" text pill** on rank 1 only (word + icon, not color). See §5.
- **Reorder affordance clarified.** Up/down chevrons stay (they're the reliable, a11y-safe
  reorder pattern already in place), but they move into a dedicated 44pt control column and
  gain proper disabled semantics and SR labels.
- **Edit/Remove promoted to the row's trailing swipe-less action pattern** used elsewhere:
  a compact inline action row using the app's icon+word treatment (`colors.primary2` for
  Edit, `colors.error` for Remove — Remove is destructive, so it earns `error`, not a
  bespoke pink).

Functionality preserved 1:1: load, add, edit, delete (with confirm), reorder (optimistic
PATCH), title-required validation.

---

## 2. Full-screen wireframe — default / populated

iPhone 15 Pro (390×844). `<GradientBackground variant="bgDarkPurple">`.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Financial Priorities                            ( + )    │  ← standard header
│                                                                │     BackButton · title · add
│  Rank what matters most so your spending stays aligned with    │  ← context strip
│  your goals. Drag order with the arrows.                       │     caption, muted
│                                                                │  ← spacing.xl
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ┌──┐  Pay off student loans          ★ TOP     ┌ ▲ ┐     │ │  rank badge · title
│  │ │ 1│  We want to be debt-free before          │ ▽ │     │ │  · Top pill · reorder
│  │ └──┘  we start a family.                        └───┘     │ │  · notes (muted)
│  │       ─────────────────────────────────────────────       │ │  divider
│  │        ✎ Edit                              🗑 Remove       │ │  inline actions
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ┌──┐  Build a 6-month emergency fund           ┌ △ ┐     │ │  (no Top pill)
│  │ │ 2│  Peace of mind if either of us loses      │ ▽ │     │ │
│  │ └──┘  work.                                     └───┘     │ │
│  │       ─────────────────────────────────────────────       │ │
│  │        ✎ Edit                              🗑 Remove       │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ┌──┐  Save for a house down payment            ┌ △ ┐     │ │  last row: ▽ disabled
│  │ │ 3│                                            │ ▼ │     │ │  (no notes → title only)
│  │ └──┘                                            └───┘     │ │
│  │       ─────────────────────────────────────────────       │ │
│  │        ✎ Edit                              🗑 Remove       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

- `▲` / `▼` = enabled reorder arrow; `△` / `▽` = disabled (top row's up, last row's down).
- `★ TOP` pill renders **only on rank 1** (icon `star` + word `TOP`, `colors.warning` @12%).
- Notes are optional; when absent, the title sits alone and the card is shorter.
- Screen padding `spacing.lg` horizontal; card gap `spacing.md`; header→context `spacing.sm`;
  context→list `spacing.xl`.

### Add/Edit bottom sheet (unchanged behavior, re-skinned)

Presented as a bottom sheet (`Modal animationType="slide"`), backdrop `rgba(0,0,0,0.6)`.

```
                    ┌──────────────────────────────────────────┐
                    │  New Priority                        ✕   │  ← h3 title · close
                    │                                          │
                    │  Title                                   │  ← label
                    │  ┌────────────────────────────────────┐  │
                    │  │ e.g. Pay off student loans         │  │  ← standard text field
                    │  └────────────────────────────────────┘  │
                    │                                          │
                    │  Notes (optional)                        │
                    │  ┌────────────────────────────────────┐  │
                    │  │ Why is this important?             │  │  ← multiline field
                    │  │                                    │  │
                    │  └────────────────────────────────────┘  │
                    │                                          │
                    │  ┌────────────────────────────────────┐  │
                    │  │            Add Priority            │  │  ← primaryGradient CTA
                    │  └────────────────────────────────────┘  │
                    └──────────────────────────────────────────┘
```

Edit mode: title reads `Edit Priority`, CTA reads `Update`, fields prefilled.

---

## 3. Key states

### 3.1 Loading (skeleton — reuse `components/Skeleton.tsx`)

Never a bare spinner. Layout-matched skeleton: header renders immediately (it's static),
then **3 skeleton priority cards**, each = a 40×40 rounded rank square + two text lines +
a short action line.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Financial Priorities                            ( + )    │  header renders instantly
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓                              │  context strip skeleton
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ┌────┐  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            ▓▓             │ │  Skeleton 40sq + lines
│  │ │  ▓ │    ▓▓▓▓▓▓▓▓▓▓▓                                    │ │
│  │ └────┘    ─────────────────────────────────────────       │ │
│  │           ▓▓▓▓▓          ▓▓▓▓▓▓▓                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌── (2nd skeleton card, same shape) ──────────────────────┐  │
│  ┌── (3rd skeleton card, same shape) ──────────────────────┐  │
└──────────────────────────────────────────────────────────────┘
```

Skeleton pieces: rank square `Skeleton {width:40,height:40,borderRadius: radius.md}`; title
line `Skeleton {height:16,width:'70%'}`; notes line `Skeleton {height:12,width:'45%'}`;
action line `Skeleton {height:12,width:'30%'}`. Use `SkeletonStack` where a simple stack fits.

### 3.2 Empty (no priorities yet — first-time user)

Reuse the shared `EmptyState` component (already imported), re-skinned via its own tokens
(no change needed here beyond confirming it sits inside the `GradientBackground`). Centered
within the scroll area.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Financial Priorities                            ( + )    │
│  Rank what matters most so your spending stays aligned…        │
│                                                                │
│                          ⚑                                     │  flag-outline, textDark
│                                                                │
│                   No priorities set                            │  bodyBold, text
│         Define your financial priorities to stay               │  small, textMuted
│              focused on what matters most.                     │
│                                                                │
│                 ┌───────────────────────┐                      │
│                 │    + Add Priority     │                      │  primaryGradient CTA
│                 └───────────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

Icon `flag-outline` (kept), title "No priorities set", CTA "Add Priority" → opens the sheet.

### 3.3 Error (load failed)

Reuse the shared `ErrorState` component (already imported), rendered **inline inside the
GradientBackground** below the header — never a blank screen. `alert-circle-outline`
(`colors.error`), "Couldn't load your priorities", `Retry` text button re-runs
`loadPriorities()`.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Financial Priorities                            ( + )    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    ⊘  (alert-circle-outline, error)       │ │
│  │              Couldn't load your priorities                │ │
│  │        Check your connection and try again.               │ │
│  │                    [  ↻  Retry  ]                          │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 Overflow / edge cases

- **Long title** → `numberOfLines={2}` then ellipsis; the reorder control column is
  `flexShrink: 0` and never gets pushed off.
- **Long notes** → `numberOfLines={2}` + ellipsis.
- **Many priorities (10+)** → list scrolls (already a `ScrollView`); rank numbers keep going
  (#4…#10), all sharing the neutral badge tier (only #1 gets the Top pill).
- **Single priority** → both reorder arrows disabled (nothing to swap with); card still shows
  Edit/Remove.

---

## 4. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| gradient `['#0b1021','#2b0f50','#1b1039']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `headerTitle '#f8fafc' 20/800` | `colors.text` + `typography.h3` (matches calendar/dashboard header title) |
| `subtitle '#94a3b8' 13` | `colors.textMuted` + `typography.caption` |
| add icon `'#c084fc'` | `colors.primary2` |
| card `rgba(255,255,255,0.06)` + `borderRadius:16` + border `rgba(255,255,255,0.08)` | `glassEffects.glass` / `commonStyles.card` (border → `colors.borderGlass`) |
| rank medal `#fbbf24 / #94a3b8 / #cd7f32 / #64748b` | single neutral badge: border/text `colors.primary2`, fill `rgba(168,85,247,0.12)`; rank #1 badge upgrades to `colors.warning` accent + Top pill (see §5) |
| `rankText 800/14` | `typography.smallBold` |
| `cardTitle '#f8fafc' 700/15` | `colors.text` + `typography.bodyBold` |
| `notesText '#94a3b8' 12` | `colors.textMuted` + `typography.caption` |
| chevrons `'#cbd5e1'` | `colors.text` (enabled) / `colors.textMuted` @ disabled opacity |
| chevron disabled `opacity: 0.3` | `opacity: 0.35` on `colors.textMuted` (documented, matches other disabled controls) |
| Edit `'#c084fc'` icon+text | `colors.primary2` |
| Remove `'#f472b6'` icon+text | `colors.error` (destructive → error, not bespoke pink) |
| `actionText 700/13` | `typography.smallBold` |
| card divider (new) | `commonStyles.divider` (`colors.borderLight`) |
| modal backdrop `rgba(0,0,0,0.6)` | keep (standard scrim; documented) |
| modal content `#1a1a2e` + `borderTopRadius:20` | `colors.surface2` + `radius.xl` (matches other sheets) |
| `modalTitle '#f8fafc' 18/800` | `colors.text` + `typography.h3` |
| close icon `'#cbd5e1'` | `colors.textMuted` |
| `label '#e5e7eb' 13/700` | `colors.textMuted` + `typography.smallBold` |
| input `rgba(255,255,255,0.06)` + `borderRadius:12` + border `rgba(255,255,255,0.08)` + text `#f8fafc` | `glassEffects.glass` fill, `radius.md`, `colors.borderGlass`, text `colors.text` |
| input placeholder `'#94a3b8'` | `colors.textMuted` |
| saveBtn gradient `['#a855f7','#7c3aed']` + `borderRadius:14` | `gradients.primaryGradient` + `radius.lg` |
| `saveBtnText '#fff' 800/16` | `colors.text` + `typography.button` |
| ad-hoc paddings `16/14/12/10/8/6` | `spacing.lg / md / sm / xs` |
| scroll `padding:16, paddingTop:24, paddingBottom:120` | `spacing.lg` horizontal, `spacing.xl` top, `spacing.xxxl`+ bottom (keep tab-bar clearance) |

---

## 5. Section / component specs

### 5.1 Screen header (matches calendar/dashboard header pattern)

- Row: `BackButton fallback="/(tabs)/goals"` (kept) · title `Financial Priorities`
  (`typography.h3`, `colors.text`) · trailing add button.
- **Add button** — 44×44 tap target, `Ionicons "add-circle"` size 28 `colors.primary2`
  (unchanged icon, tokenized color), opens the sheet in create mode.
- **Context strip** — one line, `typography.caption`, `colors.textMuted`, `spacing.sm` below
  the header row, `spacing.xl` above the list: "Rank what matters most so your spending stays
  aligned with your goals. Drag order with the arrows."

### 5.2 PriorityCard (the list row) — see `priorities-priority-card.json`

The core list-archetype component. One `commonStyles.card` (`glassEffects.glass`,
`radius.lg`, padding `spacing.lg`, `marginBottom: spacing.md`) containing:

- **Rank badge** (leading) — 40×40, `radius.md`, `flexShrink: 0`.
  - Default tier (rank ≥ 2): fill `rgba(168,85,247,0.12)`, 1.5px border `colors.primary2`,
    number `#{rank}` in `colors.primary2` `typography.smallBold`.
  - **Rank 1:** fill `rgba(234,179,8,0.12)`, border `colors.warning`, number in
    `colors.warning`. The **number** carries rank; color is a supporting accent only.
- **Body** (flex 1, `marginLeft: spacing.md`): title (`typography.bodyBold`, `colors.text`,
  `numberOfLines={2}`) with an inline **Top pill** trailing it when `rank === 1`; optional
  notes below (`typography.caption`, `colors.textMuted`, `numberOfLines={2}`).
- **Top pill** — `star` icon + word `TOP`, `colors.warning` text on `rgba(234,179,8,0.12)`,
  `radius.full`, `typography.caption` bold. Rendered only for rank 1. Word+icon+color →
  color-independent.
- **Reorder control column** (trailing, `flexShrink: 0`): two stacked 44×44 buttons,
  `chevron-up` / `chevron-down`.
  - Enabled: `colors.text`. Disabled (top row up / last row down): `colors.textMuted` at
    `opacity: 0.35`, `disabled` + `accessibilityState={{disabled:true}}`.
- **Divider** — `commonStyles.divider` between body and the action row.
- **Action row** — inline, `spacing.lg` gap: `Edit` (`pencil` + word, `colors.primary2`) and
  `Remove` (`trash-outline` + word, `colors.error`). Each `typography.smallBold`, 44pt tall
  tap target.

States: `default`, `rank1` (warning-accented badge + Top pill), `pressed` (subtle scale on
Edit/Remove/reorder taps via `animation.fast`), `reordering` (optimistic — the two swapped
cards animate position; instant under reduce-motion), `loading-skeleton`.

### 5.3 PriorityFormSheet (add/edit bottom sheet) — see `priorities-form-sheet.json`

- Container: `colors.surface2`, `borderTopLeftRadius/Right radius.xl`, padding `spacing.lg`,
  backdrop scrim `rgba(0,0,0,0.6)`, `Modal animationType="slide"`.
- Header: title (`New Priority` / `Edit Priority`, `typography.h3`, `colors.text`) + close
  `Ionicons "close"` 24 `colors.textMuted`, 44pt target.
- **Fields** (standard form field): label (`typography.smallBold`, `colors.textMuted`) +
  input (`glassEffects.glass` fill, `radius.md`, `colors.borderGlass`, text `colors.text`,
  placeholder `colors.textMuted`). Notes field is `multiline`, `minHeight: 80`,
  `textAlignVertical: 'top'`.
- **CTA** — full-width `TouchableOpacity` wrapping `LinearGradient gradients.primaryGradient`
  (start `{0,0}` end `{1,1}`), `radius.lg`, `paddingVertical: spacing.lg`, label
  (`Add Priority` / `Update`, `typography.button`, `colors.text`). Keeps title-required
  validation (`Alert` on empty).
- **Keyboard avoidance:** wrap content in `KeyboardAvoidingView` so the CTA and notes field
  stay visible while typing (input-heavy sheet).

States: `create`, `edit`, `default`, `focused-field`, `validation-error` (title empty →
Alert), `saving` (CTA shows spinner / disabled while the PUT/POST is in flight).

### 5.4 Reused shared components

| Component | Use |
|---|---|
| `GradientBackground variant="bgDarkPurple"` | full-screen background (replaces the hardcoded gradient) |
| `BackButton fallback="/(tabs)/goals"` | header back nav (already used — keep) |
| `Skeleton` / `SkeletonStack` | loading state (§3.1) |
| `EmptyState` | empty state (§3.2 — already imported) |
| `ErrorState` | error state (§3.3 — already imported) |

No new shared components introduced. `Sparkline`, `AttentionCard`, and the dashboard
sub-components are not relevant to this screen (no time-series or attention data here).

---

## 6. Accessibility

- **Touch targets:** add button, both reorder chevrons, Edit, Remove, close, and the CTA are
  all ≥ 44×44pt (hit-slop-pad the chevrons if their visual box is smaller than 44).
- **Color independence:** rank is carried by the **number** (`#1`, `#2`…), not by a medal
  color — the old gold/silver/bronze scheme conveyed order by color alone and is removed.
  "Top priority" is a **`star` icon + the word `TOP`** (color is supporting only). Destructive
  Remove pairs the `trash-outline` icon + the word "Remove" with `colors.error`. No status is
  color-only.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` over dark glass (clears WCAG
  AA). The warning-yellow Top pill and rank-1 badge text sit on a 12% tint, not a saturated
  fill — verify `colors.warning` on the dark card clears 4.5:1; if borderline, use the word
  `TOP` at `colors.text` weight with the yellow only on the icon/border.
- **Screen-reader order & labels:**
  - Card reads as one node: `"Priority {rank}{, top priority}: {title}. {notes}."`
  - Reorder up: `"Move {title} up"` (disabled announces "dimmed/unavailable" for the top row);
    reorder down: `"Move {title} down"`.
  - Edit: `"Edit {title}"`; Remove: `"Remove {title}"` with `accessibilityRole="button"` and
    a destructive hint "Double tap to remove this priority."
  - Add button: `"Add a priority"`; CTA: `"{Add Priority | Update}"`.
- **Reduced motion:** the reorder position swap, Top-pill/press scales, and sheet slide-in
  use `animation.fast` / `animation.medium`; under reduce-motion they become instant state
  swaps (the optimistic reorder simply re-renders in the new order with no animated move).
- **Dynamic Type:** titles and notes reflow (`numberOfLines` caps but no fixed row height that
  clips); the rank badge and reorder column keep fixed sizes, body flexes around them.

---

## 7. Developer notes

- **Re-layout, not new data.** The existing `loadPriorities`, `handleSave`, `handleDelete`,
  and `moveItem` (optimistic reorder → `PATCH /auth/priorities/reorder`) are unchanged. This
  is a styling + shell swap plus the small IA changes in §1.
- **Drive rank-1 styling off `rank === 1`** (single predicate) — badge accent + Top pill both
  key on it. All other ranks share the neutral `primary2` badge tier; do **not** reintroduce
  per-rank colors.
- **Reuse, don't reimplement:** wrap the screen in `GradientBackground` and delete the local
  `LinearGradient`; use `Skeleton`/`SkeletonStack` for loading (delete the bare
  `ActivityIndicator` in the list body — a header-only `ActivityIndicator` for background
  refresh is fine); keep `EmptyState`/`ErrorState` (already imported), just ensure they sit
  inside the gradient.
- **Destructive color:** Remove uses `colors.error` — this is intentional and replaces the
  bespoke `#f472b6`. Keep the delete confirmation `Alert` (destructive style) as-is.
- **Reorder arrows** replace what would otherwise be a drag-and-drop; they are the
  accessible, already-working pattern — keep them, just give them the 44pt column and proper
  disabled/SR semantics.
- **CTA + form field** should match the add-transaction / bills form treatment already
  specced (`gradients.primaryGradient` CTA, `glassEffects.glass` inputs) so all forms feel
  identical across the app.

---

## 8. Handoff checklist

- [x] All states designed (default, loading skeleton, empty, error, overflow, single-item)
- [x] Hardcoded gradient swapped for `<GradientBackground variant="bgDarkPurple">`
- [x] Every old hardcoded color / radius / spacing / font mapped to a design-system token
- [x] Rank made color-independent (number carries order; Top = icon+word+color)
- [x] Destructive Remove uses `colors.error` (not bespoke pink)
- [x] Loading uses shared `Skeleton`, not a bare spinner
- [x] Shared shells reused (GradientBackground, BackButton, Skeleton, EmptyState, ErrorState)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Functionality preserved 1:1 (load, add, edit, delete, reorder, validation)
- [x] Component specs written (`docs/design/components/priorities-*.json`)
