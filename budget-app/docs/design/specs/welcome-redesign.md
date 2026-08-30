# Welcome (Onboarding Entry) Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke full-bleed styling in `budget-app/app/welcome.tsx`
**Archetype:** auth / marketing (full-bleed) — sibling to `register.tsx`, `login.tsx`

---

## 1. Why this redesign exists

The current welcome screen is visually a **different app** from the rest of CoupleFlow.
It is the *first* screen a new user sees, and it sets none of the theme the redesigned
dashboard and calendar establish. Concretely, everything on it is bespoke:

- **A stock Unsplash photo** (`images.unsplash.com/photo-...`) as a full-bleed
  `ImageBackground`. It's a network image on the launch path (blank/flicker while it
  loads, breaks offline), and it looks nothing like the app's signature
  `bgDarkPurple` gradient. Every other screen renders `GradientBackground`.
- **A near-white card** (`rgba(255,255,255,0.96)`, `borderRadius: 24`) with **dark text
  on white** — the exact inverse of the app's dark-glass surfaces. The moment the user
  taps "Create an account" they're thrown onto `register.tsx`'s dark glass form; the
  jump is jarring.
- **Hardcoded colors everywhere** — `#7c3aed`, `#a855f7`, `#ede9fe`, `#6b21a8`,
  `#f4f3ff`, `#e4ddff`, `#0f172a`, `#475569` — none from `design-system.ts`.
- **Hardcoded type** — `fontSize: 28 / 15 / 12`, `fontWeight: '800'/'700'` — not
  `typography.*`.
- **Hardcoded spacing/radius** — `24 / 22 / 14 / 12 / 8`, `borderRadius 24 / 999 / 14 /
  12` — not `spacing.*` / `radius.*`.
- **A brand mismatch:** it renders a plain text badge `CoupleFlow`, while `register.tsx`
  and `login.tsx` use the real wordmark **"Couple ♥ Flow"** (purple / heart / pink).
  First impression should match the auth screens the user is about to land on.
- **Wrong navigation verb:** both CTAs use `router.replace(...)`. From the app's true
  entry point, `replace` is fine, but it means a user who taps into Register/Login has
  **no way back to Welcome** — the auth screens have no back affordance to a welcome that
  no longer exists in the stack. The redesign keeps `replace` (welcome is a root) but the
  auth screens already cross-link to each other, so this is preserved as-is.

This redesign does one thing: **make the first screen unmistakably CoupleFlow** — same
`bgDarkPurple` gradient, same glass surfaces, same tokens, same wordmark, same button
language as the auth screens — while keeping it recognizably the same welcome screen
(brand, value-prop line, feature chips, two CTAs).

### What this screen is NOT

It's a marketing/entry screen, not a data screen. It has **no fetched data**, so the
"loading / empty / error" states are not data states in the dashboard sense. This spec
still defines them, mapped to what actually varies on an entry screen:

- **Loading** = the brief moment before fonts/OAuth availability resolve (a skeleton so
  the screen never flashes empty).
- **Empty** = the honest default (no personalization) — this *is* the default populated
  state; there is no "no data" variant. Documented so the frontend agent doesn't invent
  one.
- **Error** = OAuth/session-check failure surfaced non-destructively (see §5.4), plus the
  offline case that the old stock-photo background failed silently.

---

## 2. Information architecture — what changed and why

Same content, re-ordered into the app's standard **full-bleed vertical rhythm** (brand →
hero value prop → proof → actions), matching how `register.tsx` centers a single column.

| Zone | Old | Redesigned | Rationale |
|---|---|---|---|
| Background | Unsplash photo + dark overlay | `<GradientBackground variant="bgDarkPurple">` | Match the app; no network dependency on launch; works offline. |
| Brand | text badge "CoupleFlow" | **"Couple ♥ Flow" wordmark** (matches auth screens) | One brand mark across welcome/register/login. |
| Hero | white card, dark title | Title + subtitle directly on gradient, `typography.h1`/`body` | The gradient *is* the surface; no inverted white card. |
| Proof | 4 chips in a white pill row | **Feature chips as glass pills** (`glassEffects.glass`), horizontally scrollable | Same content, on-theme surface; still scannable. |
| Actions | solid purple CTA + purple-outline ghost | **Primary gradient CTA + glass secondary** (auth-screen button language) | The primary button matches register's `['#a855f7','#7c3aed']` gradient → `gradients.primaryGradient`. |
| — | (none) | **thin legal/consent line** under the CTAs | Standard for an entry screen; low-weight `caption`. |

Layout decision: the old design pinned the card to the **bottom** (`justifyContent:
'flex-end'`). The redesign keeps the actions anchored to the bottom (thumb zone) but lifts
the **brand + hero** to the upper third, letting the gradient breathe in the middle. This
is the classic marketing-screen scan pattern and matches the vertical centering language
of the auth screens without literally copying their centered card.

---

## 3. Wireframes

iPhone 15 Pro (390×844). Full-bleed `bgDarkPurple` gradient behind everything. All content
inside the safe area, screen padding `spacing.xl` (24) horizontal.

### 3.1 Default / populated (the primary state)

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │  ← safe-area top
│                                                                │
│                     Couple ♥ Flow                              │  ← wordmark (brand)
│                                                                │     primary2 / heart / pink-ish
│                                                                │  ← spacing.xxl breathing room
│                                                                │
│   Build your money                                             │  ┐ HERO
│   rhythm together                                              │  │ typography.h1, colors.text
│                                                                │  │
│   Shared budgets, linked accounts, and real-time              │  │ subtitle
│   priorities built for partners.                              │  │ typography.body, colors.textMuted
│                                                                │  ┘
│                                                                │  ← spacer (flex:1 pushes rest down)
│                                                                │
│   ┌─────────────┐┌──────────────┐┌───────────────┐┌────────┐  │  ┐ FEATURE CHIPS
│   │Couples-first││ Shared goals ││ Smart insights││Invite… │  │  │ glass pills, horizontal scroll
│   └─────────────┘└──────────────┘└───────────────┘└────────┘  │  ┘ typography.smallBold, primary2 text
│                                                                │  ← spacing.xl
│   ┌──────────────────────────────────────────────────────┐    │  ┐ PRIMARY CTA
│   │                Create an account            →         │    │  │ gradients.primaryGradient
│   └──────────────────────────────────────────────────────┘    │  ┘ radius.lg, 52pt tall
│                                                                │  ← spacing.md
│   ┌──────────────────────────────────────────────────────┐    │  ┐ SECONDARY CTA
│   │              I already have an account                │    │  │ glassEffects.glass surface
│   └──────────────────────────────────────────────────────┘    │  ┘ colors.text label
│                                                                │  ← spacing.md
│      By continuing you agree to our Terms & Privacy.           │  ← caption, textMuted, centered
│                                                                │  ← safe-area bottom
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Loading (skeleton — pre-mount / OAuth-availability resolving)

Reuse `components/Skeleton.tsx`. The gradient, wordmark, and both CTAs can render
immediately (they need no async data), so only the **hero text and chips** skeleton in.
This keeps the launch feeling instant and prevents a layout jump when the (tiny) async
resolves. If the frontend agent determines nothing is actually async on this screen, the
skeleton state may be omitted — but it is specified here for parity with the reference
screens and to cover cold-start font load.

```
┌──────────────────────────────────────────────────────────────┐
│                     Couple ♥ Flow                              │  ← wordmark renders immediately
│                                                                │
│   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                                            │  ← Skeleton h1 line 1 (70% w, 32h)
│   ▇▇▇▇▇▇▇▇▇▇                                                  │  ← Skeleton h1 line 2 (45% w, 32h)
│                                                                │
│   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                                   │  ← Skeleton subtitle (90% w, 16h)
│   ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                                            │  ← Skeleton subtitle (60% w, 16h)
│                                                                │
│   ▇▇▇▇▇▇▇  ▇▇▇▇▇▇▇▇  ▇▇▇▇▇▇▇▇▇                                │  ← 3 Skeleton chips (radius.full)
│                                                                │
│   ┌──────────────────────────────────────────────────────┐    │  ← CTAs render live (no data needed)
│   │                Create an account            →         │    │
│   └──────────────────────────────────────────────────────┘    │
│   ┌──────────────────────────────────────────────────────┐    │
│   │              I already have an account                │    │
│   └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Empty (= the default — no personalization variant)

There is **no separate empty state**. The welcome screen has no per-user data, so its
default *is* its empty state — the wireframe in §3.1. This is called out explicitly so the
frontend agent does not build a phantom "no data" branch. If a future session-check ever
returns a returning user's name, the only change would be adding a `Welcome back, {name}`
line above the hero — noted as forward-compat, **not** in scope for v1.

### 3.4 Error (OAuth unavailable / offline — non-destructive)

The screen must **never blank** on a failure. Two real failure modes on an entry screen,
both handled inline without removing the primary path:

**A. OAuth provider unavailable** (Google request not ready / Apple not on device) — the
CTAs that create/enter an account with email still work; only the SSO affordances (if
surfaced here) degrade. Since v1 welcome routes to `register`/`login` (which own SSO),
this mostly manifests as: **both CTAs always remain enabled**; no SSO buttons on welcome
itself, so there is nothing to disable here. Documented so no one adds SSO to welcome
without a disabled/error treatment.

**B. Offline / asset failure** — the old stock photo failed *silently* (blank dark
overlay). The gradient background can never fail (no network), which is itself the fix. If
a future returning-user session check fails, show a **thin inline notice** above the CTAs,
never a full-screen error:

```
┌──────────────────────────────────────────────────────────────┐
│                     Couple ♥ Flow                              │
│                                                                │
│   Build your money rhythm together                            │
│   Shared budgets, linked accounts, and real-time priorities.  │
│                                                                │
│   ┌────────────────────────────────────────────────────┐      │  ← inline notice (glass, subtle)
│   │ ⚠ Couldn't check your session — you can still sign  │      │     icon(colors.warning) + word + text
│   │   in below.                              [ Retry ]  │      │     colors.textMuted body, Retry link
│   └────────────────────────────────────────────────────┘      │
│                                                                │
│   [ chips … ]                                                  │
│   ┌──────────────────────────────────────────────────────┐    │  ← CTAs stay fully functional
│   │                Create an account            →         │    │
│   └──────────────────────────────────────────────────────┘    │
│   ┌──────────────────────────────────────────────────────┐    │
│   │              I already have an account                │    │
│   └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Section / component specs

### 4.1 Screen shell

- Root: `<GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>` replacing the
  `ImageBackground` + `LinearGradient` overlay entirely.
- Inside: `SafeAreaView` (from `react-native-safe-area-context`, matching dashboard).
- A single vertical column, screen padding `spacing.xl` (24) horizontal, `spacing.xl`
  top / bottom inside the safe area. A `flex: 1` spacer between the hero block and the
  chips block pushes the actions to the bottom thumb zone.
- No `BackButton` on the **default** welcome (it's the root — there is nowhere back to
  go; `BackButton` correctly renders `null` when `!canGoBack()`). It is listed as a shared
  component only for archetype consistency; on this specific root screen it is intentionally
  absent. (`register`/`login` are the ones that could carry a back-to-welcome affordance,
  out of scope here.)

### 4.2 Brand wordmark — `welcome-BrandWordmark`

Reproduces the auth-screen mark so first impression == auth screens.

- Row: `Text "Couple"` + `Ionicons name="heart"` + `Text "Flow"`, `spacing.xs` gap,
  centered.
- `"Couple"` → `colors.primary2` (`#a855f7`); heart → `colors.accent`-adjacent pink. The
  existing auth screens use `#ec4899` for the heart/"Flow"; **the closest design-system
  token is `colors.error`-family is wrong** — pink `#ec4899` is not in the palette. Use
  `colors.primary2` for "Couple", and for the heart/"Flow" use `colors.accent` (`#c084fc`)
  to stay *inside* the design system rather than importing the off-token pink. This is a
  deliberate small drift from the auth screens toward the tokenized palette; flagged in
  Developer Notes as a candidate to reconcile app-wide.
- Type: `typography.h3` weight, letterSpacing per `typography` defaults.

### 4.3 Hero block — `welcome-Hero`

- **Title:** `typography.h1` (32/700), `colors.text`, left-aligned, up to 2 lines.
  Copy preserved: "Build your money rhythm together".
- **Subtitle:** `typography.body` (16/400), `colors.textMuted`, `spacing.md` below title.
  Copy preserved: "Shared budgets, linked accounts, and real-time priorities built for
  partners."
- No card surface — text sits directly on the gradient (matches how the dashboard
  headline sentence reads on dark).

### 4.4 Feature chips — `welcome-FeatureChip` (in a horizontal list)

Preserves the four chips (`Couples-first`, `Shared goals`, `Smart insights`,
`Invite-only households`) and their horizontal `FlatList`.

- Each chip: `glassEffects.glass` surface, `radius.full`, padding `spacing.md` horizontal
  / `spacing.sm` vertical, `spacing.sm` gap between chips.
- Label: `typography.smallBold`, `colors.text` (primary readability) — with an optional
  leading dot/`Ionicons` micro-icon in `colors.primary2` to add the brand tint without
  the old low-contrast purple-on-lavender text.
- `showsHorizontalScrollIndicator={false}` (kept). Overflow handled by scroll; each chip
  `numberOfLines={1}`.

### 4.5 Primary CTA — `welcome-PrimaryCTA`

Matches `register.tsx`'s primary button language, tokenized.

- `TouchableOpacity` wrapping a `LinearGradient` with `gradients.primaryGradient`
  (`[colors.primary, colors.primary2]`) — **note** the auth screen orders it
  `['#a855f7','#7c3aed']` (light→dark); `primaryGradient` is `[#7c3aed,#a855f7]`
  (dark→light). Either reads on-brand; spec chooses `gradients.primaryGradient` for the
  token. Start `{x:0,y:0}` end `{x:1,y:1}` (matches auth).
- Height: 52pt (≥ 44 target), full width, `radius.lg`, `overflow:'hidden'`.
- Label: `typography.button` (16/600), `colors.text`, + trailing `arrow-forward`
  `Ionicons` (matches register's continue button), `spacing.xs` gap.
- Copy preserved: "Create an account". `onPress` → `router.replace('/register')` (kept).
- Pressed: `activeOpacity` scale/opacity, `animation.fast`.

### 4.6 Secondary CTA — `welcome-SecondaryCTA`

Replaces the purple-outline ghost with the app's glass-secondary language.

- `TouchableOpacity`, `glassEffects.glass` surface, `radius.lg`, height 52pt, full width,
  centered label.
- Label: `typography.button`, `colors.text` (not the old purple — on dark glass white
  reads far better and matches auth secondary buttons).
- Copy preserved: "I already have an account". `onPress` → `router.replace('/login')`
  (kept).

### 4.7 Consent line — `welcome-ConsentLine`

- `typography.caption`, `colors.textMuted`, centered, `spacing.md` above bottom safe area.
- Copy: "By continuing you agree to our Terms & Privacy." with the two nouns as tappable
  `colors.primary2` links (44pt hit-slop). New, low-weight, standard for entry screens.

### 4.8 Inline error notice — `welcome-InlineNotice` (error state only)

- `glassEffects.glass`, `radius.md`, padding `spacing.md`, row: warning
  `Ionicons alert-circle-outline` (`colors.warning`) + message (`typography.small`,
  `colors.textMuted`) + `Retry` text button (`typography.smallBold`, `colors.primary2`).
- Status conveyed by **icon + the word "Couldn't" + color**, never color alone.
- Renders **above** the chips; the CTAs remain fully enabled beneath it.

---

## 5. States summary

| State | Treatment |
|---|---|
| **Default / populated** | §3.1. Gradient bg, wordmark, hero, glass chips, gradient primary CTA + glass secondary CTA, consent line. |
| **Loading** | §3.2. Wordmark + CTAs render live; hero title/subtitle + chips are `Skeleton` blocks (reuse `components/Skeleton.tsx`). Omit only if nothing on the screen is truly async. |
| **Empty** | = Default. No per-user data exists, so there is no distinct empty variant (§3.3). Do not build a phantom "no data" branch. |
| **Error** | §3.4. Never blanks. Gradient bg can't fail (no network). Any session-check failure → inline `welcome-InlineNotice` above the CTAs; both CTAs stay enabled. |
| **Disabled** | Only while a CTA's own navigation is in flight: dim to `opacity: 0.6` (matches register's `submitting` pattern) and block re-tap. No other disabled states. |
| **Overflow — long localized copy** | Title `numberOfLines={2}`; subtitle `numberOfLines={3}`; chips `numberOfLines={1}` and scroll. CTA labels `numberOfLines={1}` (they never wrap). |

---

## 6. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `<ImageBackground source={{uri:'…unsplash…'}}>` + `LinearGradient colors={['rgba(15,23,42,0.85)','rgba(15,23,42,0.75)']}` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| card `backgroundColor:'rgba(255,255,255,0.96)'`, `borderRadius:24`, shadow | **removed** — content sits on gradient; chips/secondary use `glassEffects.glass` |
| badge `backgroundColor:'#ede9fe'`, text `#7c3aed` | wordmark: `colors.primary2` / `colors.accent` (`welcome-BrandWordmark`) |
| `title` `#0f172a`, `fontSize:28`, `fontWeight:'800'` | `colors.text`, `typography.h1` |
| `subtitle` `#475569`, `fontSize:15`, `lineHeight:22` | `colors.textMuted`, `typography.body` |
| chip `backgroundColor:'#f4f3ff'`, `borderColor:'#e4ddff'`, `borderRadius:12` | `glassEffects.glass`, `colors.borderGlass`, `radius.full` |
| chip text `#6b21a8`, `fontSize:12`, `fontWeight:'700'` | `colors.text` (+ `colors.primary2` micro-icon), `typography.smallBold` |
| primary CTA `backgroundColor:'#7c3aed'`, `borderRadius:14`, `paddingVertical:14` | `gradients.primaryGradient` `LinearGradient`, `radius.lg`, height 52 |
| primary CTA text `white`, `fontWeight:'700'`, `fontSize:16` | `colors.text`, `typography.button` |
| ghost CTA `borderWidth:2`, `borderColor:'#7c3aed'`, text `#7c3aed` | `glassEffects.glass`, `colors.text`, `typography.button` |
| `overlay padding:24`, `card padding:22`, `gap:8`, `marginTop:14` | `spacing.xl` / `spacing.xl` / `spacing.sm` / `spacing.md` |
| `badge borderRadius:999`, `card borderRadius:24`, `cta borderRadius:14` | `radius.full` / `radius.xl` / `radius.lg` |
| `router.replace('/register' | '/login')` | **kept** (welcome is a root; no change) |

---

## 7. Accessibility

- **Touch targets:** both CTAs are 52pt tall × full width (≥ 44). Chips are ≥ 44 tall
  (padded); if visual height is under 44, add `hitSlop`. Consent-line links and the Retry
  button get `hitSlop` to reach 44.
- **Color independence:** the error notice pairs `colors.warning` with the
  `alert-circle-outline` icon **and** the word "Couldn't" — never color alone. The
  wordmark's meaning does not depend on color. The primary vs secondary CTA distinction is
  conveyed by **fill (gradient vs glass) + arrow icon + position**, not color alone.
- **Contrast:** all text is `colors.text` / `colors.textMuted` / semantic tokens on the
  dark gradient — clears WCAG AA. This is a strict improvement over the old chip text
  (`#6b21a8` on `#f4f3ff` ≈ purple-on-lavender, borderline) and the dark-on-white card.
- **Screen-reader order:** wordmark ("CoupleFlow") → hero title → subtitle → [error notice
  if present] → chips (as a single "Features: Couples-first, Shared goals, …" group, not
  four separate stops) → primary CTA → secondary CTA → consent line.
  - Primary CTA label: `"Create an account"`, hint `"Opens sign-up"`.
  - Secondary CTA label: `"I already have an account, log in"`, hint `"Opens sign-in"`.
  - Wordmark: `accessibilityLabel="CoupleFlow"`, `accessibilityRole="header"`.
- **Reduced motion:** CTA press-scale and any chip/skeleton pulse use `animation.fast`;
  under reduce-motion, press feedback becomes an instant opacity swap and the `Skeleton`
  pulse is acceptable (opacity-only, low amplitude) or can be frozen to its dim value.
- **Dynamic Type:** title `numberOfLines={2}` and subtitle `numberOfLines={3}` reflow;
  no fixed heights on text blocks. The `flex:1` spacer absorbs growth so the CTAs stay in
  the thumb zone without clipping.

---

## 8. Developer notes

- **Reuse, don't reimplement:** `GradientBackground` (bg, `variant="bgDarkPurple"`),
  `Skeleton` (loading), and `SafeAreaView`. Do **not** re-add `ImageBackground` or any
  network image — the gradient is the background, full stop (this also fixes the offline
  flash).
- **Wordmark token drift:** the auth screens hardcode pink `#ec4899` for the heart/"Flow".
  That color is **not** in `design-system.ts`. This spec deliberately uses `colors.accent`
  (`#c084fc`) instead to stay fully tokenized. If the team wants the exact auth-screen
  pink, add a `colors.brandPink` token to the design system and use it in **all three**
  screens (welcome/register/login) — do not one-off it here. Flag for the design owner.
- **Navigation preserved:** keep `router.replace('/register')` and
  `router.replace('/login')`. Welcome is a launch root; `replace` avoids a dead back stack.
- **No new data/endpoints.** This screen fetches nothing. The loading skeleton exists only
  to cover cold-start font/OAuth-availability resolution; if the frontend confirms nothing
  is async, the loading branch may be dropped (note it in the PR).
- **Consent line** is new copy — coordinate the Terms/Privacy link targets with the team;
  ship as `colors.primary2` text links with placeholder routes if the legal screens don't
  exist yet.
- **Chips content** stays data-light (a local `const chips = [...]`); if these ever become
  server-driven feature flags, the `FlatList` already supports it — no layout change
  needed.

---

## 9. Handoff checklist

- [x] Root swapped from `ImageBackground`+overlay to `<GradientBackground variant="bgDarkPurple">`
- [x] Inverted white card removed; content on gradient with glass chips + glass secondary CTA
- [x] Brand unified with auth screens (Couple ♥ Flow wordmark), tokenized (accent instead of off-token pink, flagged)
- [x] Primary CTA uses `gradients.primaryGradient`; secondary uses `glassEffects.glass`
- [x] All states designed (default, loading skeleton, empty=default, error inline notice, disabled)
- [x] Every old hardcoded color / gradient / spacing / radius / font mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, Dynamic Type
- [x] Navigation (`router.replace`) preserved; functionality unchanged
- [x] Component specs written (`docs/design/components/welcome-*.json`)
