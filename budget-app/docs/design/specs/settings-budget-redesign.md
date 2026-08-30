# Budget Settings Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/settings/budget-settings.tsx`
**Archetype:** settings (form + editable list) — sibling of `settings-tab`, form family of `add-transaction` / `priorities`

---

## 1. Why this redesign exists

The screen *works* — its data model (per-user categories filtered by expense/income,
each with a monthly limit, rollover flag, color, and optional budget group; plus an
inline add-category form) is good and is **fully preserved**. But visually it is **a
different app** from the screens already brought into the theme (calendar, dashboard,
budget tab). Concretely, `budget-settings.tsx` today:

1. **Hardcodes its own gradient** — `['#0b1021', '#2b0f50', '#1b1039']` via a raw
   `<LinearGradient>`. That purple is *wrong* — it is not `gradients.bgDarkPurple`
   (`['#0f172a','#1a0a40','#0f172a']`) that the theme-aligned screens use. Side by side it
   reads as a slightly different app.
2. **Hardcodes ~30 color literals** inline — `'#c084fc'`, `'#f8fafc'`, `'#94a3b8'`,
   `'#64748b'`, `'#475569'`, `'#7c3aed'`, `'#a855f7'`, `'rgba(255,255,255,0.06)'`,
   `'rgba(192,132,252,0.12)'`, `'rgba(255,255,255,0.08)'` … none from `design-system.ts`.
   It even defines a local `PRESET_COLORS` and a local `formatCurrency`.
3. **Uses magic-number spacing/radii everywhere** — `padding: 16/14`, `borderRadius:
   18/14/12/10/8`, `gap: 10/12/6`, `paddingVertical: 10/8/14` — none tokenized.
4. **Uses inline font sizes/weights** — `fontSize: 22/20/15/14/13/12/11`, `fontWeight`
   `'700'/'800'` as string literals — instead of the `typography.*` scale.
5. **Has an off-convention header.** Title is `fontSize: 20, fontWeight: '800'`, colored
   `#f8fafc`, and sits *inside* the ScrollView. The reference screens use a **fixed header
   row outside the ScrollView**: shared `<BackButton>` + `typography.h3` title + a
   right-side action slot.
6. **Has no loading skeleton, no error state.** `load()` swallows failures into
   `console.error` and the screen just shows empty cards. There is no "couldn't load"
   affordance and no layout-matched skeleton — both required by the archetype convention.
7. **Buries the primary action.** The "Total Monthly Budget" number — the one figure that
   answers *"what am I committing to per month?"* — is a small `fontSize: 22` line inside a
   flat card, visually equal to everything else. It should be the elevated headline.
8. **Mixes list-editing and creation into one long scroll** with the same card weight, so
   the eye has no anchor and the destructive delete sits with no confirmation contrast.

This redesign is a **re-skin + light IA cleanup**: adopt the design system end-to-end,
promote the total to an elevated hero, and move category creation into the shared
bottom-sheet form recipe — while keeping it recognizably the same screen.

---

## 2. The core idea — one hero number, then edit-in-place, then add-via-sheet

Three moves, done together:

1. **Adopt the design system.** Every color, gradient, space, radius, font, and card
   surface comes from `design-system.ts`. Background becomes
   `<GradientBackground variant="bgDarkPurple">`. No local color constants, no magic
   numbers, no local `PRESET_COLORS`/`formatCurrency` (use the swatch set below +
   `formatCurrency` from the design system).
2. **Sharpen the IA into a strict 3-tier hierarchy:**
   - **Tier 1 — Budget Hero** (`glassFloating`): the scope toggle (Expenses | Income) +
     the **Total Monthly Budget** number in `typography.h1`, plus a one-line proof
     (`{n} categories · {m} with rollover`). Only card that floats, only card that uses
     `h1`.
   - **Tier 2 — Category list** (flat `glass`): one row per category, tappable to expand
     inline editing (limit, group, rollover). Reuses the row grammar from
     `budget-tab-CategoryBudgetRow` / `settings-tab-SettingsRow`.
   - **Tier 3 — Add Category** (`glass` CTA row that opens a **bottom sheet**): the whole
     add-form moves out of the scroll into the shared form-sheet recipe, so the main screen
     is a clean read-and-edit surface.
3. **Make committed-vs-optional read at a glance.** A category with a limit set is
   **committed** (solid fill, exact amount). A category with **no limit** ($0) is
   **untracked** — rendered ghosted (dashed left edge, `~$0` placeholder tone, the word
   "No limit") so the couple can see which categories aren't yet budgeted. This is the
   screen's application of the settled solid-vs-ghosted metaphor.

> Rule of thumb: **only the hero floats and only the hero uses `h1`.** If a category row
> or the add-sheet ever competes for "biggest thing on screen", the hierarchy has broken.

---

## 3. Full-screen wireframe (top to bottom)

Default state, Expenses scope, populated. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Budget Settings                          (＋)        │  ← fixed header (outside scroll)
├──────────────────────────────────────────────────────────────┤   BackButton · h3 title · add action
│ ╔══════════════════════════════════════════════════════════╗ │
│ ║  [ 🛒 Expenses ]        [ 💵 Income ]                     ║ │  ← Tier 1: Budget Hero (glassFloating)
│ ║                                                          ║ │     scope toggle
│ ║  TOTAL MONTHLY BUDGET                                     ║ │
│ ║  $2,140                                                  ║ │  ← typography.h1 hero number
│ ║  8 categories · 3 with rollover                          ║ │  ← proof line (caption, muted)
│ ╚══════════════════════════════════════════════════════════╝ │
│                                                                │
│  EXPENSE CATEGORIES                                       8     │  ← section label (caption) + count
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [🛒] Groceries                          $600/mo   ↻   ›  │ │  ← committed row (solid, exact amt)
│ │      Essentials · Rollover                               │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ [🍔] Dining                             $250/mo       ›  │ │
│ │      Lifestyle                                           │ │
│ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │
│ ╎ [🎁] Gifts                              No limit     ›  ╎ │  ← untracked row (ghosted, dashed edge)
│ ╎      No group · Tap to set a limit                      ╎ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  ＋  Add expense category                              ›  │ │  ← Tier 3: Add CTA row → opens sheet
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Expanded category row (tap to edit inline)

```
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [🛒] Groceries                          $600/mo   ↻   ⌄  │ │  ← chevron rotates to ⌄ when open
│ │      Essentials · Rollover                               │ │
│ │  ┌────────────────────────────────────────────────────┐  │ │
│ │  │ Monthly limit                        [   $600   ]  │  │ │  ← glass input, right-aligned
│ │  │ Group          [ None ][•Essentials][ Lifestyle ]  │  │ │  ← segmented (wraps)
│ │  │ Rollover                                    ( ●▷ )  │  │ │  ← switch
│ │  │ ─────────────────────────────────────────────────  │  │ │
│ │  │  🗑  Delete category                                │  │ │  ← destructive text button (error)
│ │  └────────────────────────────────────────────────────┘  │ │
│ └──────────────────────────────────────────────────────────┘ │
```

### Add-Category bottom sheet (opened from Tier-3 CTA)

```
        ┌────────────────────────────────────────────┐
        │                  ────                       │  ← grab handle
        │  New expense category                   ✕   │  ← sheet title (h3) + close
        │                                             │
        │  [🛒]  ┌────────────────────────────────┐   │  ← color-tinted icon chip + name field
        │        │ Category name                  │   │
        │        └────────────────────────────────┘   │
        │                                             │
        │  Monthly limit (optional)                   │
        │  ┌────────────────────────────────────────┐ │
        │  │ $0                                     │ │
        │  └────────────────────────────────────────┘ │
        │                                             │
        │  Enable rollover                    ( ○▷ )  │  ← switch row
        │  Share with partner                 ( ○▷ )  │  ← switch row + hint line
        │    Partner can see this category            │
        │                                             │
        │  Color                                      │
        │  ● ● ● ● ● ● ● ●                             │  ← swatch grid, selected = white ring
        │                                             │
        │  Group   [ None ][ Essentials ][ Lifestyle ]│  ← segmented (if groups exist)
        │                                             │
        │  ┌────────────────────────────────────────┐ │
        │  │           Save category                │ │  ← gradients.primaryGradient button
        │  └────────────────────────────────────────┘ │
        └────────────────────────────────────────────┘
```

### Loading state (skeleton — reuse `components/Skeleton.tsx`)

Layout-matched skeletons that hold the real layout. No `ActivityIndicator` on first load.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹        Budget Settings                          (＋)        │  ← real header (static, renders instantly)
├──────────────────────────────────────────────────────────────┤
│ ╔══════════════════════════════════════════════════════════╗ │
│ ║  ▭▭▭▭▭▭▭▭       ▭▭▭▭▭▭                                    ║ │  ← Skeleton pills (toggle)
│ ║  ▭▭▭▭▭▭▭▭▭▭▭▭▭                                            ║ │  ← Skeleton bar (label)
│ ║  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭  (h1-height)                          ║ │  ← Skeleton block (hero number)
│ ║  ▭▭▭▭▭▭▭▭▭▭▭                                              ║ │
│ ╚══════════════════════════════════════════════════════════╝ │
│  ▭▭▭▭▭▭▭▭▭▭▭                                                  │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ (◯) ▭▭▭▭▭▭▭▭▭▭            ▭▭▭▭▭                          │ │  ← 4× Skeleton rows: circle + 2 bars
│ │     ▭▭▭▭▭▭▭                                              │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Empty state (no categories for the active scope — reuse `components/EmptyState.tsx`)

Hero still renders (total $0, "0 categories"). Below it, in place of the list:

```
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │                    ⌾  (folder-open-outline)              │ │  ← icon in colors.textMuted
│ │              No expense categories yet                   │ │  ← bodyBold, colors.text
│ │      Add your first category to start budgeting.         │ │  ← small, colors.textMuted
│ │                                                          │ │
│ │              ┌──────────────────────────┐                │ │
│ │              │   ＋  Add category        │                │ │  ← primaryGradient CTA → sheet
│ │              └──────────────────────────┘                │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
```

### Error state (categories failed to load — reuse `components/ErrorState.tsx`)

Don't blank the screen. Hero renders with a "—" total; list area shows:

```
│ ┌──────────────────────────────────────────────────────────┐ │
│ │              ⚠  (alert-circle-outline, error)            │ │
│ │            Couldn't load your categories                 │ │  ← bodyBold, colors.text
│ │        Check your connection and try again.              │ │  ← small, colors.textMuted
│ │              ┌──────────────────────────┐                │ │
│ │              │        ↻  Retry          │                │ │  ← glass button, re-runs load()
│ │              └──────────────────────────┘                │ │
│ └──────────────────────────────────────────────────────────┘ │
```

### Overflow / edge cases

- **Long category name:** `numberOfLines={1}` + ellipsis on name; the amount is
  `flexShrink: 0` and never truncates.
- **Many categories:** list scrolls within the ScrollView; no cap. Add-CTA stays at the
  bottom (scrolls with content, not pinned).
- **Many budget groups:** segmented control `flexWrap: 'wrap'`s to multiple lines (existing
  behavior, tokenized).
- **Only one expanded row at a time** (recommended): expanding a row collapses the
  previously expanded one, so the screen never becomes a wall of open editors.

---

## 4. Section / component specs (frontend implements directly)

### 4.1 Fixed Header (shared pattern — matches calendar/dashboard/budget-tab)

Outside the ScrollView so it never scrolls.

| Slot | Content | Tokens |
|---|---|---|
| Left | shared `<BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />` | — |
| Center | "Budget Settings" | `typography.h3`, `colors.text` |
| Right | Add action `(＋)` icon button, ≥44pt target, `colors.primary2` glyph on `glassMedium` chip; opens the Add-Category sheet | `radius.md`, `spacing.sm` |

The `<View style={{ width: 40 }} />` spacer in today's code is replaced by the real add
action, so the title stays optically centered.

### 4.2 Budget Hero — `settings-budget-BudgetHero` (Tier 1, `glassFloating`)

The only floating card; the only card using `h1`.

- **Scope toggle** at top: two segmented options `Expenses` / `Income`, each with icon
  (`cart-outline` / `cash-outline`) + word + color. Active = `colors.primary2` text on
  `${colors.primary2}1f` fill + `colors.primary2` border; inactive = `colors.textMuted` on
  `glassLight`. Reuse the `ScopeToggle` / `budget-tab-TypeToggle` grammar. Full row ≥44pt.
- **Label:** "TOTAL MONTHLY BUDGET" — `typography.caption`, `colors.textMuted`,
  letterSpacing, uppercase.
- **Hero number:** `formatCurrency(totalMonthlyBudget)` (from design-system) in
  `typography.h1`, `colors.text`.
- **Proof line:** `{n} categories · {m} with rollover` — `typography.caption`,
  `colors.textMuted`. Omit the "· {m} with rollover" clause when `m === 0`.
- Padding `spacing.xl`, `radius.xl`, gap `spacing.xl` below before the list.

See `docs/design/components/settings-budget-BudgetHero.json`.

### 4.3 Category Row — `settings-budget-CategoryRow` (Tier 2, flat `glass`, expandable)

Collapsed row grammar (reuses `budget-tab-CategoryBudgetRow` shape):

- **Icon chip:** 36pt, `radius.md`, fill `${cat.color}20`, border `${cat.color}40`, glyph
  `cart-outline`/`cash-outline` in `cat.color` (the category's own color is the one
  sanctioned per-item color; if absent, default `colors.primary2`).
- **Name:** `typography.smallBold` (mapped up from today's 15px), `colors.text`,
  `numberOfLines={1}`.
- **Subtitle:** `{groupName || 'No group'}{ · Rollover if enabled}` — `typography.caption`,
  `colors.textMuted`.
- **Trailing amount:**
  - **Committed** (`limit_amount > 0`): `{formatCurrency(limit)}/mo` — `typography.smallBold`,
    `colors.text`, `flexShrink: 0`.
  - **Untracked** (`limit_amount` falsy): the **word** `No limit` — `typography.caption`,
    `colors.textMuted`. Amount is NOT rendered as `$0`; the word is clearer.
- **Rollover glyph:** if `rollover_enabled`, a 24pt `↻` badge (`refresh`, `colors.primary2`
  on `${colors.primary2}1f`) before the chevron. This is icon+word (subtitle says
  "Rollover") + color — color-independent.
- **Chevron:** `chevron-forward`, `colors.textMuted`; rotates to `chevron-down` when
  expanded (`animation.fast`).

**Untracked (ghosted) treatment** — the solid-vs-ghosted metaphor applied to this screen:
a category with no limit renders with a **dashed left border** (`borderStyle: 'dashed'`,
`colors.borderGlass`) and the "No limit" word + "Tap to set a limit" subtitle. Committed
rows are solid. This is fill-style + word + tint, never color alone.

**Expanded editor** (inline, inside the same card, revealed on tap):

| Field | Control | Tokens / behavior |
|---|---|---|
| Monthly limit | glass `TextInput`, `keyboardType="numeric"`, right-aligned, `$0` placeholder | fill `glassMedium`, border `borderGlass`, `radius.md`; commit `onEndEditing` → `updateCategory({ limit_amount })` |
| Group | segmented (`None` + each `budgetOption`), wraps | active = `${colors.primary2}1f` + `colors.primary2`; commit on press |
| Rollover | `<Switch>` | track `{true: colors.primary2, false: colors.glassMedium}`, thumb `colors.text` |
| Delete | destructive text button `🗑 Delete category` | `colors.error` glyph + word; keeps the existing `Alert.alert` confirm |

See `docs/design/components/settings-budget-CategoryRow.json`.

### 4.4 Add-Category CTA row + Bottom Sheet — `settings-budget-AddCategorySheet` (Tier 3)

- **CTA row** (in scroll, flat `glass`): `＋ Add {expense|income} category` +
  `chevron-forward`. Full row ≥44pt, `colors.primary2` leading glyph. Opens the sheet.
- **Sheet** (shared form-sheet recipe): bottom sheet on `colors.surface2`, grab handle,
  title `New {scope} category` (`typography.h3`) + close `✕`. Fields (all preserved from
  today):
  - **Name** row: color-tinted icon chip (`${newColor}20` fill) + glass name `TextInput`.
  - **Monthly limit** (optional) glass input, numeric.
  - **Enable rollover** switch row.
  - **Share with partner** switch row + hint "Partner can see this category"
    (`typography.caption`, `colors.textMuted`). *(Preserve existing `sharePartner` state.)*
  - **Color** swatch grid: 8 swatches, 32pt, `radius.md`; selected = `colors.text` 2px ring.
    Swatch palette is the existing preset set (per-item accent colors are a sanctioned
    exception to the no-literal rule; document them in the component JSON's `swatchPalette`).
  - **Group** segmented (only when `budgetOptions.length > 0`).
  - **Save**: full-width `gradients.primaryGradient` button, `typography.button`,
    `colors.text`; runs `handleAdd`, closes sheet on success, resets form.

See `docs/design/components/settings-budget-AddCategorySheet.json`.

---

## 5. States summary

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed. Hero + list + add CTA. |
| **Loading** | `Skeleton` hero block + 4 skeleton rows. Real header renders instantly. No spinner on first load. |
| **Empty (scope)** | Hero still renders ($0, "0 categories"); list area shows `EmptyState` (folder-open icon, copy, primary CTA → sheet). Per-scope: switching to Income can be empty while Expenses is populated, and vice versa. |
| **Error (load failed)** | Hero total "—"; list area shows `ErrorState` (alert-circle, copy, `Retry` re-runs `load()`). Never blank the whole screen. |
| **Saving / updating** | Optimistic — the row/hero updates immediately (existing behavior). On failure, revert + `Alert`. Save button in sheet shows a disabled/pending style while the POST is in flight. |
| **Overflow long name** | `numberOfLines={1}` + ellipsis; amount `flexShrink: 0`. |
| **Overflow many rows** | Scrolls; add CTA at end of content. |

---

## 6. Accessibility

- **Touch targets:** every scope-toggle option, category row, rollover badge, switch row,
  swatch, segmented item, and the add CTA is ≥44×44pt. Swatches are 32pt visually but sit
  in a ≥44pt tappable hit area (`hitSlop` or padded wrapper). The row tap target is the
  whole row, not just the chevron.
- **Color-independent status:** committed vs untracked is fill-style (solid vs **dashed**)
  + the **word** ("No limit" / "$X/mo") + tint — never color alone. Rollover is `↻` icon +
  the word "Rollover" in the subtitle + `colors.primary2`. Delete is `trash` icon + the
  word "Delete" + `colors.error`.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` on dark glass (both clear
  WCAG AA at their sizes). Do not dim `colors.text` below full opacity for the ghosted
  rows — use `colors.textMuted` at full opacity instead, so the 4.5:1 minimum holds.
- **Screen-reader order & labels:**
  - Hero: "Total monthly budget, {amount}, {n} categories, {m} with rollover. Scope:
    Expenses selected / Income."
  - Scope toggle: each option `accessibilityRole="button"`, `accessibilityState.selected`.
  - Category row: `"{name}, {amount or 'no limit set'}, {group}, {rollover on/off}, button,
    double tap to edit"`. Delete button labeled `"Delete {name}"`, `accessibilityRole` with
    a destructive hint.
  - Switches use `accessibilityRole="switch"` + `accessibilityState.checked`; the whole row
    is the target.
  - Sheet: focus moves to the sheet title on open; close (`✕`) returns focus to the CTA.
- **Reduced motion:** chevron-rotate, row expand/collapse, and sheet slide use
  `animation.fast` / `animation.medium`; under reduce-motion, swap for instant show/hide
  (no scale/height animation).

---

## 7. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| header `fontSize: 20, fontWeight: '800', color:'#f8fafc'` | `typography.h3`, `colors.text` |
| accent `'#c084fc'` (toggle/active/icons) | `colors.primary2` |
| `'#f8fafc'` (all primary text) | `colors.text` |
| `'#94a3b8'` (labels) | `colors.textMuted` |
| `'#64748b'` (section label, seg inactive, muted icons) | `colors.textMuted` |
| `'#475569'` (placeholder, hint) | `colors.textDark` |
| save button `'#7c3aed'` | `gradients.primaryGradient` (primary CTA earns gradient) |
| category icon `'#a855f7'` default | `colors.primary2` |
| card `'rgba(255,255,255,0.06)'` + `borderRadius:18` + `border 'rgba(255,255,255,0.08)'` | `glassEffects.glass` (Tier 2/3) / `glassEffects.glassFloating` (hero) |
| catCard/total/input `'rgba(255,255,255,0.04)'` fills | `colors.glassLight` |
| input fill `'rgba(255,255,255,0.06)'` | `colors.glassMedium` |
| all borders `'rgba(255,255,255,0.08 / 0.06)'` | `colors.borderGlass` |
| active tint `'rgba(192,132,252,0.12)'` (toggle/seg/badge) | `${colors.primary2}1f` (≈12% — documented semantic tint) |
| active border `'rgba(192,132,252,0.3 / 0.4)'` | `${colors.primary2}` at border weight |
| switch track `'#a855f7'` / `'rgba(255,255,255,0.15)'` | `colors.primary2` / `colors.glassMedium` |
| `borderRadius: 18/16` | `radius.xl` / `radius.lg` |
| `borderRadius: 14/12` | `radius.lg` / `radius.md` |
| `borderRadius: 10/8` | `radius.md` / `radius.sm` |
| `padding: 16/14`, `gap 12/10/6`, `paddingVertical 14/12/10/8` | `spacing.lg / md / sm / xs` |
| `fontSize: 22` (total value) | `typography.h1` (promoted to hero) |
| `fontSize: 15` (catName) | `typography.smallBold` |
| `fontSize: 14/13` (fields) | `typography.small` / `smallBold` |
| `fontSize: 12/11` (subs, hints, section label) | `typography.caption` |
| local `formatCurrency` | `formatCurrency` from `design-system.ts` |
| local `PRESET_COLORS` | keep as documented `swatchPalette` in the AddCategorySheet JSON (per-item accent exception) |

**Hard rule:** after redesign, no literal hex/rgba/px remains except (a) the documented
`${colors.primary2}1f` ≈12% semantic tint, (b) per-category / swatch accent colors (a
sanctioned per-item-color exception, since categories carry their own `color`).

---

## 8. Developer notes

- Reuse shared components — do **not** re-implement: `GradientBackground`, `Skeleton`
  (loading), `BackButton`, `EmptyState`, `ErrorState`. Use the `ScopeToggle` /
  `budget-tab-TypeToggle` grammar for the Expenses/Income switch and the `priorities` /
  `savings` form-sheet recipe for the Add sheet.
- Add an error flag to `load()`: today failures are swallowed to `console.error` — set a
  `loadError` state so the Error state can render and `Retry` can re-invoke `load()`. Add a
  `loading` boolean (true until first `load()` resolves) to drive the skeleton.
- `totalMonthlyBudget` math is unchanged (`filtered.reduce(... limit_amount)`), just
  displayed via the shared `formatCurrency` in `typography.h1`.
- The expand/collapse of a row is new IA but preserves every existing edit control (limit,
  group, rollover, delete) — nothing is removed. Recommended: track a single
  `expandedId` so only one editor is open at a time.
- The Add form's state (`newName/newColor/newLimit/newRollover/newBudgetId/sharePartner`)
  and `handleAdd` move verbatim into the sheet — no logic change, only relocation + tokens.
- `sharePartner` currently has no backend wire-up in `handleAdd`'s payload; **preserve the
  UI toggle as-is** (do not silently drop it) and leave a `// TODO wire share flag` note —
  out of scope for this design.

---

## 9. Handoff checklist

- [x] All states designed (default, loading skeleton, empty-per-scope, error, saving, overflow)
- [x] Strict 3-tier hierarchy: floating hero (h1) → flat category list → add-via-sheet
- [x] Committed-vs-untracked uses solid-vs-ghosted (dashed edge + word), color-independent
- [x] Every old hardcoded value mapped to a design-system token
- [x] Fixed header w/ BackButton + h3 + add action (outside scroll)
- [x] Accessibility: 44pt targets, icon+word+color status, SR labels/order, reduced motion
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, EmptyState, ErrorState)
- [x] Component specs written (`docs/design/components/settings-budget-*.json`)
- [x] Functionality preserved (categories, limits, groups, rollover, color, add, delete, share toggle)
