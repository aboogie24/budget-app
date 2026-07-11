# Linked Accounts Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/linked-accounts.tsx`
**Archetype:** list (sibling to `accounts-redesign.md`; header, list-row, empty/error
conventions mirror it and the calendar/dashboard redesigns exactly)

---

## 1. Why this redesign exists

Like the pre-redesign calendar and dashboard, `linked-accounts.tsx` is visually a
**different app** from the rest of CoupleFlow. Concretely, it:

- Hardcodes its own background gradient `['#0b1021','#2b0f50','#1b1039']` — a *third*,
  subtly-wrong purple that matches neither `gradients.bgDarkPurple` nor the calendar's old
  gradient. Every other redesigned screen now uses `<GradientBackground variant="bgDarkPurple">`.
- Hardcodes its own status palette (`#10b981`, `#f59e0b`, `#ef4444`, `#6b7280`) instead of
  `colors.success / warning / error / textMuted`, and its own surfaces/borders
  (`rgba(255,255,255,0.06)`, `rgba(192,132,252,0.15)`) instead of `glassEffects` /
  `colors.borderGlass`.
- Uses a big **centered hero header** (80px round icon + `fontSize:28/800` title +
  subtitle) that no other list screen uses. The sibling **Accounts** screen and the
  calendar/dashboard all use a slim **`BackButton` + title row**. This screen is an
  outlier and should conform.
- Imports `EmptyState` / `ErrorState` / `SkeletonCard` but its **loading state is a generic
  4× `SkeletonCard` stack that does not match the final card layout**, and the status
  badge relies on **color + a tiny 8px dot only** — no icon, borderline color-only.

This redesign changes **zero functionality**. Same data (`getLinkedAccountStatus`), same
re-auth flow (`createUpdateLinkToken` → `WebBrowser` → `resetLinkedAccountError`), same
pull-to-refresh, same "Link New Account" → `/link-account` route. It re-skins to the
design system, adopts the shared header/list-row conventions, and makes status
color-independent. The one IA improvement (§3) is additive and justified.

---

## 2. Shared conventions this screen must obey (from calendar / dashboard / accounts)

| Element | Convention (tokenized) |
|---|---|
| **Background** | `<GradientBackground variant="bgDarkPurple">` → `SafeAreaView`. Delete the local `LinearGradient` and the unused `backBtn` style. |
| **Header row** | `flexDirection:'row'`, `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`; `BackButton` at left (`color={colors.primary2}`); center title in `typography.bodyBold` `colors.text`; right-side background-refresh `ActivityIndicator` (`colors.primary2`, `size="small"`) shown **only during silent refresh**. |
| **Group labels** | Uppercase `typography.caption` in `colors.textMuted`, `spacing.sm` below (e.g. `NEEDS ATTENTION`, `CONNECTED`). |
| **List row** | No per-row glass fill inside a group card; rows separated by 1px `colors.borderLight` dividers (cleaner than the current per-card border-box — matches `AccountSectionCard`). |
| **Cards** | `glassEffects.glass` / `commonStyles.card` for normal cards; `glassEffects.glassFloating` reserved for the ONE summary/hero card only. |
| **CTA** | Dashed `Link New Account` button (`colors.primary2`), same as accounts §6.7. |
| **States** | Skeleton (layout-matched, reuse `components/Skeleton.tsx`), empty, error — all glass, never blank the whole screen. |
| **Scroll padding** | `spacing.lg` horizontal, `spacing.xl` bottom. |

---

## 3. Information-architecture improvement (single, justified change)

**Group accounts by status: "Needs Attention" first, "Connected" below.**

The current screen renders one flat list. But the *entire reason a user opens this screen*
is usually to fix a broken connection — an `error` or `pending_expiration` account with a
Re-authenticate button. Today those can be buried below healthy accounts.

The redesign splits the list into two ordered groups:

1. **NEEDS ATTENTION** (top) — accounts with `item_status` ∈ {`error`, `pending_expiration`}
   and `revoked`. Each row is expanded to show its inline fix affordance.
2. **CONNECTED** (below) — `good` accounts, compact rows showing last-synced.

If a group is empty it renders nothing (no placeholder). If **all** accounts are healthy,
only `CONNECTED` shows — the screen looks calm, which is the correct signal. A small
**count summary** sits under the header: `✓ 3 connected` / `⚠ 1 needs attention`
(icon + word + color — §7). This is the same "worst-signal-wins, surface the action" logic
as the dashboard Attention tier, scaled to one screen. It is additive: same data, same
row content, just ordered and labeled.

Everything else (per-account content, re-auth flow, link CTA) is preserved 1:1.

---

## 4. Full-screen wireframe

Default / populated, iPhone 15 Pro (390×844). One account needs attention, three healthy.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Linked Accounts                          (◐ refresh)   │  ← BackButton + title + silent-refresh spinner
│                                                                │
│  ⚠ 1 needs attention   ·   ✓ 3 connected                       │  ← status summary (icon+word+color)
│                                                                │
│  NEEDS ATTENTION                                               │  ← group label (caption, muted)
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │ [🏦] Chase                              ⚠ Needs Attention │ │  │ LinkedAccountRow (attention)
│  │      Linked Mar 3, 2026                                   │ │  │ glass card, warning left-rail
│  │  ┌╌ ⚠ Authentication Expired ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │ │  │ inner notice (warning)
│  │  ╎ ITEM_LOGIN_REQUIRED                                 ╎  │ │  │
│  │  ╎                              [ ⟳ Re-authenticate ]  ╎  │ │  │ primary button, 44pt
│  │  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  CONNECTED                                                     │  ← group label
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │ [🏦] Bank of America                    ● Connected       │ │  │ LinkedAccountRow (good)
│  │      Synced today                                         │ │  │ rows divided by 1px rule
│  │ ────────────────────────────────────────────────────────  │ │  │
│  │ [🏦] Wells Fargo                        ● Connected       │ │  │
│  │      Synced today                                         │ │  │
│  │ ────────────────────────────────────────────────────────  │ │  │
│  │ [🏦] Ally Bank                          ● Connected       │ │  │
│  │      Synced Jul 4, 2026                                   │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ + Link New Account ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐  │  ← dashed CTA, 44pt
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` horizontal; header sits in the safe area;
group gaps `spacing.lg`; rows inside a group divided by `colors.borderLight`; CTA
`spacing.lg` below the last group, `spacing.xl` bottom scroll padding.

### 4a. Loading (skeleton — reuse `components/Skeleton.tsx`)

Header renders immediately (static). Body is a **layout-matched** skeleton — not the
generic 4× `SkeletonCard` — so nothing jumps when data lands:

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Linked Accounts                                        │  ← static header
│                                                                │
│  ▐yyyyyyyyyyy▐  ·  ▐yyyyyyyy▐                                   │  ← summary skeleton (2 chips)
│                                                                │
│  ▐yyyyyyyy▐                                                    │  ← group-label skeleton
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [▢]  ▐yyyyyyyyyyyyy▐                  ▐yyyyyyyy▐           │ │  ← row skeleton ×3
│  │      ▐yyyyyy▐                                             │ │     36px chip + 2 text bars
│  │ ──────────────────────────────────────────────────────    │ │     + a right badge bar
│  │ [▢]  ▐yyyyyyyyyyy▐                    ▐yyyyyyyy▐           │ │
│  │      ▐yyyyyy▐                                             │ │
│  │ ──────────────────────────────────────────────────────    │ │
│  │ [▢]  ▐yyyyyyyyyyyyy▐                  ▐yyyyyyyy▐           │ │
│  │      ▐yyyyyy▐                                             │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Each skeleton row: `Skeleton width={36} height={36} borderRadius={radius.md}` (icon chip)
+ `Skeleton width="55%" height={12}` (name) over `Skeleton width="30%" height={10}`
(date) + a right `Skeleton width={72} height={20} borderRadius={radius.full}` (badge).
Show 3 rows in one `glass` card. The two summary chips are
`Skeleton width={96} height={16} borderRadius={radius.full}`. Keep the small header
`ActivityIndicator` visible for background refresh once data has loaded once (mirror
dashboard's `loadedOnce` pattern — full skeleton only on first load, spinner on refetch).

### 4b. Empty (no linked accounts)

Reuse the calendar/accounts empty pattern — friendly, one primary CTA. (Keep the current
copy; only re-skin.)

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Linked Accounts                                        │
│                                                                │
│                      ┌───────────┐                            │
│                      │    🔗     │        ← 80×80 circle,      │
│                      └───────────┘          ${primary2}1a fill │
│                                                                │
│                 No accounts linked yet                        │  ← typography.h3
│        Link your first bank account to sync                   │  ← small, textMuted
│           balances and transactions automatically.            │
│                                                                │
│              ┌──────────────────────────────┐                 │  ← primaryGradient button
│              │        Link Account           │                 │     radius.lg, 44pt
│              └──────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────┘
```

Implemented via the shared `EmptyState` (`icon="link-outline"`, `title="No accounts
linked yet"`, `description=...`, `actionLabel="Link Account"`, `onAction=→ /link-account`)
retokenized, OR the accounts §6.8 empty block if `EmptyState` isn't tokenized yet.

### 4c. Error (fetch failed, no cached data)

Inline glass card — screen not blanked; header stays interactive so the user can retry.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Linked Accounts                                        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            ⊘  (alert-circle-outline, error)               │ │
│  │        Couldn't load your accounts                        │ │  ← typography.bodyBold
│  │   Check your connection and try again.                    │ │  ← small, textMuted
│  │                     [ Retry ]                             │ │  ← text button, primary2, 44pt
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Reuse the shared `ErrorState` (`title="Couldn't load your accounts"`, `message=<err>`,
`onRetry=→ load()`) retokenized. Keep the current behavior where the error clears on retry.

### 4d. Re-authenticating (per-row in-flight)

While `reAuthLoading === account.id`: the Re-authenticate button shows a small
`ActivityIndicator` (`#fff` on `colors.primary`), the button is `disabled` at `opacity 0.6`,
and its `accessibilityState={{ busy: true, disabled: true }}`. Only the tapped row's button
enters this state; other rows stay interactive. (Preserves current logic exactly.)

### 4e. Overflow / edge cases

| Case | Behavior |
|---|---|
| **Long institution name** | `numberOfLines={1}` + ellipsis on `accountName`; badge is `flexShrink: 0` and never truncates. |
| **Long / raw error code** | `error_code` shown `numberOfLines={2}`, `typography.caption` `colors.textMuted`, monospaced feel optional (`typography.caption`); the Re-authenticate button drops to the next line, full-width, if the row is narrow. |
| **Many accounts** | Whole screen is one `ScrollView`; groups grow naturally; no inner scroll. |
| **`revoked` account** | Lives in NEEDS ATTENTION with a distinct `Revoked` badge (`colors.textMuted`, `close-circle-outline`); the inner notice reads "Access revoked — relink to reconnect" and the action becomes **Link Account** (→ `/link-account`) rather than Re-authenticate, since a revoked item can't be updated in place. If product prefers to keep the existing behavior (no action on revoked), render the badge only and omit the button — note for confirmation at implementation. |
| **Unknown status string** | Fallback badge: `colors.textMuted`, `help-circle-outline`, label = the raw status (mirrors current `default` branch). |

---

## 5. Token mapping — every hardcoded value → design-system token

| Old hardcoded value (current `linked-accounts.tsx`) | Replace with token |
|---|---|
| gradient `['#0b1021','#2b0f50','#1b1039']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| status `'#10b981'` (Connected) | `colors.success` |
| status `'#f59e0b'` (Needs Attention / error notice) | `colors.warning` |
| status `'#ef4444'` / `'#f87171'` (Error) | `colors.error` |
| status `'#6b7280'` (Revoked) | `colors.textMuted` |
| default badge `'#94a3b8'` | `colors.textMuted` |
| `'#c084fc'` (BackButton color, header icon) | `colors.primary2` (design token equivalent of `accent` — use `primary2` to match calendar/accounts BackButton) |
| `'#a855f7'` (RefreshControl tint) | `colors.primary2` |
| `'#7c3aed'` (re-auth btn, link btn) | `colors.primary` |
| `'#fff'` on buttons | `colors.text` |
| `'#f8fafc'` (titles) | `colors.text` |
| `'#94a3b8'` / `'#64748b'` (subtitles, dates) | `colors.textMuted` |
| card `backgroundColor:'rgba(255,255,255,0.06)'` + `borderColor:'rgba(192,132,252,0.15)'` | `glassEffects.glass` / `commonStyles.card` (group card); rows use `colors.borderLight` dividers |
| `errorSection` `backgroundColor:'rgba(245,158,11,0.08)'` | `` `${colors.warning}14` `` (~8%) with `borderLeftColor: colors.warning` |
| header icon bg `'rgba(192,132,252,0.15)'` | `` `${colors.primary2}1a` `` |
| bank icon bg `'rgba(192,132,252,0.12)'` | `` `${colors.primary2}1f` `` |
| badge fill `` `${badge.color}18` `` | `` `${statusToken}1f` `` (keep the derive-from-token approach, but from the semantic token) |
| ad-hoc `borderRadius: 16 / 12 / 8 / 24 / 20` | `radius.lg / md / sm / full` (24px round chip → 36px `radius.md` chip) |
| ad-hoc paddings `20 / 16 / 12 / 8 / 6` | `spacing.lg / md / sm / xs` |
| inline `fontSize:28/800`, `16/700`, `14`, `13`, `12`, `11` + weights | `typography.bodyBold / smallBold / small / caption` (drop the big `28/800` hero title → `bodyBold` header title) |
| `statusDot` 8px color-only dot | replaced by **icon + word + color** badge (§7) |
| `headerSection` 80px hero icon block | removed — replaced by slim `BackButton` + title row |

---

## 6. Section / component specs

Reuse shared components. One small new sub-component is proposed (`LinkedAccountRow`),
filename-prefixed `linked-accounts-` in `docs/design/components/`. A small
`LinkedStatusBadge` spec is also included (may be inlined rather than a separate file).

### 6.1 Header (reuse pattern, not a new component)

- Row: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`.
- Left: `<BackButton fallback="/(tabs)/settings" color={colors.primary2} />`. (Current
  fallback is `/(tabs)/settings`; keep it — settings is the canonical parent for this
  route.)
- Center: title `Linked Accounts` in `typography.bodyBold` `colors.text`.
- Right: background-refresh `ActivityIndicator` (`colors.primary2`, `size="small"`),
  visible only while `refreshing` / a silent refetch runs (mirrors dashboard/accounts). No
  eye/sync icons — this screen has no balances to hide.

### 6.2 Status summary line (small inline element, §3)

- Sits under the header, `marginTop: spacing.sm`, `paddingHorizontal: spacing.lg`, a
  `flexDirection:'row'` with a `·` (`colors.borderGlass`) divider between two chips:
  - `✓ {n} connected` — `checkmark-circle` (`colors.success`) + count + word, `typography.caption`.
  - `⚠ {m} needs attention` — `alert-circle` (`colors.warning`) + count + word, only when `m > 0`.
- If there are 0 accounts this line is not rendered (empty state owns the screen).
- Status is conveyed by icon + word + color (never color alone).
- A11y: one label — `"3 connected, 1 needs attention."`

### 6.3 `LinkedAccountRow` (new)

Implements both group variants; the difference is which sub-content renders.

- **Props:**
  - `institutionName: string`
  - `status: 'good' | 'pending_expiration' | 'error' | 'revoked' | string`
  - `errorCode: string | null`
  - `createdAt: string` (ISO)
  - `updatedAt: string` (ISO)
  - `isReAuthLoading: boolean`
  - `onReAuth: () => void`
  - `onRelink?: () => void` (revoked → Link Account)
- **Layout:** `flexDirection:'row'` top region, `gap: spacing.md`, `minHeight: 44`,
  `paddingVertical: spacing.md`.
  - **Icon chip** 36×36 `radius.md`, `backgroundColor: ${colors.primary2}1f`,
    `business-outline` (`colors.primary2`). (Was a 48px round chip; standardize to the
    36px `radius.md` chip used by `AccountRow`/`RecentActivity`.)
  - **Middle** (`flex:1, minWidth:0`): name `typography.smallBold` `colors.text`
    `numberOfLines={1}`; subtitle `typography.caption` `colors.textMuted` `numberOfLines={1}`:
    - `good` → `Synced {relative(updatedAt)}` (e.g. "Synced today", "Synced Jul 4").
    - attention → `Linked {date(createdAt)}`.
  - **Right** (`flexShrink:0`): `LinkedStatusBadge` (§6.4).
- **Attention sub-content** (only for `error`/`pending_expiration`/`revoked`): a nested
  notice below the top row —
  - Container: `backgroundColor: ${colors.warning}14` (or `${colors.error}14` when
    `error`/overdue), `radius.md`, `padding: spacing.md`, `borderLeftWidth: 3`,
    `borderLeftColor: colors.warning` (or `colors.error`).
  - `warning-outline` (`colors.warning`/`colors.error`) + label `typography.smallBold`:
    `Authentication Expired` (`pending_expiration`) / `Connection Issue` (`error`) /
    `Access Revoked` (`revoked`).
  - `errorCode` in `typography.caption` `colors.textMuted`, `numberOfLines={2}`.
  - **Action button** (`minHeight: 44`, `radius.sm`, `paddingHorizontal: spacing.md`):
    - default: `backgroundColor: colors.primary`, `refresh-outline` (`colors.text`) +
      `Re-authenticate` in `typography.smallBold` `colors.text`.
    - `isReAuthLoading`: `ActivityIndicator` (`colors.text`), button `opacity 0.6`, disabled.
    - `revoked`: label `Link Account`, `onPress = onRelink`.
- **Good sub-content:** none beyond the subtitle (`Synced …`); rows sit in a shared group
  card separated by `colors.borderLight` 1px dividers.
- **States:** `default`, `attention`, `reauthLoading`, `revoked`, `pressed`
  (`activeOpacity: 0.7` only if the whole row is tappable; default it is not — only the
  button is interactive).
- **A11y:** row label `"{institutionName}, {statusWord}, {linked|synced} {date}."`; the
  action button `accessibilityRole="button"`, label `"Re-authenticate {institutionName}"`,
  `accessibilityState={{ busy: isReAuthLoading, disabled: isReAuthLoading }}`.

### 6.4 `LinkedStatusBadge` (small — may be inlined)

- Pill: `flexDirection:'row'`, `alignItems:'center'`, `gap: spacing.xs`,
  `paddingHorizontal: spacing.sm`, `paddingVertical: spacing.xs`, `radius.full`,
  `backgroundColor: ${statusColor}1f`.
- **Icon + word + color** (replaces the color-only 8px dot):

| `status` | Token | Ionicon | Label |
|---|---|---|---|
| `good` | `colors.success` | `checkmark-circle` | `Connected` |
| `pending_expiration` | `colors.warning` | `alert-circle-outline` | `Needs Attention` |
| `error` | `colors.error` | `warning-outline` | `Error` |
| `revoked` | `colors.textMuted` | `close-circle-outline` | `Revoked` |
| _(other)_ | `colors.textMuted` | `help-circle-outline` | raw status string |

- Text: `typography.caption` weight 600, `color: statusColor`. Icon size 12.
- A11y: the badge text is already the accessible word; no extra label needed beyond the row.

### 6.5 Link CTA (retokenize existing)

- Dashed border button: `borderWidth:1`, `borderStyle:'dashed'`,
  `borderColor: colors.primary2`, `backgroundColor: ${colors.primary2}0a`, `radius.lg`,
  `paddingVertical: spacing.md`, `minHeight: 44`, centered. `add-circle-outline`
  (`colors.primary2`) + `Link New Account` in `typography.smallBold` `colors.primary2`.
  Routes to `/link-account` (unchanged). Rendered only when `accounts.length > 0` (the
  empty state has its own primary CTA).

### 6.6 Empty & Error states

- **Empty:** shared `EmptyState` retokenized (§4b) — 80×80 `${colors.primary2}1a` circle,
  `link-outline` (`colors.primary2`), title `typography.h3` `colors.text`, body
  `typography.small` `colors.textMuted`, primary button `gradients.primaryGradient`
  (`radius.lg`, `paddingVertical: spacing.md`, `minHeight: 44`) → `/link-account`.
- **Error:** shared `ErrorState` retokenized (§4c) — `glassEffects.glass` card,
  `alert-circle-outline` (`colors.error`), title `typography.bodyBold`, body
  `typography.small` `colors.textMuted`, text `Retry` button (`colors.primary2`, 44 target)
  → clears error + re-`loadAccounts()`.

---

## 7. Accessibility

- **Touch targets ≥ 44×44:** the header BackButton and refresh spinner area are 40×40 +
  `hitSlop` to 44; the Re-authenticate / Retry / Link buttons use `minHeight: 44`; rows use
  `minHeight: 44`.
- **Color-independent status:** every status is **icon + word + color**, never color alone.
  The old design's 8px status dot (color-only) is replaced by `LinkedStatusBadge`
  (icon + `Connected/Needs Attention/Error/Revoked` word + color). The summary line pairs
  `✓`/`⚠` icon + count + word. A red/green-blind user parses the whole screen.
- **Screen-reader order:** header title → status summary → `NEEDS ATTENTION` label →
  attention rows (name → status → notice label → error code → action button) →
  `CONNECTED` label → good rows (name → status → synced date) → Link CTA.
- **Labels:** row = `"{institution}, {statusWord}, {linked|synced} {date}"`; action button
  announces busy state during re-auth so VoiceOver says "Re-authenticate, busy."
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass clears WCAG
  AA (`colors.textMuted #94a3b8` on the glass surface passes 4.5:1). Status-tint pills are
  backgrounds only; the icon+text on them stays full-opacity semantic color. Do not dim
  `colors.text` below full opacity for meaningful text — use `colors.textMuted` instead.
- **Reduced motion:** the re-auth `ActivityIndicator`, header refresh spinner, and Skeleton
  pulse respect reduce-motion — under it, spinners show a static in-progress state and the
  Skeleton renders at a fixed opacity. Any group collapse/press-scale uses `animation.fast`,
  instant under reduce-motion.

---

## 8. Developer notes

- Wrap the screen in `<GradientBackground variant="bgDarkPurple">` → `SafeAreaView`; delete
  the local `LinearGradient`, the `headerSection`/`headerIcon`/`headerTitle`/`headerSubtitle`
  styles, and the unused `backBtn` style.
- Replace `getStatusBadge`'s hardcoded hex map with a token map onto
  `colors.success/warning/error/textMuted` plus an Ionicon per status (§6.4). Keep the
  labels; add the icon.
- Grouping (§3): partition `accounts` into `attention = status ∈ {error,
  pending_expiration, revoked}` and `good = status === 'good'` in render; order attention
  first. No new state — derived from the existing `accounts` array.
- Loading: adopt the dashboard `loadedOnce` pattern — full layout-matched Skeleton only on
  first load; on subsequent refetches keep the last data and show the header spinner. This
  removes the current jump from generic `SkeletonCard`s to real cards.
- Reuse `components/Skeleton.tsx` (§4a), `components/BackButton.tsx`, `<GradientBackground>`,
  and the shared `EmptyState` / `ErrorState` — do not re-implement any of them.
- The re-auth flow (`createUpdateLinkToken` → `WebBrowser.openAuthSessionAsync` →
  `resetLinkedAccountError` → `loadAccounts`) is unchanged; only its button styling and
  busy state move into `LinkedAccountRow`.
- `revoked` action (§4e): confirm with product whether revoked items get a **Link Account**
  relink action or just a badge. Spec supports both; default to relink for a better dead-end
  experience.
- Dates: keep `new Date(...).toLocaleDateString()` or swap to a small `relative(date)`
  helper for "Synced today / Jul 4" — either is fine; relative reads better in `CONNECTED`.

---

## 9. Handoff checklist

- [x] Local gradient → `<GradientBackground variant="bgDarkPurple">`; hero header → slim BackButton + title row
- [x] Every hardcoded color/gradient/spacing/radius/font mapped to a design-system token (§5)
- [x] Header + list-row + group-label conventions match dashboard/calendar/accounts (archetype-consistent)
- [x] IA improvement: status-grouped list (Needs Attention → Connected) + summary line, justified & additive
- [x] All states designed (default, loading skeleton layout-matched, empty, error, re-auth in-flight, overflow, revoked)
- [x] Status made color-independent: icon + word + color badge replaces the color-only dot
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, EmptyState, ErrorState)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, contrast
- [x] Functionality preserved 1:1 (data fetch, re-auth flow, pull-to-refresh, Link New Account route)
- [x] Component specs written (`docs/design/components/linked-accounts-*.json`)
```

