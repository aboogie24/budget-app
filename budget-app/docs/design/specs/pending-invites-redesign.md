# Pending Invites Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/pending-invites.tsx`
**Route:** `pending-invites` (pushed screen; back → `/(tabs)/settings`)
**Archetype:** list (invite cards)

---

## 1. Why this redesign exists

The current screen works, but — exactly like the pre-redesign calendar and dashboard — it
**does not use the design system**. It hardcodes:

- its own gradient `['#0b1021','#2b0f50','#1b1039']` (a *third* purple that matches neither
  `gradients.bgDarkPurple` nor `bgDark`);
- its own colors (`#c084fc`, `#f8fafc`, `#94a3b8`, `#fbbf24`, `#f87171`, `#64748b`, and a
  bespoke accept gradient `['#a855f7','#7c3aed']`);
- its own surfaces (`rgba(255,255,255,0.06)` cards, `rgba(255,255,255,0.08)` borders) and
  raw radii/spacing (`18`, `14`, `20`, `16`, `12`, `8`).

The result reads as a different app from the redesigned calendar/dashboard/bills/accounts
screens. This redesign is **fully tokenized** — every color, gradient, surface, radius,
space and font comes from `design-system.ts`, and the background swaps to
`<GradientBackground variant="bgDarkPurple">`.

Three additional problems this redesign fixes, matching the sibling-screen quality bar:

1. **No standard header.** The screen uses a bespoke `topBar` with a centered title and a
   spacer `View`. Every other pushed list screen (bills, accounts) now uses the shared
   `BackButton` + left-aligned `typography.h3` title row. Adopt it.
2. **No loading skeleton.** Loading is a bare centered `ActivityIndicator` on a blank
   gradient — the layout jumps when data lands. Sibling screens use layout-matched
   `components/Skeleton.tsx`. Adopt it.
3. **No error state.** `loadInvites` swallows failures into an empty array, so a network
   error is indistinguishable from "no invites" — the user is told "No Pending Invites"
   when the request actually failed. Add a distinct inline error state with **Retry**.

Functionality is preserved: load invites on mount + focus, show expiry countdown, accept
via confirm dialog, block accepting expired invites, refresh after accept.

### Information-architecture improvement (kept recognizably the same screen)

The invite is a **decision object**: *who* is inviting you, to *what* household, and *how
long* you have to decide. The redesign restructures each card to read in that order and
gives the household/inviter identity more weight than the plumbing (the invite `code` is
never surfaced to the user — it's an implementation detail, and it isn't today either).
One net-new, honest signal: an **"only one household at a time"** note. The accept dialog
already warns about this; surfacing it once at the top (when the user is *already* in a
household) prevents a surprise. This is additive and degrades gracefully — omit it if
membership isn't known.

---

## 2. Wireframes

iPhone 15 Pro (390×844). Background: `<GradientBackground variant="bgDarkPurple">` inside
a `SafeAreaView`. Screen horizontal padding `spacing.lg` (16).

### 2.1 Default / populated

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Pending Invites                          (◐ refresh)     │  ← BackButton + h3 title
│                                                                │     + bg-refresh spinner
│  2 invites waiting                                             │  ← count, caption/muted
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← invite card (glass)
│  │  [🏠]  The Rivera Household              ┌ ⏱ 5 days left ┐ │ │  icon + name + status
│  │        Invited by sam@rivera.com         └──────────────┘ │ │  chip (warning)
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  ✓  Accept & Join                                  │  │ │  ← primary CTA
│  │  └────────────────────────────────────────────────────┘  │ │     (primaryGradient)
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │  ← spacing.md gap
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  [🏠]  Weekend Cabin Fund                ┌ ⚠ Expired    ┐ │ │  status chip (error)
│  │        Invited by dana@example.com       └──────────────┘ │ │
│  │                                                          │ │
│  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │ │
│  │  ╎  ⓧ  This invite has expired                       ╎  │ │  ← dashed "ghost" bar,
│  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │ │     no CTA (error)
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ⓘ You can only be in one household at a time.                 │  ← footer note (info),
└──────────────────────────────────────────────────────────────┘     only if already in one
```

### 2.2 Loading (skeleton — reuse `components/Skeleton.tsx`)

The header renders immediately (title from static copy). Below it, layout-matched
skeletons in place of cards — same heights/radii as the real invite cards so nothing jumps.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Pending Invites                                          │  ← header renders now
│                                                                │
│  ▁▁▁▁▁▁▁▁▁▁▁▁                                                 │  ← count skeleton (w 120)
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ▢▢   ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁            ▁▁▁▁▁▁▁▁            │ │  ← icon box + 2 lines
│  │       ▁▁▁▁▁▁▁▁▁▁▁▁                                       │ │     + chip skeleton
│  │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  │ │  ← CTA bar skeleton
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  (second card skeleton, identical)                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Skeleton recipe (all `backgroundColor` handled by `Skeleton`):
- Count line: `Skeleton width={120} height={14} borderRadius={radius.sm}`.
- Each card: a `glassEffects.glass` card (`padding: spacing.lg`, `gap: spacing.md`,
  `marginBottom: spacing.md`) containing:
  - Row: `Skeleton width={44} height={44} borderRadius={radius.lg}` (icon), then a
    `View flex:1` with `SkeletonStack count={2}` (name + inviter), then
    `Skeleton width={92} height={26} borderRadius={radius.sm}` (chip).
  - `Skeleton height={48} borderRadius={radius.lg}` (CTA bar).
- Render **2** skeleton cards.
- Background refresh (data already loaded once): keep a small header `ActivityIndicator`
  (`colors.primary2`), do **not** replace the list with skeletons.

### 2.3 Empty (no invites — the request succeeded and returned none)

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Pending Invites                                          │
│                                                                │
│                                                                │
│                        ┌────────────┐                          │
│                        │   ✉ open   │                          │  ← icon in glass tile
│                        └────────────┘                          │
│                                                                │
│                     No pending invites                         │  ← h3, colors.text
│                                                                │
│         When someone invites you to their household,          │  ← body/small, muted
│              it'll show up here.                               │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

- Centered `commonStyles.emptyState`. Icon tile: 80×80, `glassEffects.glass`,
  `radius.xxl`, `mail-open-outline` 40px `colors.textMuted`. Title `typography.h3`
  `colors.text`. Subcopy `typography.small` `colors.textMuted`, centered, `lineHeight` from
  `typography.small`. This is a **distinct** state from error (see §2.4) — never conflate.

### 2.4 Error (the request failed)

Inline glass notice — never blank the screen, never masquerade as "empty".

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   Pending Invites                                          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │   ⚠  Couldn't load your invites                          │ │  ← alert-circle, error
│  │      Check your connection and try again.       [Retry]  │ │  ← Retry text button
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- `glassEffects.glass` card, `padding: spacing.lg`, `gap: spacing.sm`. Icon
  `alert-circle-outline` 22px `colors.error`. Title `typography.bodyBold` `colors.text`.
  Subcopy `typography.small` `colors.textMuted`. **Retry** = text button
  `typography.smallBold` `colors.primary2`, 44pt tap target (hit-slop), re-runs
  `loadInvites`. Matches the calendar error notice pattern exactly.

### 2.5 Accepting (per-card in-flight)

While one invite is being accepted (`accepting === code`): that card's CTA swaps its
label + icon for a small `ActivityIndicator` (`#fff`) and the button is `disabled`
(`activeOpacity` press feedback suppressed). Other cards remain interactive. This mirrors
the current behavior, tokenized.

---

## 3. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `pending-invites.tsx`) | Replace with token |
|---|---|
| gradient `['#0b1021','#2b0f50','#1b1039']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `BackButton color="#c084fc"` | `colors.primary2` (`#a855f7`) — match sibling BackButton tint |
| header `#f8fafc`, `fontSize:18/800` | `typography.h3` + `colors.text` |
| `countText #94a3b8`, `14/600` | `typography.caption` (uppercase optional) + `colors.textMuted` |
| card `rgba(255,255,255,0.06)` + `borderColor rgba(255,255,255,0.08)` + `borderRadius:18` | `glassEffects.glass` (`colors.glassLight` + `colors.borderGlass` + `radius.lg`) via `commonStyles.card` |
| `inviteIcon` bg `rgba(192,132,252,0.12)` / border `rgba(192,132,252,0.2)` | `` `${colors.primary2}1f` `` fill + `` `${colors.primary2}33` `` border, `radius.lg` |
| `inviteIcon` color `#c084fc` | `colors.primary2` |
| `inviteName #f8fafc`, `17/800` | `typography.bodyBold` + `colors.text` |
| `inviterText #94a3b8`, `13` | `typography.small` + `colors.textMuted` |
| expiry chip fill `rgba(251,191,36,0.12)` / border `rgba(251,191,36,0.2)` / text `#fbbf24` | `` `${colors.warning}1f` `` / `` `${colors.warning}33` `` / `colors.warning` |
| expired chip fill `rgba(248,113,113,0.1)` / text `#f87171` | `` `${colors.error}1f` `` / `colors.error` |
| chip `borderRadius:8`, `paddingHorizontal:10/vertical:5` | `radius.sm`, `spacing.sm` / `spacing.xs` |
| accept gradient `['#a855f7','#7c3aed']` | `gradients.primaryGradient` (`[colors.primary, colors.primary2]`) |
| `acceptBtnInner borderRadius:14`, `paddingVertical:14` | `radius.lg`, `spacing.md` |
| `acceptBtnText #fff`, `16/800` | `typography.button` + `colors.text` |
| expired bar `rgba(248,113,113,0.08)` fill / border `rgba(248,113,113,0.12)` / `borderRadius:12` | `` `${colors.error}14` `` fill / `` `${colors.error}29` `` border **dashed** / `radius.lg` |
| `expiredText #f87171`, `14/600` | `typography.smallBold` + `colors.error` |
| empty card `rgba(255,255,255,0.06)` + `borderRadius:20` + `padding:32` | `commonStyles.emptyState` + `glassEffects.glass` tile |
| `emptyIcon` 80×80 `rgba(255,255,255,0.04)` `borderRadius:24` | 80×80 `glassEffects.glass` + `radius.xxl` |
| `emptyIcon` color `#64748b` | `colors.textMuted` |
| `emptyTitle #f8fafc`, `20/800` | `typography.h3` + `colors.text` |
| `emptySub #94a3b8`, `14` | `typography.small` + `colors.textMuted` |
| loading `ActivityIndicator color="#c084fc"` | `Skeleton` list (see §2.2); header spinner uses `colors.primary2` |
| gaps `14`, `12`, `8` | `spacing.md`, `spacing.md`, `spacing.sm` |

> Opacity-suffix note: `` `${token}1f` `` ≈ 12%, `` `${token}14` `` ≈ 8%, `` `${token}33` ``
> ≈ 20%, `` `${token}29` `` ≈ 16% — the same hex-alpha convention the calendar/dashboard
> specs use for tint fills and borders.

---

## 4. Component specs

### 4.1 Header row (standard, matches bills/accounts)

- Container: `flexDirection: 'row'`, `alignItems: 'center'`, `paddingHorizontal:
  spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`.
- Left: `<BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />`.
- Title: `Pending Invites` in `typography.h3` `colors.text`, `marginLeft: spacing.sm`,
  `flex: 1` (left-aligned — drop the old centered title + spacer `View`).
- Right: during **background** refresh only (`loading && loadedOnce`), a small
  `ActivityIndicator` `colors.primary2`. Otherwise nothing.

### 4.2 `InviteCard` (see `pending-invites-invite-card.json`)

Structure top-to-bottom inside a `commonStyles.card` (`glassEffects.glass`,
`padding: spacing.lg`, `gap: spacing.md`, `marginBottom: spacing.md`):

1. **Header row** (`flexDirection:'row'`, `alignItems:'center'`, `gap: spacing.md`):
   - Icon tile 44×44, `radius.lg`, fill `` `${colors.primary2}1f` ``, border
     `` `${colors.primary2}33` ``, `home` 20px `colors.primary2`.
   - Identity column (`flex:1`): household name `typography.bodyBold` `colors.text`
     `numberOfLines={1}`; inviter line `typography.small` `colors.textMuted`
     `numberOfLines={1}` (`Invited by {inviter_email}`), rendered only when
     `inviter_email` present.
   - **Status chip** (`flexShrink:0`) — see 4.3.
2. **Action zone** — mutually exclusive by expiry:
   - **Not expired:** primary CTA `AcceptButton` (see 4.4).
   - **Expired:** dashed "ghost" bar (`borderStyle:'dashed'`, border
     `` `${colors.error}29` ``, fill `` `${colors.error}14` ``, `radius.lg`,
     `paddingVertical: spacing.md`, centered): `close-circle-outline` 16px `colors.error`
     + `This invite has expired` `typography.smallBold` `colors.error`. No CTA.

Props: `{ householdName, inviterEmail?, expiresAt, expired, accepting, onAccept }`.
States: `default`, `accepting` (CTA → spinner, disabled), `expired` (CTA replaced by ghost
bar). The user-facing card never shows the raw `code`.

### 4.3 `StatusChip` (expiry) — color-independent

One chip, three cases, always **icon + word + color** (never color alone):

| Case | Condition | Icon | Word | Color token | Fill / border |
|---|---|---|---|---|---|
| **Active** | > 1 day left | `time-outline` | `{n} days left` | `colors.warning` | `` `${colors.warning}1f` `` / `` `${colors.warning}33` `` |
| **Urgent** | ≤ 1 day, not expired | `alarm-outline` | `1 day left` / `Today` | `colors.error` | `` `${colors.error}1f` `` / `` `${colors.error}33` `` |
| **Expired** | past `expires_at` | `alert-circle-outline` | `Expired` | `colors.error` | `` `${colors.error}1f` `` / `` `${colors.error}33` `` |

Chip: `flexDirection:'row'`, `alignItems:'center'`, `gap: spacing.xs`, `paddingHorizontal:
spacing.sm`, `paddingVertical: spacing.xs`, `radius.sm`, icon 12px, text `typography.caption`
(600). The **Urgent** case is new IA polish: today the countdown reads "1 day left" in the
same warning yellow as "5 days left"; escalating to `colors.error` + `alarm-outline` when
≤1 day communicates urgency without color-only reliance.

### 4.4 `AcceptButton` (primary CTA)

- Wrapper `TouchableOpacity`, `disabled={accepting}`, `activeOpacity: 0.85`, ≥44pt tall.
- Inner `LinearGradient` `gradients.primaryGradient`, `radius.lg`, `paddingVertical:
  spacing.md`, row centered, `gap: spacing.sm`.
- Default: `checkmark-circle-outline` 18px `colors.text` + `Accept & Join`
  `typography.button` `colors.text`.
- Accepting: `ActivityIndicator size="small" color={colors.text}` only.
- `onPress` → existing `handleAccept(code, householdName)` confirm-dialog flow (unchanged).

### 4.5 Footer note (`OneHouseholdNote`) — additive, graceful-degrade

Rendered once below the list **only when the current user is already a household member**
(so joining will *switch* households). Row: `information-circle-outline` 14px `colors.info`
+ `You can only be in one household at a time.` `typography.caption` `colors.textMuted`,
`gap: spacing.xs`, `marginTop: spacing.sm`. If membership is unknown, omit — nothing else
changes. The accept dialog keeps its own confirmation regardless.

### 4.6 Count line

`{n} invite{s} waiting` in `typography.caption` `colors.textMuted`, `marginBottom:
spacing.md`. Only shown in the populated state (not empty/error).

---

## 5. States summary

| State | Trigger | Treatment |
|---|---|---|
| **Default / populated** | invites.length > 0 | Count line + `InviteCard` list (§2.1). |
| **Loading (first load)** | `loading && !loadedOnce` | 2 skeleton cards (§2.2). |
| **Background refresh** | `loading && loadedOnce` | List stays; header `ActivityIndicator`. |
| **Empty** | loaded ok, invites.length === 0 | Centered empty card (§2.3). |
| **Error** | `loadInvites` threw | Inline glass notice + Retry (§2.4). Distinct from empty. |
| **Accepting** | `accepting === code` | That card's CTA → spinner, disabled (§2.5). |
| **Expired invite** | `expires_at` past | Card shows Expired chip + dashed ghost bar, no CTA. |
| **Overflow — long household name / email** | — | `numberOfLines={1}` + ellipsis on name and inviter line; chip `flexShrink:0`. |
| **Overflow — many invites** | — | Outer `ScrollView` (existing), `paddingBottom: spacing.xxl`. |

> Implementation note: add an `errored` boolean to distinguish empty-vs-error. Today
> `catch` sets `setInvites([])`, which is why errors currently render as "No invites". Set
> `setErrored(true)` in `catch`, clear it on success, and gate the empty state on
> `!errored`.

---

## 6. Accessibility

- **Touch targets:** `BackButton` (already 40×40 + 12pt hit-slop = ≥44), `AcceptButton`
  ≥44pt tall, **Retry** text button padded to 44pt (hit-slop). Status chip is
  non-interactive (informational) so it's exempt.
- **Color independence:** every status is **icon + word + color** — Active
  (`time-outline` + "N days left"), Urgent (`alarm-outline` + "1 day left"), Expired
  (`alert-circle-outline` + "Expired") and the ghost bar (`close-circle-outline` + "This
  invite has expired"). A color-blind user reads the word and icon, never the hue alone.
- **Contrast:** all text on `colors.text` / `colors.textMuted` / semantic tokens over dark
  glass clears WCAG AA. Tint fills (`…1f`, `…14`) are backgrounds only; chip text stays
  full-opacity semantic color, verified ≥ 4.5:1 on the dark card.
- **Screen-reader order & labels:**
  - Header: `BackButton` labeled "Back", then title "Pending Invites".
  - Count line read first: "2 invites waiting".
  - Each `InviteCard` is one node:
    `"{householdName}, invited by {inviterEmail}, {statusWord}."` e.g.
    `"The Rivera Household, invited by sam@rivera.com, 5 days left."`
  - `AcceptButton`: `role="button"`, label `"Accept and join {householdName}"`, hint
    "Double tap to join this household"; `accessibilityState={{ disabled, busy: accepting }}`.
  - Expired ghost bar: `accessibilityRole="text"`, "This invite has expired."
  - Error Retry: `role="button"`, label "Retry loading invites".
- **Reduced motion:** the `Skeleton` pulse and CTA press-scale respect reduce-motion —
  under it, the skeleton renders at a static mid-opacity and the press feedback becomes an
  instant state swap (no scale animation). No parallax/entrance animations are introduced.

---

## 7. Developer notes

- **Reuse, don't reimplement:** `GradientBackground` (bg, `variant="bgDarkPurple"`),
  `Skeleton` / `SkeletonStack` (loading), `BackButton` (header). No shared component needs
  changing.
- **Add `errored` state** to separate empty vs error (§5). This is the one behavioral fix
  the redesign requires; everything else is presentational.
- **Urgent chip math:** reuse existing `daysUntil`; add a `≤1 && !expired` branch mapping
  to the error-tinted urgent chip. "Today" copy when `days === 0`-ish (diff > 0 but < 1
  day) is a nicety — "1 day left" is an acceptable fallback.
- **`accepting` keys off `code`** (unchanged) — the `code` stays internal and is never
  rendered to the user.
- **Footer note** depends on knowing current household membership; if that isn't readily
  available in this screen's data, ship without it (graceful degrade) — the accept dialog
  already covers the constraint.
- Keep load-on-mount + `useFocusEffect` refresh and the accept confirm `Alert` exactly as
  they are; this is a re-skin + IA pass, not a logic rewrite.

---

## 8. Handoff checklist

- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Standard `BackButton` + `h3` title header (replaces bespoke centered topBar)
- [x] Every hardcoded color/gradient/surface/radius/space/font mapped to a token (§3)
- [x] All states designed: default, loading (skeleton), empty, error, accepting, expired, overflow
- [x] Empty vs error made distinct (adds `errored`) — no more "No invites" on failure
- [x] Loading uses layout-matched `components/Skeleton.tsx`, not a bare spinner
- [x] Status conveyed by icon + word + color (Active / Urgent / Expired), never color alone
- [x] IA improvement: identity-first card order, Urgent escalation, one-household note (additive)
- [x] Accessibility: 44pt targets, SR node labels + order, reduced motion
- [x] Component specs written (`docs/design/components/pending-invites-*.json`)
