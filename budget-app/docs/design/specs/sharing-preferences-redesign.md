# Sharing Preferences Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route:** `sharing-preferences` · **File:** `budget-app/app/sharing-preferences.tsx`
**Archetype:** Settings (a **pushed detail** child of the Settings tab — keeps `BackButton`)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Sibling references:** `docs/design/specs/settings-tab-redesign.md`, `docs/design/specs/calendar-redesign.md`,
`app/(tabs)/dashboard.tsx`, `app/(tabs)/calendar.tsx`

---

## 1. Why this redesign exists

The current screen is a **bespoke, off-theme** implementation. It is the same family of
control as the Settings tab (grouped list of toggle rows), yet it looks like a different
app because it hardcodes everything the design system already defines:

1. **Wrong background.** It wraps in `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>`
   — a one-off gradient that appears nowhere else. Every redesigned screen uses
   `<GradientBackground variant="bgDarkPurple">`.
2. **Hardcoded colors everywhere.** `#c084fc`, `#a855f7`, `#f8fafc`, `#64748b`,
   `rgba(255,255,255,0.06/0.08)`, `rgba(192,132,252,0.1)` — none reference tokens. The
   subtitle gray `#64748b` isn't even a token value (`colors.textMuted` is `#94a3b8`), so
   the muted text is a different gray than the rest of the app.
3. **Ad-hoc surfaces & radii.** Cards are inline `rgba(255,255,255,0.06)` + `borderRadius:18`
   instead of `glassEffects.glass` + `radius.lg`. Magic paddings (`14`, `10`, `16`) instead
   of the `spacing` scale.
4. **A parallel toggle row.** `ToggleRow` re-implements what the Settings archetype already
   standardized as `SettingsRow` (switch variant) — same icon-chip + title/subtitle + switch,
   but with different metrics (34px chip, 15/700 title, `#64748b` subtitle). Two components,
   one job.
5. **No non-happy states.** There is no loading skeleton (prefs are fetched async from
   `/auth/sharing-preferences` + `/auth/households/me`), no error state (the fetch can fail
   and today just silently keeps defaults), and no "no partner yet" empty state — even though
   sharing preferences are **meaningless without a household/partner**.
6. **Native `Alert` for save feedback.** Breaks the visual language; the rest of the app
   confirms inline / optimistically.

This redesign keeps the screen **recognizably the same** — a titled screen with a quick
"share everything" master control and grouped sharing toggles — but re-skins it onto the
design system and adds the missing states. It also sharpens the IA around one insight:
**the whole screen only matters when you have a partner**, so partner context moves to the top.

---

## 2. Information architecture (what changed and why)

Preserved 1:1 (functionality is unchanged):

- The seven boolean prefs (`shareBudgets`, `shareTransactions`, `shareDebts`, `shareSavings`,
  `sharePriorities`, `shareNotes`, `notifyPartner`) and their default-`true` values.
- The **master "toggle all"** control (`allOn` / `toggleAll`).
- The two groups: **WHAT TO SHARE** (six data toggles) and **ACTIVITY** (notify partner).
- Save flow (`savePrefs` → POST `/auth/sharing-preferences`, write-through to AsyncStorage,
  then navigate back).

IA improvements (each earns its place):

1. **Partner context header card** — a slim glass card under the header naming *who* you're
   sharing with (partner name/initial from `householdMembers`). Sharing prefs are abstract
   ("share budgets") until you see the face they're shared with. When there's no partner,
   this becomes the **empty state** (see §7) instead of showing toggles that do nothing.
2. **Master control becomes a first-class summary row**, not a floating custom pill. It reads
   the derived state ("Sharing everything" / "Custom sharing") and offers one tap to flip all.
   Same behavior, now consistent with the archetype's row vocabulary.
3. **Each data toggle gains a live "Shared / Private" status word**, so the on/off state is
   legible without reading the switch position — and is color-independent (see §8).
4. **"Notes & Categories" stays grouped with WHAT TO SHARE** but the ACTIVITY group is kept
   separate — notifying a partner is a different concern (push, not data visibility). Good IA,
   preserved.
5. **Save moves to a sticky footer CTA** (gradient button, same as today) so it's always
   reachable as the list grows; and confirmation becomes an **inline toast**, not `Alert`.

---

## 3. The screen at a glance

One vertical scroll of grouped glass cards under a slim titled header **with a BackButton**
(this is a pushed screen, unlike the root Settings tab), on the shared `bgDarkPurple`
gradient, with a **sticky Save footer**.

| Element | Choice | Token / component |
|---|---|---|
| Background | shared gradient | `<GradientBackground variant="bgDarkPurple">` |
| Header | BackButton + centered title + spacer (pushed-screen pattern) | `BackButton` + `typography.bodyBold` `colors.text` |
| Partner card | slim glass card, avatar + name + household | `glassEffects.glass`, `radius.lg` |
| Master row | summary row + "All on / Turn all on" action | `SharingMasterRow` (§5.1) |
| Section label | uppercase caption | `typography.caption` `colors.textMuted`, `letterSpacing` |
| Toggle row | icon chip + title/subtitle + status word + switch | `SharingToggleRow` (§5.2) |
| Save | sticky gradient CTA | `gradients.primaryGradient`, `radius.lg` |

---

## 4. Wireframes (all states)

### 4.1 Default / populated

```
┌──────────────────────────────────────────────────────────┐
│  ‹     Sharing Preferences                          ▢     │  ← BackButton + title + spacer
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ (◑A)  Sharing with Alex                           │    │  ← partner context card
│  │       The Brown Household · 2 members             │    │     avatar + name + household
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [◉]  Sharing everything            [ Turn off ]   │    │  ← MASTER row (summary + action)
│  │      Alex sees all shared categories              │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  WHAT TO SHARE                                             │  ← section label (caption/muted)
│  ┌──────────────────────────────────────────────────┐    │
│  │ [▢] Budgets            ● Shared         (●──)      │    │  icon · title · status · switch
│  │     Allow partner to view shared budgets          │    │
│  │  ─────────────────────────────────────────────    │    │  divider (colors.borderLight)
│  │ [⇄] Transactions       ● Shared         (●──)      │    │
│  │     Show spending & income activity               │    │
│  │  ─────────────────────────────────────────────    │    │
│  │ [▤] Debts              ○ Private         (──○)      │   │  OFF: hollow dot + "Private"
│  │     Loans, credit cards, payoff progress          │    │
│  │  ─────────────────────────────────────────────    │    │
│  │ [↗] Savings            ● Shared         (●──)      │    │
│  │  ─────────────────────────────────────────────    │    │
│  │ [⚑] Priorities         ● Shared         (●──)      │    │
│  │  ─────────────────────────────────────────────    │    │
│  │ [◈] Notes & Categories ● Shared         (●──)      │    │
│  │     Include labels and notes with shared items    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
│  ACTIVITY                                                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │ [🔔] Notify Partner    ● On             (●──)      │    │
│  │     When I update budgets, debts, savings…        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                            │
├────────────────────────────────────────────────────────  │
│  ┌──────────────────────────────────────────────────┐    │  ← STICKY footer (blur/solid)
│  │            Save Preferences            ✓          │    │     gradients.primaryGradient
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Header title is static and renders immediately. Everything data-dependent (partner name,
resolved prefs) is skeletoned. Footer Save is disabled during load.

```
┌──────────────────────────────────────────────────────────┐
│  ‹     Sharing Preferences                          ▢     │  ← real (static)
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │ (◯)   ▭▭▭▭▭▭▭▭                                     │    │  Skeleton 40 circle
│  │       ▭▭▭▭▭▭▭▭▭▭▭▭                                 │    │  + 2 lines (60% / 40%)
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │ ▭▭  ▭▭▭▭▭▭▭▭▭▭▭▭                        ▭▭▭▭      │    │  master row skeleton
│  └──────────────────────────────────────────────────┘    │
│  ▭▭▭▭▭▭▭  (WHAT TO SHARE placeholder)                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │ ▢  ▭▭▭▭▭▭▭▭▭▭▭                            (▭▭)     │    │  6 × skeleton toggle rows:
│  │    ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭                                │    │  chip + 2 lines + switch pill
│  │  ─────────────────────────────────────────────    │    │
│  │ ▢  ▭▭▭▭▭▭▭▭                               (▭▭)     │    │
│  │    … (repeat, last line at 60%)                    │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

Skeleton recipe (mirrors dashboard's `skelRow`):
- Partner card: `Skeleton width={40} height={40} borderRadius={radius.full}` + two lines
  (`height 12 width 60%`, `height 10 width 40%`).
- Each toggle row: `Skeleton width={34} height={34} borderRadius={radius.md}` (icon chip) +
  `{ flex:1 }` two lines (`60%` / `40%`) + `Skeleton width={44} height={26} borderRadius={radius.full}`
  (switch pill). Render **6** in the WHAT-TO-SHARE card and **1** in ACTIVITY.

### 4.3 Empty (no partner / solo household)

Sharing preferences are inert without someone to share with. Instead of a wall of toggles
that change nothing, show a single centered glass card that routes the user to invite a
partner. This mirrors the calendar "empty month" and dashboard empty patterns.

```
┌──────────────────────────────────────────────────────────┐
│  ‹     Sharing Preferences                          ▢     │
│                                                            │
│                                                            │
│                    ┌──────────────┐                        │
│                    │   👥 (icon)   │                        │  people-outline, colors.textDark
│                    └──────────────┘                        │
│                                                            │
│              No partner to share with yet                  │  typography.bodyBold colors.text
│      Invite your partner to a household and you can        │  typography.small colors.textMuted
│      choose exactly what they see here.                    │
│                                                            │
│              ┌────────────────────────────┐                │
│              │      Invite a partner       │                │  primaryGradient CTA →
│              └────────────────────────────┘                │  /household-setup
│                                                            │
└──────────────────────────────────────────────────────────┘
```

Detection: `householdMembers.length < 2` (no partner). No sticky Save footer in this state.

### 4.4 Error (prefs failed to load)

The current code silently swallows the fetch error and keeps `defaultPrefs` — the user can't
tell whether "everything shared" is real or a fallback. Make failure explicit and recoverable,
inline, without blanking the header.

```
┌──────────────────────────────────────────────────────────┐
│  ‹     Sharing Preferences                          ▢     │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │            ⚠ (alert-circle-outline)               │    │  colors.error
│  │      Couldn't load your sharing settings           │    │  typography.bodyBold colors.text
│  │   We didn't want to show the wrong toggles.        │    │  typography.small colors.textMuted
│  │                                                    │    │
│  │              [ ↻  Retry ]                          │    │  text button, colors.primary2
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

Note: distinguish **load** error (above — block the toggles, offer Retry) from **save** error
(inline toast at the footer: "Couldn't save — tap to retry", `colors.error`), which keeps the
edited toggles on screen so the user's work isn't lost.

---

## 5. Component specifications

Reuse the Settings archetype's `SettingsRow` where possible. Because sharing rows add a
**status word** ("Shared / Private") and the master row adds an inline action button, this spec
defines two thin wrappers documented as `sharing-preferences-*` component JSONs. They MUST be
visually identical to `SettingsRow` (same icon-chip radius/size, same title/subtitle typography,
same switch styling) — they are the same row with one extra trailing label.

### 5.1 `SharingMasterRow` — the "share everything" summary + toggle-all

The redesigned replacement for the bespoke `quickToggle`.

| Prop | Type | Req | Notes |
|---|---|---|---|
| `allOn` | `boolean` | yes | Derived `Object.values(prefs).every(Boolean)` |
| `partnerName` | `string` | no | Used in subtitle: "{partner} sees all shared categories" |
| `onToggleAll` | `(on: boolean) => void` | yes | Calls existing `toggleAll(!allOn)` |

- Surface: `glassEffects.glass`, `radius.lg`, `padding: spacing.lg`, `marginBottom: spacing.md`.
- Leading icon chip 34×34 `radius.md`, fill `` `${colors.primary2}1a` ``, icon
  `people-circle-outline` (all-on) / `options-outline` (custom), `colors.primary2`, size 18.
- Title `typography.smallBold` `colors.text`: `allOn ? 'Sharing everything' : 'Custom sharing'`.
- Subtitle `typography.caption` `colors.textMuted`:
  `allOn ? '{partner} sees all shared categories' : 'You've hidden some categories'`.
- Trailing **action button** (not a switch — it's a bulk action): pill,
  `paddingHorizontal: spacing.md`, `paddingVertical: spacing.sm`, `radius.md`,
  min 44pt tall via `hitSlop`. Two variants:
  - all-on → label **"Turn off"**, fill `colors.glassMedium`, text `colors.textMuted`.
  - not all-on → label **"Turn all on"**, fill `` `${colors.primary2}26` `` border
    `` `${colors.primary2}40` ``, text `colors.primary2`.
- States: `default`, `pressed` (activeOpacity 0.7), `allOn`, `custom`, `loading` (skeleton).

### 5.2 `SharingToggleRow` — a single data/activity toggle

Wrapper over `SettingsRow` (switch variant) that adds the status word. Renders each of the 7 prefs.

| Prop | Type | Req | Notes |
|---|---|---|---|
| `icon` | `keyof Ionicons.glyphMap` | yes | e.g. `wallet-outline`, `swap-horizontal-outline` |
| `title` | `string` | yes | e.g. "Budgets" |
| `subtitle` | `string` | no | e.g. "Allow partner to view shared budgets" |
| `value` | `boolean` | yes | current pref |
| `onChange` | `(v: boolean) => void` | yes | existing `setPrefs` updater |
| `onLabel` | `string` | no | status word when on — default `"Shared"` (ACTIVITY row uses `"On"`) |
| `offLabel` | `string` | no | status word when off — default `"Private"` (ACTIVITY uses `"Off"`) |

- Layout identical to `SettingsRow`: icon chip 34×34 `radius.md` fill `` `${colors.primary2}1a` ``
  icon `colors.primary2` size 18; left gap `spacing.md`; `minHeight: 48`;
  `paddingVertical: spacing.md`.
- Title `typography.smallBold` `colors.text`, `numberOfLines={1}`.
- Subtitle `typography.caption` `colors.textMuted`, `numberOfLines={1}`.
- **Status word** (trailing, before the switch, `flexShrink: 0`, `spacing.sm` gap):
  - on → glyph `●` + `onLabel` in `colors.success`, `typography.caption`.
  - off → glyph `○` (hollow) + `offLabel` in `colors.textMuted`, `typography.caption`.
- Switch: `trackColor={{ true: colors.primary2, false: colors.glassMedium }}`,
  `thumbColor={colors.text}` (matches `SettingsRow.switchStyling`).
- Rows within a card are separated by a hairline divider (`colors.borderLight`, `height: 1`),
  not gaps — matches the settings grouped-card look; first/last rows have no outer divider.
- States: `default`, `pressed`, `switchOn`, `switchOff`, `loading`.

### 5.3 `SharingPartnerCard` — partner context (top card)

| Prop | Type | Req | Notes |
|---|---|---|---|
| `partnerName` | `string` | yes | first name of the partner from `householdMembers` |
| `partnerInitial` | `string` | yes | uppercased first letter |
| `householdName` | `string` | no | e.g. "The Brown Household" |
| `memberCount` | `number` | no | e.g. 2 → "· 2 members" |
| `loading` | `boolean` | no | renders skeleton variant |

- Surface `glassEffects.glass`, `radius.lg`, `padding: spacing.lg`, row layout, `gap: spacing.md`.
- Avatar 40×40 `radius.full`, fill `colors.info` (partner palette per dashboard: you =
  `colors.primary`, partner = `colors.info`), initial `typography.smallBold` `colors.text`.
- Title `typography.smallBold` `colors.text`: "Sharing with {partnerName}".
- Subtitle `typography.caption` `colors.textMuted`: "{householdName} · {memberCount} members".
- Loading: `Skeleton` circle 40 + two lines.

### 5.4 Save footer CTA

- Sticky at the bottom inside the safe area, above the home indicator. Background: subtle
  `colors.surface` at ~92% or a top hairline (`colors.borderLight`) so it separates from the
  scrolling list.
- Button: `LinearGradient` `gradients.primaryGradient` (replaces hardcoded
  `['#a855f7','#7c3aed']`), `radius.lg`, `paddingVertical: spacing.lg`, centered row with
  `typography.button` `colors.text` label + `checkmark` icon size 18 `colors.text`, `gap: spacing.sm`.
- States: `default`, `saving` (label → "Saving…", disabled, `opacity 0.7`, optional inline
  `ActivityIndicator` `colors.text`), `disabled` (no changes / loading / empty state → hidden),
  `error` (see §4.4 save-error toast).
- **Optimistic save option (recommended):** since prefs write-through to AsyncStorage anyway,
  the row switches can update instantly and the footer can show a transient "Saved ✓" toast
  (`colors.success`) instead of the native `Alert` + immediate `router.back()`. Preserve the
  existing back-navigation-on-success if the team prefers the current flow.

---

## 6. Token mapping (every hardcoded value → design-system token)

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `topBar` `paddingHorizontal:16, paddingTop:8, paddingBottom:12` | `spacing.lg` / `spacing.sm` / `spacing.md` |
| `headerText` `#f8fafc` `fontSize:18 weight:800` | `typography.bodyBold` `colors.text` |
| BackButton `color="#c084fc"` | `color={colors.primary2}` |
| `quickToggle` `rgba(255,255,255,0.06)` + `borderRadius:14` + border `rgba(255,255,255,0.08)` | `glassEffects.glass` + `radius.lg` + `colors.borderGlass` |
| `quickToggle` `padding:14`, `marginHorizontal:16`, `marginBottom:12` | `spacing.lg` / `spacing.lg` / `spacing.md` |
| `quickLabel` `#f8fafc` `fontSize:15 weight:700` | `typography.smallBold` `colors.text` |
| `quickSub` `#64748b` `fontSize:12` | `typography.caption` `colors.textMuted` |
| `quickBtn` `rgba(255,255,255,0.08)` + `borderRadius:10` | `colors.glassMedium` + `radius.md` |
| `quickBtnActive` `rgba(168,85,247,0.2)` / border `rgba(168,85,247,0.3)` | `` `${colors.primary2}26` `` / `` `${colors.primary2}40` `` |
| `quickBtnText` `#94a3b8` | `colors.textMuted` (already the token — now literal) |
| `quickBtnTextActive` `#c084fc` | `colors.primary2` |
| `card` `rgba(255,255,255,0.06)` + `borderRadius:18` + border `rgba(255,255,255,0.08)` | `glassEffects.glass` + `radius.lg` + `colors.borderGlass` |
| `card` `padding:14`, `marginHorizontal:16`, `marginBottom:12` | `spacing.lg` / `spacing.lg` / `spacing.md` |
| `sectionLabel` `#64748b` `fontSize:11 letterSpacing:1.2 weight:700` | `typography.caption` `colors.textMuted` + `letterSpacing:1.2` (kept) |
| `row` `paddingVertical:10` | `spacing.md` (`12`) via `minHeight:48` row |
| `rowLeft` `gap:12` | `spacing.md` |
| `rowIcon` `34×34` `borderRadius:10` `rgba(192,132,252,0.1)` | `34×34` `radius.md` `` `${colors.primary2}1a` `` |
| icon `color="#c084fc"` size `16` | `colors.primary2` size `18` (match SettingsRow) |
| `rowTitle` `#f8fafc` `fontSize:15 weight:700` | `typography.smallBold` `colors.text` |
| `rowSubtitle` `#64748b` `fontSize:12` | `typography.caption` `colors.textMuted` |
| Switch `thumbColor="#fff"` | `colors.text` |
| Switch `trackColor {true:'#a855f7', false:'rgba(255,255,255,0.15)'}` | `{ true: colors.primary2, false: colors.glassMedium }` |
| `saveBtn` `marginTop:8, marginHorizontal:16` | `spacing.sm` / `spacing.lg` |
| `saveBtnInner` gradient `['#a855f7','#7c3aed']` | `gradients.primaryGradient` |
| `saveBtnInner` `borderRadius:14 paddingVertical:14 gap:8` | `radius.lg` / `spacing.lg` / `spacing.sm` |
| `saveText` `#fff` `fontSize:16 weight:800` | `typography.button` `colors.text` |
| save icon `checkmark` `#fff` | `colors.text` |
| status "Shared" (new) | glyph `●` + `colors.success` |
| status "Private" (new) | glyph `○` + `colors.textMuted` |
| load-error / save-error accents (new) | `colors.error` |
| dividers between rows (new) | `colors.borderLight` |
| native `Alert.alert('Saved'…)` | inline toast (`colors.success`) / kept `router.back()` |
| native `Alert.alert('Error'…)` | inline save-error toast (`colors.error`) |
| unused `styles.backBtn` (dead style) | delete (BackButton owns its own style) |

No magic numbers remain: every color from `colors`, gradient from `gradients`, radius from
`radius`, space from `spacing`, and text style from `typography`.

---

## 7. States summary

| State | Detection | Treatment |
|---|---|---|
| **Default / populated** | partner exists, prefs loaded | §4.1 — partner card, master row, two grouped cards, sticky Save |
| **Loading** | initial fetch in flight, not yet loaded once | §4.2 skeleton via `components/Skeleton.tsx`; header static; Save disabled |
| **Empty (no partner)** | `householdMembers.length < 2` | §4.3 centered card + "Invite a partner" CTA → `/household-setup`; no Save footer |
| **Load error** | prefs GET failed | §4.4 inline error card + Retry; do **not** silently show default toggles |
| **Save error** | prefs POST failed | inline footer toast (`colors.error`, "tap to retry"); edited toggles retained |
| **Save success** | POST ok | inline "Saved ✓" toast (`colors.success`) then `router.back()` (keep existing nav) |
| **Overflow — long subtitle** | e.g. long custom category note | subtitle `numberOfLines={1}` + ellipsis; status word + switch `flexShrink:0` never clip |
| **Dynamic Type** | large font setting | rows use `minHeight` (not fixed height) so title/subtitle reflow |

---

## 8. Accessibility

- **Touch targets:** every toggle row ≥ 48pt tall (min 44pt); the switch's tappable area is
  the **whole row**, not just the thumb. Master-row action button and BackButton reach 44pt via
  `hitSlop`. Retry / CTA buttons ≥ 44pt.
- **Color-independent status (icon + word + color):** on/off is never color-only. Each row shows
  a **glyph** (`●` filled / `○` hollow) **+ a word** ("Shared"/"Private", "On"/"Off") **+ the
  switch position** — three redundant cues. The master row shows the literal words "Sharing
  everything" / "Custom sharing". Error/empty states pair the `alert-circle` / `people` **icon**
  with a text headline.
- **Contrast:** all text uses `colors.text` (`#f8fafc`) or `colors.textMuted` (`#94a3b8`) over
  dark glass — both clear WCAG AA (4.5:1) on the `bgDarkPurple` surfaces. The old subtitle
  `#64748b` (which failed against the glass in places) is retired.
- **Screen-reader order:** header title → partner card ("Sharing with {name}, {household}") →
  master row ("Sharing everything, button, turn off") → WHAT TO SHARE label → each toggle
  ("Budgets, allow partner to view shared budgets, Shared, switch") → ACTIVITY label → notify
  row → Save button. Switches expose `accessibilityRole="switch"` +
  `accessibilityState={{ checked: value }}` and announce on change.
- **Save button** label "Save Preferences"; while saving, announce "Saving" and set
  `accessibilityState={{ disabled: true }}`.
- **Reduced motion:** switch flips and toast entrance use `animation.fast`; under
  `AccessibilityInfo.isReduceMotionEnabled`, swap the toast slide/fade for an instant show and
  skip the skeleton pulse's amplitude (Skeleton already respects a gentle loop — acceptable, but
  gate any added row-highlight animation).

---

## 9. Developer notes

- **Reuse, don't reimplement.** Background = `<GradientBackground variant="bgDarkPurple">`.
  Loading = `components/Skeleton.tsx`. Header back control = `BackButton` (this is a **pushed**
  screen — unlike the root Settings tab, which correctly has no BackButton). The toggle row is
  the Settings archetype's `SettingsRow` (switch variant) plus a status word — keep them
  visually identical.
- **Master state derivation is unchanged:** `allOn = Object.values(prefs).every(Boolean)`;
  `toggleAll(on)` sets all seven booleans. Preserve exactly.
- **Partner resolution** already exists in `dashboard.tsx` (`householdMembers`,
  `/auth/households/me`). Reuse the same shape: `member.full_name` → first name; partner =
  the member whose `user_id !== currentUser.id`. If `members < 2`, render the empty state.
- **Keep prefs as separate booleans end-to-end** (don't collapse into a bitmask) — the API
  payload maps 1:1 (`share_budgets`, …, `notify_partner`).
- **Error handling:** the current `load()` swallows the GET error and keeps `defaultPrefs`.
  Add a `loadError` flag so §4.4 can render; on Retry, re-run `load()`.
- **Replace `Alert`** with the inline toast pattern; if the team wants minimal change, keeping
  `Alert` is acceptable but off-theme — flagged, not required.
- **Icons stay the same** (`wallet-outline`, `swap-horizontal-outline`, `card-outline`,
  `trending-up-outline`, `flag-outline`, `pricetag-outline`, `notifications-outline`) — only
  their color (`colors.primary2`) and size (18) change.
- **Delete the dead `styles.backBtn`** — it's unused (BackButton owns its style).

---

## 10. Handoff checklist

- [x] Bespoke gradient replaced with `<GradientBackground variant="bgDarkPurple">`
- [x] Every hardcoded color/gradient/radius/spacing/font mapped to a design-system token (§6)
- [x] Off-token subtitle gray `#64748b` retired in favor of `colors.textMuted`
- [x] Toggle row unified with the Settings archetype `SettingsRow` (switch variant + status word)
- [x] Master "share everything" control re-expressed as a tokenized summary row
- [x] All states designed: default, loading (Skeleton), empty (no partner), load error, save error
- [x] Color-independent on/off status (glyph + word + switch), 44pt targets, SR order, reduced motion
- [x] Pushed-screen header (keeps BackButton) justified against the archetype (vs root Settings tab)
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, SettingsRow)
- [x] Component specs written (`docs/design/components/sharing-preferences-*.json`)
