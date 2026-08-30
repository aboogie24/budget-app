# Frequency Settings Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke styling in `budget-app/app/settings/frequency.tsx`
**Archetype:** settings (a single-purpose sub-screen reached from the Settings tab) — must
read as the same app as `dashboard.tsx`, `calendar.tsx`, and the redesigned settings tab.

---

## 1. Why this redesign exists

The screen works and its data model is simple (three integer multipliers stored in
AsyncStorage under `frequencyMultipliers`), but — exactly like the pre-redesign calendar,
dashboard, and settings tab — it **fights the design system** instead of using it.

Concrete problems in the current file:

1. **Wrong background.** A raw `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>`.
   That purple is subtly *not* `gradients.bgDarkPurple` (`['#0f172a','#1a0a40','#0f172a']`),
   so side by side with the settings tab this sub-screen is off-hue. It should use the shared
   `<GradientBackground variant="bgDarkPurple">`, never a local `LinearGradient`.
2. **Hardcoded everything.** Colors (`'#c084fc'`, `'#f8fafc'`, `'#64748b'`, `'#94a3b8'`,
   `'#475569'`, `'#7c3aed'`), surfaces (`'rgba(255,255,255,0.06)'`, `'0.04)'`), borders
   (`'rgba(255,255,255,0.08)'`, `'0.06)'`), radii (`18 / 14 / 12 / 10`), paddings
   (`16 / 14 / 8`), and every font size/weight are inline literals. **Not a single token is
   imported.** This is the entire reason it "feels bespoke."
3. **No non-default states.** `useEffect` reads AsyncStorage async, yet the screen renders the
   hardcoded defaults (`'4' / '2' / '1'`) immediately, so on a slow read the user briefly sees
   values that then jump to the stored ones. There is **no loading skeleton, no error state**
   (a failed `getItem` silently shows defaults), and no explanation of what a "good" value is.
4. **Save/reset feedback is a blocking `Alert`.** Three native alerts (`Saved`, `Reset`,
   `Done`) for what is a trivially reversible settings change. The redesigned app prefers
   inline, non-blocking confirmation and keeps destructive confirmation only where it matters.
5. **The numbers have no meaning to the user.** "Weekly = 4" is presented with zero context.
   The whole *point* of these multipliers — converting a per-occurrence budget amount into a
   monthly figure — is invisible. A user cannot tell if 4 is right or what changing it does.

This redesign is a **re-layout of the exact same three settings and the same save/reset
actions** — fully tokenized, with the four required states added, status made
color-independent, and one IA improvement (a live preview that makes the multipliers legible).
It stays recognizably the same screen: header + three multiplier fields + Save + Reset.

### What we deliberately preserve (functionality is not changed)

- The three fields — **Weekly**, **Biweekly**, **Monthly** — their icons, and their
  numeric-keyboard integer inputs.
- Load from / save to AsyncStorage key `frequencyMultipliers` (`{ weekly, biweekly, monthly }`).
- **Save Changes** (primary) and **Reset to Defaults** (secondary → `4 / 2 / 1`).
- `BackButton` fallback to `/(tabs)/settings`.

### One IA improvement (keeps it the same screen)

Add a **live conversion preview** under the fields: "A $50 weekly budget → **$200 / month**".
It is read-only, recomputes as the user edits, and is the single most useful thing we can add
— it turns three abstract integers into an understandable statement. No new data, no new
storage; it's pure presentation of the values already on screen.

---

## 2. Layout structure

```
GradientBackground variant="bgDarkPurple"
 └ SafeAreaView
    ├ Header row (fixed, OUTSIDE scroll)   BackButton · "Frequency" (h3) · [help icon 44]
    └ ScrollView (keyboardShouldPersistTaps="handled")
       ├ Hero explainer card               glassFloating — what multipliers do
       ├ Section label  "MULTIPLIERS"
       ├ FrequencyField × 3                glass rows (Weekly / Biweekly / Monthly)
       ├ Live preview card                 glass — "$50 weekly → $200/mo" etc.
       ├ Primary CTA   "Save changes"      gradients.primaryGradient
       └ Reset link    "Reset to defaults" ghost / text button
```

Header lives outside the ScrollView so the title + back affordance stay fixed — matching the
list-archetype convention used by calendar/dashboard/settings-tab.

---

## 3. Wireframes (all required states)

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Frequency                                     (?)     │  ← BackButton · h3 · help 44pt
│                                                            │
│  ┌──────────────────────────────────────────────────┐ ▲  │
│  │  ⟳  How multipliers work                          │ │  │  glassFloating hero
│  │                                                    │ │  │
│  │  These numbers convert a per-occurrence budget     │ │  │
│  │  into a monthly amount. A weekly item counts       │ │  │
│  │  4× a month; biweekly 2×; monthly 1×.              │ │  │
│  └──────────────────────────────────────────────────┘ ▼  │
│                                                            │
│  MULTIPLIERS                                               │  ← section label (caption/muted)
│  ┌──────────────────────────────────────────────────┐     │
│  │ [📅] Weekly                              [  4  ]   │     │  glass field row
│  │      counts 4× per month                          │     │
│  └──────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ [⇄] Biweekly                             [  2  ]   │     │
│  │      counts 2× per month                          │     │
│  └──────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ [🗓] Monthly                             [  1  ]   │     │
│  │      counts 1× per month                          │     │
│  └──────────────────────────────────────────────────┘     │
│                                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │  PREVIEW                                           │     │  glass preview card
│  │  A $50 weekly budget   →   $200 / month           │     │
│  │  A $50 biweekly budget →   $100 / month           │     │
│  │  A $50 monthly budget  →   $50 / month            │     │
│  └──────────────────────────────────────────────────┘     │
│                                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │   ✓  Save changes                                 │     │  primaryGradient CTA, 48pt
│  └──────────────────────────────────────────────────┘     │
│              ⟲  Reset to defaults                          │  ← ghost text button
└──────────────────────────────────────────────────────────┘
```

Inline save confirmation (replaces the `Saved` Alert): the CTA morphs to a
`colors.success`-tinted "✓ Saved" state for `animation.medium`, then returns to "Save
changes". No modal. Reset still uses a native confirm `Alert` (it discards edits — a
destructive-ish action worth one tap of friction), then the fields animate to `4 / 2 / 1` and
the CTA shows the same inline "✓ Saved".

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Shown while the AsyncStorage read is in flight (`loading` true, before first value resolves).
Header renders immediately (static). Body is skeletons that hold the exact final layout so
nothing jumps when values arrive.

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Frequency                                     (?)     │  ← header renders instantly
│                                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         │  Skeleton h=96 r=radius.xl  (hero)
│                                                            │
│  ▓▓▓▓▓▓▓▓                                                  │  Skeleton w=90 h=10 (label)
│  ┌──────────────────────────────────────────────────┐     │
│  │ (○)  ▓▓▓▓▓▓▓▓▓▓              [ ▓▓ ]                │     │  3× field skeletons
│  │      ▓▓▓▓▓▓▓▓▓▓▓▓▓                                 │     │  chip Skeleton 34 r=md,
│  └──────────────────────────────────────────────────┘     │  title 100×14, hint 130×10,
│  ┌──────────────────────────────────────────────────┐     │  input 60×36 r=md
│  │ (○)  ▓▓▓▓▓▓▓▓▓▓              [ ▓▓ ]                │     │
│  └──────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────┐     │
│  │ (○)  ▓▓▓▓▓▓▓▓▓▓              [ ▓▓ ]                │     │
│  └──────────────────────────────────────────────────┘     │
│                                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         │  Skeleton h=110 r=radius.lg (preview)
│                                                            │
│  (CTA + reset hidden until loaded — no action on skeletons)│
└──────────────────────────────────────────────────────────┘
```

Use `Skeleton` for each block; use `SkeletonStack` inside a field for the title+hint pair.
No `ActivityIndicator` — spinner is reserved for background refresh, and there is none here.
(In practice the AsyncStorage read is near-instant; if measured < ~150ms the implementer may
skip straight to populated. The skeleton is the correct treatment for the slow path and must
exist.)

### 3.3 Empty (first-run — nothing stored yet)

There is no "no data" empty for this screen the way a list has one: the settings always have
the **default** values `4 / 2 / 1`. So the "empty" state is really **first-run / never
saved**, and we treat it as *populated-with-defaults plus a first-run banner* rather than a
blank `EmptyState`. This preserves the screen's always-usable nature.

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Frequency                                     (?)     │
│  ┌──────────────────────────────────────────────────┐     │
│  │  ℹ  Using default multipliers                     │     │  info-tinted inline notice
│  │     4 / 2 / 1 haven't been customized yet. Adjust │     │  (icon + WORD + color)
│  │     them below, or keep the defaults.             │     │
│  └──────────────────────────────────────────────────┘     │
│  … fields prefilled with 4 / 2 / 1 (default state) …       │
└──────────────────────────────────────────────────────────┘
```

The notice appears only when `getItem('frequencyMultipliers')` returned `null`; it disappears
after the first successful save. Fields underneath are fully interactive.

### 3.4 Error (AsyncStorage read/write failed)

```
┌──────────────────────────────────────────────────────────┐
│  ‹   Frequency                                     (?)     │
│  ┌──────────────────────────────────────────────────┐     │
│  │            ⚠  (alert-circle-outline, error)       │     │  ErrorState (shared)
│  │        Couldn't load your settings                │     │
│  │   Your saved multipliers didn't load. You can     │     │
│  │   still edit — changes save when the store         │     │
│  │   recovers.                                        │     │
│  │              [   Retry   ]                          │     │  text button → reload()
│  └──────────────────────────────────────────────────┘     │
│  … fields shown with defaults so the screen stays usable … │
└──────────────────────────────────────────────────────────┘
```

Read error → inline `ErrorState` card above still-usable default fields (never blank the
screen). **Write** error (save failed) → the CTA flips to a `colors.error`-tinted
"⚠ Couldn't save — retry" for `animation.medium`, then returns to "Save changes"; this
replaces the current `Error` Alert. Both are icon + word + color (color-independent).

### 3.5 Overflow / edge cases

- **Long hint text** wraps to 2 lines max (`numberOfLines={2}`); the input chip is
  `flexShrink: 0` and never compresses.
- **Large / invalid input:** input is `keyboardType="numeric"`, stripped to digits, clamped to
  a sane `1–31` on blur (a "12" weekly is nonsense). If a field is blank or `0` on save it
  falls back to the default for that row (matches current `parseInt(x) || default`), and the
  field visibly repopulates so the user sees what was stored.
- **Dynamic Type:** fields grow vertically; the input chip keeps a 44pt min touch height.

---

## 4. Token mapping (no magic numbers)

Every current literal → its `design-system.ts` token. After this redesign the file must
contain **no** hex/rgba/px literals except the documented 12% semantic tint (`…1a` suffix).

| Old hardcoded value (frequency.tsx) | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| header `color: '#f8fafc'`, `fontSize: 20/'800'` | `colors.text` + `typography.h3` |
| `BackButton color="#c084fc"` | `colors.accent` (keep prop, pass token) |
| section label `'#64748b'`, `fontSize 11`, `letterSpacing 1.2` | `colors.textDark` + `typography.caption` + `letterSpacing: 1` |
| desc / hint `'#94a3b8'` / `'#64748b'` | `colors.textMuted` / `colors.textDark` |
| card `backgroundColor 'rgba(255,255,255,0.06)'` | `glassEffects.glass` (fields) / `glassEffects.glassFloating` (hero) |
| card `borderColor 'rgba(255,255,255,0.08)'` | `colors.borderGlass` |
| card `borderRadius: 18` | `radius.xl` (hero) / `radius.lg` (fields, preview) |
| fieldCard `'rgba(255,255,255,0.04)'` + `borderRadius 14` + `padding 14` | `glassEffects.glass` + `radius.lg` + `spacing.md` |
| fieldIcon `'rgba(192,132,252,0.1)'`, `36×36`, `radius 10` | `${colors.primary2}1a` (12% tint), `34×34`, `radius.md` |
| fieldIcon glyph `color '#c084fc'` | `colors.accent` |
| fieldLabel `'#f8fafc'`, `'700'`, `15` | `colors.text` + `typography.smallBold` |
| fieldHint `'#64748b'`, `12` | `colors.textMuted` + `typography.caption` |
| fieldInput fill `'rgba(255,255,255,0.06)'`, border `'0.08)'`, `radius 10`, text `'#f8fafc'` | `colors.glassMedium` + `colors.borderGlass` + `radius.md` + `colors.text`; focused border `colors.primary2` |
| fieldInput `placeholderTextColor '#475569'` | `colors.textDark` |
| saveBtn `backgroundColor '#7c3aed'`, `radius 14` | `gradients.primaryGradient` (LinearGradient fill) + `radius.lg` |
| saveBtnText `'#fff'`, `'800'`, `16` | `colors.text` + `typography.button` |
| resetBtn `'rgba(255,255,255,0.06)'` + border | ghost: transparent fill + `colors.borderGlass`, or plain text button in `colors.textMuted` |
| resetBtnText `'#94a3b8'`, `'700'`, `14` | `colors.textMuted` + `typography.smallBold` |
| container `padding: 16` | `spacing.lg` (scroll content padding) |
| header `marginBottom: 20`, gaps `10 / 8` | `spacing.xl` / `spacing.md` / `spacing.sm` |
| inline `Alert('Saved' / 'Error' / 'Done')` | inline CTA morph (success/error tinted) + preserve one confirm `Alert` on Reset |

Semantic tint recipe (matches the convention): chip/badge backgrounds = semantic color at
**12% opacity** written as the `${color}1a` suffix (e.g. `${colors.primary2}1a`,
`${colors.success}1a`, `${colors.error}1a`, `${colors.info}1a`).

---

## 5. Component specs

Two new tokenized components; everything else is shared (`GradientBackground`, `BackButton`,
`Skeleton`/`SkeletonStack`, `ErrorState`, `SafeAreaView`, `LinearGradient` for the CTA fill).

### 5.1 `FrequencyField` (see `components/settings-frequency-FrequencyField.json`)

A glass row: leading icon chip + label + hint on the left, a compact numeric input on the
right. This is the settings-archetype list row adapted for a **single-value numeric input**
(mirrors `SettingsRow` + `FormField` conventions rather than inventing a new pattern).

- Layout: `minHeight 56`, `glassEffects.glass`, `radius.lg`, padding `spacing.md`, row gap
  `spacing.md`, `marginBottom spacing.sm`.
- Icon chip: `34×34`, `radius.md`, fill `${colors.primary2}1a`, glyph `colors.accent` @ 18.
- Label `typography.smallBold` / `colors.text`; hint `typography.caption` / `colors.textMuted`,
  `numberOfLines={2}`.
- Input: `width 60`, `minHeight 44`, `radius.md`, fill `colors.glassMedium`, border
  `colors.borderGlass` (→ `colors.primary2` on focus), text centered `typography.bodyBold`
  `colors.text`, `keyboardType="numeric"`, `maxLength 2`, digits-only, clamp `1–31` on blur.
- States: `default`, `focused`, `filled`, `invalid` (border `colors.error` + a caption hint
  "1–31" in `colors.error`), `disabled` (skeleton path).

### 5.2 `FrequencyPreviewCard` (see `components/settings-frequency-FrequencyPreviewCard.json`)

Read-only `glassEffects.glass` card, `radius.lg`, showing three "$50 {freq} → ${50×n}/month"
lines that recompute live from the current field values. `PREVIEW` caption label
(`colors.textDark`). Each line: base amount + freq word in `colors.textMuted`, arrow glyph,
and the monthly result in `typography.smallBold` `colors.text`. Non-interactive
(`accessibilityElementsHidden` for the decorative arrows; the full line has one SR label).

### 5.3 Header (reused pattern, not a new component)

Fixed row outside the ScrollView: `<BackButton fallback="/(tabs)/settings" color={colors.accent}
size={20} />` · `Text` "Frequency" `typography.h3` `colors.text` · trailing 44×44 help button
(`help-circle-outline`, `colors.textMuted`) that opens the same hero explainer copy in an
`Alert` or scrolls to the hero. Trailing help replaces the old empty `{ width: 40 }` spacer so
the title stays centered and the slot is useful.

### 5.4 Save CTA (reused pattern)

`LinearGradient` `gradients.primaryGradient`, `radius.lg`, `minHeight 48`, centered
`checkmark-circle-outline` + "Save changes" (`typography.button`, `colors.text`). Inline result
morph: success → fill swaps to `${colors.success}1a` over a solid `colors.success` border +
"✓ Saved"; write-error → `${colors.error}1a` + "⚠ Couldn't save — retry". Reverts after
`animation.medium`.

---

## 6. Interactions

- **Edit field:** tap → numeric keyboard, `keyboardShouldPersistTaps="handled"` so tapping
  another field or Save doesn't require dismissing first. Focused field shows
  `colors.primary2` border.
- **Live preview:** every keystroke recomputes the three preview lines (`50 × n`). No debounce
  needed (trivial math).
- **Save changes:** writes `{ weekly, biweekly, monthly }` to AsyncStorage; on success CTA
  shows inline "✓ Saved" (no Alert); on failure shows inline "⚠ Couldn't save — retry".
- **Reset to defaults:** confirm `Alert` (kept — it discards unsaved edits) → writes `4/2/1`,
  animates fields to defaults (`animation.medium`), CTA shows "✓ Saved".
- **Back:** `BackButton` → `/(tabs)/settings`.
- **Transitions:** field focus border, CTA morph, and reset repopulate all use
  `animation.medium`; honor reduced motion (§7).

---

## 7. Accessibility

- **Touch targets:** every field row ≥ 56pt; the numeric input ≥ 44pt tall; help button and
  CTA ≥ 44pt; Reset text button padded to ≥ 44pt. BackButton is the shared 40→44 target.
- **Color independence:** all status is **icon + word + color**:
  - first-run notice = `information-circle-outline` + "Using default multipliers" + `colors.info`;
  - read error = `alert-circle-outline` + "Couldn't load your settings" + `colors.error`;
  - save success = `checkmark-circle-outline` + "Saved" + `colors.success`;
  - save error = `alert-circle-outline` + "Couldn't save — retry" + `colors.error`;
  - invalid field = `alert-circle-outline` + "1–31" caption + `colors.error` border.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` on dark glass (≥ 4.5:1). The
  `colors.textDark` section/preview labels are large-enough/secondary; verify the preview
  monthly result stays on `colors.text` (primary) for the load-bearing number.
- **Screen-reader order & labels:** header → hero explainer → section label → each field
  (`"Weekly, counts 4 times per month, edit box, 4"`) → preview (one label per line:
  `"A 50 dollar weekly budget equals 200 dollars per month"`, arrows hidden) → Save
  (`"Save changes, button"`) → Reset (`"Reset to defaults, button"`). The CTA announces its
  result state change ("Saved" / "Couldn't save, retry").
- **Reduced motion:** field-focus, CTA morph, and reset-repopulate transitions swap to instant
  state changes under `prefers-reduced-motion`; the `Skeleton` pulse already respects the
  platform setting via its own animation and is acceptable, but under reduce-motion prefer a
  static dimmed block.

---

## 8. Developer notes

- Wrap the whole screen in `<GradientBackground variant="bgDarkPurple">` → `SafeAreaView` →
  fixed header → `ScrollView`. Do **not** re-implement the gradient.
- Drive states off two booleans + the stored value: `loading` (AsyncStorage read in flight →
  skeleton), `readError` (getItem threw → ErrorState above default fields),
  `isFirstRun` (getItem returned `null` → info notice). Keep fields always rendered/usable in
  every non-loading state so the screen is never blank.
- Preserve the `parseInt(x) || default` fallback for blank/zero on save; after save, set state
  from the *stored* object so any coercion is reflected back into the fields.
- Reuse `components/Skeleton.tsx` (`Skeleton`, `SkeletonStack`) and
  `components/ErrorState.tsx`; do not build local versions.
- Keep the AsyncStorage key and shape (`frequencyMultipliers` → `{ weekly, biweekly, monthly }`)
  byte-for-byte — other screens read it.
- The `$50` preview base is a fixed illustrative constant; document it as such (not user data).

---

## 9. Handoff checklist

- [x] All states designed (default, loading skeleton, first-run "empty", error, overflow)
- [x] `<GradientBackground variant="bgDarkPurple">` replaces the raw LinearGradient
- [x] One elevated `glassFloating` headline (hero explainer); other cards flat `glass`
- [x] Every old hardcoded color/gradient/spacing/radius/font mapped to a token
- [x] Status is icon + word + color everywhere (first-run, read error, save success/error, invalid)
- [x] Loading = `Skeleton` placeholders holding layout, not an `ActivityIndicator`
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion
- [x] Component specs written (`components/settings-frequency-*.json`)
- [x] Functionality preserved (3 multipliers, AsyncStorage key/shape, Save, Reset, back route)
- [x] IA improvement (live conversion preview) is additive and read-only
```
