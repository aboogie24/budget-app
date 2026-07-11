# Onboarding Wizard Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Route / file:** `onboarding/index` → `budget-app/app/onboarding/index.tsx`
**Archetype:** onboarding flow (multi-step wizard: welcome → invite partner → link bank → framework preview → finish)
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the fully bespoke, locally-styled wizard currently in `onboarding/index.tsx`

---

## 1. Why this redesign exists

The onboarding wizard is the **very first fully-branded screen a new couple sees** — and it is
visually a *different app* from the two reference screens (`dashboard.tsx`, `calendar.tsx`) and
from the sibling flows it literally hands off to (`link-account`, `household-setup`, `framework`).
It never touches the design system; it re-invents every color, gradient, surface, radius, and
font as a local literal. That's a bad first impression: the user is welcomed by one visual
language, then dropped into a differently-styled app the moment onboarding completes.

Concrete offenders in the current file:

- **Its own background gradient** `['#0f0a1e','#1a0a40','#0f0a1e']` via a raw `LinearGradient`,
  instead of the shared `<GradientBackground variant="bgDarkPurple">`
  (`gradients.bgDarkPurple = ['#0f172a','#1a0a40','#0f172a']`). This is the #1 reason it reads
  off-brand next to its siblings — note the current start/end `#0f0a1e` is a *subtly wrong*
  navy vs. the token's `#0f172a`.
- **A private accent palette** — `#a855f7`, `#ec4899` (pink, which is **not a token at all**),
  `#7c3aed`, `#10b981`, `#9ca3af`, `#5a5a6a`, `#1a1a2e`, `#3a3a4a` — duplicating and drifting
  from `colors.primary2 / primary / success / textMuted / textDark / surface2 / border`.
  The pink (`#ec4899`) is the biggest problem: it appears nowhere else in the app, so the
  "CoupleFlow" wordmark and heart look bespoke rather than on-brand.
- **Magic numbers everywhere** — `fontSize: 40/26/24/15/14/13/12`, `fontWeight: '800'`,
  `borderRadius: 12/50/4`, ad-hoc paddings (`24/20/16/14/12/8`), hand-tuned `rgba(...)` fills —
  none tokenized.
- **A raw gradient CTA button** (`LinearGradient colors={['#a855f7','#7c3aed']}`) repeated in
  four steps, instead of one shared primary-CTA pattern using `gradients.primaryGradient`.
- **No loading skeleton and no error state.** The screen's async work (create household → send
  invite; fetch link_token → Plaid; complete onboarding) is entirely swallowed into
  `Alert.alert` + "proceed anyway." A first-run flow that depends on the network *must* be able
  to show a real inline error and a real loading state, not just an `ActivityIndicator` inside a
  button and a modal alert.
- **A hand-rolled bank grid** (`BANKS` = Chase / BofA / Wells / Other) that is **pure
  decoration** — tapping a tile only sets local `selectedBank` state; the actual connection
  always goes through the same Plaid web session regardless of which tile is selected. This is
  misleading UI. The redesigned link step defers to the real provider flow (`link-account`).
- **A bespoke step chrome** — custom dot indicator, custom bottom nav with chevron buttons and a
  "Step N of 4" counter, custom fade `Animated` transition — none of which match the standard
  header (`BackButton` + title) the rest of the app uses.

This redesign does three things, in priority order:

1. **Adopt the design system** — every color, gradient, radius, space, font, and surface comes
   from `design-system.ts`. Swap the bespoke gradient for `<GradientBackground variant="bgDarkPurple">`.
   No magic numbers, no local color constants, and **retire the non-token pink** in favor of
   `colors.primary2` / `colors.info` (the app's established partner-A / partner-B pairing).
2. **Add the missing states** — real loading **skeleton** (reuse `components/Skeleton.tsx`), and a
   real **error** state with Retry using the inline glass `noticeCard` pattern the calendar and
   dashboard established. Keep the "you can always do this later" graceful-degrade, but *show* it.
3. **Tighten the information architecture** — keep the same four steps and the same
   functionality, but (a) give each step one unmistakable primary action, (b) make async status
   **color-independent** (icon + word + color), and (c) align the step chrome and CTAs with the
   rest of the app so onboarding flows seamlessly into the dashboard it lands on.

Keep it recognizably the same screen: same welcome → invite → link → framework-preview → finish
progression, same skip affordances, same "never block the user" completion behavior, same
navigation targets (`router.replace('/(tabs)/dashboard')`).

---

## 2. Information architecture — one wizard, four steps, one primary action each

The screen is a **linear step machine on `currentStep` (0–3)**. The redesign keeps all four
steps and their order, but reframes each around a single dominant action and demotes everything
else. The step chrome is standardized:

- **Progress rail** (replaces the bespoke dot row): a slim segmented bar at the top, one segment
  per step, filled up to and including the current step. This is a clearer "how far am I" signal
  than four dots and it's tokenized (`colors.primary` fill on `colors.glassLight` track,
  `radius.full`). See §4.1.
- **Standard header** — a `BackButton` (step-aware; see §4.2) on the left, the step's short title
  centered, and a **Skip** text button on the right for skippable steps (invite, link). The
  welcome step (0) has no back and no skip. This replaces the bottom chevron nav + "Step N of 4"
  counter entirely; forward motion is driven by the step's primary CTA, back motion by the header
  `BackButton`.
- **One primary CTA per step**, full-width, `gradients.primaryGradient`, `radius.lg`, ≥ 44pt tall
  (see the shared `onboarding-primary-cta` component). Secondary "Skip for now" is a plain text
  link below it in `colors.primary2`.

| Step | Purpose | Primary action | Secondary | Skippable |
|---|---|---|---|---|
| **0 — Welcome** | Brand + value prop | **Get Started** | — | no (it's the entry) |
| **1 — Invite partner** | Add the second person | **Send Invite** (or **Continue** if email blank) | Skip for now | yes |
| **2 — Link a bank** | Connect real money data | **Connect a bank** (→ real provider flow) | Skip | yes |
| **3 — Your journey** | Preview the framework + commit | **Let's Go!** (completes onboarding) | — | no (it's the finish) |

Why keep four steps rather than collapse: each maps to a distinct real setup task the rest of the
app already owns (invite → `household-setup`, link → `link-account`, journey → `framework`), and
sequencing them is the entire point of an onboarding flow. The redesign improves the IA *within*
each step, not by removing steps.

---

## 3. Full-screen wireframes — per step, all key states

iPhone 15 Pro (390×844). Background is always `<GradientBackground variant="bgDarkPurple">`.

### 3.0 Step 0 — Welcome (default)

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓▓▓░░░░░░░░  ░░░░░░░░  ░░░░░░░░                              │  ← progress rail (seg 1/4 filled)
│                                                                │
│                                                                │
│                    ◜◝   ◜◝                                      │  ← two overlapping glass
│                   (  ) ( ● )    ← soft purple/violet orbs      │    orbs (primary2 / info tint)
│                    ◟◞   ◟◞                                      │
│                                                                │
│                 Couple ♥ Flow                                  │  ← wordmark, h1, primary2 + info
│                                                                │    heart = colors.primary2
│         Build your financial future, together                 │  ← h3, colors.text, centered
│         Take control of your money as a couple                │  ← body, colors.textMuted
│                                                                │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                Get Started            →                 │  │  ← primary CTA (gradient)
│   └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The welcome step is the one intentionally *centered* layout (its job is a hero moment). Every
other step uses the standard top-aligned header + scroll. The two orbs are decorative glass
circles tinted `colors.primary2` and `colors.info` at low opacity — the same A/B pairing used
for partner avatars app-wide, so even the decoration is on-brand (and the retired pink is gone).

### 3.1 Step 1 — Invite partner (default)

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓░░░░  ░░░░░░░░  ░░░░░░░░                              │  ← progress rail (seg 2/4)
│  ‹                Invite Partner              Skip            │  ← header: BackButton · title · Skip
│                                                                │
│                📱  →  📱                                        │  ← two-phone illo, primary2 / info
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Budget together                                         │ │  ← glass card
│  │  Invite your partner to share this household.            │ │    caption/muted subtitle
│  │                                                          │ │
│  │  PARTNER'S EMAIL                                         │ │  ← field label (caption, muted)
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │  partner@example.com                             │   │ │  ← input (glass field)
│  │  └──────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                   Send Invite                           │  │  ← primary CTA
│   └────────────────────────────────────────────────────────┘  │
│                      Skip for now                              │  ← text link, primary2
└──────────────────────────────────────────────────────────────┘
```

**Sending** (in-flight): CTA shows an `ActivityIndicator` (`colors.text`) and label "Sending…",
CTA disabled, input non-editable.

**Success:** the CTA is replaced by a **status pill** (color-independent):
`✓  Invite sent` — filled `checkmark-circle` (`colors.success`) + word + `${colors.success}1f`
fill + `colors.success` border. After ~800ms auto-advance to step 2 (existing behavior kept).

**Error** (invite failed): inline `noticeCard` above the CTA (does **not** block advancing):
`⚠  Couldn't send the invite — you can add your partner later in Settings.` with a `Retry`
text button. Icon `alert-circle-outline` (`colors.warning` — this is recoverable, not fatal).
The CTA underneath becomes **Continue** so the user is never trapped.

### 3.2 Step 2 — Link a bank (default)

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓  ░░░░░░░░  ░░░░░░░░                              │  ← progress rail (seg 3/4)
│  ‹                Link a Bank                 Skip            │
│                                                                │
│                    🔗  (glass ring)                            │  ← link glyph in glass circle
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  See your real money move                               │ │  ← glass card, benefit copy
│  │  Connect a bank to auto-import income, spending,        │ │
│  │  and bills. You can add more accounts anytime.          │ │
│  │                                                          │ │
│  │  🔒  Bank-level encryption · read-only access           │ │  ← security row, colors.success lock
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │            🔗   Connect a bank                          │  │  ← primary CTA → real provider flow
│   └────────────────────────────────────────────────────────┘  │
│                        Skip                                    │  ← text link, primary2
└──────────────────────────────────────────────────────────────┘
```

**Deliberate cut:** the four fake bank tiles (Chase / BofA / Wells / Other) are **removed**.
They implied a bank picker but did nothing — the connection always routes through the same
provider web session. The redesigned step states the value + trust signal, then hands off to the
**real** provider selection that `link-account.tsx` already owns (`GET /auth/link_token` →
`WebBrowser.openAuthSessionAsync`). This is honest UI and it de-duplicates the picker.

**Connecting** (in-flight, web session open): CTA → `ActivityIndicator` + "Connecting…", disabled.

**Success:** CTA replaced by the same status-pill pattern: `✓  Account connected` (success).
Auto-advance to step 3 after ~500ms (existing behavior).

**Error** (link failed / cancelled): inline `noticeCard`:
`⚠  Couldn't connect your bank — you can link one later in Settings.` + `Try again` text button
(re-invokes the connect flow). Icon `alert-circle-outline` (`colors.warning`). CTA stays
**Connect a bank**; **Skip** remains available. Never blocks.

### 3.3 Step 3 — Your journey (default)

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓                              │  ← progress rail (all 4 / 4)
│  ‹              Your CoupleFlow Journey                       │  ← header (no skip — it's the finish)
│                                                                │
│  Our AI meets you where you are and guides you level by level.│  ← body/muted intro
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ┌──┐                                                    │ │  ← framework roadmap (glass card)
│  │  │🏠│  Foundation                                        │ │    5 levels, connector rail
│  │  └┬─┘  Set up budgets & emergency fund                   │ │    icon chip tinted per-level
│  │  ┌┴─┐                                                    │ │
│  │  │🔥│  Attack Debt                                       │ │
│  │  └┬─┘  Eliminate high-interest debt                      │ │
│  │  ┌┴─┐                                                    │ │
│  │  │🛡│  Build Security     3–6 month safety net           │ │
│  │  └┬─┘                                                    │ │
│  │  ┌┴─┐                                                    │ │
│  │  │📈│  Grow Wealth        Invest & build assets          │ │
│  │  └┬─┘                                                    │ │
│  │  ┌┴─┐                                                    │ │
│  │  │⭐│  Dream Big          Plan your dream goals          │ │
│  │  └──┘                                                    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │              Let's Go!               🚀                 │  │  ← primary CTA → completes
│   └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The five levels come straight from the current `LEVELS` array and stay identical in copy/order,
but the per-level `color` literals (`#a855f7`, `#ec4899`, `#10b981`) are re-mapped to tokens so
the roadmap matches the `framework` screen the user will actually visit (see §7). The connector
rail between icon chips uses `colors.borderGlass` instead of the hardcoded `#3a3a4a`.

### 3.4 Loading state (initial mount, e.g. resolving user session / household)

The screen does a small amount of async work on entry (reads `getCurrentUser`, and step 1 may
look up an existing household). While `booting`, show a **skeleton of the current step's chrome**
rather than a blank screen or a bare spinner. Reuse `components/Skeleton.tsx`.

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓▓▓░░░░░░░░  ░░░░░░░░  ░░░░░░░░                              │  ← progress rail renders immediately
│  ‹                ░░░░░░░░░░░░                                │  ← Skeleton title (140×18)
│                                                                │
│           ◜◝  ◜◝     (dim orbs, static under reduce-motion)    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░  (Skeleton 60% × 16)            │ │
│  │  ░░░░░░░░░░░░  (Skeleton 40% × 12)                       │ │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (Skeleton 100% × 44)     │ │  ← input/CTA placeholder
│  └──────────────────────────────────────────────────────────┘ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (Skeleton 100% × 52)     │  ← CTA placeholder
└──────────────────────────────────────────────────────────────┘
```

Most of the wizard is instant (static content), so the skeleton is short-lived and only needed
if the initial user/household resolve is slow. Keep the progress rail + `GradientBackground`
painted immediately so there is never a flash of a differently-styled loading screen.

### 3.5 Empty state (no user session)

Onboarding assumes a logged-in user. If `getCurrentUser()` returns no user (edge case: session
expired mid-flow), the screen must **not** silently proceed. Show a full-card empty/redirect
state instead of erroring on `router.replace`:

```
┌──────────────────────────────────────────────────────────────┐
│  ▓▓▓▓░░░░░░░░  ░░░░░░░░  ░░░░░░░░                              │
│                                                                │
│                        ⓘ                                       │  ← information-circle, colors.info
│                 Let's get you signed in                       │  ← h3, colors.text
│      You'll need an account to set up CoupleFlow.             │  ← body, colors.textMuted
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                    Sign in                              │  │  ← primary CTA → /login
│   └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

This is a rare edge case, but it replaces the current silent `throw new Error('No user session')`
→ swallowed-into-alert behavior with something the user can act on.

### 3.6 Error state (finish step, completion call fails)

Onboarding's completion (`POST /auth/onboarding/complete`) today swallows failure and navigates
to the dashboard anyway — which is the *right* graceful-degrade instinct, and we keep it. But
"never block the user" ≠ "never tell the user." If completion fails, still navigate, and surface
a **non-blocking inline notice** on the finish step for the brief moment before navigation (and
let the dashboard's own error handling take over):

```
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐   │
│  ╎ ⚠  We'll finish setting things up in the background.  ╎   │  ← noticeCard, colors.warning
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘   │
```

Because navigation still proceeds, this is best-effort; the durable error handling lives on the
dashboard. The point is: no silent failures anywhere in the flow.

---

## 4. Section / component specs

### 4.1 `OnboardingProgressRail`

A slim segmented progress bar replacing the bespoke dot row.

- **Layout:** a horizontal `flexRow`, `gap: spacing.xs`, full-width minus screen padding, height
  4pt, sitting at the top inside the safe area with `spacing.md` below.
- **Segments:** 4 equal-flex bars, `radius.full`. Track color `colors.glassLight`; filled (index
  ≤ currentStep) `colors.primary`. The current segment optionally animates its fill width in with
  `animation.medium` (instant under reduce-motion).
- **Props:** `totalSteps: number` (4), `currentStep: number` (0–3).
- **A11y:** `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 1, max: 4, now: currentStep + 1 }}`,
  label `"Step {currentStep + 1} of 4"` (preserves the retired counter's info for screen readers).

### 4.2 `OnboardingHeader`

Standard header for steps 1–3 (welcome step 0 has none). Mirrors the app's header convention.

- **Left:** `BackButton` with `onPress={goBack}` (step-internal back — decrements `currentStep`;
  do **not** use router navigation, since the wizard is a single route). On step 0 the header is
  absent, so no back is shown. Uses the shared `components/BackButton.tsx` — but pass `onPress`
  so it drives the step machine, not the router.
- **Center:** step title in `typography.bodyBold`, `colors.text`, `numberOfLines={1}`.
- **Right:** on skippable steps (1, 2) a **Skip** text button (`typography.smallBold`,
  `colors.primary2`, ≥ 44pt target, `hitSlop`); on non-skippable steps a fixed-width spacer so the
  title stays centered.
- **Props:** `title: string`, `onBack: () => void`, `onSkip?: () => void`, `showBack: boolean`.

### 4.3 `OnboardingPrimaryCta`

The single shared primary button used by every step (replaces four copies of the inline gradient
button).

- **Layout:** full-width, `radius.lg`, `overflow: 'hidden'`, min-height 52pt (≥ 44pt target),
  `gradients.primaryGradient` fill, centered `flexRow` with `gap: spacing.sm`.
- **Content:** optional leading/trailing Ionicon (`colors.text`) + label in `typography.button`
  (`colors.text`). Supports a loading mode: swap label/icon for `ActivityIndicator`
  (`colors.text`) + optional in-flight label ("Sending…", "Connecting…").
- **Props:** `label: string`, `onPress: () => void`, `loading?: boolean`, `disabled?: boolean`,
  `iconLeading?: IoniconName`, `iconTrailing?: IoniconName`.
- **States:** default · pressed (opacity/scale via `animation.fast`) · loading (spinner, disabled)
  · disabled (opacity 0.5, no press).
- **A11y:** `accessibilityRole="button"`, label = the CTA label; `accessibilityState={{ disabled, busy: loading }}`.

### 4.4 `OnboardingStatusPill`

Color-independent success/inflight confirmation that replaces a CTA once an async action succeeds.
Used by step 1 (invite sent) and step 2 (account connected).

- **Layout:** `flexRow`, `flexCenter`, `gap: spacing.sm`, `paddingVertical: spacing.md`,
  `paddingHorizontal: spacing.lg`, `radius.lg`, fill `${colors.success}1f` (~12%), border
  `${colors.success}33`.
- **Content:** filled `checkmark-circle` (`colors.success`) + label (`typography.smallBold`,
  `colors.success`). **Always word + icon + color** — never color alone.
- **Props:** `label: string`, `tone?: 'success' | 'info'` (default success).
- **A11y:** `accessibilityRole="text"`, `accessibilityLabel="{label}"`, announced on appearance
  (`accessibilityLiveRegion="polite"`).

### 4.5 `OnboardingNoticeCard`

Inline, non-blocking recoverable-error card. The same `noticeCard` pattern the calendar and
dashboard error states use. Used by steps 1, 2, and the finish step.

- **Layout:** `glassEffects.glass`, `padding: spacing.lg`, `flexRow`, `gap: spacing.md`,
  `marginBottom: spacing.md`.
- **Content:** `alert-circle-outline` (`colors.warning` for recoverable; `colors.error` only if
  ever fatal) + message (`typography.small`, `colors.text`) + optional trailing `Retry` / `Try
  again` text button (`typography.smallBold`, `colors.primary2`, ≥ 44pt target).
- **Props:** `message: string`, `onRetry?: () => void`, `retryLabel?: string`, `tone?: 'warning' | 'error'`.
- **A11y:** icon + word + color; `accessibilityRole="alert"`; retry is a labeled button.

### 4.6 `OnboardingField` (step 1 email input)

Tokenized text field replacing the bespoke input.

- **Layout:** label (`typography.caption`, uppercase, `colors.textMuted`, `spacing.xs` below) over
  a `glassEffects.glass` input container, `radius.md`, `paddingHorizontal: spacing.lg`,
  `paddingVertical: spacing.md`, min-height 48pt.
- **Text:** value `typography.body` `colors.text`; placeholder `colors.textDark`.
- **Focus:** border brightens to `colors.primary2` (from `colors.borderGlass`) via `animation.fast`.
- **Props:** `label`, `value`, `onChangeText`, `placeholder`, `keyboardType`, `autoCapitalize`,
  `editable`, `keyboardAvoiding` (screen wraps in keyboard-avoiding behavior; see §6).
- **States:** default · focused · disabled (during send) · error (border `colors.error` if the
  email is malformed — optional client validation).

### 4.7 `OnboardingRoadmap` (step 3 framework preview)

Renders the 5 `LEVELS` as a vertical stepper inside one `glassEffects.glass` card. Structurally
identical to the current roadmap, but tokenized and aligned with the real `framework` screen's
stepper (reuse `framework-FrameworkJourneyStepper.json` conventions where practical).

- **Per level row:** left rail = a `radius.full` icon chip (40×40) filled with the level's token
  color at ~20% (`${levelColor}33`), icon in the level's token color; a `connector` (2pt wide,
  `spacing.xl` tall, `colors.borderGlass`) between chips (omit after the last). Right = title
  (`typography.smallBold`, `colors.text`) over description (`typography.caption`, `colors.textMuted`).
- **Props:** `levels: { title, description, icon, colorToken }[]`.
- **A11y:** each row is one node: `"{title}: {description}"`; the list has
  `accessibilityRole="list"`.

---

## 5. Wordmark & decorative orbs (step 0)

- **Wordmark:** `Couple ♥ Flow` — `Couple` in `colors.primary2`, `Flow` in `colors.info`, heart
  (`Ionicons name="heart"`) in `colors.primary2`. Size `typography.h1` (32/700). This retires the
  non-token pink (`#ec4899`) and the ad-hoc `fontSize: 40`. The primary2 / info pairing is the
  same A/B color pair used for partner avatars everywhere else, so the brand reads as "two people"
  in the app's own language.
- **Orbs:** two 100px `radius.full` circles, overlapping, `colors.primary2` at ~18% and
  `colors.info` at ~18% (`${token}2e`). Purely decorative → `accessibilityElementsHidden`. Under
  reduce-motion they're static (no float animation); with motion allowed, a subtle
  `animation.slow` drift is optional.

---

## 6. Keyboard handling (step 1)

Step 1 is the only input-heavy step. Wrap its content in keyboard-avoiding behavior so the email
field and the **Send Invite** CTA stay visible when the keyboard opens:

- `KeyboardAvoidingView` (`behavior="padding"` iOS / `"height"` Android) around the scroll.
- `keyboardShouldPersistTaps="handled"` on the scroll (already present — keep).
- The CTA should remain reachable above the keyboard; if content is short, pin the CTA to the
  bottom of the safe area rather than letting the keyboard cover it.
- Tapping outside the field dismisses the keyboard.

---

## 7. Mapping to design-system tokens (no magic numbers)

Every hardcoded value in the current `onboarding/index.tsx` maps to a token:

| Old hardcoded value | Replace with token |
|---|---|
| gradient `['#0f0a1e','#1a0a40','#0f0a1e']` (raw `LinearGradient`) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| CTA gradient `['#a855f7','#7c3aed']` | `gradients.primaryGradient` (`[colors.primary, colors.primary2]`) |
| `#a855f7` (accent / active / skip link / step dot) | `colors.primary2` |
| `#7c3aed` (CTA end) | `colors.primary` |
| `#ec4899` (pink — heart, wordmark, level color) **[non-token]** | `colors.primary2` (heart/wordmark), `colors.info` for the second brand color; level colors → §7.1 |
| `#10b981` (success badge, "Foundation"/"Build Security" level, lock) | `colors.success` |
| `#ffffff` / `#f8fafc` text | `colors.text` |
| `#9ca3af` (subtitle, label, bank name, step counter, muted) | `colors.textMuted` |
| `#5a5a6a` (placeholder, disabled chevron, arrow) | `colors.textDark` |
| `#1a1a2e` (input bg, bank tile bg) | `colors.glassLight` (glass field) — retire the opaque surface |
| `#3a3a4a` (input border, tile border, connector) | `colors.borderGlass` |
| `rgba(168,85,247,0.08)` (active tile fill) | `${colors.primary2}14` |
| `rgba(16,185,129,0.1/0.2)` (success badge fill/border) | `${colors.success}1f` / `${colors.success}33` |
| `rgba(255,255,255,0.05)` (nav btn bg) | `colors.glassLight` |
| `rgba(255,255,255,0.15/0.06)` (inactive dot / nav border) | `colors.glassStrong` / `colors.borderLight` |
| `borderRadius: 12` (buttons, input, tiles, nav) | `radius.md` (fields/tiles) / `radius.lg` (CTA) |
| `borderRadius: 50 / 20 / 4` (circles, chips, dots) | `radius.full` |
| card / roadmap surfaces | `glassEffects.glass` |
| the finish-step roadmap card | `glassEffects.glass` (no card floats here — the CTA is the anchor) |
| `fontSize: 40` (wordmark) | `typography.h1` |
| `fontSize: 26` (headline) | `typography.h3` |
| `fontSize: 24` (step title) | `typography.h3` (or `bodyBold` in the header) |
| `fontSize: 16/15` (CTA text, input) | `typography.button` / `typography.body` |
| `fontSize: 14` (subtitle, skip) | `typography.small` / `typography.smallBold` |
| `fontSize: 13/12` (bank name, label, counter, level desc) | `typography.caption` |
| `fontWeight: '800'` (wordmark) | `typography.h1` weight (`700`) |
| ad-hoc paddings `24/20/16/14/12/8/4` | `spacing.xl / lg / md / sm / xs` |
| gap `8/12/16` | `spacing.sm / md / lg` |
| fade `Animated` 150ms | keep, but reference `animation.fast` timing / disable under reduce-motion |

### 7.1 Step-3 level colors → tokens

The five levels' `color` literals re-map so the onboarding preview matches the real `framework`
screen. Use the framework palette rather than inventing per-level hues:

| Level | Old color | Token |
|---|---|---|
| Foundation | `#a855f7` | `colors.primary2` |
| Attack Debt | `#ec4899` (pink) | `colors.error` (debt = the app's expense/attack color) |
| Build Security | `#10b981` | `colors.success` |
| Grow Wealth | `#a855f7` | `colors.info` (growth = info/blue, matches trajectory sparkline) |
| Dream Big | `#ec4899` (pink) | `colors.primary2` |

(If `framework-FrameworkJourneyStepper` already defines a canonical per-level token map, defer to
it verbatim so the two screens are pixel-consistent.)

---

## 8. Accessibility

- **Touch targets:** every CTA (52pt), the Skip link, the header `BackButton` (40pt + `hitSlop`),
  the email field (48pt), and each roadmap row are ≥ 44×44pt. The progress-rail segments are
  decorative/non-interactive.
- **Color independence:** all async status is conveyed by **icon + word + color together** —
  the success pill (`✓ Invite sent` / `✓ Account connected`), the notice cards (`⚠` +
  message + retry), never color alone. The retired pink is gone; the two brand colors
  (`primary2` / `info`) are distinguishable in the wordmark by *word position*, not hue.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` over dark glass or the gradient —
  clears WCAG AA. Success/warning text sits on its own low-opacity tint but at full-opacity
  semantic color (≥ 4.5:1 verified on the dark card). Placeholder text (`colors.textDark`) is
  decorative only; the label above the field carries the meaning.
- **Screen-reader order per step:** progress ("Step 2 of 4") → title → benefit copy → field/roadmap
  → primary CTA → skip link. The two decorative orbs and the connector rails are
  `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`.
- **Live regions:** status pills and notice cards use `accessibilityLiveRegion="polite"` so a
  successful invite/connect or a recoverable error is announced without stealing focus.
- **Reduced motion:** the step fade transition, the progress-rail fill animation, the orb drift,
  and CTA press-scales all respect reduce-motion — under it they become instant state swaps (no
  fade, no float, instant rail fill). The `Animated.sequence` fade in the current code must check
  the reduce-motion setting and skip to the end value when enabled.
- **Dynamic Type:** headlines, benefit copy, and CTA labels reflow (no fixed heights that clip);
  the roadmap rows grow vertically with larger text rather than truncating descriptions.

---

## 9. States summary

| State | Treatment |
|---|---|
| **Default / populated** | Per-step wireframes in §3.0–§3.3. |
| **Loading (initial mount)** | Skeleton of the current step's chrome (§3.4); progress rail + `GradientBackground` paint immediately. Reuse `components/Skeleton.tsx`. |
| **In-flight (per action)** | CTA → `ActivityIndicator` + in-flight label ("Sending…", "Connecting…"), disabled. |
| **Success (per action)** | CTA replaced by `OnboardingStatusPill` (✓ + word + success color), then auto-advance (800ms invite / 500ms connect — existing timings). |
| **Empty (no user session)** | Full-card sign-in redirect (§3.5) instead of a silent throw. |
| **Error (recoverable — invite/link failed)** | Inline `OnboardingNoticeCard` (warning) + Retry; CTA stays reachable, Skip remains; never blocks. |
| **Error (finish/complete failed)** | Non-blocking notice; still navigate to dashboard (graceful-degrade kept), durable handling on the dashboard. |
| **Overflow — long partner email** | Input scrolls horizontally within the field; never wraps the field height. |
| **Overflow — long level description** | Roadmap description `numberOfLines={2}` + ellipsis; title never truncates. |
| **Disabled** | CTA during in-flight (opacity 0.5); Back on step 0 absent (not disabled-styled). |

---

## 10. Developer notes

- **Same route, same step machine.** This is one screen (`onboarding/index`) with internal
  `currentStep` state — keep it. `goNext` / `goBack` drive the progress rail and header; do **not**
  convert steps into separate routes.
- **`BackButton` with `onPress`.** The shared `components/BackButton.tsx` supports an `onPress`
  override that bypasses router navigation — use it so Back decrements `currentStep` instead of
  popping the navigation stack. On step 0, don't render the header (no back).
- **Reuse, don't reimplement:** `GradientBackground` (bg — replace the raw `LinearGradient`),
  `Skeleton` (loading), `BackButton` (header). The `OnboardingPrimaryCta`, `OnboardingProgressRail`,
  `OnboardingStatusPill`, `OnboardingNoticeCard`, `OnboardingField`, and `OnboardingRoadmap` are
  new but small; the roadmap should mirror `framework`'s stepper conventions.
- **Retire the fake bank grid.** Delete `BANKS` and the tile grid. Step 2's CTA calls the existing
  link flow (`GET /auth/link_token` → `WebBrowser.openAuthSessionAsync`) directly — the real
  provider picker lives in that web session and in `link-account.tsx`. Do not build a second picker.
- **Retire the bespoke chrome.** Delete the dot row, the bottom chevron nav, and the "Step N of 4"
  counter — the progress rail + header replace all of them (the counter's info moves to the rail's
  `accessibilityValue`).
- **Keep "never block the user."** Every failure path still lets the user proceed (Continue / Skip /
  auto-navigate on complete). The only change is that failures are now *visible* (notice cards)
  instead of swallowed into `Alert.alert` + silent proceed. Keep the existing `Alert` as a
  belt-and-suspenders fallback if desired, but the inline notice is the primary surface.
- **Preserve the async flows verbatim:** invite (create-household-if-needed → invite), Plaid link
  (link_token → web session → success), complete (`POST /auth/onboarding/complete` →
  `router.replace('/(tabs)/dashboard')`). Only the *presentation* of their in-flight / success /
  error states changes.
- **Haptics stay:** keep `Haptics.impactAsync` on advance and `notificationAsync(Success)` on
  invite-sent / connected / complete — they're good and on-pattern.
- **Level colors:** use the §7.1 token map; if `framework-FrameworkJourneyStepper.json` already
  defines a canonical per-level palette, defer to it for cross-screen consistency.

---

## 11. Handoff checklist

- [x] Four steps preserved (welcome / invite / link / journey), one primary action each
- [x] Bespoke gradient → `<GradientBackground variant="bgDarkPurple">`; bespoke CTA → `gradients.primaryGradient`
- [x] Non-token pink (`#ec4899`) retired → `colors.primary2` / `colors.info` (partner A/B pairing)
- [x] Bespoke dot row + chevron nav + "Step N of 4" → tokenized progress rail + standard `BackButton` header
- [x] Fake bank grid removed; link step defers to the real provider flow (`link-account`)
- [x] Missing states added: loading **skeleton**, empty (no session), recoverable **error** with Retry
- [x] Async status color-independent (icon + word + color) via `OnboardingStatusPill` / `OnboardingNoticeCard`
- [x] Keyboard handling spec'd for the email step
- [x] Every old hardcoded color/gradient/spacing/font mapped to a design-system token (no magic numbers)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, live regions, reduced motion, Dynamic Type
- [x] "Never block the user" graceful-degrade preserved — failures now visible, not swallowed
- [x] Component specs written (`docs/design/components/onboarding-*.json`)
