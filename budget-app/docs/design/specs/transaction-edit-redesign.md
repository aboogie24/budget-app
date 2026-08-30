# Edit Transaction Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `transaction/edit/[id]` → `budget-app/app/transaction/edit/[id].tsx`
**Archetype:** Form (single-column, one primary action) — the **edit twin** of `add-transaction`
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Reference screens (the look to match):** `app/(tabs)/dashboard.tsx`, `app/(tabs)/calendar.tsx`
**Sibling spec this MUST stay consistent with:** `docs/design/specs/add-transaction-redesign.md`
**Replaces:** ad-hoc styling in `budget-app/app/transaction/edit/[id].tsx`

---

## 1. Why this redesign exists

This is the **edit** counterpart of the add-transaction form, and it has all the same problems plus a
few of its own. It is visually a **different app** from the rest of CoupleFlow:

- **Off-theme background.** It uses the bespoke gradient `['#0b1021','#1b0d30','#2d0c53']` via a raw
  `LinearGradient` (in *three* places — default, loading, and error branches), instead of the
  `<GradientBackground variant="bgDarkPurple">` that dashboard, calendar, and add-transaction
  standardized on. It reads as a slightly wrong hue and breaks the unified feel.
- **Hardcoded everything.** Colors (`'#f87171'`, `'#34d399'`, `'#a855f7'`, `'#94a3b8'`, `'#cbd5e1'`,
  `'#e5e7eb'`, `'#f8fafc'`, `'#64748b'`), radii (`16`, `14`, `12`, `8`), paddings (`20`, `70`, `18`,
  `16`, `14`, `12`, `10`), and font sizes/weights (`22/800`, `13`, `14/700`, `16/800`) are all magic
  numbers. None come from `design-system.ts`.
- **Non-standard header.** A custom 3-column `headerRow` with `paddingTop: 70` and its own
  `headerTitle`/`headerSubtitle` sizes, ignoring the safe-area inset the reference screens rely on.
- **A raw spinner for loading and a blank screen for errors.** The initial fetch shows a bare
  centered `ActivityIndicator` (not a layout-matched skeleton), and every failure —
  *transaction-not-found*, *no session*, *fetch failed* — dumps the whole screen for a centered red
  string + "Go Back". That is the opposite of the app's inline glass-card state language.
- **Blocking `Alert.alert` validation and confirmation.** Invalid amount, bad due day, category-create
  failure, save failure, and even the *success* case all fire native modal alerts. The rest of the app
  uses inline hints + haptics + `router.back()`.
- **A bespoke inline category-suggestion dropdown** (`suggestionItem`) that doesn't match how
  add-transaction picks categories (it uses the shared `CategoryPicker`). Two screens, two category
  UIs, is exactly the fragmentation this program is fixing.

This redesign keeps the screen **recognizably the same edit form** — type toggle, name, amount,
category, frequency, conditional due-day, one Save button — re-skins it entirely onto the design
system, adopts the **exact same form vocabulary as add-transaction** (so add and edit are visually one
family), and adds the states the edit flow specifically needs: a **pre-fill skeleton**, a
**transaction-not-found** state, a **destructive Delete** action, and **dirty-tracking** on Save.

---

## 2. Information architecture — what changed and why

The edit form is the same shape as add, with three edit-specific IA moves. Reading order top to bottom:

1. **Header** — standard tokenized header with `BackButton`, title `Edit Transaction`, one-line
   subtitle. Gains a right-side **Delete** action (edit-only; add has an empty 40pt spacer there).
2. **Type segmented control** (Expense | Income) — the *frame* for everything below; it recolors the
   amount and swaps the category set, so it stays first (as today). Pre-selected to the transaction's
   current type.
3. **Amount — promoted to a hero field.** Identical to add: amount is the single most important value,
   so it becomes a large centered numeric hero inside the top `glassFloating` card, semantically tinted
   (`colors.error` expense / `colors.success` income). On edit it mounts **pre-filled** with the
   existing amount.
4. **Details card** — Name, Category, Frequency chips, conditional **Due day**. All pre-filled from the
   loaded transaction. Category uses the shared `CategoryPicker` (retiring the bespoke suggestion
   dropdown), so add and edit pick categories the same way.
5. **Sticky Save CTA** — primary gradient button pinned to the bottom (keyboard-aware). On edit it reads
   **Save Changes** and is **disabled until the form is both valid *and* dirty** (nothing changed →
   nothing to save).

Everything the current screen does is preserved: same fields, same category-create-if-missing behavior,
same PUT payload to `/auth/transactions/{id}`, same haptics. The structural moves are: amount promoted
to a hero, validation/confirmation moved from blocking alerts to inline color-independent surfaces, the
CTA pinned + dirty-gated, a Delete affordance added, and the suggestion dropdown replaced by
`CategoryPicker`.

### Layout structure

```
GradientBackground (bgDarkPurple)
└─ SafeAreaView
   ├─ Header row     [BackButton] [ Edit Transaction / subtitle ] [ Delete ]
   ├─ ScrollView (keyboard-aware, flexes above sticky footer)
   │   ├─ Type segmented control (Expense | Income)      ← pre-selected
   │   ├─ Amount hero card (glassFloating)               ← pre-filled + inline error slot
   │   ├─ Details card (glass)
   │   │    ├─ Name field                                ← pre-filled
   │   │    ├─ Category row  → CategoryPicker            ← pre-filled
   │   │    ├─ Frequency chip row                        ← pre-selected
   │   │    └─ Due-day field (conditional)               ← pre-filled
   │   └─ (inline error card, if save/delete failed)
   └─ Sticky footer:  Save Changes CTA  (disabled(clean/invalid) | default | loading)
```

---

## 3. Wireframes (key states)

### 3.1 Default / populated (pre-filled from the loaded transaction)

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Edit Transaction                     [ 🗑 ]     │  header: Back + title + Delete action
│            Update the details, then save                  │  subtitle (textMuted)
│                                                            │
│  ┌──────────────────────┬──────────────────────┐          │  segmented control (pre-selected)
│  │  💳  Expense   ●      │   ↗  Income          │          │  active = expense → error-tinted
│  └──────────────────────┴──────────────────────┘          │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Amount hero — glassFloating
│  │                    AMOUNT                            │   │  label (caption, muted)
│  │                                                      │   │
│  │                  −  $ 84.20                          │   │  h1, colors.error (expense), pre-filled
│  │                                                      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Details card — glass
│  │  Name                                               │   │  label (smallBold)
│  │  [ 🅣  Whole Foods                              ]   │   │  input row (glass inset), pre-filled
│  │                                                      │   │
│  │  Category                                           │   │
│  │  [ 🏷  Groceries                            ›  ]     │   │  tap → CategoryPicker, pre-filled
│  │                                                      │   │
│  │  Frequency                                          │   │
│  │  ( one-time )( weekly )( biweekly )( monthly ● )    │   │  chip row, selected = primary tint
│  │                                                      │   │
│  │  Due day                          (monthly+expense) │   │  conditional field, pre-filled
│  │  [ 📅  17                                       ]   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
├────────────────────────────────────────────────────────── ┤
│  ┌────────────────────────────────────────────────────┐   │  sticky footer
│  │              Save Changes  →                         │   │  primaryGradient CTA (dirty-gated)
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Income variant: segmented control right side active (`↗ Income`, `colors.success` tint), amount hero
shows `+ $5,200.00` in `colors.success`, Due-day never shown (income has no due day).

**Clean vs dirty:** on first mount nothing is changed, so the CTA renders **disabled** (`opacity 0.5`,
label `Save Changes`). The moment any field diverges from the loaded snapshot, the CTA enables.

### 3.2 Loading (initial pre-fill — fetch transaction + categories)

This is the state the current bare `ActivityIndicator` covers, and it's the biggest difference from
add-transaction: edit **must fetch and pre-fill** before the form is usable. Use
`components/Skeleton.tsx`, layout-matched so the real pre-filled fields don't jump when they arrive. The
header renders normally (title is known); the Delete action is skeleton/disabled until data loads.

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Edit Transaction                     [ ▓ ]     │  header normal; delete disabled
│            Update the details, then save                  │
│                                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (skeleton bar)   │  segmented control placeholder (h=44)
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  amount hero skeleton (glassFloating)
│  │      ▓▓▓▓▓▓  (label)                                 │   │
│  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (big number bar, h=40)      │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │  details skeleton
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (name, h=48)   │   │
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (category,h=48) │   │
│  │  ▓▓▓▓  ( )( )( )( )  (chip row)                     │   │
│  └────────────────────────────────────────────────────┘   │
│  [ ▓▓▓▓▓▓▓▓▓▓▓▓  disabled CTA skeleton ]                   │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Empty state — two edit-specific "emptys"

**(a) Category picker empty (same as add):** if the household has **no categories** for the selected
type, the Category row becomes an inline empty affordance (dashed border) rather than opening a dead
picker.

```
│  Category                                                  │
│  ┌────────────────────────────────────────────────────┐   │  glass, dashed border = "nothing yet"
│  ╎ 🏷  No expense categories yet         + Create      ╎   │  outline icon + word + action
│  └────────────────────────────────────────────────────┘   │
```

**(b) Transaction not found (edit-only, see §3.4).** This replaces the current blank
`"Transaction not found."` screen and is the more important edit empty state.

### 3.4 Error / not-found states — inline glass, never a blank screen

The current code blanks the whole screen for three distinct failures. The redesign gives each an inline
glass card on the standard gradient + header, so the user always has context and a way out.

**(a) Transaction not found / no session (fatal — can't populate the form).** The form body is replaced
by a single centered glass card. This is the one case where a full-body state is correct (there's
literally nothing to edit).

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Edit Transaction                               │  header (no Delete — nothing to delete)
│                                                            │
│         ┌──────────────────────────────────────┐          │
│         │            ( 🔍 )                      │          │  search-outline, colors.textMuted
│         │      We couldn't find this            │          │  smallBold, colors.text
│         │      transaction                       │          │
│         │  It may have been deleted or moved.    │          │  small, colors.textMuted
│         │      [   Back to transactions   ]      │          │  glass button → /(tabs)/budget
│         └──────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

Copy varies by cause but the shell is identical: `No user session` → icon `person-outline`, "You're
signed out", subcopy "Sign in again to edit this transaction."

**(b) Load failed (recoverable — network/server).** Same inline card but with a **Retry** that re-runs
the fetch, plus Back. Uses `alert-circle-outline` (`colors.error`) + the word "Couldn't load."

```
│         ┌──────────────────────────────────────┐          │
│         │            ( ⚠ )                       │          │  alert-circle-outline, colors.error
│         │      Couldn't load this transaction    │          │  smallBold, colors.text
│         │   Check your connection and try again. │          │  small, colors.textMuted
│         │       [  Retry  ]     [  Back  ]        │          │  primary retry + glass back
│         └──────────────────────────────────────┘          │
```

**(c) Save / Delete failed (form stays intact).** Replaces the blocking `Alert.alert('Error', …)`. An
inline glass error card appears directly above the sticky CTA; the CTA returns to enabled so the user
can retry without losing their edits.

```
│  ┌────────────────────────────────────────────────────┐   │  inline error card — glass
│  │  ⚠  Couldn't save your changes                      │   │  alert-circle-outline (error) + word
│  │     Check your connection and try again.            │   │  small, textMuted
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────── ┤
│  [ Save Changes  →  ]   ← re-enabled                       │
```

Field-level validation (color-independent), replacing the invalid-amount / bad-due-day alerts:

```
│  Amount                                                    │
│  [ $ abc ]                                                 │
│  ⚠ Enter a valid number            ← caption, colors.error + icon

│  Due day                                                   │
│  [ 📅  45 ]                                                │
│  ⚠ Day must be 1–31                ← caption, colors.error + icon
```

### 3.5 Delete confirmation (edit-only destructive action)

Delete is destructive, so it keeps a **confirmation** — but as the app's bottom-sheet language, not a
generic alert. A compact confirm sheet on `colors.surface2`.

```
        ┌──────────────────────────────────────────┐
        │  Delete this transaction?                 │  smallBold, colors.text
        │  This removes “Whole Foods − $84.20”      │  small, colors.textMuted (echoes the record)
        │  and can't be undone.                      │
        │                                            │
        │  [        Delete        ]                  │  error-filled button (destructive)
        │  [        Cancel        ]                  │  glass button
        └──────────────────────────────────────────┘
```

- Delete button: fill `colors.error` (destructive is the one place a solid semantic fill is right),
  label white `typography.button`. On confirm → `errorHaptic()`? No — success on delete: run the delete
  call, `successHaptic()`, `router.back()`. On failure → inline error card (§3.4c), sheet closes.
- If a `DELETE /auth/transactions/{id}` endpoint isn't available yet, ship the Delete action
  **disabled-styled** and note it in dev notes (forward-compat, mirrors how add ships the period switch
  disabled). Do not remove the affordance.

### 3.6 Disabled CTA (clean or invalid)

Save Changes is disabled when **(not dirty)** OR **(invalid)**. Invalid = amount not a finite number,
or no category, or (monthly expense) dueDay not 1–31. Disabled = `opacity 0.5`, no gradient press
feedback, `accessibilityState={{ disabled: true }}` with a reason ("No changes yet" when clean, "Enter
a valid amount" when invalid). This proactively surfaces the same rules the old blocking alerts
enforced.

### 3.7 Overflow / edge cases

```
Long name:        [ 🅣  Whole Foods Market — Downtown Fla… ]   numberOfLines=1, ellipsis
Long category:    [ 🏷  Dining & Restaurants                ›]   name truncates, chevron pinned (flexShrink 0)
Large amount:     −  $1,250,000.00                             hero auto-shrinks font one step at >10 chars
Many freq chips:  wraps to 2 rows (flexWrap), gap = spacing.sm
Delete echo copy: sheet subtitle numberOfLines=2, ellipsis on the merchant name
```

---

## 4. Token mapping (no magic numbers)

Every current hardcoded value → its `design-system.ts` token. (Shared rows match the add-transaction
mapping exactly so the two screens stay identical; edit-only rows are marked ★.)

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0b1021','#1b0d30','#2d0c53']` (bg — all 3 branches) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| Save button `LinearGradient ['#a855f7','#7c3aed']` | `gradients.primaryGradient` |
| Loading `ActivityIndicator color '#a855f7'` on a bespoke gradient | `Skeleton` placeholders on `GradientBackground` (spinner only for background refresh) ★ |
| Error `errorText '#f87171'` + bespoke `errorButton` on blank screen | inline glass state card (§3.4), `colors.error` icon + word ★ |
| Expense accent `'#f87171'` (toggle icon/text, amount) | `colors.error` |
| Income accent `'#34d399'` (toggle icon/text, amount) | `colors.success` |
| Selected chip `'rgba(168,85,247,0.18)'` fill / `'rgba(168,85,247,0.7)'` border | `colors.primary2` @ ~18% fill / @ ~70% border |
| Toggle inactive `'#94a3b8'` / placeholder `'#94a3b8'` | `colors.textMuted` |
| Input icon `'#cbd5e1'` | `colors.textMuted` (or `colors.text` for filled) |
| Label `'#e5e7eb'` | `colors.text` |
| Suggestion text `'#e5e7eb'` / suggestion row bg `'rgba(255,255,255,0.08)'` | retired — replaced by `CategoryPicker` ★ |
| Primary text `'#f8fafc'` | `colors.text` |
| Subtitle `'#cbd5e1'` | `colors.textMuted` |
| Card `bg 'rgba(255,255,255,0.05)'` + `border 'rgba(255,255,255,0.06)'` | `glassEffects.glass` / `commonStyles.card` |
| Amount hero card | `glassEffects.glassFloating` (it earns elevation) |
| Input inset `bg 'rgba(255,255,255,0.06)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassMedium` + `colors.borderGlass` |
| Toggle inactive `bg 'rgba(255,255,255,0.04)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassLight` + `colors.borderGlass` |
| Toggle active expense `'rgba(248,113,113,0.1)'` / `0.3` border | `colors.error` @ 10% / @ 30% |
| Toggle active income `'rgba(52,211,153,0.1)'` / `0.3` border | `colors.success` @ 10% / @ 30% |
| Chip `bg 'rgba(255,255,255,0.06)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassMedium` + `colors.borderGlass` |
| Category-create default `color: '#4CAF50'` (in `handleSave`) | `colors.success` (keep as the created-category color) ★ |
| Delete action tint (new) | `colors.error` icon; confirm sheet delete button = `colors.error` fill ★ |
| `borderRadius: 16` (card) | `radius.lg` |
| `borderRadius: 14` (button, chip, freq) | `radius.lg` (button) / `radius.md` (chip) |
| `borderRadius: 12` (inputs, toggle, iconButton) | `radius.md` |
| `borderRadius: 8` (suggestionItem) | retired ★ |
| `padding: 20` (container) | `spacing.lg` horizontal via `commonStyles.scrollContent` |
| `paddingTop: 70` | `SafeAreaView` inset + `spacing.sm` (drop the magic 70) |
| `padding: 16` (card) | `spacing.lg` |
| `marginBottom: 18 / 14` | `spacing.lg` / `spacing.md` |
| `paddingVertical: 16` (button) | `spacing.lg` |
| `paddingVertical: 12 / 10` (inputs, freq) | `spacing.md` / `spacing.sm` |
| `gap: 8` (rows/chips) | `spacing.sm` |
| header `fontSize:22, weight:800` | `typography.h3` (weight 800 override ok, matches calendar/add title) |
| subtitle `fontSize:13` | `typography.small`, `colors.textMuted` |
| label `fontSize:14, weight:700` | `typography.smallBold` |
| button text `fontSize:16, weight:800` | `typography.button` |
| amount hero (new) | `typography.h1`, semantic color |
| Native `Alert.alert(...)` for validation (invalid amount / bad due day) | inline field hints (`typography.caption`, `colors.error` + icon) |
| Native `Alert.alert('Error', 'Failed to create category.')` | inline error card (§3.4c) ★ |
| Native `Alert.alert('Error', 'Could not save…')` | inline error card (§3.4c) |
| Native `Alert.alert('Success', 'Transaction updated.')` | keep `successHaptic()`; drop the modal → `router.back()` (calendar/dashboard don't confirm-modal on write) |
| (new) Delete confirmation | bottom-sheet confirm on `colors.surface2` (§3.5), not `Alert.alert` ★ |

---

## 5. Component specs

**Reuse the add-transaction form components verbatim** — this is the whole point of keeping add and edit
one family. The shared, already-specced components are:

- `add-transaction-type-segmented-control.json` — Type segmented control (pre-selected on edit).
- `add-transaction-amount-hero.json` — Amount hero (pre-filled on edit).
- `add-transaction-form-field.json` — Name / Due-day glass inset field.
- `add-transaction-category-row.json` — Category row → `CategoryPicker` (retires the bespoke dropdown).
- `add-transaction-frequency-chips.json` — Frequency chip radiogroup.
- `add-transaction-save-cta.json` — Sticky save button (label + dirty-gate overridden per §5.3).

Plus shared primitives: `GradientBackground`, `BackButton`, `Skeleton`, `CategoryPicker`.

Only the **edit-specific** additions get new `transaction-edit-` prefixed JSONs.

### 5.1 Header (standard, tokenized) — with Delete action

- Layout: `flexDirection row`, `alignItems flex-start`, `paddingHorizontal spacing.lg`,
  `paddingTop spacing.sm`, `paddingBottom spacing.md` (matches dashboard/add header).
- Left: `<BackButton fallback="/(tabs)/budget" />` (preserve current fallback).
- Center: title `Edit Transaction` (`typography.h3`, weight 800, `colors.text`) + subtitle
  `Update the details, then save` (`typography.small`, `colors.textMuted`).
- Right: **Delete action** (`transaction-edit-delete-action.json`) — a 40×40 icon button
  (`trash-outline`, `colors.error`) matching `BackButton`'s square-glass footprint, `hitSlop` 12 →
  ≥44pt. Replaces add's empty 40pt spacer. **Hidden** in the not-found/no-session state (§3.4a) and
  **disabled-styled** while loading or if no delete endpoint exists.

### 5.2 Amount / Name / Category / Frequency / Type — reused

These behave exactly as in add-transaction, with one difference: they **mount pre-filled** from the
loaded transaction. No prop changes; the parent seeds their `value`/`selected` from fetched data.
Category specifically **drops the bespoke inline suggestion list** (`suggestionItem` styles) and uses
`CategoryPicker`, so the create-if-missing logic in `handleSave` still runs but selection is picker-based.

### 5.3 SaveCTA — reused, dirty-gated (edit override)

Same `add-transaction-save-cta.json` component, with the edit label and gate:

- Label: **`Save Changes`** (add uses `Save`).
- `disabled` when **`!isDirty || !isValid`** (add uses just `!isValid`). `isDirty` = any field differs
  from the loaded snapshot. Clean form → dimmed CTA with reason "No changes yet."
- `loading` state label `Saving…`, small `ActivityIndicator`, non-interactive; keep
  `successHaptic()`/`errorHaptic()` on resolve.
- On success → `successHaptic()` + `router.back()` (no success modal).

### 5.4 DeleteAction → `transaction-edit-delete-action.json` (new)

- 40×40 square-glass button in the header right slot (mirrors `BackButton` footprint), icon
  `trash-outline` in `colors.error`, `hitSlop` 12 → ≥44pt.
- `onPress` opens the DeleteConfirmSheet (§5.5). States: `default | pressed | disabled | hidden`.
- Disabled when data still loading or no delete endpoint; hidden in the not-found state.
- `accessibilityRole="button"`, label `"Delete transaction"`, hint `"Opens a delete confirmation."`

### 5.5 DeleteConfirmSheet → `transaction-edit-delete-confirm-sheet.json` (new)

- Bottom sheet on `colors.surface2`, `radius.xl` top corners, `padding spacing.xl`, `gap spacing.md`
  (the shared confirm/form-sheet recipe).
- Title `Delete this transaction?` (`typography.smallBold`, `colors.text`); body echoes the record
  (`This removes "{name} {sign}${amount}" and can't be undone.`, `typography.small`, `colors.textMuted`,
  `numberOfLines 2`).
- Primary (destructive) button: fill `colors.error`, `radius.lg`, `paddingVertical spacing.lg`, label
  `Delete` white `typography.button`. Secondary: glass `Cancel`.
- States: `default | deleting (button → "Deleting…" + spinner, non-interactive)`.
- `accessibilityViewIsModal`, focus lands on the title; the destructive button announces
  `"Delete transaction, deletes permanently."`

### 5.6 EditStateCard → `transaction-edit-state-card.json` (new)

The single inline full-body card that renders for **loading-failed / not-found / no-session** (§3.4a–b).
One component, driven by a `kind` prop, so all three fatal states look consistent.

- Centered `glassEffects.glass` card, `padding spacing.xl`, `alignItems center`, `gap spacing.md`.
- `kind: 'notFound' | 'noSession' | 'loadError'` → icon + copy + actions:
  - `notFound` → `search-outline` (`colors.textMuted`), "We couldn't find this transaction", subcopy,
    single glass **Back to transactions** button.
  - `noSession` → `person-outline` (`colors.textMuted`), "You're signed out", subcopy, glass Back.
  - `loadError` → `alert-circle-outline` (`colors.error`), "Couldn't load this transaction", subcopy,
    **primary Retry** (`gradients.primaryGradient`) + glass Back.
- Icon + word always paired (color-independent). States: one per `kind`; Retry has a `retrying` spinner.

### 5.7 InlineErrorCard (save / delete failure) — reuse pattern

Same inline glass error card as add-transaction §3.4 and calendar §7: `glassEffects.glass`,
`alert-circle-outline` (`colors.error`) + `Couldn't save your changes` / `Couldn't delete` +
`typography.small` `colors.textMuted` subcopy. Appears above the sticky CTA; clears on the next
successful action. Not a new JSON — mirror the add/calendar inline error spec.

---

## 6. Interactions

- **Initial load:** fetch transaction → pre-fill all fields → fetch categories for its type. Show the
  §3.2 skeleton meanwhile (not a bare spinner). Snapshot the loaded values for dirty-tracking.
- **Type switch:** `animation.fast` (150ms) cross-fade of the active segment tint + amount hero color;
  resets category selection (preserve existing `type`-change effect that refetches categories). Under
  reduced motion, instant.
- **Amount focus:** tapping the hero card focuses the numeric input; keyboard pushes the sticky CTA up
  (`KeyboardAvoidingView`, `behavior: padding` on iOS).
- **Category tap:** opens `CategoryPicker` (existing). On select, row fills. The create-if-missing path
  (typed a new name) still fires in `handleSave`, tinted `colors.success` (was `#4CAF50`).
- **Frequency select:** chip toggles; selecting `monthly` while `type === expense` reveals the Due-day
  field over `animation.medium`, collapses otherwise (unchanged logic).
- **Dirty tracking:** any change from the loaded snapshot enables the CTA; reverting all changes
  re-disables it ("No changes yet").
- **Save:** validate inline (no blocking alert); on success → `successHaptic()` + `router.back()`; on
  failure → `errorHaptic()` + inline error card, CTA re-enabled.
- **Delete:** Delete action → confirm sheet → on confirm run delete → `successHaptic()` + `router.back()`;
  on failure → close sheet + inline error card.
- **Retry (load error):** re-runs the fetch and returns to skeleton → populated.
- **Press feedback:** all tappables `activeOpacity ~0.7–0.85`; chips/segments get a subtle
  background-tint change on press.

---

## 7. Accessibility

- **Touch targets:** BackButton (40 + hitSlop 12), Delete action (40 + hitSlop 12), segments, chips,
  category row, CTA, and confirm-sheet buttons are all ≥44×44pt.
- **Color-independent status (icon + word + color, everywhere):**
  - Expense vs income → **icon (card vs trending-up) + words "Expense"/"Income" + sign prefix (−/+)**,
    not color alone.
  - Validation → `alert-circle-outline` + a **word** ("Enter a valid number", "Day must be 1–31",
    "Select a category") with the red, never red alone.
  - Fatal states → each `EditStateCard.kind` pairs a distinct icon + a headline word.
  - Delete is conveyed by the **trash icon + the word "Delete"**, not just the red fill.
  - Selected frequency/type conveyed via `accessibilityState` (checked/selected) + weight change, not
    only the purple tint.
- **Screen-reader order:** title → subtitle → Delete action → type control ("Expense selected") →
  amount ("Amount, $84.20, expense") → Name → Category → Frequency (radiogroup) → Due day (if present) →
  Save Changes (announces disabled reason: "No changes yet" or "Enter a valid amount"). In fatal
  states: title → the state card headline → its action button.
- **Labels:** amount `accessibilityLabel="Transaction amount"`; category row `"Category, {name or
  none}, opens picker"`; CTA `"Save changes"`; Delete `"Delete transaction"`; confirm sheet is a modal
  (`accessibilityViewIsModal`) with focus on its title.
- **Contrast:** all text on dark glass uses `colors.text` / `colors.textMuted`; placeholder
  `colors.textMuted` (#94a3b8) on `colors.glassMedium` clears 4.5:1 over the dark gradient. The
  `colors.error` fill of the Delete button carries white `typography.button` (≥4.5:1).
- **Reduced motion:** type cross-fade, due-day reveal, sheet slide-in, and press scales collapse to
  instant state changes under `AccessibilityInfo.isReduceMotionEnabled`.

---

## 8. Developer notes

- **This is add-transaction + pre-fill + delete.** Build it from the same components; the only new
  parts are `DeleteAction`, `DeleteConfirmSheet`, `EditStateCard`, and the dirty-gate on the CTA.
- Swap all three root `LinearGradient`s (default, loading, error branches) for a single
  `<GradientBackground variant="bgDarkPurple">` + `SafeAreaView`; delete `paddingTop: 70`.
- Wrap the scroll body in `KeyboardAvoidingView` so the sticky CTA + amount hero stay visible while the
  numeric keyboard is up.
- **Pre-fill + snapshot:** after the fetch resolves, seed every field *and* keep an immutable snapshot
  (`initialForm`) of `{type, amount, category, note, frequency, dueDay}`. `isDirty = !deepEqual(current,
  initialForm)`. The CTA is disabled when `!isDirty || !isValid`.
- **`isValid` memo** = amount is a finite number && a category is selected && (not monthly-expense ||
  dueDay 1–31). It replaces the `Alert.alert` validation branches — keep the *logic*, change the
  *surface* to inline hints.
- **Retire the bespoke category dropdown.** Delete the `suggestionItem` filter-list and wire the
  Category row to `CategoryPicker` (as add-transaction does). The create-if-missing branch in
  `handleSave` stays; just change the created-category `color` from `'#4CAF50'` to `colors.success`.
- **Loading is the primary edit state** (unlike add, where it's a brief flash). Always render the §3.2
  skeleton while `loading` is true — the current bare `ActivityIndicator` is the thing being replaced.
- **Three fatal outcomes → one `EditStateCard`** with `kind`: keep the existing branch conditions
  (`!currentUser?.id` → `noSession`, transaction not found → `notFound`, thrown fetch error →
  `loadError`), just render the inline card instead of blanking.
- **Delete:** if `DELETE /auth/transactions/{id}` exists, wire it; otherwise ship the Delete action
  disabled-styled and leave a TODO (forward-compat, mirrors add shipping its period switch disabled).
- Preserve `successHaptic()` / `errorHaptic()`, `uuidv4()` id for created categories, and the exact PUT
  payload to `/auth/transactions/{transactionId}` — this is a re-skin + IA change, not a behavior
  change. Drop only the success `Alert.alert` (replace with `router.back()`).

---

## 9. Handoff checklist

- [x] All states designed (default/populated pre-filled, loading skeleton, empty-category, not-found,
      no-session, load-error, save/delete-error, disabled clean/invalid, overflow)
- [x] Off-theme gradient (all 3 branches) replaced with `<GradientBackground variant="bgDarkPurple">`
- [x] Every hardcoded color/gradient/radius/spacing/font mapped to a design-system token
- [x] Blocking `Alert.alert` (validation, save, delete, success) replaced with inline surfaces + haptics
- [x] Amount promoted to a semantic pre-filled hero (income green / expense red, sign prefix)
- [x] Sticky, keyboard-aware, **dirty-gated** Save Changes CTA
- [x] Edit-only Delete action + bottom-sheet confirmation (not an Alert)
- [x] Bespoke category dropdown retired in favor of shared `CategoryPicker`
- [x] Accessibility: 44pt targets, icon+word+color status, SR order, reduced motion
- [x] Add/edit kept as one visual family — reuses the `add-transaction-*` component specs verbatim
- [x] Edit-specific component specs written (`docs/design/components/transaction-edit-*.json`)
- [x] Functionality preserved (same fields, PUT payload, category-create, haptics, navigation)
```