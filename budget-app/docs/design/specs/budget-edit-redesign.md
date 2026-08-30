# Edit Budget Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `budget/edit/[id]` → `budget-app/app/budget/edit/[id].tsx`
**Archetype:** Form (single-column, one primary action) — sibling of `add-transaction`
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Reference screens (the look to match):** `app/(tabs)/dashboard.tsx`, `app/(tabs)/calendar.tsx`
**Sibling form to match exactly:** `docs/design/specs/add-transaction-redesign.md`
**Replaces:** ad-hoc styling in `budget-app/app/budget/edit/[id].tsx`

---

## 1. Why this redesign exists

The screen works, but — like `add-transaction` before it — it is visually a **different app**
from the rest of CoupleFlow, and it is the *last* budget-flow form still on bespoke styling.
Concretely:

- **Off-theme background.** It uses a bespoke raw `LinearGradient ['#0b1021','#1b0d30','#2d0c53']`
  instead of `<GradientBackground variant="bgDarkPurple">` that dashboard, calendar, and
  add-transaction standardized on. Its hue is subtly wrong, which breaks the unified feel.
- **Hardcoded everything.** Colors (`'#f8fafc'`, `'#cbd5e1'`, `'#94a3b8'`, `'#c084fc'`, `'#a78bfa'`,
  `'#a855f7'`, `'#7c3aed'`, `'#475569'`, and a dozen `rgba(255,255,255,…)`/`rgba(192,132,252,…)`
  values), radii (`16`, `12`, `10`), paddings (`16`, `14`, `12`, `10`, `8`, `6`), and font
  sizes/weights (`18/800`, `16/800`, `13/700`, `11/600`) are all magic numbers. None come from
  `design-system.ts`, so the screen can't inherit future theme changes.
- **Amount is buried.** The single most important value in the form — the budget amount — is the
  2nd plain text input in a flat stack, visually identical to the Name field. It never reads at a
  glance. Its sibling `add-transaction` already promoted amount to a semantic hero; this screen
  should match.
- **Blocking `Alert.alert` everywhere.** Session error, validation ("Missing fields"), the save
  **success** ("Saved / Budget updated."), and the save failure all fire native modal alerts. That
  is the opposite of the app's inline glass-card language, and dashboard/calendar/add-transaction
  never confirm-modal on a write.
- **No state coverage.** Categories and the existing-budget record are fetched in `useEffect`, but
  there is **no loading skeleton, no inline error, no empty-category state, and no
  disabled-until-valid CTA.** While `getCurrentUser()` + `GET /auth/budgets/{id}` +
  `GET /auth/categories/user/{id}` resolve, the form shows stale/blank param values with no
  feedback.
- **Partner attribution is a whisper.** The genuinely useful "Last edited by partner" line exists
  but is a tiny off-token purple caption (`'#a78bfa'`, `11px`). In a two-partner household app this
  is important co-editing context and deserves the tokenized partner-glyph treatment the other
  screens use.

This redesign keeps the screen **recognizably the same form** — name, amount, type toggle,
category, frequency, share-with-household switch, start date, one Save button — but re-skins it
entirely onto the design system, adds the missing states, promotes amount to a hero, and turns the
co-edit attribution into a first-class, color-independent partner banner.

---

## 2. Information architecture — what changed and why

Reading order top to bottom mirrors the user's mental model when editing a recurring budget line:

1. **Header** — standard tokenized header with `BackButton`, title `Edit Budget`, one-line subtitle.
2. **Co-edit banner (conditional)** — when the budget was last touched by the *partner*, a small
   glass banner with the partner glyph: `◑ Last edited by Alex · 2 days ago`. Promoted out of the
   header so it reads, and made color-independent (glyph + word + relative time).
3. **Amount — promoted to a hero field.** Big centered numeric hero inside the top `glassFloating`
   card, semantically tinted by the selected **type** (`colors.error` for expense budgets,
   `colors.success` for income budgets), sign prefix `−`/`+`. This is the exact calendar/dashboard/
   add-transaction "one number reads at a glance" pattern.
4. **Type segmented control** (Expense | Income) — kept as the *frame*: it recolors the amount hero
   and swaps the category set (existing `categories.filter(c => c.type === type)` logic). Sits
   directly under the hero it recolors, in the same top card.
5. **Details card** — Name, Category (glass select list, filtered by type), Frequency chips
   (`monthly / weekly / biweekly / 1st-15th`), Start date field (opens the existing
   `DateTimePicker`), and the **Share with household** switch row with its explanatory subcopy.
6. **Sticky Save CTA** — primary gradient button pinned to the bottom (keyboard-aware), disabled
   and dimmed until the form is valid, inline loading label. Replaces the inline-scrolled button
   and the success `Alert`.

Everything the current screen does is preserved. Structural moves: amount promoted to a hero, the
type toggle moved directly under it, validation/success/error moved from blocking alerts to inline
color-independent surfaces, the co-edit line promoted to a real banner, and the CTA pinned.

### Layout structure

```
GradientBackground (bgDarkPurple)
└─ SafeAreaView
   ├─ Header row        [BackButton] [ Edit Budget / subtitle ] [40pt spacer]
   ├─ ScrollView (keyboard-aware, flexes above sticky footer)
   │   ├─ Co-edit banner (conditional: last edited by partner)
   │   ├─ Amount hero card (glassFloating)
   │   │    ├─ Amount hero        ← big semantic number, tinted by type
   │   │    └─ Type segmented control (Expense | Income)
   │   ├─ Details card (glass)
   │   │    ├─ Name field
   │   │    ├─ Category select (filtered by type)
   │   │    ├─ Frequency chip row
   │   │    ├─ Start date field  → DateTimePicker
   │   │    └─ Share-with-household switch row
   │   └─ (inline error card, if save failed)
   └─ Sticky footer:  Save Budget CTA  (disabled | default | loading)
```

---

## 3. Wireframes (key states)

### 3.1 Default / populated (existing budget, edited by partner)

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Edit Budget                              (40)   │  header: BackButton + title + spacer
│            Update this recurring budget line              │  subtitle (textMuted)
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  co-edit banner — glass
│  │  ◑  Last edited by Alex · 2 days ago                │   │  partner glyph + word + rel-time
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Amount + Type — glassFloating
│  │                    AMOUNT                            │   │  label (caption, muted)
│  │                                                      │   │
│  │                  −  $ 850.00                         │   │  h1, colors.error (expense budget)
│  │                                                      │   │
│  │  ┌──────────────────────┬──────────────────────┐    │   │  segmented control (1 tappable row)
│  │  │  💳  Expense   ●      │   ↗  Income          │    │   │  active expense → error-tinted
│  │  └──────────────────────┴──────────────────────┘    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  Details card — glass
│  │  Name                                               │   │  label (smallBold)
│  │  [ 🅣  Groceries                                 ]   │   │  input row (glass inset)
│  │                                                      │   │
│  │  Category                                           │   │
│  │  ┌────────────────────────────────────────────┐     │   │  select list, filtered by type
│  │  │  Food & Dining                          ✓  │     │   │  selected = primary2 tint + check
│  │  │  Household                                  │     │   │
│  │  │  Transportation                             │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  │                                                      │   │
│  │  Frequency                                          │   │
│  │  ( monthly ● )( weekly )( biweekly )( 1st-15th )    │   │  chip row, selected = primary tint
│  │                                                      │   │
│  │  Start date                                         │   │
│  │  [ 📅  July 1, 2026                             ]   │   │  tap → DateTimePicker
│  │                                                      │   │
│  │  ────────────────────────────────────────────────  │   │  divider (borderLight)
│  │  Share with household                        (⬤▢)  │   │  switch row
│  │  Let your partner view and edit this budget         │   │  subcopy (small, textMuted)
│  └────────────────────────────────────────────────────┘   │
│                                                            │
├────────────────────────────────────────────────────────── ┤
│  ┌────────────────────────────────────────────────────┐   │  sticky footer
│  │                Save Budget  →                        │   │  primaryGradient CTA
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Income variant: segmented control right side active (`↗ Income`, `colors.success` tint), the amount
hero shows `+ $5,200.00` in `colors.success`, and the Category list swaps to income categories
(existing filter). Everything else is identical.

### 3.2 Loading (fetching the budget record + categories)

Use `components/Skeleton.tsx`. The header renders normally; the co-edit banner is omitted (not yet
known); the form body is skeletoned so layout does not jump when the real record + categories mount.
This is the window while `getCurrentUser()` + `GET /auth/budgets/{id}` + category fetch resolve.

```
┌──────────────────────────────────────────────────────────┐
│ [‹]        Edit Budget                              (40)   │
│            Update this recurring budget line              │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │  amount+type hero skeleton
│  │      ▓▓▓▓▓▓  (label)                                 │   │
│  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (big number bar, h=36)      │   │
│  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (segment bar, h=44) │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │  details skeleton
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (name, h=48)   │   │
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓  (3 cat rows)   │   │
│  │  ▓▓▓▓  ( )( )( )( )  (chip row)                     │   │
│  │  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  (date, h=48)        │   │
│  └────────────────────────────────────────────────────┘   │
│  [ ▓▓▓▓▓▓▓▓▓▓▓▓  disabled CTA skeleton ]                   │
└──────────────────────────────────────────────────────────┘
```

Skeleton blocks reuse `Skeleton` sized to the real field heights (hero number ~36, segment ~44,
field rows 48, category rows 44, chip row 44) so there is zero layout shift on mount.

### 3.3 Empty state (no category available for this type)

The form is never empty of its own fields — the *only* emptiable region is the Category select. If
the household has **no categories** for the selected type, the select list becomes an inline empty
affordance rather than rendering an empty box (today it silently renders nothing).

```
│  Category                                                  │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     │  glass, dashed border = "nothing yet"
│  ╎ 🏷  No expense categories yet          + Create   ╎     │  outline icon + word + action
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘     │
```

"+ Create" routes to category creation (existing app path) rather than leaving a dead box. The word
"No … categories yet" keeps the empty state color-independent. Saving remains possible without a
category (category is optional in the payload — `category_id || undefined`), so this does not block
the CTA.

### 3.4 Error state

Two distinct load/save error surfaces, both inline glass cards — never a blocking `Alert`.

**Load error** (the `GET /auth/budgets/{id}` fetch failed): replaces the current silent
`console.error`. A full inline card sits where the form would be, with a Retry action, so the user
isn't staring at stale param values.

```
│  ┌────────────────────────────────────────────────────┐   │  inline error card — glass
│  │  ⚠  Couldn't load this budget                       │   │  alert-circle-outline (error) + word
│  │     Check your connection and try again.            │   │  small, textMuted
│  │                                    [  Retry  ]      │   │  text button
│  └────────────────────────────────────────────────────┘   │
```

**Save error** (the `PUT /auth/budgets/{id}` failed): replaces `Alert.alert('Error', …)`. An inline
card appears directly above the sticky Save CTA; the CTA returns to its default enabled state so the
user can retry.

```
│  ┌────────────────────────────────────────────────────┐   │  inline error card — glass
│  │  ⚠  Couldn't save budget                            │   │  alert-circle-outline (error) + word
│  │     Check your connection and try again.            │   │  small, textMuted
│  └────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────── ┤
│  [ Save Budget  →  ]   ← re-enabled                        │
```

Field-level validation (replaces `Alert.alert('Missing fields', …)`) surfaces as inline,
color-independent hints, not a modal:

```
│  Amount                                                    │
│  −  $ abc                                                  │
│  ⚠ Enter a valid amount            ← caption, colors.error + icon

│  Name                                                      │
│  ⚠ Give this budget a name         ← caption, colors.error + icon
```

### 3.5 Disabled CTA (form invalid)

Save is disabled until: `name` is non-empty **and** `amount` is a valid, finite number. (Category,
frequency, and start date all have valid defaults, matching current save logic.) Disabled =
`opacity 0.5`, no gradient press feedback, `accessibilityState={{ disabled: true }}`. This surfaces
the same rules the old `Alert.alert('Missing fields', …)` enforced, but proactively.

### 3.6 Overflow / edge cases

```
Long name:          [ 🅣  Groceries, Household & Warehouse Cl… ]   numberOfLines=1, ellipsis
Long category:      Food & Restaurants — Dining Out          ✓     name truncates, check pinned (flexShrink 0)
Large amount:       −  $1,250,000.00                               hero auto-shrinks font one step at >10 chars
Many categories:    select list scrolls within a maxHeight; page still scrolls
Many freq chips:    wraps to 2 rows (flexWrap), gap = spacing.sm
Long partner name:  ◑ Last edited by Alexandra … · 2 days ago      banner text numberOfLines=1
```

---

## 4. Token mapping (no magic numbers)

Every current hardcoded value → its `design-system.ts` token.

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0b1021','#1b0d30','#2d0c53']` (screen bg) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| Save button `backgroundColor '#7c3aed'` | `gradients.primaryGradient` |
| Primary text `'#f8fafc'` (header, inputs, select text) | `colors.text` |
| Label `'#cbd5e1'` | `colors.text` (label) / `colors.textMuted` (secondary) |
| Placeholder + subcopy `'#94a3b8'` | `colors.textMuted` |
| Check / date icon / active accent `'#c084fc'` | `colors.primary2` (tokenized accent) |
| Last-edited caption `'#a78bfa'` | partner glyph `colors.primary2` (A) / `colors.info` (B) |
| Switch track-on `'#a855f7'` | `colors.primary2` |
| Switch track-off `'#475569'` | `colors.textDark` |
| Card `bg 'rgba(255,255,255,0.06)'` + `border 'rgba(255,255,255,0.08)'` | `glassEffects.glass` / `commonStyles.card` |
| Amount+type hero card | `glassEffects.glassFloating` (it earns elevation) |
| Input `bg 'rgba(255,255,255,0.06)'` + `border 'rgba(255,255,255,0.15)'` | `colors.glassMedium` + `colors.borderGlass` |
| Toggle inactive `bg 'rgba(255,255,255,0.04)'` + `border 'rgba(255,255,255,0.12)'` | `colors.glassLight` + `colors.borderGlass` |
| Toggle active `border '#c084fc'` + `bg 'rgba(192,132,252,0.14)'` | `colors.primary2` @ ~70% border / @ ~18% fill |
| Select box `bg 'rgba(255,255,255,0.03)'` + `border 'rgba(255,255,255,0.08)'` | `colors.glassLight` + `colors.borderGlass` |
| Select item border `'rgba(255,255,255,0.05)'` | `colors.borderLight` |
| Select item active `'rgba(192,132,252,0.1)'` | `colors.primary2` @ ~12% |
| Date "Done" pill `bg 'rgba(192,132,252,0.15)'` + text `'#c084fc'` | `colors.primary2` @ ~15% fill / `colors.primary2` text |
| `borderRadius: 16` (card) | `radius.lg` |
| `borderRadius: 12` (inputs, toggle, button, select) | `radius.md` |
| `borderRadius: 10` (small toggle, date pill) | `radius.md` |
| `padding: 16` (container, card) | `spacing.lg` |
| `paddingVertical: 14` (button) | `spacing.lg` |
| `paddingVertical: 12 / 10 / 8` (inputs, toggles) | `spacing.md` / `spacing.sm` |
| `gap: 12 / 10` (card, toggle row) | `spacing.md` / `spacing.sm` |
| `marginBottom / marginTop: 12 / 8 / 6 / 4` | `spacing.md` / `spacing.sm` / `spacing.xs` |
| header `fontSize:18, weight:800` | `typography.h3` (weight 800 override ok, matches calendar/add-transaction title) |
| subtitle (new) | `typography.small`, `colors.textMuted` |
| label `fontSize:13, weight:700` | `typography.smallBold`, `colors.text` |
| last-edited `fontSize:11, weight:600` | `typography.caption`, partner glyph color |
| share subcopy `fontSize:12, weight:500` | `typography.caption`, `colors.textMuted` |
| select text `weight:700` | `typography.bodyBold`, `colors.text` |
| date text `fontSize:14, weight:700` | `typography.smallBold`, `colors.text` |
| button text `fontSize:16, weight:800` | `typography.button`, white |
| amount hero (new) | `typography.h1`, semantic color by type |
| `Alert.alert('Session', …)` | inline error card / redirect to login (no modal) |
| `Alert.alert('Missing fields', …)` | inline field hints (`typography.caption`, `colors.error` + icon) |
| `Alert.alert('Saved', 'Budget updated.')` | drop the modal; `successHaptic()` + `router.back()` (matches add-transaction §4) |
| `Alert.alert('Error', 'Could not save budget.')` | inline error glass card (see §3.4) |

---

## 5. Component specs

Reuse shared components: `GradientBackground`, `BackButton`, `Skeleton`, and the existing
`DateTimePicker` wrapper. New sub-components are `budget-edit-` prefixed JSONs under
`docs/design/components/`. Because this is the sibling of `add-transaction`, four of its components
are **shared verbatim** — do not re-implement, reuse the add-transaction ones:

| Component | Source |
|---|---|
| Header (tokenized) | same recipe as add-transaction §5.1 |
| `AmountHero` | reuse `add-transaction-amount-hero.json` (semantic tint by type) |
| `TypeSegmentedControl` | reuse `add-transaction-type-segmented-control.json` |
| `FormField` (Name) | reuse `add-transaction-form-field.json` |
| `FrequencyChips` | reuse `add-transaction-frequency-chips.json` values `['monthly','weekly','biweekly','1st-15th']` |
| `SaveCTA` | reuse `add-transaction-save-cta.json` (label `Save Budget`) |

New, budget-edit-specific components below.

### 5.1 Header (standard, tokenized)

- Layout: `flexDirection row`, `alignItems: flex-start`, `paddingHorizontal spacing.lg`,
  `paddingTop spacing.sm`, `paddingBottom spacing.md` (matches dashboard/add-transaction `header`).
- Left: `<BackButton fallback="/(tabs)/budget" size={20} />` (preserve current fallback + size).
- Center: title `Edit Budget` (`typography.h3`, weight 800, `colors.text`) + subtitle
  `Update this recurring budget line` (`typography.small`, `colors.textMuted`).
- Right: 40pt spacer `View` to balance the back button (keeps title centered; matches current
  `<View style={{ width: 40 }} />`).
- Touch target: BackButton is 40×40 with `hitSlop` → ≥44pt effective.
- **Note:** the current code puts the "last edited" line inside the header; it moves out to the
  co-edit banner (§5.2) so the header stays the standard two-line form header.

### 5.2 CoEditBanner → `budget-edit-coedit-banner.json`

- Renders **only** when `budgetData.updated_by` exists AND `updated_by !== currentUserId` (exact
  current condition). Otherwise not rendered — the banner never appears for your own edits.
- Row: `glassEffects.glass`, `radius.md`, `paddingHorizontal spacing.md`, `paddingVertical
  spacing.sm`, `flexDirection row`, `alignItems center`, `gap spacing.sm`, `marginBottom spacing.md`.
- Leading **partner glyph**: a 14pt `◑`/`◐` half-moon (or initial circle) tinted per the household
  convention — Partner A `colors.primary2`, Partner B `colors.info`. Shared/unknown → neutral
  `colors.textMuted` dot.
- Text: `Last edited by {updated_by_name || 'partner'}` + ` · {relativeTime(updated_at)}`
  (`typography.caption`, `colors.textMuted`, `numberOfLines=1`). Relative time is new, additive
  context ("2 days ago"); if `updated_at` is missing, omit the `· time` half — graceful degrade.
- States: `hidden | partnerA | partnerB | partnerUnknown`.
- Color-independent: the **glyph + the words "Last edited by {name}"** carry the meaning, not the
  tint. `accessibilityRole="text"`, label `"Last edited by {name}, {relative time}"`.

### 5.3 CategorySelect → `budget-edit-category-select.json`

- The existing filtered category list, re-skinned. A single glass container
  (`glassEffects.glass`, `radius.md`) wrapping rows for `categories.filter(c =>
  c.type.toLowerCase() === type)`.
- Row: `flexDirection row`, `justifyContent space-between`, `alignItems center`,
  `paddingHorizontal spacing.md`, `minHeight 44`, bottom hairline `colors.borderLight` (last row
  none). Name `typography.bodyBold` `colors.text`, `numberOfLines=1`.
- Selected row: fill `colors.primary2` @ ~12%, trailing `checkmark` Ionicon in `colors.primary2`
  (`flexShrink 0`). Unselected: no check.
- If the filtered list is empty → the dashed **empty affordance** from §3.3 (outline
  `pricetag-outline`, "No {type} categories yet", "+ Create" action) instead of the list.
- Container caps at `maxHeight` ≈ 5 rows and scrolls internally on overflow.
- States: `default | selected | empty | pressed`.
- Each row `accessibilityRole="radio"` in a `radiogroup`, `accessibilityState={{ checked }}`,
  label `"{category name}"`; selection is conveyed by state + check icon, not tint alone.

### 5.4 StartDateField → `budget-edit-start-date-field.json`

- Glass inset row identical to `FormField`, but tap opens the existing `DateTimePicker` instead of
  a text input. Leading `calendar-outline` in `colors.primary2`; value =
  `startDate.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })` in
  `typography.smallBold` `colors.text`.
- Row: `colors.glassMedium` bg, `colors.borderGlass` border, `radius.md`, `paddingHorizontal
  spacing.md`, `minHeight 48`.
- iOS: `DateTimePicker` `display="spinner"`, `themeVariant="dark"`, followed by a **Done** pill —
  `colors.primary2` @ ~15% fill, `radius.md`, text `colors.primary2` `typography.smallBold`,
  `alignSelf flex-end`, min target 44. Android: `display="calendar"`, auto-dismiss on change
  (preserve current platform branching exactly).
- Props: `value: Date`, `onChange`, `showPicker`, `onOpen`, `onClose`.
- States: `collapsed | pickerOpen`. `accessibilityRole="button"`, label
  `"Start date, {formatted date}, opens date picker"`, min height 48 → ≥44pt.

### 5.5 ShareToggleRow → `budget-edit-share-toggle-row.json`

- The Share-with-household control, re-skinned. Preceded by a `commonStyles.divider`
  (`colors.borderLight`) to separate it from the fields above.
- Layout: `flexDirection row`, `alignItems center`, `justifyContent space-between`, `gap
  spacing.md`, `paddingVertical spacing.sm`. Left column (`flex 1`): title `Share with household`
  (`typography.smallBold`, `colors.text`) + subcopy `Let your partner view and edit this budget`
  (`typography.caption`, `colors.textMuted`).
- Right: RN `Switch` — `thumbColor` white, `trackColor={{ true: colors.primary2, false:
  colors.textDark }}` (tokenized from the current `'#a855f7' / '#475569'`).
- Props: `value: boolean`, `onValueChange`.
- States: `off | on`. Color-independent: the switch state is paired with the persistent **title +
  subcopy text**, and the Switch itself exposes on/off to the screen reader.
- `accessibilityRole="switch"`, `accessibilityState={{ checked: value }}`, label `"Share with
  household"`, hint = the subcopy. The whole 44pt row is the touch target for the label; the Switch
  is independently ≥44pt.

### 5.6 SaveCTA (sticky footer) — reuse `add-transaction-save-cta.json`

- Same recipe: pinned footer above the keyboard (`KeyboardAvoidingView`), `paddingHorizontal
  spacing.lg`, `paddingBottom` = safe-area inset + `spacing.md`, top hairline `colors.borderLight`.
- Button: `gradients.primaryGradient`, `radius.lg`, `paddingVertical spacing.lg`, centered
  `Save Budget` (`typography.button`, white) + `arrow-forward` icon.
- States: `disabled` (form invalid → `opacity 0.5`, no feedback, `accessibilityState disabled`),
  `default` (valid → `activeOpacity 0.85`), `loading` (mid-save → label `Saving…`, small
  `ActivityIndicator` replaces the arrow, non-interactive; preserves the current
  `saving ? 'Saving...' : 'Save Budget'` behavior). Height ≥44pt.

### 5.7 InlineErrorCard (load + save failure) — reuse pattern from calendar §7 / add-transaction §5.8

- `glassEffects.glass`, `alert-circle-outline` (`colors.error`) + headline (`typography.smallBold`,
  `colors.text`) + subcopy (`typography.small`, `colors.textMuted`). Load variant adds a `Retry`
  text button (re-runs the fetch). Save variant appears above the sticky CTA and dismisses on the
  next successful save. Not a separate JSON — mirror the shared inline-error recipe.

---

## 6. Interactions

- **Type switch:** `animation.fast` (150ms) cross-fade of the active segment tint **and** the amount
  hero color (expense red ↔ income green), and re-filters the Category list to the new type
  (existing `categories.filter` logic). Under reduced motion, instant. If the currently-selected
  category no longer belongs to the new type, clear the selection (it becomes optional anyway).
- **Amount focus:** tapping the hero card focuses the numeric input; keyboard pushes the sticky CTA
  up (`KeyboardAvoidingView`, `behavior: padding` on iOS).
- **Category select:** tapping a row sets `categoryId` and moves the check; single-select. List
  scrolls internally if long.
- **Frequency select:** chip toggles single-select among `['monthly','weekly','biweekly','1st-15th']`.
- **Start date:** tapping the field opens `DateTimePicker` (spinner on iOS with a Done pill; inline
  calendar on Android that auto-dismisses on change) — preserve the exact current platform branches.
- **Share switch:** toggles `shared`; no animation beyond the native Switch.
- **Save:** validates inline (no blocking alert); on success → `successHaptic()` + `router.back()`
  (no confirmation modal); on failure → `errorHaptic()` + inline save-error card, CTA re-enabled.
- **Press feedback:** all tappables `activeOpacity ~0.7–0.85`; chips/segments/category rows get a
  subtle background-tint change on press.

---

## 7. Accessibility

- **Touch targets:** BackButton (40 + hitSlop), segments, chips, category rows, date field, the
  share row, and the CTA are all ≥44×44pt. Category rows and the date row are padded to `minHeight
  44/48`.
- **Color-independent status:**
  - Expense vs income budget is conveyed by **icon (card vs trending-up) + the words
    "Expense"/"Income" + the sign prefix (−/+)** on the hero, not color alone.
  - Co-edit attribution is conveyed by the **partner glyph + the words "Last edited by {name}"**,
    not the tint alone; partner A vs B is glyph-shape (`◑`/`◐`) as well as color.
  - Category selection is conveyed by the **checkmark icon + `accessibilityState.checked`**, not the
    purple row tint alone. Same for selected frequency/type (weight change + state).
  - Validation errors always pair `alert-circle-outline` + a **word** ("Enter a valid amount",
    "Give this budget a name") with the red — never red alone.
  - Share on/off is conveyed by the persistent title + subcopy text and the Switch's own
    accessible state, not by the track color alone.
- **Screen-reader order:** title → subtitle → co-edit banner (if present) → amount ("Amount,
  $850.00, expense") → type control ("Expense selected / Income") → Name → Category (radiogroup) →
  Frequency (radiogroup) → Start date → Share switch → Save button (announces disabled reason when
  invalid, e.g. "Save Budget, dimmed, enter a name and amount").
- **Labels:** amount input `accessibilityLabel="Budget amount"`; category rows `"{name}"`; date row
  `"Start date, {formatted}, opens date picker"`; CTA `"Save budget"`.
- **Contrast:** all text on dark glass uses `colors.text` / `colors.textMuted`; verify placeholder
  and caption `colors.textMuted` (#94a3b8) on `colors.glassMedium` over the dark gradient clears
  4.5:1 (it does).
- **Reduced motion:** type cross-fade, category re-filter, and any press scale collapse to instant
  state changes under `AccessibilityInfo.isReduceMotionEnabled`.

---

## 8. Developer notes

- Swap the root `LinearGradient` for `<GradientBackground variant="bgDarkPurple">` + `SafeAreaView`.
- Wrap the scroll body in `KeyboardAvoidingView` so the sticky CTA + amount hero stay visible while
  the numeric keyboard is up.
- Drive the disabled/valid state from a single derived `isValid` memo (`name.trim().length > 0 &&
  amount && !isNaN(Number(amount))`) — it replaces the `Alert.alert('Missing fields', …)` branch.
  Keep the branch's *logic*, only change the *surface* (inline vs modal).
- Add a `loading` flag around the initial `getCurrentUser()` + `GET /auth/budgets/{id}` +
  category fetch; render the §3.2 skeleton while it's true. Add a `loadError` flag around the
  budget fetch to drive the §3.4 load-error card + Retry (replaces the silent `console.error`).
- Preserve the exact PUT payload to `/auth/budgets/${params.id}` (name, amount, type, category_id
  || undefined, start_date ISO, frequency, user_id, id || uuidv4(), is_shared) and the platform
  date-picker branches. This is a re-skin + IA change, not a behavior change.
- Replace the success `Alert.alert('Saved', …)` with `successHaptic()` + `router.back()` to match
  add-transaction and the rest of the app (writes don't confirm-modal).
- `updated_at` relative-time formatting is additive; if the field is absent, render just
  "Last edited by {name}" — never crash the banner on missing time.
- Reuse the four shared add-transaction component JSONs (AmountHero, TypeSegmentedControl,
  FormField, FrequencyChips, SaveCTA) rather than re-implementing them; only the four budget-edit
  JSONs (CoEditBanner, CategorySelect, StartDateField, ShareToggleRow) are net-new here.

---

## 9. Handoff checklist

- [x] All states designed (default/populated, loading skeleton, empty-category, load error, save error, disabled, overflow)
- [x] Off-theme gradient replaced with `<GradientBackground variant="bgDarkPurple">`
- [x] Every hardcoded color/gradient/radius/spacing/font mapped to a design-system token
- [x] Blocking `Alert.alert` (session/validation/success/error) replaced with inline, color-independent surfaces
- [x] Amount promoted to a semantic hero (income green / expense red, sign prefix by type)
- [x] Co-edit "last edited by partner" promoted to a first-class, color-independent partner banner
- [x] Sticky, keyboard-aware, disabled-until-valid Save CTA
- [x] Accessibility: 44pt targets, icon+word+color status, SR order, reduced motion
- [x] Shared components reused (GradientBackground, BackButton, Skeleton, DateTimePicker + the add-transaction form components)
- [x] Component specs written (`docs/design/components/budget-edit-*.json`)
- [x] Functionality preserved (same fields, PUT payload, date picker, haptics, navigation)
