# Settings Tab Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke styling in `budget-app/app/(tabs)/settings.tsx`
**Archetype:** settings (grouped rows on a main tab) — must read as the same app as
`dashboard.tsx` and `calendar.tsx`.

---

## 1. Why this redesign exists

The Settings screen works, but — exactly like the pre-redesign calendar and dashboard — it
**fights the design system** instead of using it. It reads as a slightly different app from
the two screens already redesigned in the target theme.

Concrete problems in the current file:

1. **Wrong background.** It uses a bespoke `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>`
   — a purple that is subtly *not* `gradients.bgDarkPurple` (`['#0f172a','#1a0a40','#0f172a']`).
   Side by side with the dashboard, the settings tab looks off-hue.
2. **Hardcoded everything.** Colors (`'#c084fc'`, `'#f8fafc'`, `'#64748b'`, `'#f87171'`,
   `'#7c3aed'`, `'#a855f7'`, `'#ef4444'`), surfaces (`'rgba(255,255,255,0.06)'`), borders
   (`'rgba(255,255,255,0.08)'`), radii (`20 / 18 / 12 / 10`), paddings (`16 / 14 / 12 / 11 / 8`),
   and font sizes/weights are all inline literals. No token is imported.
3. **No non-default states.** The screen renders instantly from `useState('')` defaults, so on
   a cold/slow network the user sees a **blank profile** (`'Your Name'`, empty email, `'A'`
   avatar) and rows that flash from placeholder → real. There is **no loading skeleton, no
   error state**, and no first-time/empty household treatment.
4. **Status conveyed largely by color.** The linked-accounts warning is a red badge + red icon
   tint; the pending-invites accent is a bare blue. Neither pairs the color with an icon+word,
   so it fails color-independence.
5. **Header inconsistent with the archetype.** The current header is a custom icon-chip + bold
   title. The redesigned main-tab screens use a slim titled header row on `bgDarkPurple`
   (dashboard: greeting; settings: a title). We standardize on that.

This redesign is a **re-layout of the exact same data and navigation** — every row still goes
where it went — fully tokenized, with the four required states added, and status made
color-independent. It stays recognizably the same Settings screen.

### What we deliberately preserve (functionality is not changed)

- Every row and its destination: Household, Pending Invites, Sharing Preferences, Linked
  Accounts, Budget Settings, Categories, Category Rules, Advisor Memory, Bills & Recurring,
  Properties, Default Currency (opens `CurrencyPicker`), Push Notifications (toggle → API),
  Email Summaries (coming-soon alert), Theme (toggle), App Lock (toggle), Log Out (destructive
  confirm), and the version footer.
- The profile card with avatar / name / email / plan badge / edit affordance.
- The `useFocusEffect` reload of household + sharing prefs + linked-account status.
- The section grouping (Household / Financial / Preferences / Security) — it's sound IA.

### One small IA improvement (keeps it the same screen)

The current "Financial" group crams **seven** rows (Linked Accounts, Budget Settings,
Categories, Category Rules, Advisor Memory, Bills & Recurring, Properties) into one card,
mixing *connections* (Linked Accounts), *budgeting config* (Budget/Categories/Rules), *AI*
(Advisor Memory), and *asset tracking* (Bills, Properties). We split the single overloaded
group into three tighter, scannable groups — **Accounts & Sync**, **Budgeting**, and
**Money & Assets** — plus keep **Household**, **Preferences**, **Security**. Same rows, same
routes, just grouped by intent so the eye finds things faster. This is the only structural
change; if the frontend prefers to keep Financial as one group for v1, the row specs are
identical either way.

---

## 2. The screen at a glance — header + grouped list on `bgDarkPurple`

The whole screen is one vertical scroll of **grouped setting cards** under a slim titled
header, on the shared gradient. The visual vocabulary matches the reference screens exactly:

| Element | Treatment | Token |
|---|---|---|
| Background | shared gradient | `<GradientBackground variant="bgDarkPurple">` |
| Header | slim title row inside safe area (like dashboard's greeting row) | `typography.bodyBold` title, `colors.text` |
| Group card | flat glass card (never floating — no tier competes here) | `glassEffects.glass` / `commonStyles.card`, `radius.lg` |
| Group label | uppercase caption above each card | `typography.caption`, `colors.textMuted` |
| Row | icon chip + title/subtitle + value/chevron, ≥44pt tall | see §5 SettingsRow |
| Profile card | the one visually richer card at the top | `glassEffects.glass`, avatar on `colors.primary` |

Nothing floats — a settings list has no single hero, so (unlike the dashboard headline) we do
**not** use `glassFloating`. All cards are flat `glass`, and hierarchy comes from the group
labels + spacing, not elevation.

---

## 3. Wireframes — all required states

### 3.1 Default / populated

iPhone 15 Pro (390×844). Screen padding `spacing.lg` (16) horizontal; group label →
`spacing.sm` below → card; `spacing.lg` gap between groups.

```
┌──────────────────────────────────────────────────────────────┐
│  Settings                                                      │  ← slim titled header
│                                                                │     (bodyBold, colors.text)
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ PROFILE CARD
│  │  ╭───╮   Alex Rivera                                 ✎    │ │  │ glass, radius.lg
│  │  │ A │   alex.rivera@email.com                            │ │  │ avatar on colors.primary
│  │  ╰───╯   ★ Pro Plan                                       │ │  │ edit btn top-right
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  HOUSEHOLD                                                     │  ┐ group label (caption)
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🏠] Household            with sam@email.com   Rivera  ›  │ │  │ SettingsRow ×3
│  │ [✉] Pending Invites      ● 2 new                       ›  │ │  │ invites: info status
│  │ [⇄] Sharing Preferences  Control what Sam sees  Custom ›  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ACCOUNTS & SYNC                                               │  ┐
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🔗] Linked Accounts   ⚠ 2 need attention      [2]     ›  │ │  │ error status row
│  └──────────────────────────────────────────────────────────┘ │  ┘   (icon+word+color)
│                                                                │  ← spacing.lg
│  BUDGETING                                                     │  ┐
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [◔] Budget Settings    Categories, limits & rollovers  ›  │ │  │
│  │ [🏷] Categories         Manage category tree & icons   ›  │ │  │
│  │ [⑃] Category Rules      Auto-categorization rules      ›  │ │  │
│  │ [✦] Advisor Memory      What your AI advisor remembers ›  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  MONEY & ASSETS                                                │  ┐
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🧾] Bills & Recurring  Manage recurring payments      ›  │ │  │
│  │ [🏠] Properties         Track home values & equity     ›  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  PREFERENCES                                                   │  ┐
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🌐] Default Currency   Used for new transactions $ USD ›  │ │  │ opens CurrencyPicker
│  │ [🔔] Push Notifications Budget alerts & reminders   (•—) │ │  │ Switch (no chevron)
│  │ [✉] Email Summaries    Weekly reports & alerts        ›  │ │  │ coming-soon alert
│  │ [◑] Theme                                        Dark  ›  │ │  │ toggleTheme
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  SECURITY                                                      │  ┐
│  ┌──────────────────────────────────────────────────────────┐ │  │
│  │ [🔒] App Lock           Face ID / Passcode         (—•) │ │  │ Switch
│  │  ┌────────────────────────────────────────────────────┐  │ │  │ destructive button
│  │  │            [⎋]  Log Out                            │  │ │  │ error-tinted, full-width
│  │  └────────────────────────────────────────────────────┘  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │
│                    CoupleFlow v1.0.0                           │  ← version, textDark, centered
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

Cold load, before user + household + currency + push + linked-status resolve. The header
title renders immediately (it's static). The **profile card** and the **first two groups**
(the ones with async values — Household + Accounts) render as skeletons; the purely
navigational groups (Budgeting, Money & Assets) may render immediately since their rows have
no async value, OR render skeleton for a uniform look — pick one and be consistent. Layout is
shape-matched so nothing jumps when data arrives.

```
┌──────────────────────────────────────────────────────────────┐
│  Settings                                                      │  ← real, static
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  profile skeleton
│  │  ▢▢▢▢    ▭▭▭▭▭▭▭▭▭▭▭▭                                    │ │  circle 56 (radius.full)
│  │  ▢▢▢▢    ▭▭▭▭▭▭▭▭                                        │ │  + 2 lines + pill
│  │          ▭▭▭▭                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▭▭▭▭▭  (group label skeleton, 80×10)                          │
│  ┌──────────────────────────────────────────────────────────┐ │  3 skeleton rows:
│  │  ▢  ▭▭▭▭▭▭▭▭▭▭                              ▭▭▭▭          │ │  chip 34 (radius.md)
│  │  ▢  ▭▭▭▭▭▭▭▭                                ▭▭▭           │ │  + title 60% + value
│  │  ▢  ▭▭▭▭▭▭▭▭▭▭▭▭                            ▭▭▭▭          │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▭▭▭▭▭                                                         │
│  ┌──────────────────────────────────────────────────────────┐ │  1 skeleton row
│  │  ▢  ▭▭▭▭▭▭▭▭▭▭                              ▭▭            │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton primitives (from `components/Skeleton.tsx`): avatar `Skeleton width={56} height={56}
borderRadius={radius.full}`; text lines `Skeleton height={12|10} width="60%"|"40%"`; row icon
chip `Skeleton width={34} height={34} borderRadius={radius.md}`; group label `Skeleton
width={80} height={10}`. This is the same skeleton-row recipe used in the dashboard redesign,
so the two screens' loading states rhyme.

### 3.3 Empty / first-time (no household yet)

Solo user who hasn't set up a household. The **Household** group is the only thing that
changes: its three rows collapse into a single **prompt card** encouraging setup. Everything
else (Preferences, Security, etc.) renders normally — Settings is never fully empty because
account/preferences rows always exist.

```
┌──────────────────────────────────────────────────────────────┐
│  HOUSEHOLD                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            [👥]                                            │ │  icon, textDark
│  │      Set up your household                                │ │  bodyBold, colors.text
│  │  Invite your partner to share budgets, bills, and         │ │  small, colors.textMuted
│  │  goals — or use CoupleFlow solo.                          │ │
│  │      ┌────────────────────────────────┐                   │ │  primary CTA
│  │      │        Set up household         │                   │ │  gradients.primaryGradient
│  │      └────────────────────────────────┘                   │ │  radius.lg, → /household-setup
│  └──────────────────────────────────────────────────────────┘ │
```

`CoupleFlow` is usable solo, so this is a soft empty state (a prompt, not a blocker). If the
user later has a household, the group reverts to the three-row form in §3.1.

### 3.4 Error (a required async load failed)

Household / linked-account status / currency / push preference each load independently and can
fail on their own. Do **not** blank the screen — the profile + navigational rows still render.
The **specific card that failed** shows an inline error strip with a Retry, matching the
dashboard's partial-error pattern.

```
┌──────────────────────────────────────────────────────────────┐
│  HOUSEHOLD                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ⚠  Couldn't load your household              Retry      │ │  alert-circle-outline
│  └──────────────────────────────────────────────────────────┘ │  colors.error + Retry
```

For a value that fails inside an otherwise-fine row (e.g. currency), the row still renders and
its value shows a neutral fallback (`— ` / `USD`) rather than an error strip — only a whole
card's failed load escalates to the strip. Push/App-lock toggles that fail to persist revert
optimistically (existing behavior) and may surface a lightweight inline note; no strip needed.

---

## 4. Header — slim titled row (matches the main-tab archetype)

```
┌──────────────────────────────────────────────────────────────┐
│  Settings                                                      │
└──────────────────────────────────────────────────────────────┘
```

- **No BackButton.** Settings is a **root tab**, reached by tapping the tab bar — the same as
  Dashboard and Calendar tabs, which have no back button. `BackButton` is for *pushed* screens
  (the sub-settings pages like `/settings/categories` use it); the tab root does not. (This is
  the archetype-consistency call: main tabs = titled header, pushed detail screens = BackButton.)
- **Title** `Settings` in `typography.bodyBold` `colors.text`, left-aligned, inside the safe
  area, with `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom:
  spacing.md` — identical metrics to the dashboard header row so the two line up.
- Drop the custom purple icon-chip beside the title; the reference main-tab headers are text-led
  and slim so the header never competes with content. (If a settings glyph is desired, it can
  sit as a muted `settings-outline` at the row's right edge, `colors.textMuted`, but it's
  optional and non-interactive.)

---

## 5. Component specs

### 5.1 `SettingsRow` (the workhorse — replaces the local `Row`)

One tappable list row: leading icon chip, title + optional subtitle, trailing value/status +
optional chevron. This is the settings-archetype analogue of the dashboard's recent-activity
row and must be visually consistent with it (same icon-chip radius, same caption subtitle).

**Props**

| Prop | Type | Required | Notes |
|---|---|---|---|
| `icon` | `keyof Ionicons.glyphMap` | yes | leading glyph |
| `title` | `string` | yes | `typography.smallBold`* `colors.text`, `numberOfLines={1}` |
| `subtitle` | `string` | no | `typography.caption` `colors.textMuted`, `numberOfLines={1}` |
| `value` | `string` | no | trailing value, `typography.caption`/`small` `colors.textMuted`, `flexShrink:0` |
| `status` | `'default' \| 'info' \| 'warning' \| 'error'` | no (default `'default'`) | drives icon tint + optional status chip; **color-independent** (see below) |
| `statusLabel` | `string` | no | short word rendered with the status color when `status !== 'default'` (e.g. `2 new`, `Needs attention`) |
| `badgeCount` | `number` | no | numeric pill on the right (e.g. linked-account error count) |
| `accessory` | `'chevron' \| 'switch' \| 'none'` | no (default `'chevron'`) | trailing affordance |
| `switchValue` | `boolean` | no | when `accessory === 'switch'` |
| `onSwitchChange` | `(v: boolean) => void` | no | switch handler |
| `onPress` | `() => void` | no | row tap; when absent and `accessory==='chevron'`, render `'none'` |
| `destructive` | `boolean` | no | renders as the log-out variant (see 5.2) |

\* Title uses `smallBold` (15/600 equivalent → `typography.smallBold` is 14/600; current row
title is 15/700). Use `typography.smallBold` for token compliance; the ~1px size delta is
acceptable and keeps rows on the scale. Do not reintroduce inline `fontSize: 15`.

**Layout tokens**

- Row min-height **48pt** (≥ 44pt touch target), `paddingVertical: spacing.md` (12).
- Icon chip: 34×34, `radius.md`, fill `` `${colors.primary2}1a` `` (~10%), icon `colors.primary2`
  (matches the old `#c084fc` accent → `colors.accent`? use `colors.primary2` for the chip icon,
  see §7 mapping), 18pt icon.
- Left group gap `spacing.md`; title/subtitle stacked; trailing group gap `spacing.sm`.
- Chevron: `chevron-forward` 14pt `colors.textMuted`.
- Row divider: when multiple rows in a card, thin `commonStyles.divider` (`colors.borderLight`)
  between them — or rely on the card padding + row spacing as today (either is fine; pick one
  and be consistent across all group cards).

**Status → visual (color-independent)**

| `status` | icon chip fill | icon color | trailing |
|---|---|---|---|
| `default` | `${colors.primary2}1a` | `colors.primary2` | value + chevron |
| `info` | `${colors.info}1a` | `colors.info` | `statusLabel` in `colors.info` **with a leading `●` dot** + chevron (e.g. `● 2 new`) |
| `warning` | `${colors.warning}1a` | `colors.warning` | `⚠ {statusLabel}` (`alert-circle` glyph + word) in `colors.warning` |
| `error` | `${colors.error}1a` | `colors.error` | `⚠ {statusLabel}` + optional `badgeCount` pill (`colors.error` fill, white text) |

Because every non-default status renders an **icon/dot glyph + a word** alongside the color, a
color-blind user reads "2 new" / "Needs attention" regardless of hue. Never rely on the tint
alone (fixes the current bare-blue pending-invites accent and red-only linked-accounts badge).

**States**

- `default`, `pressed` (`activeOpacity 0.7` — matches current), `switch on/off`, `error/warning/info`,
  `disabled` (only if a row is genuinely unavailable; not used in v1 — Email Summaries is
  enabled and shows a coming-soon alert on tap).

**Accessibility**

- `accessibilityRole`: `'button'` for tappable rows, `'switch'` for switch rows (with
  `accessibilityState={{ checked }}`).
- Label: `` `${title}${subtitle ? ', ' + subtitle : ''}${value ? ', ' + value : ''}${statusLabel ? ', ' + statusLabel : ''}` ``.
- Switch rows announce checked/unchecked; the whole row is the target (≥44pt), not just the switch.

### 5.2 `SettingsRow` destructive variant — Log Out button

Full-width tinted action inside the Security card (keeps current behavior: `Alert` confirm →
clear session → `router.replace('/login')`).

- Container: `backgroundColor: \`${colors.error}1a\``, `borderWidth: 1`, `borderColor:
  \`${colors.error}26\``, `borderRadius: radius.md`, `paddingVertical: spacing.md`, centered
  row, `gap: spacing.sm`, `marginTop: spacing.sm`.
- Content: `log-out-outline` 16pt + `Log Out`, both `colors.error`, `typography.smallBold`.
- `accessibilityRole="button"`, label `"Log out"`, hint `"Ends your session"`.

### 5.3 `ProfileCard`

The one richer card at the top. Same data as today (name / email / plan badge / edit).

**Props**: `name: string`, `email: string`, `plan?: string` (default `'Pro Plan'`),
`avatarLabel: string` (first initial), `loading?: boolean`, `onEditPress?: () => void`.

**Layout / tokens**

- Card `glassEffects.glass`, `radius.lg`, `padding: spacing.lg`, row layout, `gap: spacing.md`,
  `alignItems: 'center'`.
- Avatar 56×56, `radius.full`, fill `colors.primary`, initial in `typography.h3`-ish white/`colors.text`,
  weight 700. (Matches the dashboard header avatar palette: you = `colors.primary`.)
- Name `typography.bodyBold` `colors.text`; email `typography.caption` `colors.textMuted`,
  `spacing.xs` above.
- **Plan badge**: pill, `backgroundColor: \`${colors.primary2}26\``, border `\`${colors.primary2}40\``,
  `radius.sm`, `paddingHorizontal: spacing.sm`, `paddingVertical: 2`; text `colors.primary2`,
  `typography.caption` bold, prefixed with a `star` glyph so plan tier isn't color-only.
- Edit button: 36×36, `radius.md`, `backgroundColor: colors.glassLight`, border `colors.borderGlass`,
  `create-outline` 16pt `colors.primary2`; ≥44pt hit-slop; `accessibilityLabel="Edit profile"`.
- `loading`: render the §3.2 profile skeleton instead of content.

**States**: `default`, `loading`, `long name/email` (`numberOfLines={1}` + ellipsis on both;
badge wraps to its own line if the name is very long — it already sits on `marginTop`).

### 5.4 `SettingsGroup`

A labeled group = uppercase caption + a `glass` card wrapping N rows.

**Props**: `label: string`, `children`, plus `loading?`, `error?: boolean`, `onRetry?: () => void`,
`empty?: boolean`, `emptyContent?: ReactNode`.

- Label: `typography.caption`, `colors.textMuted`, uppercase, `letterSpacing ~1.2`, `spacing.sm`
  below. (Replaces the current `sectionLabel` with `#64748b` → `colors.textMuted`.)
- Card: `commonStyles.card` (`glass` + `padding: spacing.lg` + `marginBottom` handled by the
  `spacing.lg` group gap).
- `error` → render the §3.4 inline error strip (`alert-circle-outline` `colors.error`, message,
  `Retry` text button `colors.primary2`) instead of children.
- `empty` → render `emptyContent` (e.g. the §3.3 household setup prompt) instead of children.
- `loading` → render skeleton rows (count matches the group's real row count).

Component JSONs for `SettingsRow` and `ProfileCard` are provided under
`docs/design/components/settings-tab-*.json`.

---

## 6. Interactions (unchanged behavior, tokenized feedback)

| Element | Behavior |
|---|---|
| Any navigational row | `activeOpacity 0.7` press, `router.push(route)` — routes identical to current file |
| Default Currency row | opens `CurrencyPicker` modal (existing `visible/onClose/onSelect/selectedCode`); on select → optimistic set + `PUT /auth/currencies/default`, revert + Alert on failure (existing) |
| Push Notifications switch | optimistic toggle → `PUT /auth/push-preference`; revert on failure (existing) |
| Theme row | `toggleTheme()` from `useTheme`; value shows `Dark`/`Light` (existing) |
| App Lock switch | local state toggle (existing; no API yet) |
| Email Summaries | tap → `Alert` "Coming soon" (existing) |
| Log Out | `Alert` destructive confirm → clear `budgetAppSession` → `router.replace('/login')` (existing) |
| Edit profile | `onEditPress` (existing button is a no-op placeholder; keep as-is or wire to a profile-edit route — out of scope to change) |
| Focus refresh | `useFocusEffect` reloads household + sharing prefs + linked-account status (existing) |
| Switch track/thumb | replace inline `#a855f7` / `#fff` with `trackColor={{ true: colors.primary2, false: colors.glassMedium }}`, `thumbColor={colors.text}` |

All transitions use `animation.fast` (press states, skeleton pulse via the shared `Skeleton`);
under reduce-motion they are instant (the `Skeleton` pulse is decorative and may be disabled).

---

## 7. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `settings.tsx`) | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| header icon-chip `'rgba(192,132,252,0.12)'` / border `'rgba(192,132,252,0.2)'` | removed (slim text header); if kept: `` `${colors.primary2}1f` `` / `` `${colors.primary2}33` `` |
| `headerText` `#f8fafc` `fontSize:22 weight:800` | `typography.bodyBold` `colors.text` |
| profile/card bg `'rgba(255,255,255,0.06)'` | `glassEffects.glass` (`colors.glassLight`) / `commonStyles.card` |
| card/profile border `'rgba(255,255,255,0.08)'` | `colors.borderGlass` (or `colors.borderLight`) |
| `borderRadius: 20` (profile) / `18` (card) / `12` / `10` | `radius.lg` (16) for cards, `radius.md` (12) for chips, `radius.sm` (8) for small pills |
| avatar bg `#7c3aed` | `colors.primary` |
| avatar text `#fff` | `colors.text` |
| `profileName`/`rowTitle` `#f8fafc` | `colors.text` (via `typography.bodyBold` / `smallBold`) |
| `profileEmail` `#94a3b8` | `colors.textMuted` (via `typography.caption`) |
| plan badge bg `'rgba(168,85,247,0.15)'` / border `'rgba(168,85,247,0.25)'` / text `#c084fc` | `` `${colors.primary2}26` `` / `` `${colors.primary2}40` `` / `colors.primary2` |
| `sectionLabel` `#64748b` `fontSize:11 letterSpacing:1.2` | `typography.caption` `colors.textMuted` |
| row icon chip `'rgba(192,132,252,0.1)'` + icon `#c084fc` | `` `${colors.primary2}1a` `` + `colors.primary2` |
| `rowTitle` `#f8fafc fontSize:15 weight:700` | `typography.smallBold` `colors.text` |
| `rowSub` `#64748b fontSize:12` | `typography.caption` `colors.textMuted` |
| `rowValue` `#94a3b8 fontSize:13 weight:600` | `typography.caption` (or `smallBold`) `colors.textMuted` |
| chevron `#64748b` | `colors.textMuted` |
| linked-accounts error tint `#ef444418` / icon `#ef4444` | `` `${colors.error}1a` `` / `colors.error` |
| `warningBadge` bg `#ef4444` / text `#fff` | `colors.error` / `colors.text` |
| pending-invites accent `#60a5fa` | `colors.info` (with `●`/word — see §5 status) |
| push/app-lock switch track `#a855f7` / off `'rgba(255,255,255,0.15)'` / thumb `#fff` | `colors.primary2` / `colors.glassMedium` / `colors.text` |
| `logoutBtn` bg `'rgba(248,113,113,0.1)'` / border `'rgba(248,113,113,0.15)'` / text `#f87171` | `` `${colors.error}1a` `` / `` `${colors.error}26` `` / `colors.error` |
| `version` `#475569 fontSize:12` | `typography.caption` `colors.textDark` |
| ad-hoc paddings `16 / 14 / 12 / 11 / 10 / 8 / 4` | `spacing.lg / md / sm / xs` |
| ad-hoc `gap: 14 / 12 / 10 / 8 / 6 / 2` | `spacing.md / sm / xs` |
| container `padding:16 paddingBottom:40 gap:14` | `paddingHorizontal: spacing.lg`, `paddingBottom: 120` (clears the tab bar, matches dashboard), group gap `spacing.lg` |

---

## 8. Accessibility

- **Touch targets:** every row ≥ 48pt tall (≥44pt min); the edit button, switches, and Retry
  buttons get hit-slop to reach 44pt even where the visual is smaller. Switch rows make the
  **whole row** the target, not just the switch thumb.
- **Color independence:** all status is **icon/glyph + word + color**:
  - Pending invites → `● {n} new` in `colors.info` (dot + word), not a bare blue value.
  - Linked accounts error → `⚠ Needs attention` + numeric `[2]` pill in `colors.error`.
  - Plan badge → `★ Pro Plan` (star glyph), not color-only.
  - Log out → `⎋ Log Out` label + destructive confirm, not red-only.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` on dark glass (clears WCAG AA).
  Status words render at **full-opacity semantic color** on the dark card (not tinted-on-tint),
  verified ≥ 4.5:1; the ~10% chip fills are backgrounds only.
- **Screen-reader order:** header title → profile (name, email, plan, "Edit profile" button) →
  each group: label announced, then rows top-to-bottom. Row label:
  `"{title}, {subtitle}, {value/statusLabel}, {button|switch}"`. Switches announce
  checked/unchecked and their new state on change.
- **Reduced motion:** press-scale/opacity and the `Skeleton` pulse honor reduce-motion — swap
  to instant state changes; skeletons may render as static dim blocks.
- **Dynamic Type:** rows use min-height (not fixed height) so titles/subtitles reflow; values
  and switches never clip (`flexShrink: 0` on the trailing group, titles `numberOfLines={1}`
  with ellipsis).

---

## 9. Developer notes

- **Reuse, don't reimplement:** `GradientBackground` (bg, `variant="bgDarkPurple"`), `Skeleton`
  (loading — same row recipe as the dashboard redesign), `CurrencyPicker` (existing modal). The
  screen has no back button (it's a root tab); `BackButton` is only for the pushed
  `/settings/*` detail screens.
- **No new endpoints.** Everything is already fetched by the current `loadHousehold` /
  `loadSharingPrefs` / `loadPushPreference` / `loadUserCurrency` / `loadLinkedAccountStatus`.
  The redesign is a re-layout + tokenization + added states, not new data.
- **Loading gate:** introduce a `loading` / `loadedOnce` pair like the dashboard so the profile
  and value-bearing groups can show skeletons on cold load instead of flashing placeholder
  defaults (`'Your Name'`, empty email, `'A'`). Navigational-only groups can render immediately.
- **Per-group error isolation:** wrap each async-backed group's load in try/catch that sets a
  per-group error flag; render `SettingsGroup error onRetry={reload}` for just that group. Never
  blank the whole screen (mirrors the dashboard partial-error pattern).
- **Status derivation:** `pending invites` → `status='info'` + `statusLabel='{n} new'` when
  `pendingInviteCount > 0`, else `value='None'`. `linked accounts` → `status='error'` +
  `statusLabel='{n} need${…} attention'` + `badgeCount={n}` when `linkedAccountErrors > 0`, else
  `subtitle='Bank connections & sync'`. `sharing` → `value=sharingSummary` (`All on`/`Custom`/
  `Configure`). These map 1:1 onto the current logic.
- **IA split is optional for v1:** if the frontend prefers to keep the single "Financial" group,
  the `SettingsRow`/`SettingsGroup` specs are unchanged — only the group boundaries differ.
- **Switch styling:** use tokenized `trackColor`/`thumbColor` as in §6; keep the optimistic
  toggle + revert-on-failure logic verbatim.

---

## 10. Handoff checklist

- [x] Wrong bespoke gradient replaced with `<GradientBackground variant="bgDarkPurple">`
- [x] All four required states designed (default/populated, loading skeleton, empty/first-time, error)
- [x] Every hardcoded color / gradient / surface / border / radius / spacing / font mapped to a token
- [x] `SettingsRow`, `ProfileCard`, `SettingsGroup` specced with props/states/tokens (JSONs written)
- [x] Shared components reused (`GradientBackground`, `Skeleton`, `CurrencyPicker`); root-tab header (no BackButton) justified against the archetype
- [x] Status made color-independent (icon/glyph + word + color) for invites, linked accounts, plan, logout
- [x] Accessibility: 48/44pt targets, SR order + labels, reduced motion, Dynamic Type, WCAG-AA contrast
- [x] Functionality preserved — every row, route, toggle, and confirm dialog unchanged
- [x] IA improvement (split overloaded Financial group) noted as optional, non-breaking
