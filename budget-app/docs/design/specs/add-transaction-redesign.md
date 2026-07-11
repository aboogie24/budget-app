# Add Transaction Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `add-transaction` → `budget-app/app/add-transaction.tsx`
**Archetype:** Form (single-column, one primary action)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Reference screens (the look to match):** `app/(tabs)/dashboard.tsx`, `app/(tabs)/calendar.tsx`
**Replaces:** ad-hoc styling in `budget-app/app/add-transaction.tsx`

---

## 1. Why this redesign exists

The screen works, but it is visually a **different app** from the rest of CoupleFlow. Concretely:

- **Off-theme background.** It uses a bespoke gradient `['#0b1021','#1b0d30','#2d0c53']` via a raw
  `LinearGradient`, instead of the `<GradientBackground variant="bgDarkPurple">` that dashboard and
  calendar standardized on. It reads as a slightly different hue and kills the unified feel.
- **Hardcoded everything.** Colors (`'#f87171'`, `'#34d399'`, `'#a855f7'`, `'#94a3b8'`, `'#cbd5e1'`,
  `'#e5e7eb'`, `'#64748b'`), radii (`16`, `14`, `12`), paddings (`20`, `70`, `18`, `16`, `14`, `10`),
  and font sizes/weights (`22/800`, `13`, `14/700`) are all magic numbers. None come from
  `design-system.ts`, so the screen can't inherit future theme changes.
- **Non-standard header.** A custom 3-column `headerRow` with `paddingTop: 70` and its own
  `headerTitle`/`headerSubtitle` sizes — it doesn't match the tokenized `header` + `BackButton`
  pattern the reference screens use, and the `paddingTop: 70` ignores the safe-area inset that
  `SafeAreaView` handles elsewhere.
- **Blocking `Alert.alert` validation.** All errors (invalid amount, missing category, bad due day,
  save failure) fire native modal alerts. That's the opposite of the app's inline glass-card
  error/empty/loading language. There is no skeleton, no inline error, no disabled-until-valid CTA.
- **No state coverage.** No loading skeleton (the category picker / user session load), no inline
  error surface, no empty/disabled treatment on the save button.

This redesign keeps the screen **recognizably the same form** — type toggle, name, amount, category,
frequency, conditional due-day, one Save button — but re-skins it entirely onto the design system and
adds the missing states, and it fixes the information architecture so the two most important decisions
(is this money in or out? how much?) lead the form.

---

## 2. Information architecture — what changed and why

Reading order, top to bottom, mirrors the user's mental model when logging money:

1. **Header** — standard tokenized header with `BackButton`, screen title, one-line subtitle.
2. **Type segmented control** (Expense | Income) — this is the *frame* for everything below it; it
   recolors the amount and swaps category set, so it stays first (as today).
3. **Amount — promoted to a hero field.** Currently amount is the 2nd text input in a stack. Amount is
   the single most important value in the form, so it becomes a large, centered numeric hero inside
   the top glass card, semantically tinted (`colors.error` for expense, `colors.success` for income).
   This is the calendar/dashboard "one number reads at a glance" pattern applied to input.
4. **Details card** — Name, Category (tap row → `CategoryPicker`), Frequency chips, and the conditional
   **Due day** field (only when `type === expense && frequency === monthly`, unchanged logic).
5. **Sticky Save CTA** — primary gradient button pinned to the bottom (keyboard-aware), disabled and
   dimmed until the form is valid, with an inline loading label. Replaces the inline-scrolled button.

Everything the current screen does is preserved. The only structural moves are: amount promoted to a
hero, validation moved from blocking alerts to inline color-independent hints, and the CTA pinned.

### Layout structure

```
GradientBackground (bgDarkPurple)
└─ SafeAreaView
   ├─ Header row        [BackButton] [ New Transaction / subtitle ] [40pt spacer]
   ├─ ScrollView (keyboard-aware, flexes above sticky footer)
   │   ├─ Type segmented control (Expense | Income)
   │   ├─ Amount hero card (glassFloating)   ← big semantic number + inline error slot
   │   ├─ Details card (glass)
   │   │    ├─ Name field
   │   │    ├─ Category row  → CategoryPicker
   │   │    ├─ Frequency chip row
   │   │    └─ Due-day field (conditional)
   │   └─ (inline error card, if save failed)
   └─ Sticky footer:  Save CTA  (disabled | default | loading)
```

---

## 3. Wireframes (key states)

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        New Transaction                          (40)   │  header: BackButton + title + spacer
│            Log it to keep budgets fresh                    │  subtitle (textMuted)
│                                                            │
│  ┌──────────────────────┬──────────────────────┐          │  segmented control (1 tappable row)
│  │  💳  Expense   ●      │   ↗  Income          │          │  active = expense → error-tinted
│  └──────────────────────┴──────────────────────┘          │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Amount hero — glassFloating
│  │                    AMOUNT                            │   │  label (caption, muted)
│  │                                                      │   │
│  │                  −  $ 84.20                          │   │  h1, colors.error (expense)
│  │                                                      │   │  cursor after last digit
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Details card — glass
│  │  Name                                               │   │  label (smallBold)
│  │  [ 🅣  Coffee                                    ]   │   │  input row (glass inset)
│  │                                                      │   │
│  │  Category                                           │   │
│  │  [ 🏷  Groceries                            ›  ]     │   │  tap → CategoryPicker
│  │                                                      │   │
│  │  Frequency                                          │   │
│  │  ( one-time )( weekly )( biweekly )( monthly )      │   │  chip row, selected = primary tint
│  │                                                      │   │
│  │  Due day                          (monthly+expense) │   │  conditional field
│  │  [ 📅  17                                       ]   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
├────────────────────────────────────────────────────────── ┤
│  ┌────────────────────────────────────────────────────┐   │  sticky footer
│  │                Save  →                               │   │  primaryGradient CTA
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Income variant: segmented control right side active (`↗ Income`, `colors.success` tint), the amount
hero shows `+ $5,200.00` in `colors.success`, and Due-day is never shown (income has no due day).

### 3.2 Loading (initial — user session + category context resolving)

Use `components/Skeleton.tsx`. The header renders normally; the form body is skeletoned so layout does
not jump when the real fields mount. This is the brief window while `getCurrentUser()` resolves the
`userId` the `CategoryPicker` needs.

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        New Transaction                          (40)   │
│            Log it to keep budgets fresh                    │
│                                                            │
│  �some ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (skeleton bar) │  segmented control placeholder (h=44)
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  amount hero skeleton
│  │      ▓▓▓▓▓▓  (label)                                 │   │
│  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (big number bar, h=40)      │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │  details skeleton
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (field, h=48)  │   │
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (field, h=48)  │   │
│  │  ▓▓▓▓  ( )( )( )( )  (chip row)                     │   │
│  └────────────────────────────────────────────────────┘   │
│  [ ▓▓▓▓▓▓▓▓▓▓▓▓  disabled CTA skeleton ]                   │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Empty state (no category available for this type)

Not a whole-screen empty — the form is never empty of its own fields. The *only* emptiable region is
the Category picker: if the household has **no categories** for the selected type yet, the Category row
becomes an inline empty affordance rather than opening a picker with nothing in it.

```
│  Category                                                  │
│  ┌────────────────────────────────────────────────────┐   │  glass, dashed border = "nothing yet"
│  ╎ 🏷  No expense categories yet         + Create      ╎   │  outline icon + word + action
│  └────────────────────────────────────────────────────┘   │
```

Tapping "+ Create" routes to category creation (existing CategoryPicker create path) rather than a
dead picker. Text ("No … categories yet") makes the empty state color-independent.

### 3.4 Error state (save failed)

Replaces the blocking `Alert.alert('Error', …)`. An inline glass error card appears directly above the
sticky Save CTA; the CTA returns to its default enabled state so the user can retry. Validation errors
(invalid amount, missing category, bad due day) surface as **inline field hints**, not this card.

```
│  ┌────────────────────────────────────────────────────┐   │  inline error card — glass
│  │  ⚠  Couldn't save transaction                       │   │  alert-circle-outline (error) + word
│  │     Check your connection and try again.            │   │  small, textMuted
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────── ┤
│  [ Save  →  ]   ← re-enabled                               │
```

Field-level validation (color-independent):

```
│  Amount                                                    │
│  [ $ abc ]                                                 │
│  ⚠ Enter a valid number            ← caption, colors.error + icon
```

### 3.5 Disabled CTA (form invalid)

Save is disabled until: `amount` is a valid number **and** a category is selected **and**
(if monthly expense) `dueDay` is 1–31. Disabled = `opacity 0.5`, no gradient press feedback,
`accessibilityState={{ disabled: true }}`. This surfaces the same rules the old blocking alerts
enforced, but proactively.

### 3.6 Overflow / edge cases

```
Long name:        [ 🅣  Whole Foods Market — Downtown Fla… ]   numberOfLines=1, ellipsis
Long category:    [ 🏷  Dining & Restaurants                ›]   name truncates, chevron pinned (flexShrink 0)
Large amount:     −  $1,250,000.00                             hero auto-shrinks font one step at >10 chars
Many freq chips:  wraps to 2 rows (flexWrap), gap = spacing.sm
```

---

## 4. Token mapping (no magic numbers)

Every current hardcoded value → its `design-system.ts` token.

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0b1021','#1b0d30','#2d0c53']` (screen bg) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| Save button `LinearGradient ['#a855f7','#7c3aed']` | `gradients.primaryGradient` |
| Expense accent `'#f87171'` (toggle icon/text, amount) | `colors.error` |
| Income accent `'#34d399'` (toggle icon/text, amount) | `colors.success` |
| Selected chip `'rgba(168,85,247,0.18)'` fill / `'rgba(168,85,247,0.7)'` border | `colors.primary2` @ ~18% fill / @ ~70% border |
| Toggle inactive `'#94a3b8'` / placeholder `'#94a3b8'` | `colors.textMuted` |
| Input icon `'#cbd5e1'` | `colors.textMuted` (or `colors.text` for filled) |
| Label `'#e5e7eb'` | `colors.text` |
| Chevron `'#64748b'` | `colors.textDark` |
| Primary text `'#f8fafc'` | `colors.text` |
| Subtitle `'#cbd5e1'` | `colors.textMuted` |
| Card `bg 'rgba(255,255,255,0.05)'` + `border 'rgba(255,255,255,0.06)'` | `glassEffects.glass` / `commonStyles.card` |
| Amount hero card | `glassEffects.glassFloating` (it earns elevation) |
| Input inset `bg 'rgba(255,255,255,0.06)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassMedium` + `colors.borderGlass` |
| Toggle inactive `bg 'rgba(255,255,255,0.04)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassLight` + `colors.borderGlass` |
| Toggle active expense `'rgba(248,113,113,0.1)'`/`0.3` border | `colors.error` @ 10% / @ 30% |
| Toggle active income `'rgba(52,211,153,0.1)'`/`0.3` border | `colors.success` @ 10% / @ 30% |
| Chip `bg 'rgba(255,255,255,0.06)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassMedium` + `colors.borderGlass` |
| `borderRadius: 16` (card) | `radius.lg` |
| `borderRadius: 14` (button, chip) | `radius.lg` (button) / `radius.md` (chip) |
| `borderRadius: 12` (inputs, toggle) | `radius.md` |
| `padding: 20` (container) | `spacing.lg` horizontal via `commonStyles.scrollContent` |
| `paddingTop: 70` | `SafeAreaView` inset + `spacing.sm` (drop the magic 70) |
| `padding: 16` (card) | `spacing.lg` |
| `marginBottom: 18 / 14` | `spacing.lg` / `spacing.md` |
| `paddingVertical: 16` (button) | `spacing.lg` |
| `paddingVertical: 12 / 10` (inputs) | `spacing.md` / `spacing.sm` |
| `gap: 8` (rows/chips) | `spacing.sm` |
| header `fontSize:22, weight:800` | `typography.h3` (weight 800 override ok, matches calendar title) |
| subtitle `fontSize:13` | `typography.small`, `colors.textMuted` |
| label `fontSize:14, weight:700` | `typography.smallBold` |
| button text `fontSize:16, weight:800` | `typography.button` |
| amount hero (new) | `typography.h1`, semantic color |
| Native `Alert.alert(...)` for validation | inline field hints (`typography.caption`, `colors.error` + icon) |
| Native `Alert.alert('Error', …)` on save fail | inline error glass card (see §3.4) |
| Native `Alert.alert('Success', …)` | keep `successHaptic()`; replace modal with `router.back()` (calendar/dashboard don't confirm-modal on write) |

---

## 5. Component specs

Reuse shared components: `GradientBackground`, `BackButton`, `Skeleton`, `CategoryPicker`
(existing, unchanged). New sub-components are `add-transaction-` prefixed JSONs under
`docs/design/components/`.

### 5.1 Header (standard, tokenized)

- Layout: `flexDirection row`, `alignItems: flex-start`, `paddingHorizontal spacing.lg`,
  `paddingTop spacing.sm`, `paddingBottom spacing.md` (matches dashboard `header`).
- Left: `<BackButton fallback="/(tabs)/budget" />` (preserve current fallback).
- Center: title `New Transaction` (`typography.h3`, weight 800, `colors.text`) + subtitle
  `Log it to keep budgets fresh` (`typography.small`, `colors.textMuted`).
- Right: 40pt spacer `View` to balance the back button (keeps title visually centered, matches
  current intent).
- Touch target: BackButton is already 40×40 with `hitSlop` 12 → ≥44pt effective.

### 5.2 TypeSegmentedControl → `add-transaction-type-segmented-control.json`

- Two equal segments in one glass track. Props: `value: 'expense'|'income'`, `onChange`.
- Track: `glassEffects.glass`, `radius.md`, `padding spacing.xs`; segments flex 1.
- Active expense: fill `colors.error`@10%, border `colors.error`@30%, icon `card-outline` +
  label in `colors.error`, weight 700.
- Active income: fill `colors.success`@10%, border `colors.success`@30%, icon `trending-up` +
  label in `colors.success`, weight 700.
- Inactive: `colors.textMuted` icon + label, weight 400.
- States: `default | expenseActive | incomeActive | pressed`.
- On change: resets `selectedCategory` to null (preserve existing effect) and recolors the amount hero.
- Height ≥ 44pt. `accessibilityRole="tablist"`; each segment `role="tab"`,
  `accessibilityState={{ selected }}`.

### 5.3 AmountHero → `add-transaction-amount-hero.json`

- `glassEffects.glassFloating`, `padding spacing.xl`, `alignItems center`.
- Label `AMOUNT` (`typography.caption`, `colors.textMuted`, letterSpacing, centered).
- Value: hidden `TextInput` (numeric) driving a large display in `typography.h1`; sign prefix
  `−`/`+` and `$` glyph in the semantic color. Color = `colors.error` (expense) / `colors.success`
  (income). Empty placeholder `$0.00` in `colors.textMuted`.
- Font auto-shrinks one step (`adjustsFontSizeToFit`, `minimumFontScale ~0.6`) past ~10 chars.
- Inline validation hint slot below (see §3.4): `⚠ Enter a valid number`, `typography.caption`,
  `colors.error`, with `alert-circle-outline` icon.
- States: `empty | filled | invalid`.
- The whole card is tappable to focus the input (large touch target).

### 5.4 FormField (Name, Due day) → `add-transaction-form-field.json`

- Replaces `LabeledInput`. Label `typography.smallBold` `colors.text`; input row is a glass inset:
  `colors.glassMedium` bg, `colors.borderGlass` border, `radius.md`, `paddingHorizontal spacing.md`,
  min height 48.
- Leading Ionicon (`text-outline`, `calendar-outline`) in `colors.textMuted`; `TextInput` `colors.text`,
  placeholder `colors.textMuted`.
- Props: `label, icon, placeholder, value, onChangeText, keyboardType?, error?`.
- States: `default | focused (border colors.primary2) | filled | error (border colors.error + hint)`.
- Due-day field renders **only** when `type === 'expense' && frequency === 'monthly'` (unchanged).

### 5.5 CategoryRow → `add-transaction-category-row.json`

- Tap row that opens `CategoryPicker` (existing). Same glass inset as FormField.
- Leading `pricetag-outline` (`colors.textMuted`), value text (selected name in `colors.text`,
  else placeholder `Tap to select category` in `colors.textMuted`, `numberOfLines=1`), trailing
  `chevron-forward` (`colors.textDark`, `flexShrink 0`).
- States: `empty (no selection) | selected | noCategories (dashed border + "+ Create", see §3.3) |
  pressed`.
- `accessibilityRole="button"`, label `"Category, {selected|none}, opens category picker"`,
  min height 48 → ≥44pt.

### 5.6 FrequencyChips → `add-transaction-frequency-chips.json`

- Row of chips for `['one-time','weekly','biweekly','monthly']`, `flexWrap`, gap `spacing.sm`.
- Chip: `colors.glassMedium` bg, `colors.borderGlass` border, `radius.md`,
  `paddingVertical spacing.sm`, `paddingHorizontal spacing.md`, label `typography.small`
  `colors.text`, `textTransform capitalize`.
- Selected: fill `colors.primary2`@18%, border `colors.primary2`@70%, label `colors.text` weight 700.
- States: `default | selected | pressed`. Each chip ≥44pt tall (pad to reach it).
- `accessibilityRole="radio"` within a `radiogroup`; `accessibilityState={{ checked }}`.

### 5.7 SaveCTA (sticky footer) → `add-transaction-save-cta.json`

- Pinned footer (`position` above keyboard via `KeyboardAvoidingView`), `paddingHorizontal spacing.lg`,
  `paddingBottom` = safe-area inset + `spacing.md`, subtle top hairline `colors.borderLight`.
- Button: `gradients.primaryGradient`, `radius.lg`, `paddingVertical spacing.lg`, centered
  `Save` (`typography.button`, white) + `arrow-forward` icon.
- States:
  - `disabled` — form invalid: `opacity 0.5`, no press feedback, `accessibilityState disabled`.
  - `default` — valid: `activeOpacity 0.85`.
  - `loading` — mid-save: label `Saving…`, small `ActivityIndicator` (`#fff`) replaces the arrow,
    button non-interactive; keep `successHaptic()`/`errorHaptic()` on resolve.
- Height ≥44pt (it's ~52 with padding).

### 5.8 InlineErrorCard (save failure) → reuse pattern from calendar §7 error

- `glassEffects.glass`, `colors.error`@ low-alpha left accent optional, `alert-circle-outline`
  (`colors.error`) + `Couldn't save transaction` (`typography.smallBold`, `colors.text`) +
  subcopy (`typography.small`, `colors.textMuted`). Appears above the sticky CTA; dismiss on next
  successful save. Not a separate JSON — mirror calendar's inline error card spec.

---

## 6. Interactions

- **Type switch:** `animation.fast` (150ms) cross-fade of the active segment tint + amount hero color;
  resets category. Under reduced motion, instant.
- **Amount focus:** tapping the hero card focuses the numeric input; keyboard pushes the sticky CTA up
  (`KeyboardAvoidingView`, `behavior: padding` on iOS).
- **Category tap:** opens `CategoryPicker` bottom sheet (existing). On select, row fills; picker closes.
- **Frequency select:** chip toggles; selecting `monthly` while `type === expense` reveals the Due-day
  field with a quick height/opacity fade (`animation.medium`), collapses otherwise.
- **Save:** validates inline (no blocking alert); on success → `successHaptic()` + `router.back()`;
  on failure → `errorHaptic()` + inline error card, CTA re-enabled.
- **Press feedback:** all tappables `activeOpacity ~0.7–0.85`; chips/segments get a subtle
  background-tint change on press.

---

## 7. Accessibility

- **Touch targets:** BackButton (40 + hitSlop 12), segments, chips, category row, and CTA are all
  ≥44×44pt. Chips are padded to reach 44 tall even though text is small.
- **Color-independent status:**
  - Expense vs income is conveyed by **icon (card vs trending-up) + the words "Expense"/"Income" +
    the sign prefix (−/+)**, not color alone.
  - Validation errors always pair `alert-circle-outline` + a **word** ("Enter a valid number",
    "Select a category", "Day must be 1–31") with the red — never red alone.
  - Selected frequency/type conveyed via `accessibilityState` (checked/selected) + weight change, not
    only the purple tint.
- **Screen-reader order:** title → subtitle → type control ("Expense selected / Income") → amount
  ("Amount, $84.20, expense") → Name → Category → Frequency (radiogroup) → Due day (if present) →
  Save button (announces disabled reason when invalid, e.g. "Save, dimmed, enter an amount and pick a
  category").
- **Labels:** amount input `accessibilityLabel="Transaction amount"`; category row
  `"Category, {name or none}, opens picker"`; CTA `"Save transaction"`.
- **Contrast:** all text on dark glass uses `colors.text` / `colors.textMuted`; verify placeholder
  `colors.textMuted` (#94a3b8) on `colors.glassMedium` clears 4.5:1 (it does over the dark gradient).
- **Reduced motion:** type cross-fade, due-day reveal, and any press scale collapse to instant state
  changes under `AccessibilityInfo.isReduceMotionEnabled`.

---

## 8. Developer notes

- Swap the root `LinearGradient` for `<GradientBackground variant="bgDarkPurple">` + `SafeAreaView`;
  delete `paddingTop: 70`.
- Wrap the scroll body in `KeyboardAvoidingView` so the sticky CTA + amount hero stay visible while
  the numeric keyboard is up.
- Drive the disabled/valid state from a single derived `isValid` memo (amount is a finite number &&
  category selected && (not monthly-expense || dueDay 1–31)); it replaces all four `Alert.alert`
  validation branches. Keep the branches' *logic*, only change the *surface* (inline vs modal).
- Loading skeleton is only the brief `getCurrentUser()` window; gate it on a `bootLoading` flag so it
  doesn't flash on fast sessions (show skeleton only if load exceeds ~1 frame, or accept a quick flash
  — reuse `Skeleton` sizes matching the field heights so layout is stable).
- `CategoryPicker` stays exactly as-is (it already receives `userId`, `type`, `visible`, callbacks).
  The `noCategories` empty state is a display concern on the Category **row**, not the picker.
- Preserve `successHaptic()` / `errorHaptic()`, `uuidv4()` id, and the exact POST payload
  (`/auth/transactions`) — this is a re-skin + IA change, not a behavior change.

---

## 9. Handoff checklist

- [x] All states designed (default/populated, loading skeleton, empty-category, error, disabled, overflow)
- [x] Off-theme gradient replaced with `<GradientBackground variant="bgDarkPurple">`
- [x] Every hardcoded color/gradient/radius/spacing/font mapped to a design-system token
- [x] Blocking `Alert.alert` validation replaced with inline, color-independent hints
- [x] Amount promoted to a semantic hero (income green / expense red, sign prefix)
- [x] Sticky, keyboard-aware, disabled-until-valid Save CTA
- [x] Accessibility: 44pt targets, icon+word+color status, SR order, reduced motion
- [x] Shared components reused (GradientBackground, BackButton, Skeleton, CategoryPicker)
- [x] Component specs written (`docs/design/components/add-transaction-*.json`)
- [x] Functionality preserved (same fields, payload, haptics, navigation)
