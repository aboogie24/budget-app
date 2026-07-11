# Settings · Categories Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `settings/categories` — `budget-app/app/settings/categories.tsx`
**Archetype:** settings / list (expandable, editable)
**Status:** Design handoff — implementation by frontend agent. DESIGN ONLY, no `.tsx`.
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Convention siblings:** `bills-redesign.md`, `budget-tab-redesign.md`, `calendar-redesign.md`, `dashboard-redesign.md`

---

## 1. Why this redesign exists

The Categories screen is a bespoke island. It never touches the design system:

- **Its own gradient** — `LinearGradient colors={['#0f0a1e','#1a1035','#0f0a1e']}` instead of
  `<GradientBackground variant="bgDarkPurple">`. This is the single biggest reason it reads as
  "a different app" (same problem the calendar had).
- **Its own palette** — `#a855f7`, `#c084fc`, `#64748b`, `#475569`, `#f87171`, `#cbd5e1` hardcoded
  everywhere instead of `colors.primary2 / accent / textMuted / textDark / error / text`.
- **Its own surfaces & borders** — `rgba(255,255,255,0.05)` cards, `rgba(255,255,255,0.08)` borders,
  ad-hoc `borderRadius: 14` — none of which are `glassEffects.glass` / `colors.borderGlass` / `radius.*`.
- **Its own type ramp** — inline `fontSize: 20/16/14/12` + `fontWeight: '800'/'700'` instead of
  `typography.h3 / bodyBold / small / caption`.
- **Its own segmented control** — the `toggleRow` is a fourth hand-rolled Expense/Income toggle when
  the app already settled ONE segmented-control style (`ScopeToggle` → `BudgetTypeToggle`).
- **Weak loading state** — a bare `ActivityIndicator` with "Loading categories…" instead of a
  `Skeleton` that holds the list layout (convention rule: spinner only for background refresh).
- **No error state at all** — a failed fetch silently `console.error`s and shows the empty state,
  which lies to the user ("No categories yet" when the truth is "we couldn't load").
- **Color-only status** — the `System` badge and rule badge lean on tint; the trash affordance is a
  bare red glyph. Status must be icon + word + color together.

This redesign keeps the screen **recognizably the same** — same data, same expand/collapse, same
add/edit modal, same Expense/Income split — but re-skins every surface onto the design system and
tightens the information architecture (a headline count card, a cleaner two-tier row, a proper
form sheet).

---

## 2. Information architecture (what changed, and why)

Structure today: `Header → Toggle → "N categories" label + hint → flat list of parents (each expands
to subs + "Add subcategory") → footer "Add Category" → edit modal`.

Redesigned IA, top to bottom:

1. **Fixed header** (outside scroll): `BackButton` · title "Categories" · `+` add-parent action.
2. **Expense | Income segmented control** — the shared toggle style, re-scopes the whole list.
3. **Headline count card** (`glassFloating`) — the one elevated card. Leads with the big count
   (`typography.h2`), plus a quiet "Custom vs System" breakdown so the user understands *what they can
   edit*. Replaces the tiny uppercase `sectionLabel` + `hint` line. The "Tap to expand · long-press to
   edit" hint moves into this card as a subtle affordance line.
4. **Category list** — flat glass rows (`CategoryParentRow`), each expandable to a sub-list of
   `CategorySubRow`s ending in a dashed "Add subcategory" row. Unchanged behavior.
5. **Footer** "Add Category" ghost button (kept — it's a good reach-friendly secondary entry point,
   redundant with the header `+` on purpose for a long scrolled list).
6. **Add / Edit form sheet** — bottom sheet on `colors.surface2` using the shared form-sheet recipe.

Everything is preserved; the only *new* IA is the headline card (which absorbs two existing labels and
adds the custom/system breakdown) and a real error state.

---

## 3. Wireframes

### 3.1 Default / populated

```
┌───────────────────────────────────────────────────────────┐
│  ‹   Categories                                    [ + ]   │  ← fixed header (BackButton · h3 · add)
├───────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Expenses            ·            Income             │  │  ← shared segmented control
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │  ← glassFloating headline card
│  │   18                                                 │  │     (typography.h2)
│  │   expense categories                                 │  │
│  │                                                      │  │
│  │   ◐ 11 custom   ·   ⚙ 7 system                       │  │  ← editable vs locked breakdown
│  │   Tap a category to expand · long-press to edit      │  │  ← affordance hint (caption, muted)
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │  ← CategoryParentRow (glass)
│  │  ⬤🏠  Housing                                  ⌄     │  │     iconChip · name · chevron
│  │        3 subs · ⑂ 4 rules                            │  │     meta line (caption, muted)
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │  ← EXPANDED parent
│  │  ⬤🍽  Food & Dining                     🗑    ⌃      │  │     (trash appears only if custom)
│  │        2 subs · ⑂ 6 rules                            │  │
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │  │
│  │       ◦🛒  Groceries              ⑂ 4       🗑        │  │  ← CategorySubRow (indented)
│  │       ◦🍴  Restaurants            ⑂ 2                 │  │
│  │    ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     │  │
│  │    ╎  +  Add subcategory                       ╎     │  │  ← dashed add-sub row
│  │    └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │  ← system parent (locked)
│  │  ⬤💳  Transfers                    🔒 System   ⌄     │  │     lock icon + word "System"
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │  ← footer add-category ghost button
│  ╎  ⊕  Add Category                                    ╎  │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Loading (Skeleton — holds layout, no spinner)

```
┌───────────────────────────────────────────────────────────┐
│  ‹   Categories                                    [ + ]   │  ← real header stays
├───────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  │  ← toggle skeleton (radius.full, h32)
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │  ← headline card skeleton (glassFloating)
│  │  ▓▓▓▓▓▓▓   (big count block)                          │  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                                     │  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓  ·  ▓▓▓▓▓▓▓▓                            │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │  ← 6× CategoryParentRow skeleton
│  │  ⬤   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                           ▓     │  │     (icon circle + 2 lines + chevron)
│  │      ▓▓▓▓▓▓▓▓▓                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ⬤   ▓▓▓▓▓▓▓▓▓▓                               ▓     │  │
│  │      ▓▓▓▓▓▓                                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                        … (rows 3–6) …                      │
└───────────────────────────────────────────────────────────┘
```

### 3.3 Empty (loaded OK, but no categories of this type)

Reuses the shared `EmptyState` inside the list body. Copy is type-aware and offers the primary action.

```
┌───────────────────────────────────────────────────────────┐
│  ‹   Categories                                    [ + ]   │
├───────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │  ← toggle stays (user can switch types)
│  │  Expenses            ·            Income             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │  ← EmptyState (glass)
│  │                     ┌───────┐                        │  │
│  │                     │  🗂    │                        │  │  folder-open-outline, accent tint
│  │                     └───────┘                        │  │
│  │              No income categories yet                │  │  ← title (bodyBold)
│  │      Add one to start tagging money coming in.       │  │  ← description (small, muted)
│  │                                                      │  │
│  │                 [  + Add Category  ]                 │  │  ← primary action → openAddParent
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 3.4 Error (fetch failed — new state, never blank the screen)

Reuses the shared `ErrorState` inside the list body. The header and toggle remain interactive so the
user can still retry / navigate.

```
┌───────────────────────────────────────────────────────────┐
│  ‹   Categories                                    [ + ]   │
├───────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │  ← ErrorState (glass)
│  │                     ┌───────┐                        │  │
│  │                     │  ⚠     │                        │  │  alert-circle-outline, colors.error
│  │                     └───────┘                        │  │
│  │              Couldn't load categories                │  │  ← title (bodyBold)
│  │        Check your connection and try again.          │  │  ← message (small, muted)
│  │                                                      │  │
│  │                  [  ⟳  Try Again  ]                  │  │  ← onRetry → fetchData()
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 3.5 Add / Edit form sheet (bottom sheet)

```
                    ░░░ scrim rgba(0,0,0,0.6) ░░░
┌───────────────────────────────────────────────────────────┐
│  ▁▁▁▁ grabber ▁▁▁▁                                         │  ← colors.surface2, radius.xl top
│  Edit Category                                       ✕     │  ← typography.h3 · close (44pt)
│                                                            │
│  NAME                                                      │  ← smallBold, muted
│  ┌─────────────────────────────────────────────────────┐  │  ← glass input (borderGlass)
│  │  Groceries                                           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  COLOR                                                     │
│  ⬤ ⬤ ⬤ ⬤ ⬤   ⬤ ⬤ ⬤ ⬤ ⬤                                     │  ← swatch grid (selected = ring)
│                                                            │
│  ICON                                                      │
│  ◦ ◦ ◦ ◦ ◦ ◦ ◦ ◦ →                                         │  ← horizontal icon scroller
│                                                            │
│  PREVIEW                                                   │
│  ┌─────────────────────────────────────────────────────┐  │  ← live preview row (glass)
│  │  ⬤🛒  Groceries                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │  ← primaryGradient CTA
│  │                  Save Changes                        │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Token mapping (every hardcoded value → design-system token)

No literal hex / rgba / px survives except the documented **12% semantic tint** for icon-chip /
badge backgrounds (the convention's one allowed exception).

### 4.1 Background, header, toggle

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0f0a1e','#1a1035','#0f0a1e']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `header` `fontSize 20 / fontWeight '800' / #f8fafc` | `typography.h3`, `colors.text` |
| `addHeaderBtn` `rgba(168,85,247,0.12)` fill / `rgba(168,85,247,0.3)` border / `#c084fc` icon | icon `colors.accent`, chip fill `colors.primary2` @ 12%, border `colors.borderGlass`, `radius.md` |
| `backBtn` bespoke styles | shared `<BackButton color={colors.accent} size={20} />` (already used — keep) |
| `toggleRow / toggle / toggleActive` (all bespoke) | shared segmented control — see `settings-categories-CategoryTypeToggle.json` (models `BudgetTypeToggle`) |
| `toggleText #64748b` / `toggleTextActive #c084fc` | `colors.textMuted` / `colors.accent` |

### 4.2 Headline card + list rows

| Old hardcoded value | Replace with token |
|---|---|
| `sectionLabel #64748b fontSize 11` + `hint #475569 fontSize 12` | folded into `CategoryCountCard` (`glassFloating`); count `typography.h2`, hint `typography.caption` `colors.textMuted` |
| `parentSection` `rgba(255,255,255,0.05)` / border `rgba(255,255,255,0.08)` / `borderRadius 14` | `glassEffects.glass`, `colors.borderGlass`, `radius.lg` |
| `parentRow` `padding 14 / gap 12` | `spacing.md`/`spacing.lg` padding, `spacing.md` gap |
| `iconCircle` 40×40, `borderRadius 12`, fill `${color}22` | keep 40×40, `radius.md`, fill = category color @ 12% (the allowed tint) |
| `parentName` `fontSize 16 / '700' / #f8fafc` | `typography.bodyBold`, `colors.text` |
| `metaText #64748b fontSize 12` | `typography.caption`, `colors.textMuted` |
| chevron `#64748b` | `colors.textMuted` |
| `ruleBadge` fill `rgba(192,132,252,0.12)` / text `#c084fc` | fill `colors.primary2` @ 12%, icon+text `colors.accent`, `radius.sm` |
| `systemBadge` fill `rgba(100,116,139,0.2)` / text `#94a3b8` | fill `colors.glassMedium`, `lock-closed` icon + "System" word in `colors.textMuted`, `radius.sm` |
| `miniAction` fill `rgba(255,255,255,0.04)` / trash `#f87171` | fill `colors.glassLight`, icon `colors.error`, `radius.sm`, target padded to 44 |

### 4.3 Subcategories

| Old hardcoded value | Replace with token |
|---|---|
| `subsContainer` top border `rgba(255,255,255,0.06)` | `colors.borderLight` |
| `subRowWrapper` bottom border `rgba(255,255,255,0.04)` | `colors.borderLight` |
| `subRow` `paddingLeft 56` indent | `spacing.xxl + spacing.xl` derived indent (kept visual, tokenized) |
| `subIconCircle` 30×30 fill `${color}18` | 30×30, `radius.sm`, category color @ 12% |
| `subName #cbd5e1 fontSize 14 / '500'` | `typography.small`, `colors.text` (raise contrast — `#cbd5e1` on glass is borderline) |
| `ruleBadgeSm` `#c084fc` | `colors.accent`, `radius.sm` |
| `systemBadgeSm #94a3b8` | `lock-closed` + `colors.textMuted` |
| `addSubBtn` dashed `rgba(168,85,247,0.25)` / fill `rgba(168,85,247,0.06)` / text `#a855f7` | dashed `colors.borderGlass`, fill `colors.primary2` @ 8%, `+` icon + text `colors.accent`, `radius.md` |

### 4.4 Footer, empty, modal

| Old hardcoded value | Replace with token |
|---|---|
| `addCategoryBtn` fill `rgba(168,85,247,0.12)` / border `rgba(168,85,247,0.3)` / text `#a855f7` | fill `colors.primary2` @ 12%, border `colors.borderGlass`, `add-circle-outline` + text `colors.accent`, `radius.lg` |
| `emptyState` bespoke + `ActivityIndicator #a855f7` | **loading** → `Skeleton` layout; **empty** → shared `EmptyState`; never a spinner in body |
| `emptyText rgba(255,255,255,0.3)` | (removed — handled by `EmptyState` / `ErrorState`) |
| `RefreshControl tintColor #a855f7` | `colors.primary2` (spinner allowed here — background refresh only) |
| `modalOverlay rgba(0,0,0,0.7)` | scrim `rgba(0,0,0,0.6)` (match savings/priorities sheet recipe) |
| `modalContainer #0f0a1e` / border `rgba(255,255,255,0.08)` / `borderTopRadius 24` | `colors.surface2`, `colors.borderGlass`, `radius.xl` |
| `modalTitle 20 / '800' / #f8fafc` | `typography.h3`, `colors.text` |
| `closeBtn rgba(255,255,255,0.08)` / `#e5e7eb` | `colors.glassMedium`, icon `colors.textMuted`, 44pt |
| `fieldLabel #94a3b8 fontSize 13 / '700'` | `typography.smallBold`, `colors.textMuted` |
| `input rgba(255,255,255,0.06)` / border `rgba(255,255,255,0.08)` / `#f8fafc` / placeholder `#475569` | fill `colors.glassLight`, border `colors.borderGlass`, `radius.md`, text `typography.body` `colors.text`, placeholder `colors.textMuted` |
| `colorSwatch` 32×32 / `borderRadius 10` / active border `#fff` | 32×32, `radius.md`; selected = 2px `colors.text` ring |
| `iconOption` fill `rgba(255,255,255,0.06)` / border `rgba(255,255,255,0.08)` | fill `colors.glassLight`, border `colors.borderGlass`, `radius.md`; selected border = category color, fill = category color @ 12% |
| `previewRow rgba(255,255,255,0.05)` / border `rgba(255,255,255,0.08)` | `glassEffects.glass`, `radius.lg` |
| `previewName #f8fafc 16 / '700'` | `typography.bodyBold`, `colors.text` |
| `saveBtn #7c3aed` / text `#fff 16 / '800'` | `gradients.primaryGradient`, `typography.button`, `colors.text`, `radius.lg` |
| `PRESET_COLORS` (category swatches) | **kept as literals on purpose** — these are user-selectable data values, not chrome. Reorder so index 0–3 line up with `colors.primary / success / error / info` for brand cohesion, but the array stays. |

---

## 5. Component specs

Full JSON specs live in `budget-app/docs/design/components/settings-categories-*.json`. Summary:

### 5.1 `CategoryTypeToggle` (`settings-categories-CategoryTypeToggle.json`)
Expenses | Income segmented control. **Do not hand-roll** — model on / extend `BudgetTypeToggle`
(itself modeled on `ScopeToggle`) so the app keeps one segmented-control style. `glassEffects.glass`
container at `radius.full`, active segment `colors.primary` fill + `typography.smallBold` `colors.text`;
inactive `colors.textMuted`. Icons: `cart-outline` (expense) / `cash-outline` (income). Re-scopes the
whole list. `role=tablist`, 44pt segments, `animation.fast` pill slide (instant under reduced motion).

### 5.2 `CategoryCountCard` (`settings-categories-CategoryCountCard.json`)
The one elevated headline card (`glassEffects.glassFloating`). Big count in `typography.h2`
("18") + label "expense categories" (`typography.small`, `colors.textMuted`). Breakdown line:
`◐ {custom} custom · ⚙ {system} system` — custom count in `colors.text`, the pencil/half-glyph
in `colors.accent`; system count + `lock-closed`/`settings` glyph in `colors.textMuted`. Affordance
hint "Tap to expand · long-press to edit" in `typography.caption`, `colors.textMuted`. Props:
`{ type, total, customCount, systemCount }`.

### 5.3 `CategoryParentRow` (`settings-categories-CategoryParentRow.json`)
Flat glass row (`glassEffects.glass`, `radius.lg`). Left: 40×40 icon chip (`radius.md`, category
color @ 12% fill, category-color icon). Center: name (`typography.bodyBold`), meta line
(`typography.caption`) = `{n} subs · ⑂ {n} rules`. Right cluster: trash `miniAction` (only if custom;
`colors.error`, 44pt) then chevron (`chevron-up/down`, `colors.textMuted`). Tap = expand/collapse
(`LayoutAnimation` → `animation.medium`, instant under reduced motion); long-press = edit.
System rows show a `🔒 System` chip in place of trash. States: `default / expanded / pressed /
system(locked) / skeleton`.

### 5.4 `CategorySubRow` (`settings-categories-CategorySubRow.json`)
Indented child row inside an expanded parent. 30×30 icon chip (`radius.sm`, category color @ 12%),
name (`typography.small`, `colors.text`), optional `⑂ {n}` rule badge, trash (`colors.error`, custom
only, 44pt). Tap = edit. Divider between subs = `colors.borderLight`. Ends with the dashed
**Add subcategory** row: dashed `colors.borderGlass` border, `colors.primary2` @ 8% fill, `+` +
"Add subcategory" in `colors.accent`, `radius.md`.

### 5.5 `CategoryFormSheet` (`settings-categories-CategoryFormSheet.json`)
Bottom-sheet re-skin of the existing add/edit `Modal` — same fields, same `handleSaveEdit`
validation, same `Alert`s. Surface `colors.surface2` @ `radius.xl` top; shared form-sheet recipe
(glass inputs, `typography.smallBold` `colors.textMuted` labels, `gradients.primaryGradient` CTA).
Contains: name input, color swatch grid (selected = `colors.text` ring), horizontal icon scroller
(selected = category-color border + @12% fill), and the live preview row. Title/CTA swap on
`isNew`: "Add Category/Subcategory" + "Create" vs "Edit Category" + "Save Changes". Add
`KeyboardAvoidingView` (missing today). System categories never open this sheet (Alert, kept).

Shared components reused as-is: `GradientBackground`, `BackButton`, `Skeleton`, `EmptyState`,
`ErrorState`. No new shared components required.

---

## 6. Accessibility

- **Touch targets ≥ 44×44pt:** header `+`, back button, chevron/trash `miniAction`s (currently
  28×28 — pad the tappable area to 44 with `hitSlop`, keep the 28 visual), toggle segments, swatch
  and icon options, add-sub / footer buttons, sheet close.
- **Status is icon + word + color, never color alone:**
  - System category → `lock-closed` icon **+** the word "System" **+** muted color. (Today it's a
    tinted pill only.)
  - Rule count → `git-branch` icon **+** number **+** accent color.
  - Delete → `trash-outline` icon (the shape carries the meaning; red is reinforcement only).
- **Custom vs system independence:** editability is signaled by presence/absence of the trash
  affordance **and** the "System" lock chip — not by color.
- **Contrast:** raise subcategory name from `#cbd5e1` to `colors.text`; keep meta/labels on
  `colors.textMuted` (verify ≥ 4.5:1 on `glassLight` over `bgDarkPurple`). The category-color icon
  glyph sits on a 12%-tint chip, not as text, so it isn't held to text contrast — but never encode a
  category *only* by color; the icon glyph and name always accompany it.
- **Screen-reader order & labels:**
  - Header: back → "Categories" → "Add category" button.
  - Toggle: `tablist`; each tab "Expenses tab / Income tab", selected state announced.
  - Parent row label: `"{name}, {n} subcategories, {n} rules{, System — locked}"`; hint
    `"Double-tap to expand, long-press to edit"` (or `"…, locked"` for system).
  - Sub row label: `"{name}, {n} rules{, System}"`; trash has its own "Delete {name}" action.
  - Form sheet is a `dialog`; focus lands on the name field; fields read top-to-bottom; swatches
    expose "{color} color, selected/not selected"; CTA "Create / Save changes".
- **Reduced motion:** expand/collapse (`LayoutAnimation`) and the toggle pill slide drop to instant
  state swaps when reduce-motion is on; `Skeleton` pulse is opacity-only (already gentle) and may be
  frozen.

---

## 7. States summary

| State | Treatment |
|---|---|
| **Default / populated** | §3.1 — headline card + flat glass parent rows, expand to subs. |
| **Loading** | §3.2 — `Skeleton` toggle + headline + 6 parent-row placeholders that hold layout. No body spinner. |
| **Refreshing** | Pull-to-refresh `RefreshControl` in `colors.primary2` — the one allowed spinner (background refresh over existing content). |
| **Empty (this type)** | §3.3 — shared `EmptyState`, type-aware copy, `+ Add Category` primary action. Toggle stays so the user can switch types. |
| **Error** | §3.4 — shared `ErrorState`, "Couldn't load categories", `Try Again` → `fetchData()`. New; never blank/lie. |
| **System category** | Locked: `🔒 System` chip, no trash, tap/long-press → informational Alert (kept). |
| **Overflow — long name** | `numberOfLines={1}` + ellipsis on parent/sub names; badges/chevron are `flexShrink: 0`. |
| **Overflow — many subs** | Parent expands to full height inline (list scrolls); no inner cap. |
| **Empty subs** | Expanded parent with zero subs shows only the dashed "Add subcategory" row. |

---

## 8. Developer notes

- **Preserve all functionality & data flow:** `fetchData`, `ruleCounts`, `expandedIds`,
  `isSystemCategory`, `openEdit/openAddParent/openAddSubcategory`, `handleSaveEdit`,
  `handleDeleteParent/handleDeleteSubcategory` are unchanged. This is a re-skin + IA polish, not a
  rewrite.
- **Add an `error` state:** `fetchData`'s `catch` currently only `console.error`s. Introduce an
  `error` boolean so §3.4 can render; distinguish it from the genuine empty state (which today are
  conflated).
- **Header moves outside the list:** lift the header row out of `ListHeaderComponent` into a fixed
  row above the `FlatList` (convention: header is fixed, not scrolled) — the toggle + count card may
  stay in `ListHeaderComponent`.
- **Don't hand-roll the toggle:** reuse/extend `BudgetTypeToggle`/`ScopeToggle`. If a generic
  two-option config isn't available, prefer adding one over a fourth bespoke toggle.
- **`PRESET_COLORS` stays literal** — those are category *data* values the user picks, not UI chrome;
  the "no hex" rule targets chrome. Optionally align the first four with `colors.primary/success/
  error/info` for cohesion.
- **`ICON_MAP` unchanged** — icon glyph set is data; keep it.
- **Reuse, don't reimplement:** `GradientBackground`, `Skeleton`, `EmptyState`, `ErrorState`,
  `BackButton` all exist and fit — wire them in rather than styling new ones.
- **Form sheet:** add the missing `KeyboardAvoidingView` and swap `#0f0a1e`→`colors.surface2`,
  save button `#7c3aed`→`gradients.primaryGradient`.

---

## 9. Handoff checklist

- [x] All states designed (default, loading skeleton, empty, error, system-locked, overflow)
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Every hardcoded color/gradient/spacing/font mapped to a token (only 12%/8% tints remain literal)
- [x] One `glassFloating` headline card; all other cards flat `glass`
- [x] Shared segmented-control style reused (no 4th bespoke toggle)
- [x] Loading = `Skeleton` (spinner only for pull-to-refresh)
- [x] Real error state added (was silently missing)
- [x] Status = icon + word + color (System lock chip, rule branch badge)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion
- [x] Component specs written (`docs/design/components/settings-categories-*.json`)
- [x] Functionality preserved; screen still recognizably "Categories"
