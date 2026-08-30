# Add Budget Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `budget/add-budget` → `budget-app/app/budget/add-budget.tsx`
**Archetype:** Form (single-column, one primary action)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Reference screens (the look to match):** `app/(tabs)/dashboard.tsx`, `app/(tabs)/calendar.tsx`
**Sibling form (the archetype to match exactly):** `add-transaction` (see `docs/design/specs/add-transaction-redesign.md`)
**Replaces:** ad-hoc styling in `budget-app/app/budget/add-budget.tsx`

---

## 1. Why this redesign exists

This screen is the single most off-theme screen in the app: it is a **plain white iOS form**
dropped into a dark, glassmorphic product. It shares almost nothing with the design system, and
it is the *sibling* of `add-transaction` (same fields: type, name, amount, category, frequency) yet
looks like it came from a different codebase. Concretely:

- **White background.** `safeArea` is `backgroundColor: 'white'` and every text color is a
  default black/gray (`'#333'`, `'#555'`, `'#999'`, `'#ccc'`). It is *literally* light-mode inside a
  dark app — the most jarring possible break from `<GradientBackground variant="bgDarkPurple">`.
- **No standard header.** The screen is just a centered bold `title` ("Add Budget") — no
  `BackButton`, no subtitle, no tokenized header row. The only way back is the Cancel button at the
  very bottom of the form (below the fold on small devices).
- **Two competing dropdown systems.** `Type` and `Frequency` use `react-native-dropdown-picker`
  (`listMode="MODAL"`, gray borders), while `Category` uses a custom tap-row into `CategoryPicker`,
  and the date uses a raw `DateTimePicker` spinner that is **always rendered inline** on iOS (a 150pt
  spinner permanently occupying the middle of the form). Three different interaction languages for
  four choices.
- **Hardcoded everything.** Green save button `'#4CAF50'`, gray cancel `'gray'`, borders `'#ccc'`,
  radii `8`, paddings `20/16/12`, font sizes `22/18/16` — none from `design-system.ts`.
- **Blocking `Alert.alert` validation.** Missing-field and save-failure both fire native modal
  alerts, the opposite of the app's inline glass error language. There is no skeleton, no inline
  error, no disabled-until-valid CTA.
- **No state coverage.** No loading skeleton (categories/budgets load), no inline error, no empty
  affordance, no disabled treatment. (There is also a large block of **commented-out dead code** —
  the "Income Budgets / Expense Budgets" `FlatList`s and `renderBudgetItem` — which the redesign
  formally drops; see §8.)

This redesign keeps the screen **recognizably the same form** — type, name, amount, category,
frequency, start date, one Save — but re-skins it entirely onto the design system, adopts the
**exact same component vocabulary as `add-transaction`** (so the two sibling forms finally match),
adds the missing states, and fixes the information architecture so the two decisions that define a
budget (is this an income or expense budget? how much?) lead the form.

---

## 2. Information architecture — what changed and why

Reading order, top to bottom, mirrors the user's mental model when creating a budget line.
This is intentionally **identical in shape** to the `add-transaction` form so the two siblings read
the same — with the budget-specific differences called out.

1. **Header** — standard tokenized header with `BackButton`, title "New Budget", one-line subtitle.
   Replaces the bare centered title (and absorbs the bottom "Cancel" — back is now top-left where the
   app expects it).
2. **Type segmented control** (Expense | Income) — this is the *frame* for everything below; it
   recolors the amount hero and **swaps the category set** (the existing `useEffect` re-fetches
   categories per `type`). Stays first. Reuses `add-transaction-type-segmented-control` unchanged.
3. **Amount — promoted to a hero field.** Currently amount is the 2nd of two identical text inputs.
   Amount is *the* value in a budget, so it becomes a large, centered numeric hero inside the top
   glass card, semantically tinted (`colors.error` for expense budgets, `colors.success` for income
   budgets). Same `AmountHero` component the transaction form uses.
4. **Details card** — Name, Category (tap row → `CategoryPicker`), Frequency chips, and the
   **Start date** field. All existing fields, re-skinned; the always-open date spinner becomes a
   tappable field that reveals a picker on demand.
5. **Sticky Save CTA** — primary gradient button pinned to the bottom (keyboard-aware), disabled and
   dimmed until the form is valid, with an inline loading label. Replaces the inline Save button, and
   the separate "Cancel" button is removed (the header BackButton is the cancel affordance).

**Everything the current screen does is preserved.** Structural moves only: amount promoted to a
hero, the ever-present date spinner replaced by a reveal-on-tap field, validation moved from blocking
alerts to inline color-independent hints + a disabled CTA, back moved to a standard header, dead
commented budget-list code dropped.

### Budget-specific differences from the transaction form (call-outs)

| Aspect | `add-transaction` | `add-budget` (this screen) |
|---|---|---|
| Type options | Expense / Income | Expense / Income — **same** |
| Frequency options | one-time, weekly, biweekly, monthly | one-time, weekly, biweekly, monthly, **1st & 15th** (extra chip) |
| Date field | conditional **Due day** (monthly expense only) | always-present **Start date** (a real date, not a day-of-month) |
| Amount meaning | the transaction amount | the **budgeted amount per occurrence** |
| Category swap on type change | resets selected category | resets category **and re-fetches** the category list per type |

The one net-new sub-component is `add-budget-start-date-field`; everything else is a **reuse** of the
`add-transaction-*` components (see §5).

### Layout structure

```
GradientBackground (bgDarkPurple)
└─ SafeAreaView
   ├─ Header row        [BackButton] [ New Budget / subtitle ] [40pt spacer]
   ├─ KeyboardAvoidingView
   │   └─ ScrollView (flexes above sticky footer)
   │       ├─ Type segmented control (Expense | Income)
   │       ├─ Amount hero card (glassFloating)   ← big semantic number + inline error slot
   │       ├─ Details card (glass)
   │       │    ├─ Name field
   │       │    ├─ Category row  → CategoryPicker
   │       │    ├─ Frequency chip row  (incl. "1st & 15th")
   │       │    └─ Start-date field  → reveals DateTimePicker
   │       └─ (inline error card, if save failed)
   └─ Sticky footer:  Save CTA  (disabled | default | loading)
```

---

## 3. Wireframes (key states)

### 3.1 Default / populated (Expense budget)

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        New Budget                                (40)   │  header: BackButton + title + spacer
│            Set a limit to keep spending on track           │  subtitle (textMuted)
│                                                            │
│  ┌──────────────────────┬──────────────────────┐          │  segmented control (1 tappable row)
│  │  💳  Expense   ●      │   ↗  Income          │          │  active = expense → error-tinted
│  └──────────────────────┴──────────────────────┘          │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Amount hero — glassFloating
│  │                    BUDGET AMOUNT                     │   │  label (caption, muted)
│  │                                                      │   │
│  │                  −  $ 600.00                         │   │  h1, colors.error (expense)
│  │                  per month                           │   │  freq echo (caption, muted)
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Details card — glass
│  │  Name                                               │   │  label (smallBold)
│  │  [ 🅣  Groceries                                 ]   │   │  input row (glass inset)
│  │                                                      │   │
│  │  Category                                           │   │
│  │  [ 🏷  Food › Groceries                       ›  ]   │   │  tap → CategoryPicker
│  │                                                      │   │
│  │  Frequency                                          │   │
│  │  (one-time)(weekly)(biweekly)( monthly )(1st & 15th)│   │  chip row, selected = primary tint
│  │                                                      │   │
│  │  Start date                                         │   │
│  │  [ 📅  July 5, 2026                          ›  ]   │   │  tap → reveals picker
│  └────────────────────────────────────────────────────┘   │
│                                                            │
├────────────────────────────────────────────────────────── ┤
│  ┌────────────────────────────────────────────────────┐   │  sticky footer
│  │                Save Budget  →                        │   │  primaryGradient CTA
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Income variant:** segmented control right side active (`↗ Income`, `colors.success` tint), amount
hero shows `+ $5,200.00` in `colors.success` with `per month` echo, and the category list re-fetches
to income categories. Structure is otherwise identical (income budgets *do* have a start date and
frequency, unlike the transaction form's income which hid the due-day).

### 3.2 Start-date field expanded (picker revealed)

The always-on 150pt spinner is gone. The field is a normal tap row; tapping it reveals the picker
inline (iOS) or as the native calendar dialog (Android). Reveal fades in over `animation.medium`.

```
│  Start date                                                │
│  [ 📅  July 5, 2026                          ⌃  ]         │  chevron flips up while open
│  ┌────────────────────────────────────────────────────┐   │  revealed picker — glass inset
│  │            ‹  July   5   2026  ›   (spinner)         │   │  iOS spinner, height ~150
│  └────────────────────────────────────────────────────┘   │
```

- iOS: `DateTimePicker display="spinner"` mounted **only while open**, inside a glass inset
  (`colors.glassLight`, `radius.md`), so it reads as part of the form rather than floating chrome.
- Android: tapping opens the native `display="calendar"` dialog (unchanged behavior); the field label
  updates on dismiss. No inline spinner on Android.
- Selecting a date collapses the inline picker (iOS) on next tap of the field or on scroll.

### 3.3 Loading (initial — user session + categories + existing budgets resolving)

Use `components/Skeleton.tsx`. The header renders normally; the form body is skeletoned so layout does
not jump when the real fields mount. This covers the window while `getCurrentUser()` resolves `userId`
(the `CategoryPicker` needs it) and the two `useEffect`s fetch categories + current-month budgets.

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        New Budget                                (40)   │
│            Set a limit to keep spending on track           │
│                                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (h=44)           │  segmented control placeholder
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  amount hero skeleton
│  │      ▓▓▓▓▓▓▓  (label)                                │   │
│  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (big number bar, h=40)      │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │  details skeleton
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (field, h=48)  │   │
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (field, h=48)  │   │
│  │  ▓▓▓▓  ( )( )( )( )( )  (chip row)                  │   │
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (field, h=48)  │   │
│  └────────────────────────────────────────────────────┘   │
│  [ ▓▓▓▓▓▓▓▓▓▓▓▓  disabled CTA skeleton ]                   │
└──────────────────────────────────────────────────────────┘
```

Gate the skeleton on a `bootLoading` flag so it doesn't flash on fast sessions (only show if the load
exceeds ~1 frame, or accept a very brief flash). The form is prefilled/interactive the instant data
lands.

> Note on prefill: the screen accepts `prefill_category_id` / `prefill_name` params (from the
> dashboard "Create Budget" / proactive-card flows). When present, Name and Category mount already
> filled — skip the skeleton for those two fields and render them populated.

### 3.4 Empty state (no category available for this type)

Not a whole-screen empty — the form always has its own fields. The only emptiable region is the
Category picker: if the household has **no categories** for the selected type yet, the Category row
becomes an inline empty affordance rather than opening a picker with nothing in it. Identical to the
transaction form (`add-transaction-category-row` `noCategories` state).

```
│  Category                                                  │
│  ┌────────────────────────────────────────────────────┐   │  glass, dashed border = "nothing yet"
│  ╎ 🏷  No expense categories yet         + Create      ╎   │  outline icon + word + action
│  └────────────────────────────────────────────────────┘   │
```

Tapping "+ Create" routes to category creation (existing `CategoryPicker` create path) rather than a
dead picker. The word "No … categories yet" keeps the empty state color-independent.

### 3.5 Error state (save failed)

Replaces the blocking `Alert.alert('Error', 'Failed to save budget.')`. An inline glass error card
appears directly above the sticky Save CTA; the CTA returns to its default enabled state so the user
can retry. Validation errors (missing name, invalid amount, no category) surface as **inline field
hints / a disabled CTA**, not this card.

```
│  ┌────────────────────────────────────────────────────┐   │  inline error card — glass
│  │  ⚠  Couldn't save budget                            │   │  alert-circle-outline (error) + word
│  │     Check your connection and try again.            │   │  small, textMuted
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────── ┤
│  [ Save Budget  →  ]   ← re-enabled                        │
```

Field-level validation (color-independent), replacing the single
`Alert.alert('Missing Fields', 'Please fill in all fields.')`:

```
│  Amount                                                    │
│  ⚠ Enter a budget amount            ← caption, colors.error + icon   (empty/NaN)
│  Name                                                      │
│  ⚠ Name your budget                 ← caption, colors.error + icon   (empty)
│  Category                                                  │
│  ⚠ Pick a category                  ← caption, colors.error + icon   (none)
```

Prefer the **disabled CTA** as the primary guard; show a field hint only after a user has touched that
field and left it invalid (don't shout on first render).

### 3.6 Disabled CTA (form invalid)

Save is disabled until: `name` is non-empty **and** `amount` is a valid number > 0 **and** a category
is selected **and** `frequency` and `type` are set (they default, so effectively always true) **and** a
start `date` exists (defaults to today). Disabled = `opacity 0.5`, no gradient press feedback,
`accessibilityState={{ disabled: true }}`. This surfaces the same rules the old blocking
"fill in all fields" alert enforced — proactively, per the sibling form.

### 3.7 Overflow / edge cases

```
Long name:        [ 🅣  Groceries, Household & Toiletries… ]   numberOfLines=1, ellipsis
Long category:    [ 🏷  Food & Dining › Restaurants          ›]  name truncates, chevron pinned (flexShrink 0)
Large amount:     −  $12,500.00                               hero auto-shrinks font one step at >10 chars
Many freq chips:  5 chips wrap to 2 rows (flexWrap), gap = spacing.sm  ("1st & 15th" is the widest)
Long date label:  "September 15, 2026" fits; field text numberOfLines=1
```

---

## 4. Token mapping (no magic numbers)

Every current hardcoded value → its `design-system.ts` token. (Shared rows mirror the
`add-transaction` mapping so the two forms stay identical.)

| Old hardcoded value | Replace with token |
|---|---|
| `safeArea backgroundColor: 'white'` (whole screen) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| Save button `backgroundColor: '#4CAF50'` | `gradients.primaryGradient` (matches sibling CTA) |
| `renderBudgetItem` icon circle `'#4CAF50'` | n/a — dead code, dropped (see §8) |
| Cancel button text `'gray'` | removed — Cancel is now the header `BackButton` |
| Input/dropdown/selector border `'#ccc'` | `colors.borderGlass` |
| `title` `#000` (default) | `colors.text` |
| Input text / date / category `'#333'` | `colors.text` |
| Category placeholder / chevron `'#999'` | placeholder `colors.textMuted`, chevron `colors.textDark` |
| `transactionCategory '#555'` / `transactionDate '#999'` | n/a — dead code, dropped |
| `label` `#000` bold | `typography.smallBold`, `colors.text` |
| `input` `bg white` + `border '#ccc'` inset | `colors.glassMedium` bg + `colors.borderGlass` border |
| `dateSelector` bordered box | `add-budget-start-date-field` glass inset (`colors.glassMedium`) |
| `dropdown` / `dropdownContainer` `'#ccc'` (Type, Frequency) | replaced by `TypeSegmentedControl` + `FrequencyChips` (drop `react-native-dropdown-picker`) |
| `categorySelector` bordered row | `add-transaction-category-row` glass inset |
| Amount hero card (new) | `glassEffects.glassFloating` (it earns elevation) |
| Details card (new grouping) | `glassEffects.glass` / `commonStyles.card` |
| `borderRadius: 8` (inputs, buttons, selectors) | `radius.md` (fields) / `radius.lg` (CTA) |
| `container padding: 20` | `spacing.lg` horizontal via `commonStyles.scrollContent` |
| `title marginBottom: 20` | standard header `paddingBottom: spacing.md` |
| `input/selector marginBottom: 16` | field `gap: spacing.md` |
| `input/date/selector padding: 12` | `spacing.md` |
| `saveButton padding: 16` | `paddingVertical: spacing.lg` |
| `label marginBottom: 4` | `spacing.sm` |
| `sectionTitle fontSize:18, weight:bold` | n/a — dead code, dropped |
| `title fontSize:22, weight:bold` | `typography.h3` (weight 800 override ok, matches sibling title) |
| `input/saveButtonText fontSize:16` | `typography.body` (input) / `typography.button` (CTA) |
| amount hero (new) | `typography.h1`, semantic color (`colors.error` / `colors.success`) |
| Native `Alert.alert('Missing Fields', …)` | disabled CTA + inline field hints (`typography.caption`, `colors.error` + icon) |
| Native `Alert.alert('Error', 'Failed to save budget.')` | inline error glass card (see §3.5) |
| `successHaptic()` on save | **keep**; replace no modal (already just `router.back()`) |
| always-mounted iOS `DateTimePicker` (150pt) | reveal-on-tap inside `add-budget-start-date-field` |

---

## 5. Component specs

**Reuse (unchanged):** `GradientBackground`, `BackButton`, `Skeleton`, `CategoryPicker`,
`add-transaction-type-segmented-control`, `add-transaction-amount-hero`,
`add-transaction-form-field`, `add-transaction-category-row`, `add-transaction-save-cta`.
The transaction form already produced these; this form consumes them so the siblings match exactly.

**New (`add-budget-` prefixed JSONs):** `add-budget-frequency-chips` (adds the `1st-15th` option) and
`add-budget-start-date-field` (reveal-on-tap date picker). Both under `docs/design/components/`.

### 5.1 Header (standard, tokenized)

- Layout: `flexDirection row`, `alignItems: flex-start`, `paddingHorizontal spacing.lg`,
  `paddingTop spacing.sm`, `paddingBottom spacing.md` (matches dashboard `header`).
- Left: `<BackButton fallback="/(tabs)/budget" />` — this is now the **Cancel** affordance
  (`router.back()`), replacing the old bottom Cancel button.
- Center: title `New Budget` (`typography.h3`, weight 800, `colors.text`) + subtitle
  `Set a limit to keep spending on track` (`typography.small`, `colors.textMuted`).
- Right: 40pt spacer `View` to balance the back button (keeps title visually centered).

### 5.2 TypeSegmentedControl → **reuse** `add-transaction-type-segmented-control.json`

- Two equal segments in one glass track. Props: `value: 'expense'|'income'`, `onChange`.
- Active expense: fill `colors.error`@10%, border `colors.error`@30%, icon `card-outline` + label
  in `colors.error`. Active income: fill `colors.success`@10%, border `colors.success`@30%, icon
  `trending-up` + label in `colors.success`. Inactive: `colors.textMuted`, weight 400.
- **Budget-specific behavior:** on change, in addition to resetting the selected category and
  recoloring the amount hero, it **triggers the category re-fetch** (the existing `useEffect([type])`).
  Same component, one extra side-effect wired by the screen.
- `accessibilityRole="tablist"`; each segment `role="tab"`, `accessibilityState={{ selected }}`,
  ≥44pt tall.

### 5.3 AmountHero → **reuse** `add-transaction-amount-hero.json`

- `glassEffects.glassFloating`, `padding spacing.xl`, `alignItems center`.
- Label content is **`BUDGET AMOUNT`** (vs the transaction form's `AMOUNT`) — pass via the label
  slot; everything else identical.
- Value: hidden numeric `TextInput` driving a large `typography.h1` display; sign prefix `−`/`+` and
  `$` in the semantic color (`colors.error` expense / `colors.success` income); placeholder `$0.00`
  in `colors.textMuted`; `adjustsFontSizeToFit` past ~10 chars.
- **Budget-specific:** a small **frequency echo** caption under the number — `per month` /
  `per week` / `every 2 weeks` / `one-time` / `on the 1st & 15th` — in `typography.caption`
  `colors.textMuted`, so the amount reads as "rate", which is what a budget is. (Additive line inside
  the same hero card; if the reused component doesn't expose a sub-caption slot, the screen renders it
  just below the hero card. Prefer adding an optional `caption?` prop to keep it inside the card.)
- Inline validation hint slot below: `⚠ Enter a budget amount`, `typography.caption`, `colors.error`,
  `alert-circle-outline`. States: `empty | filled | invalid`. Whole card tappable to focus.

### 5.4 FormField (Name) → **reuse** `add-transaction-form-field.json`

- Label `typography.smallBold` `colors.text`; input row is a glass inset (`colors.glassMedium` bg,
  `colors.borderGlass` border, `radius.md`, `paddingHorizontal spacing.md`, min height 48).
- Leading `text-outline` in `colors.textMuted`; `TextInput` `colors.text`, placeholder
  `Budget name` in `colors.textMuted`.
- States: `default | focused (border colors.primary2) | filled | error (border colors.error + hint)`.
- **Note:** unlike the transaction form, this screen has **no** conditional due-day FormField — the
  date is handled by the dedicated start-date field (§5.7). The Name field is the only FormField here.

### 5.5 CategoryRow → **reuse** `add-transaction-category-row.json`

- Tap row that opens `CategoryPicker` (existing). Glass inset, leading `pricetag-outline`
  (`colors.textMuted`), value text (`colors.text` selected / `Tap to select category`
  `colors.textMuted` placeholder, `numberOfLines=1`), trailing `chevron-forward` (`colors.textDark`,
  `flexShrink 0`).
- **Budget-specific:** preserve the existing "auto-name" behavior — when a category is selected and
  the Name field is still empty, the picker's `onSelect` fills Name with the category's short name.
  Also preserve the `parent_name > name` composite label the current screen builds.
- States: `empty | selected | noCategories (dashed + "+ Create") | pressed`. Min height 48, ≥44pt.

### 5.6 FrequencyChips → **new** `add-budget-frequency-chips.json`

- Same visual language as `add-transaction-frequency-chips`, but with the **five** budget options:
  `['one-time', 'weekly', 'biweekly', 'monthly', '1st-15th']`. Row is `flexWrap`, gap `spacing.sm`;
  five chips wrap to two rows on a 390pt screen.
- Chip: `colors.glassMedium` bg, `colors.borderGlass` border, `radius.md`,
  `paddingVertical spacing.sm`, `paddingHorizontal spacing.md`, label `typography.small`
  `colors.text`. Selected: fill `colors.primary2`@18%, border `colors.primary2`@70%, weight 700.
- **Label formatting:** display labels are `One-time · Weekly · Biweekly · Monthly · 1st & 15th`
  (the last is friendlier than the raw `1st-15th` value). Default selected = `monthly` (unchanged).
- **Behavior:** changing frequency updates the AmountHero's frequency-echo caption (§5.3). Unlike the
  transaction form, selecting `monthly` does **not** reveal any extra field (there is no due-day here).
- Each chip ≥44pt tall. `accessibilityRole="radio"` in a `radiogroup`,
  `accessibilityState={{ checked }}`.

### 5.7 StartDateField → **new** `add-budget-start-date-field.json`

- Replaces the always-mounted 150pt `DateTimePicker` spinner. Collapsed, it looks exactly like a
  `CategoryRow`: glass inset (`colors.glassMedium`, `colors.borderGlass`, `radius.md`, min height 48),
  leading `calendar-outline` (`colors.textMuted`), the formatted date
  (`July 5, 2026`, `typography.body`, `colors.text`), trailing `chevron-forward` (`colors.textDark`)
  that **rotates to up** while the picker is open.
- **iOS:** tapping toggles an inline `DateTimePicker display="spinner"` mounted **only while open**,
  inside a glass inset directly beneath the field (`colors.glassLight`, `radius.md`, height ~150),
  revealed with `animation.medium` fade. Selecting keeps the field label in sync; collapses on next
  field tap or scroll.
- **Android:** tapping opens the native `display="calendar"` dialog (existing behavior); no inline
  spinner. Field label updates on dismiss.
- Props: `value: Date`, `onChange: (d: Date) => void`, `open: boolean`, `onToggle: () => void`.
- States: `collapsed | open (iOS) | pressed`. Default value = `new Date()` (today), matching current.
- `accessibilityRole="button"`, label `"Start date, {formatted date}, opens date picker"`,
  min height 48 → ≥44pt.

### 5.8 SaveCTA (sticky footer) → **reuse** `add-transaction-save-cta.json`

- Pinned footer above the keyboard (`KeyboardAvoidingView`), `paddingHorizontal spacing.lg`,
  `paddingBottom` = safe-area inset + `spacing.md`, top hairline `colors.borderLight`.
- Button: `gradients.primaryGradient`, `radius.lg`, `paddingVertical spacing.lg`, centered
  **`Save Budget`** (`typography.button`, white) + `arrow-forward`.
- States: `disabled` (form invalid, `opacity 0.5`) / `default` / `loading` (`Saving…` +
  `ActivityIndicator #fff`). On success: `successHaptic()` + `router.back()` (already the current
  behavior — just drop the modal). On failure: `errorHaptic()` + inline error card, CTA re-enabled.
- Height ≥44pt.

### 5.9 InlineErrorCard (save failure) → reuse pattern from calendar §7 / transaction §5.8

- `glassEffects.glass`, `alert-circle-outline` (`colors.error`) + `Couldn't save budget`
  (`typography.smallBold`, `colors.text`) + subcopy (`typography.small`, `colors.textMuted`). Appears
  above the sticky CTA; dismiss on next successful save. Not a separate JSON — mirrors the shared
  inline-error pattern.

---

## 6. Interactions

- **Type switch:** `animation.fast` (150ms) cross-fade of the active segment tint + amount hero color;
  resets category selection **and re-fetches** the category list for the new type. Instant under
  reduced motion.
- **Amount focus:** tapping the hero card focuses the numeric input; keyboard pushes the sticky CTA up
  (`KeyboardAvoidingView`, `behavior: padding` on iOS — preserve the existing
  `keyboardVerticalOffset` intent).
- **Category tap:** opens `CategoryPicker` bottom sheet (existing). On select, row fills, Name
  auto-fills if empty, picker closes.
- **Frequency select:** chip toggles; updates the amount hero's frequency echo. No conditional field
  reveal.
- **Start-date tap:** toggles the inline spinner (iOS) / opens the calendar dialog (Android); chevron
  rotates while open; reveal fades over `animation.medium`.
- **Save:** validates via the derived `isValid` (no blocking alert); on success → `successHaptic()` +
  `router.back()`; on failure → `errorHaptic()` + inline error card, CTA re-enabled.
- **Press feedback:** all tappables `activeOpacity ~0.7–0.85`; chips/segments get a subtle
  background-tint change on press.

---

## 7. Accessibility

- **Touch targets:** BackButton (40 + hitSlop 12), segments, chips, category row, start-date row, and
  CTA are all ≥44×44pt. Chips are padded to reach 44 tall even though text is small.
- **Color-independent status:**
  - Expense vs income conveyed by **icon (card vs trending-up) + the words "Expense"/"Income" + the
    sign prefix (−/+)**, not color alone.
  - Validation errors always pair `alert-circle-outline` + a **word** ("Enter a budget amount",
    "Name your budget", "Pick a category") with the red — never red alone.
  - Selected frequency/type conveyed via `accessibilityState` (checked/selected) + weight change, not
    only the purple tint.
- **Screen-reader order:** title → subtitle → type control ("Expense selected / Income") → amount
  ("Budget amount, $600, expense, per month") → Name → Category → Frequency (radiogroup) →
  Start date ("Start date, July 5 2026, opens date picker") → Save button (announces disabled reason
  when invalid, e.g. "Save budget, dimmed, enter an amount and pick a category").
- **Labels:** amount input `accessibilityLabel="Budget amount"`; category row
  `"Category, {name or none}, opens picker"`; date row `"Start date, {date}, opens date picker"`;
  CTA `"Save budget"`.
- **Contrast:** all text on dark glass uses `colors.text` / `colors.textMuted`; verify placeholder
  `colors.textMuted` (#94a3b8) on `colors.glassMedium` clears 4.5:1 (it does over the dark gradient).
- **Reduced motion:** type cross-fade, date-picker reveal, and any press scale collapse to instant
  state changes under `AccessibilityInfo.isReduceMotionEnabled`. The `Skeleton` pulse already respects
  the shared component.

---

## 8. Developer notes

- **Swap the shell:** delete `SafeAreaView { backgroundColor: 'white' }` and the bare `title`; wrap in
  `<GradientBackground variant="bgDarkPurple">` + `SafeAreaView` + the standard tokenized header with
  `<BackButton fallback="/(tabs)/budget" />`. Remove the bottom Cancel button (back lives in the
  header now).
- **Drop `react-native-dropdown-picker` entirely** for this screen. Type → `TypeSegmentedControl`,
  Frequency → `FrequencyChips`. This removes the `typeOpen`/`frequencyOpen`/`categoryOpen` z-index
  juggling and the `listMode="MODAL"` mismatch.
- **Delete the dead code:** the commented-out "Income Budgets / Expense Budgets" `FlatList`s,
  `renderBudgetItem`, `incomeBudgets`/`expenseBudgets`, and the `budgets` fetch `useEffect` exist only
  to feed that removed UI. Drop them and the associated `transaction*` styles. (If a future "existing
  budgets for this category" hint is desired, that's a separate design — out of scope here.)
- **Keyboard-aware layout:** keep the `KeyboardAvoidingView` (`behavior: padding` on iOS); move the
  Save CTA into a sticky footer inside it so it stays above the keyboard while the numeric keyboard is
  up.
- **Single `isValid` memo** drives the disabled/enabled CTA: `name.trim().length > 0 &&
  Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0 && !!categoryId && !!frequency &&
  !!type && !!date`. It replaces both `Alert.alert` validation branches (keep the *logic*, change the
  *surface*). The save `body` shape and `POST /auth/budgets` call are unchanged.
- **Preserve prefill:** keep reading `prefill_category_id` / `prefill_name` and mounting Name +
  Category pre-filled; render those two fields populated (not skeletoned) when params are present.
- **Preserve the category-driven auto-name** and the `parent_name > name` composite label from the
  current `CategoryPicker.onSelect`.
- **Date picker:** mount the iOS spinner only while `open` (inside `StartDateField`), not permanently.
  Keep the existing `handleDateChange` semantics (Android closes on select; iOS updates live).
- **Reuse, don't reimplement:** `GradientBackground`, `BackButton`, `Skeleton`, `CategoryPicker`, and
  the five `add-transaction-*` sub-components. Only `add-budget-frequency-chips` (extra option) and
  `add-budget-start-date-field` (reveal date picker) are new.

---

## 9. Handoff checklist

- [x] IA reordered to lead with Type + Amount hero; matches the `add-transaction` sibling form exactly
- [x] Standard tokenized header with `BackButton` replaces bare title; bottom Cancel absorbed into it
- [x] White/light-mode shell replaced by `<GradientBackground variant="bgDarkPurple">`
- [x] Dropdown-picker Type/Frequency replaced by `TypeSegmentedControl` + `FrequencyChips` (5 options)
- [x] Always-on date spinner replaced by reveal-on-tap `StartDateField`
- [x] Amount promoted to a semantic `glassFloating` hero with a budget frequency echo
- [x] All states designed (default, date-open, loading skeleton, empty categories, error, disabled, overflow)
- [x] Blocking `Alert.alert` validation replaced by disabled CTA + inline color-independent hints
- [x] Every old hardcoded value mapped to a design-system token (no magic numbers)
- [x] Accessibility: 44pt targets, color-independent status (icon+word+color), SR order/labels, reduced motion
- [x] Dead commented budget-list code formally dropped
- [x] Component specs: 2 new (`add-budget-frequency-chips`, `add-budget-start-date-field`); 5 reused from `add-transaction-*`
```
