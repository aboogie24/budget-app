# Household Setup Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/household-setup.tsx`
**Archetype:** form / flow (create household, invite partner, accept invite)
**Route:** `household-setup` · **Back fallback:** `/(tabs)/settings`

---

## 1. Why this redesign exists

`household-setup.tsx` is the last major screen still shipping its **own private theme**.
It hardcodes a *different* background gradient from the rest of the app
(`['#0b1021', '#2b0f50', '#1b1039']` instead of `gradients.bgDarkPurple`), its own surface
color (`rgba(255,255,255,0.06)`), its own borders (`rgba(255,255,255,0.08)`), its own
accent (`#c084fc`, which isn't even a token — the token is `colors.accent`/`colors.primary2`),
and dozens of inline font sizes/weights and raw paddings (`16 / 14 / 12 / 10 / 8`). Next to
the redesigned `calendar.tsx` and `dashboard.tsx` it reads as **a different app** — the exact
problem those two redesigns already solved.

It also has **no loading skeleton** (just a bare centered `ActivityIndicator` over the wrong
gradient) and **no error state** (network failures are swallowed into `console.error` and the
user silently sees the empty "No Household Yet" card even when the real problem was a failed
fetch). A form/flow screen that can fail on load *must* be able to say so and offer Retry.

This redesign does three things, in priority order:

1. **Adopt the design system** — every color, gradient, radius, space, font, and surface comes
   from `design-system.ts`. Swap the bespoke gradient for `<GradientBackground variant="bgDarkPurple">`.
   No magic numbers, no local color constants.
2. **Add the missing states** — real loading **skeleton** (reuse `components/Skeleton.tsx`) and a
   real **error** state with Retry, matching the `noticeCard` pattern the calendar established.
3. **Tighten the information architecture** — the screen has two completely different modes
   (has-household vs. no-household) and today they share ambiguous section labels. Make the
   *primary action of each mode* unmistakable, and make invite/member status **color-independent**
   (icon + word + color), which it currently is not (yellow chip only).

Keep it recognizably the same screen: same two modes, same create / invite / accept /
members / actions functionality, same navigation targets.

---

## 2. Information architecture — two modes, one clear primary action each

The screen is a **state machine on `householdId`**. The redesign keeps both modes but gives
each a single, visually dominant primary action, and orders sections by the user's actual goal.

### Mode A — HAS household (`householdId != null`)
The user's job here is *manage & grow* the household. Order:

1. **Household hero** — identity (name + member count). Glass **floating** card — the one card
   that floats, mirroring the "only the headline floats" rule from the dashboard redesign.
2. **Members** — who's in it (with your-badge + owner badge).
3. **Invite partner** — the primary *growth* action (email + send). Promoted directly under
   members because "add my partner" is the #1 reason someone opens this screen.
4. **Pending invites** — invites you've *sent* that aren't accepted yet (status: Pending).
   Only rendered when non-empty.
5. **Manage** — Sharing Preferences, Your Pending Invites, Leave Household (destructive, last).

### Mode B — NO household (`householdId == null`)
The user's job is *join or create*. Order depends on whether they were invited:

- **If they have an incoming invite** → the invite is the hero. `Accept & Join` is the primary
  action; "or create your own" is secondary/demoted below it.
- **If they have no invite** → `Create Household` is the hero primary action; "Got an invite?"
  is the secondary escape hatch.

This priority-flip is already in the current code (it reorders based on `pendingInvites.length`);
the redesign keeps that logic and makes the winner visually dominant (floating card + gradient CTA)
instead of two same-weight cards.

---

## 3. Header — standard stack header with BackButton

Same header contract as every stack screen: `BackButton` left, centered title, right slot
reserved for a background-refresh spinner (mirrors the calendar's `loading && loadedOnce`
`ActivityIndicator`). Tokenized.

```
┌──────────────────────────────────────────────────────────┐
│  [‹]            Household              (⟳ / spacer)        │
└──────────────────────────────────────────────────────────┘
```

- **Back:** `<BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />` —
  keep the existing fallback; swap the raw `#c084fc` for `colors.primary2`.
- **Title:** `Household` in `typography.h3` weight `800`, `colors.text` (matches calendar's
  `styles.title`). Note: the current file's header title is `18/800`; the redesign lifts it to
  the tokenized `h3` used by the reference screens.
- **Right slot:** 40pt reserved box. During a **background refresh** (a `useFocusEffect` reload
  while data is already on screen) show `<ActivityIndicator size="small" color={colors.primary2} />`;
  otherwise an empty 40pt spacer so the title stays centered.
- Header container: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`,
  `paddingBottom: spacing.md` (identical to calendar).

---

## 4. Wireframes

iPhone 15 Pro (390×844). `<GradientBackground variant="bgDarkPurple">` behind everything.
Screen padding `spacing.lg` (16) horizontal; inter-card gap `spacing.md` (12).

### 4.1 Mode A — HAS household (default / populated)

```
┌──────────────────────────────────────────────────────────┐
│  [‹]            Household                                  │  header (BackButton)
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │  ┐ HERO
│  │                    ⌂  (home)                          │ │  │ glassFloating
│  │                 The Johnsons                          │ │  │ radius.xl
│  │              ●  2 members · owner you                 │ │  │ icon + name + sub
│  └──────────────────────────────────────────────────────┘ │  ┘
│                                                            │  ← spacing.md
│  MEMBERS                                                   │  group label (caption/muted)
│  ┌──────────────────────────────────────────────────────┐ │
│  │ (A) alex@email.com   (you)              [★ Owner]     │ │  member row, your-avatar tint
│  │ (S) sam@email.com                        member       │ │  member row
│  └──────────────────────────────────────────────────────┘ │
│                                                            │  ← spacing.md
│  INVITE PARTNER                                            │  group label
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Send an invite to your partner's email.              │ │  fieldDesc (small/muted)
│  │ ┌──────────────────────────────────┐  ┌────────────┐ │ │
│  │ │ partner@email.com                │  │  ➤  Send   │ │ │  input + gradient send btn
│  │ └──────────────────────────────────┘  └────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │  ← spacing.md
│  PENDING INVITES                                           │  group label (only if any)
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ✉  jordan@email.com                  ◔ Pending       │ │  invite row: icon+word+color
│  │    Expires Jul 24                                     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │  ← spacing.md
│  MANAGE                                                    │  group label
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ⇄  Sharing Preferences                          ›    │ │  action row (44pt)
│  │ ✉  Your Pending Invites                         ›    │ │  action row
│  │ ──────────────────────────────────────────────────   │ │  divider
│  │ ⏻  Leave Household                                   │ │  destructive, error tint
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Mode B — NO household, WITH an incoming invite (invite is hero)

```
┌──────────────────────────────────────────────────────────┐
│  [‹]            Household                                  │
│                                                            │
│  YOU'RE INVITED                                            │  group label
│  ┌──────────────────────────────────────────────────────┐ │  ┐ INVITE HERO
│  │  ⌂  The Rivera Home                                   │ │  │ glassFloating,
│  │      Invited by sam@email.com                        │ │  │ primary2-tinted
│  │                                                       │ │  │
│  │   ┌────────────────────────────────────────────────┐ │ │  │ gradient CTA
│  │   │        ✓  Accept & Join                        │ │ │  │ (primaryGradient)
│  │   └────────────────────────────────────────────────┘ │ │  ┘
│  └──────────────────────────────────────────────────────┘ │
│  ( if expired → "⌛ This invite has expired" in place of  │
│    the CTA, colors.textMuted )                            │
│                                                            │  ← spacing.md
│  OR CREATE YOUR OWN                                        │  group label (demoted)
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Give your shared space a name.                       │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │ e.g. The Johnsons                                │ │ │  text input
│  │ └──────────────────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │        +  Create Household                        │ │ │  secondary weight here
│  │ └──────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Mode B — NO household, NO invite (create is hero) = the empty state

```
┌──────────────────────────────────────────────────────────┐
│  [‹]            Household                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │  ┐ EMPTY / CREATE HERO
│  │                   ⌂ (home-outline)                    │ │  │ glassFloating
│  │               Start your household                    │ │  │ friendly onboarding
│  │   Share budgets, transactions & goals with your      │ │  │ voice
│  │   partner. Give your shared space a name.            │ │  │
│  │                                                       │ │  │
│  │ ┌──────────────────────────────────────────────────┐ │ │  │ named input
│  │ │ e.g. The Johnsons, Casa del Amor                 │ │ │  │
│  │ └──────────────────────────────────────────────────┘ │ │  │
│  │ ┌──────────────────────────────────────────────────┐ │ │  │ gradient CTA
│  │ │        +  Create Household                        │ │ │  │ (primaryGradient)
│  │ └──────────────────────────────────────────────────┘ │ │  ┘
│  └──────────────────────────────────────────────────────┘ │
│                                                            │  ← spacing.md
│  GOT AN INVITE?                                            │  group label
│  ┌──────────────────────────────────────────────────────┐ │
│  │ If your partner already sent you an invite, check    │ │  fieldDesc
│  │ your pending invites.                                │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │  ✉  Check Pending Invites                         │ │ │  secondaryBtn
│  │ └──────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 4.4 Loading (skeleton — reuse `components/Skeleton.tsx`)

Replaces the bare centered spinner. Layout-matched so nothing jumps when data lands. Show while
`loading && !loadedOnce`. Header renders immediately (title is static).

```
┌──────────────────────────────────────────────────────────┐
│  [‹]            Household                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │  Skeleton h=120 r=radius.xl
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │  (hero)
│  └──────────────────────────────────────────────────────┘ │
│  ░░░░░░░  (MEMBERS label skeleton, w=96 h=12)             │
│  ┌──────────────────────────────────────────────────────┐ │  Skeleton h=92 r=radius.lg
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │  (members / 2 rows)
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │  Skeleton h=88 r=radius.lg
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │  (invite / create)
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │  Skeleton h=64 r=radius.md
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │  (manage)
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Skeleton block in a `paddingHorizontal: spacing.lg`, `gap: spacing.md` column — identical to the
calendar's skeleton block. Under a **background refresh** (data already present) do NOT show
skeletons; show the header spinner instead.

### 4.5 Error (load failed — matches calendar `noticeCard`)

Today, a failed `GET /auth/households/me` is indistinguishable from "no household." The redesign
distinguishes them: track an explicit `errored` flag (fetch threw for a non-404 reason). If
`errored`, show the notice card **instead of** the no-household/create UI, so we never tell a user
they have no household when we simply couldn't reach the server.

```
┌──────────────────────────────────────────────────────────┐
│  [‹]            Household                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │  noticeCard (glass, centered)
│  │                    ⚠ (alert-circle-outline, error)    │ │
│  │            Couldn't load your household               │ │  noticeTitle
│  │     Check your connection and try again.              │ │  noticeSub (muted)
│  │                    [ Retry ]                          │ │  text button, primary2
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

(A `404`/"no household" response is **not** an error — it routes to Mode B, §4.2/§4.3.)

---

## 5. Section / component specs

All cards use `glassEffects.glass` unless noted; the **one floating hero per screen** uses
`glassEffects.glassFloating`. Group labels above each section use `typography.caption` uppercase,
`colors.textMuted`, letterSpacing ~1.2, `spacing.sm` below — replacing the current inline
`sectionLabel` (which lives *inside* the card). Pulling the label *above* the card matches the
`THIS WEEK` / `RECENT ACTIVITY` group-label pattern from the dashboard redesign.

### 5.1 Household hero (Mode A) — `HouseholdHeroCard`
- Surface: `glassEffects.glassFloating`, `radius.xl`, `padding: spacing.xl`, centered.
- Icon chip: 64×64, `radius.xl`, fill `` `${colors.primary2}26` `` (~15%), border
  `` `${colors.primary2}33` ``, `Ionicons "home"` size 28 `colors.primary2`.
- Title: household name, `typography.h3` weight `800`, `colors.text`, `numberOfLines={1}`.
- Sub: `{n} member{s} · {you are owner ? 'owner you' : 'member'}`, `typography.small`,
  `colors.textMuted`, centered.

### 5.2 Members — `MemberRow`
- Container card: `glassEffects.glass`, `padding: spacing.lg`, rows separated by
  `commonStyles.divider` (or `spacing.sm` vertical rhythm).
- Avatar: 40×40, `radius.md`; default fill `colors.glassMedium`; **your** row fill
  `` `${colors.primary}33` `` (the "you" tint). Initial = first char of email, `typography.bodyBold`,
  `colors.text`.
- Email: `typography.smallBold` `colors.text`, `+ ' (you)'` suffix when it's you, `numberOfLines={1}`.
- Role: `typography.caption` `colors.textMuted`, capitalized.
- **Owner badge:** pill, `radius.sm`, fill `` `${colors.primary2}26` ``, border `` `${colors.primary2}40` ``,
  **icon + word** `★ Owner` (`star` 11px + text) `colors.primary2` `typography.caption` weight 700.
  The star makes ownership color-independent.

### 5.3 Invite partner (Mode A) — `InviteInputRow`
- Card: `glassEffects.glass`. Field description in `typography.small` `colors.textMuted`.
- Input: `glassEffects.glass` fill, `radius.md`, `paddingHorizontal: spacing.md`,
  `paddingVertical: spacing.md`, text `colors.text`, placeholder `colors.textDark`,
  `keyboardType="email-address"`, `autoCapitalize="none"`.
- **Send button:** was a flat `#7c3aed` square; upgrade to a `gradients.primaryGradient`
  `LinearGradient`, 44×44, `radius.md`, `paper-plane` 18 `#fff`. 44pt satisfies the touch target.
  Disabled (`submitting`) → opacity 0.5 + spinner swap.

### 5.4 Pending invites (sent, Mode A) — `PendingInviteRow`
- Row: `flexRow`, `alignItems:center`, `paddingVertical: spacing.md`.
- Leading: `mail-outline` 16 `colors.warning`.
- Email `typography.smallBold` `colors.text`; expiry `Expires {date}` `typography.caption`
  `colors.textMuted`.
- **Status chip:** `◔ Pending` — pill `radius.sm`, fill `` `${colors.warning}26` ``, border
  `` `${colors.warning}40` ``, `time-outline` 11 + word `Pending`, `colors.warning`,
  `typography.caption` weight 700. Icon+word makes it color-independent (fixes the current
  yellow-only chip).
- **Expired** variant: chip word `Expired`, color `colors.error`, icon `close-circle-outline`.

### 5.5 Incoming invite hero (Mode B) — `IncomingInviteCard`
- Surface: `glassEffects.glassFloating`, `radius.xl`, `padding: spacing.lg`, background tint
  `` `${colors.primary2}14` `` (subtle purple wash, the "this is for you" energy).
- Header row: 44×44 icon chip (`home` `colors.primary2`, fill `` `${colors.primary2}1f` ``) +
  household name (`typography.bodyBold` `colors.text`) + inviter (`Invited by {email}`,
  `typography.caption` `colors.textMuted`).
- **Primary CTA** (not expired): `PrimaryGradientButton` — `gradients.primaryGradient`
  `LinearGradient`, `radius.lg`, `paddingVertical: spacing.md`, `checkmark-circle-outline` 18 +
  `Accept & Join` (`typography.button`/bodyBold weight 800, `#fff`). While accepting → centered
  `ActivityIndicator #fff`, button disabled.
- **Expired:** replace CTA with `⌛ This invite has expired` (`hourglass-outline` + text)
  `colors.textMuted`, `typography.small`.

### 5.6 Create household — `CreateHouseholdForm`
- **When it's the hero (no invite, §4.3):** `glassEffects.glassFloating` card in onboarding
  voice — centered `home-outline` 40 chip, title `Start your household` (`typography.h3` w800),
  subcopy (`typography.small` `colors.textMuted`, centered), then the input + gradient CTA.
- **When demoted (invite present, §4.2):** `glassEffects.glass`, left-aligned, label
  `OR CREATE YOUR OWN`, input + a **secondary-weight** create button (still functional, but not
  gradient — use `secondaryBtn` styling so it loses the visual fight to Accept & Join).
- Input: same spec as §5.3 input. Placeholder `e.g. The Johnsons, Casa del Amor`.
- Primary CTA (hero mode): `PrimaryGradientButton`, `add-circle-outline` 18 + `Create Household`
  (→ `Creating…` while `submitting`), disabled when name empty or submitting.
- Validation: empty-name still surfaces the existing `Alert` — but **also** disable the CTA
  (opacity 0.5) while `!createName.trim()` so the error is preventable, not just reactive.

### 5.7 Manage (Mode A) — `ActionRow` + `LeaveButton`
- Card `glassEffects.glass`. Each `ActionRow`: leading icon (18) + label (`typography.smallBold`
  `colors.text`, `flex:1`) + `chevron-forward` 14 `colors.textMuted`. Min height **44pt**.
  - Sharing Preferences → `share-social-outline` `colors.primary2` → `/sharing-preferences`.
  - Your Pending Invites → `mail-unread-outline` `colors.info` → `/pending-invites`.
- Divider (`commonStyles.divider`) before the destructive action.
- **Leave Household:** `exit-outline` 16 + text, `colors.error`, fill `` `${colors.error}1a` ``,
  border `` `${colors.error}26` ``, `radius.md`, `paddingVertical: spacing.md`. Keeps the existing
  confirm `Alert` → "Coming soon" placeholder (functionality preserved verbatim).

### 5.8 Got-an-invite escape hatch (Mode B) — `SecondaryButton`
- `glassEffects.glass` fill, `radius.md`, `paddingVertical: spacing.md`, `mail-unread-outline` 16
  `colors.primary2` + `Check Pending Invites` (`typography.smallBold` `colors.primary2`).
  → `/pending-invites`.

---

## 6. States summary

| State | Trigger | Treatment |
|---|---|---|
| **Default — Mode A** | `householdId != null` | §4.1: hero + members + invite + pending + manage. |
| **Default — Mode B (invited)** | no household, `pendingInvites.length > 0` | §4.2: invite hero + demoted create. |
| **Empty — Mode B (no invite)** | no household, no invites | §4.3: create hero + got-an-invite hatch. This is the screen's true empty state. |
| **Loading** | `loading && !loadedOnce` | §4.4 skeleton block (reuse `Skeleton`), header static. |
| **Background refresh** | `useFocusEffect` reload w/ data present | header `ActivityIndicator` (`colors.primary2`); content stays, no skeleton. |
| **Error** | `me` fetch failed for non-404 reason | §4.5 `noticeCard` + Retry; never masquerades as "no household". |
| **Submitting (create/invite/accept)** | button pressed | button disabled + opacity 0.5, label→`…`ing or inline spinner. |
| **Overflow — long email** | any member/invite email | `numberOfLines={1}` + ellipsis; badge/chip `flexShrink: 0`. |
| **Overflow — many members** | 3+ members | list grows; ScrollView already scrolls. |
| **Overflow — long household name** | hero title | `numberOfLines={1}` ellipsis; sub wraps to 2. |
| **Expired invite** | `expires_at < now` | Accept CTA → "expired" message (§5.5); sent chip → `Expired`/error (§5.4). |

---

## 7. Full token mapping — every hardcoded value → design-system token

| Old hardcoded value (current `household-setup.tsx`) | Replace with token |
|---|---|
| gradient `['#0b1021', '#2b0f50', '#1b1039']` (bg + loading) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| loading `ActivityIndicator color="#c084fc"` | `colors.primary2` |
| `#c084fc` (BackButton, hero icon, accents) | `colors.primary2` |
| `#f8fafc` (all primary text) | `colors.text` |
| `#94a3b8` (subtext, fieldDesc, heroSub) | `colors.textMuted` |
| `#64748b` (sectionLabel, role, chevron, expiry) | `colors.textMuted` (labels) / `colors.textDark` (chevrons/placeholders) |
| `#475569` (placeholderTextColor) | `colors.textDark` |
| `#7c3aed` (sendBtn fill) | `gradients.primaryGradient` (upgrade flat→gradient) / `colors.primary` |
| `['#a855f7', '#7c3aed']` (primary/accept CTA gradient) | `gradients.primaryGradient` |
| `#fff` (button text/icons) | keep `#fff` (on-gradient white is intentional & AA-safe) |
| `#fbbf24` (pending chip yellow) | `colors.warning` |
| `#f87171` (leave text/icon) | `colors.error` |
| `#60a5fa` (pending-invites action icon) | `colors.info` |
| `rgba(255,255,255,0.06)` (cards, hero, input, secondaryBtn) | `glassEffects.glass` / `colors.glassLight` |
| `rgba(255,255,255,0.08)` (avatar fill, all borders) | `colors.borderGlass` (borders) / `colors.glassMedium` (avatar) |
| `rgba(192,132,252,0.15 / 0.2 / 0.12 / 0.1)` (icon chips) | `` `${colors.primary2}26` / `${colors.primary2}33` / `${colors.primary2}1f` `` |
| `rgba(168,85,247,0.2 / 0.15 / 0.25 / 0.08)` (you-avatar, owner badge, inline invite) | `` `${colors.primary}33` `` / `` `${colors.primary2}26` `` / `` `${colors.primary2}40` `` / `` `${colors.primary2}14` `` |
| `rgba(251,191,36,0.15 / 0.25)` (pending chip fill/border) | `` `${colors.warning}26` `` / `` `${colors.warning}40` `` |
| `rgba(248,113,113,0.1 / 0.15)` (leave fill/border) | `` `${colors.error}1a` `` / `` `${colors.error}26` `` |
| `borderRadius: 20` (hero/empty) | `radius.xl` |
| `borderRadius: 18` (cards) | `radius.lg` |
| `borderRadius: 14 / 12` (inline invite, input, avatar, sendBtn, buttons) | `radius.lg` / `radius.md` |
| `borderRadius: 8` (badges/chips) | `radius.sm` |
| `borderRadius: 24` (empty icon) | `radius.xxl` |
| paddings `32 / 24` (empty/hero) | `spacing.xxl` / `spacing.xl` |
| paddings `16 / 14 / 12` | `spacing.lg` / `spacing.md` |
| paddings/gaps `10 / 8 / 4` | `spacing.sm` / `spacing.xs` |
| `content { gap: 14 }` | `gap: spacing.md` |
| header title `18/800` | `typography.h3` weight `800` |
| hero title `22/800` | `typography.h3` weight `800` |
| empty title `20/800` | `typography.h3` weight `800` |
| member/invite email `14/600` | `typography.smallBold` |
| role/expiry `12` | `typography.caption` |
| sectionLabel `11/700 ls1.2` | `typography.caption` weight `700`, letterSpacing `1.2` (moved *above* card) |
| fieldDesc `13/18` | `typography.small` |
| input `15` | `typography.body` (or `smallBold` for compactness) |
| primaryBtnText `16/800` | `typography.button` weight `800` |
| avatarText `16/700` | `typography.bodyBold` |
| chip/badge text `11/700` | `typography.caption` weight `700` |

---

## 8. Accessibility

- **Touch targets ≥ 44×44pt:** send button is now 44×44 (was 44 — keep). BackButton keeps its
  40pt visual box + 12pt hitSlop (already ≥44 effective). Action rows and the Leave button get a
  `minHeight: 44`. Member rows are non-interactive (no target needed). Gradient CTAs are full-width
  and `spacing.md` tall (≥44).
- **Color-independent status (icon + word + color):**
  - Owner → `★ Owner` (star icon + word), not color alone.
  - Sent invite pending → `◔ Pending` (`time-outline` + word); expired → `Expired` + `close-circle-outline`.
  - Error notice → `⚠` `alert-circle-outline` + "Couldn't load" text + `colors.error`.
  - This fixes the current chips that convey meaning by yellow fill only.
- **Contrast (WCAG AA):** all text on `colors.text` / `colors.textMuted` over dark glass clears
  4.5:1. Semantic tints (`…26`, `…1a`) are backgrounds only; the icon/word on them stays the
  full-opacity semantic color. White text sits only on the `primaryGradient` (purple) — verified AA.
- **Screen-reader order & labels:**
  - Header: BackButton `"Back"`; title `"Household"` as heading.
  - Hero (A): `"{name}, {n} members, you are {role}."`
  - Member row: `"{email}{, you}, {role}{, owner}."`
  - Invite input: input labeled `"Partner's email address"`; send button `"Send invite"`,
    hint `"Sends an invite to the email you entered."`
  - Sent invite: `"Invite to {email}, pending, expires {date}."` / `"…, expired."`
  - Incoming invite CTA: `"Accept and join {household}"`, hint
    `"Joins this household. You can only be in one household at a time."`
  - Create CTA: `"Create household"` (disabled announces disabled when name empty).
  - Leave: `"Leave household"`, `accessibilityRole="button"`, and since it's destructive it keeps
    the confirm dialog.
- **Reduced motion:** the only motion is button press-scale + skeleton pulse + the accept spinner.
  Under reduce-motion, press feedback becomes an instant opacity change; the `Skeleton` pulse is
  already gentle but should be swapped for a static `colors.glassMedium` block when
  `AccessibilityInfo.isReduceMotionEnabled()` is true.
- **Keyboard avoidance:** both modes have text inputs near the vertical middle/bottom. Wrap the
  `ScrollView` in `KeyboardAvoidingView` (`behavior: 'padding'` iOS) so the create/invite input
  isn't hidden by the keyboard — a gap the current screen has.

---

## 9. Developer notes

- **Reuse, don't reimplement:** `GradientBackground` (bg, `variant="bgDarkPurple"`), `Skeleton`
  (loading), `BackButton` (`fallback="/(tabs)/settings"`, `color={colors.primary2}`). No new
  shared components required. `AttentionCard` / `Sparkline` / dashboard sub-components are **not**
  relevant to this form/flow screen — do not force them in.
- **Add an explicit `errored` flag.** Today `loadData` swallows the household fetch error into
  `console.error` and falls through to the no-household branch, so a network failure looks
  identical to "user has no household." Split them: on catch, inspect the failure — a genuine
  404/"no household" → Mode B; anything else → set `errored = true` and render §4.5. Keep
  `loadedOnce` so the skeleton only shows on the first load, not on focus refreshes.
- **Group labels move outside the cards.** The current `sectionLabel` lives inside each card;
  the redesign lifts it above the card as a `typography.caption` group label (dashboard pattern).
  This is purely presentational — same strings, new position.
- **One floating card per screen.** Mode A → the household hero floats. Mode B → the *winning*
  action floats (incoming invite hero, or create hero). Everything else is flat `glass`. If two
  cards ever float, the hierarchy has broken.
- **Send button upgrade:** flat `#7c3aed` square → `gradients.primaryGradient` `LinearGradient`,
  matching the accept/create CTAs so all three "commit" actions share one visual language.
- **Preserve all functionality verbatim:** create (`POST /auth/households`), invite
  (`POST /auth/households/invite`), accept (`POST /auth/households/accept`), the leave
  confirm→"Coming soon" placeholder, both invite-loading paths (sent vs. incoming), and the
  priority-flip that puts an incoming invite above create. This is a re-skin + state-completion,
  not a behavior change.
- **`API_URL` note (pre-existing bug, flag only):** the current file references `API_URL` in
  `handleCreate`/`handleSendInvite`/`handleAccept` and in `loadData`'s dependency array, but never
  imports/defines it. Not a design concern — flag it to the implementing agent so the re-skin
  doesn't silently inherit a broken constant.

---

## 10. Handoff checklist

- [x] Both modes (has-household / no-household) redesigned with one clear primary action each
- [x] All states designed: default A, default B (invited), empty B (create), loading (skeleton), error, submitting, expired, overflow
- [x] Loading uses `Skeleton` (layout-matched), not a bare spinner
- [x] Error state added + distinguished from "no household" via explicit `errored` flag
- [x] Every hardcoded color/gradient/spacing/radius/font mapped to a design-system token
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Standard stack header with tokenized `BackButton` + centered `h3` title + refresh slot
- [x] Status made color-independent (icon + word + color): Owner, Pending, Expired, Error
- [x] Accessibility: 44pt targets, SR order/labels, reduced motion, keyboard avoidance, AA contrast
- [x] Component specs written (`docs/design/components/household-setup-*.json`)
- [x] Functionality preserved; IA improved (section order + hierarchy) without changing behavior
