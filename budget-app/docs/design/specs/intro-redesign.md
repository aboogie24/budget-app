# Intro (Welcome) Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/intro.tsx`
**Archetype:** auth / marketing (full-bleed, no drawer/tab chrome) — sits *before*
`register` and `login` in the flow. Its visual conventions must match those sibling
auth screens **and** the tokenized reference screens (`dashboard`, `calendar`).

---

## 1. Why this redesign exists

The intro screen is the **first pixel a new user ever sees**, and today it is off-brand
in three concrete ways that make CoupleFlow feel like a different app the moment you
launch it:

1. **It fights the design system.** It hardcodes its own gradient
   (`['#0f0a1e','#1a0a40','#0f0a1e']` — a *subtly wrong* purple that differs from
   `gradients.bgDarkPurple = ['#0f172a','#1a0a40','#0f172a']`), its own type sizes
   (`40 / 26 / 14`), its own paddings (`24 / 32 / 40 / 20 / 8`), and its own radii
   (`12 / 50`). No token is used anywhere.

2. **It introduces a brand color that exists nowhere else in the app.** The logo and heart
   use **pink `#ec4899`** (and `rgba(236,72,153,0.3)`), plus `#a855f7` and `#9ca3af`
   hardcoded. Pink is **not in `design-system.ts`** — the rest of CoupleFlow's identity is
   the purple family (`primary #7c3aed` → `primary2 #a855f7` → `accent #c084fc`). So the
   very screen that sets brand expectations teaches the user a palette the app then never
   honors. The redesign **retires pink** and expresses the logo in the canonical purple
   gradient, so brand identity is consistent from the first screen onward.

3. **It has no states.** OAuth (Google / Apple) and email auth can be slow or fail, yet
   this screen has no loading, no disabled, and no error affordance — a failed Google
   prompt currently just… does nothing visible. The reference screens all define
   loading / empty / error; this one must too.

The redesign keeps this **recognizably the same screen** — a centered logo, a tagline, a
primary "Get Started" CTA, and a "Sign In" link — but rebuilds every value on tokens,
unifies the brand to the purple family, adds the missing states, and tightens the
information architecture (one clear primary action, social sign-in surfaced here so the
fastest path in is one tap, not two screens deep).

---

## 2. Information architecture

The screen answers one question for a brand-new visitor: **"What is this, and how do I
get in?"** Everything is arranged as a single vertical stack with **one** visually
dominant action.

Priority order (top → bottom), which is also the reading order:

1. **Brand mark** — logo + heart glyph. Identity, not an action.
2. **Value proposition** — headline + one supporting line. "Build your financial future,
   together."
3. **Primary action** — **Get Started** (→ `register`). The single dominant control.
4. **Fast-path social auth** (recommended addition) — Continue with Apple / Google, so a
   returning-or-new user's quickest route in is one tap. These are secondary in weight.
5. **Existing-account escape hatch** — "Already have an account? **Sign In**" (→ `login`).
6. **Legal microcopy** — Terms / Privacy (recommended addition; standard for an auth
   entry screen). Lowest weight.

Rule: **exactly one primary button.** Get Started is the only filled-gradient control;
social buttons are outlined glass; Sign In is a text link. This preserves the original
screen's single-CTA intent while making the social fast-path additive, not competing.

---

## 3. Wireframes (all states)

iPhone 15 Pro (390×844). Full-bleed `<GradientBackground variant="bgDarkPurple">`, content
centered in a `SafeAreaView`, screen padding `spacing.xl` (24) horizontal.

### 3.1 Default / populated

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │  ← SafeAreaView top
│                                                                │
│                    ╭────────╮ ╭────────╮                       │  brand halo:
│                   │  purple  │ accent   │                      │  two overlapping
│                    ╰────────╯ ╰────────╯                       │  glass circles
│                         ♥                                      │  (primary + accent)
│                                                                │
│                   Couple ♥ Flow                                │  logo, purple gradient
│                                                                │  (NO pink)
│                                                                │
│           Build your financial future, together                │  headline (h2, center)
│           Take control of your money as a couple               │  subtitle (small, muted)
│                                                                │
│                                                    ↑ vertically centered block
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                Get Started            →                 │  │  PRIMARY CTA
│   └────────────────────────────────────────────────────────┘  │  gradient fill
│                                                                │
│           ────────────  or  ────────────                       │  divider w/ label
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │        Continue with Apple            │  outlined glass  │  (iOS only)
│   └────────────────────────────────────────────────────────┘  │
│   ┌────────────────────────────────────────────────────────┐  │
│   │  G     Continue with Google                             │  │  outlined glass
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│          Already have an account?  Sign In                     │  text link (primary2)
│                                                                │
│        By continuing you agree to our Terms & Privacy          │  legal caption, muted
│                                                                │  ← SafeAreaView bottom
└──────────────────────────────────────────────────────────────┘
```

Vertical rhythm: the **brand + value block** is a centered group in the upper-middle;
the **action stack** (CTA → divider → social → sign-in → legal) is pinned toward the
bottom with `spacing.xl` between the two groups so the CTA lands comfortably in the
thumb zone. Use `justifyContent: 'space-between'` on two groups rather than one
`center` block, so long headlines and Dynamic Type never collide with the buttons.

### 3.2 Loading (an auth method is in progress — e.g. Google/Apple prompt open)

There is no *data* to fetch on this screen, so "loading" means **an auth action is
in flight**. Do not skeleton the whole screen (the brand should stay solid and
reassuring). Instead: the pressed button enters a loading state and the others disable.

```
┌──────────────────────────────────────────────────────────────┐
│                   Couple ♥ Flow                                │  brand stays solid
│           Build your financial future, together                │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │              ◠ Get Started (dimmed)                      │  │  disabled while a
│   └────────────────────────────────────────────────────────┘  │  sibling action runs
│           ────────────  or  ────────────                       │
│   ┌────────────────────────────────────────────────────────┐  │
│   │            ⟳  Connecting to Google…                     │  │  spinner + label
│   └────────────────────────────────────────────────────────┘  │  (this button active)
│   ┌────────────────────────────────────────────────────────┐  │
│   │        Continue with Apple  (dimmed)                    │  │  disabled
│   └────────────────────────────────────────────────────────┘  │
│          Already have an account?  Sign In  (dimmed)           │
└──────────────────────────────────────────────────────────────┘
```

- The active button swaps its label/icon for `<ActivityIndicator color={colors.text}/>`
  + an accessible verb ("Connecting to Google…"). Reuse the header spinner pattern from
  `dashboard.tsx` (`ActivityIndicator color={colors.primary2}` on glass surfaces).
- All **other** controls drop to `opacity 0.5` and `disabled` so no double-submit.
- The Skeleton component is **not** used here (nothing is being laid-out-then-filled);
  it *is* used in 3.3 below where we optionally probe session/config.

### 3.3 First-paint / session-check loading (optional, if a check precedes render)

If the app briefly checks for an existing session or remote config before showing the
CTAs (mirrors `login.tsx`, which redirects if `findUserSession()` resolves), show the
brand immediately and **skeleton only the action stack** so the screen never flashes
empty then jumps:

```
│                   Couple ♥ Flow                                │  real brand
│           Build your financial future, together                │  real value prop
│                                                                │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  Skeleton (CTA)
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  Skeleton (social)
│              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │  Skeleton (link)
```

Reuse `components/Skeleton.tsx`: one `Skeleton height={56} borderRadius={radius.lg}`
for the CTA, one for each social button, and a short centered one for the sign-in link.
Brand/headline render from static copy (no skeleton — they're not loaded).

### 3.4 Empty state

This screen has **no user data**, so a classic "no items" empty state doesn't apply.
The equivalent is the **cold-start default** (3.1) itself — that *is* the zero-data
presentation, and it's fully self-explanatory. No separate empty layout is needed; the
default IS the empty state. (Documented explicitly so the frontend agent doesn't invent
one.)

### 3.5 Error state (auth failed / offline)

An auth attempt failed (network down, OAuth cancelled-with-error, server 5xx). Keep the
brand and CTAs fully intact — **never blank the screen** — and surface a dismissible
inline banner just above the action stack.

```
│           Build your financial future, together                │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │ ⚠  Couldn't sign in                              ✕      │  │  glass error banner
│   │    Check your connection and try again.                 │  │  icon + word + text
│   └────────────────────────────────────────────────────────┘  │  (color-independent)
│                                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │                Get Started            →                 │  │  CTAs re-enabled
│   └────────────────────────────────────────────────────────┘  │
│           ────────────  or  ────────────                       │
│   ┌────────────────────────────────────────────────────────┐  │  Try Again resumes
│   │        Continue with Apple                              │  │  the failed method
│   └────────────────────────────────────────────────────────┘  │
```

- Banner: `glassEffects.glass`, 1px `colors.error` border at low opacity
  (`` `${colors.error}55` ``) or `colors.borderGlass`; leading `warning`/`alert-circle`
  Ionicon in `colors.error`; title `typography.smallBold` `colors.text`
  ("Couldn't sign in") + body `typography.caption` `colors.textMuted`. A trailing `✕`
  (44pt hit-slop) dismisses it.
- The **word "Couldn't sign in" + the icon** carry the meaning, so it's not color-only.
- All controls return to enabled; tapping the same method retries. If offline is
  detectable, swap copy to "You're offline — reconnect and try again."

---

## 4. Brand mark — retiring pink, unifying on purple

The single most visible brand decision. Today: `Couple` (`#a855f7`) + pink heart
(`#ec4899`) + `Flow` (`#ec4899`), over two circles (purple `rgba(168,85,247,0.3)` +
**pink** `rgba(236,72,153,0.3)`).

**Redesign — all-purple, tokenized:**

| Element | Current | Redesign |
|---|---|---|
| "Couple" wordmark | `#a855f7` | `colors.primary2` (`#a855f7`) |
| Heart glyph | `#ec4899` (pink) | `colors.accent` (`#c084fc`) — the *lightest* purple, so the heart still "pops" against the two wordmarks without leaving the palette |
| "Flow" wordmark | `#ec4899` (pink) | `colors.primary2` (`#a855f7`) — matching "Couple"; the couple *is* the flow, one color |
| Left halo circle | `rgba(168,85,247,0.3)` | `colors.primary2` at ~18% (`` `${colors.primary2}2e` ``) glass circle |
| Right halo circle | `rgba(236,72,153,0.3)` (pink) | `colors.accent` at ~18% (`` `${colors.accent}2e` ``) glass circle |
| Wordmark size | `40 / 800` | `typography.h1` (32/700) — the largest token; keeps hierarchy consistent with the rest of the app where `h1` is the ceiling |

The overlapping-circles halo is a nice, ownable motif for a *couples* app (two circles,
one overlap = the shared household). Keep it — just tokenize the fills and let the
overlap region read a touch brighter (two translucent glass circles naturally blend).

> If product wants the heart to still feel like a distinct accent, `colors.accent`
> (`#c084fc`) is the intended "lightest purple" and is the correct in-system substitute
> for the retired pink. Do **not** reintroduce `#ec4899` anywhere.

---

## 5. Component specs

### 5.1 Screen container

- `<GradientBackground variant="bgDarkPurple">` wrapping a `SafeAreaView` (`flex:1`).
- Content column: `paddingHorizontal: spacing.xl`, `justifyContent: 'space-between'`
  with a top group (brand + value) and a bottom group (actions), plus top/bottom
  `spacing.xxl` breathing room inside the safe area.
- No header/BackButton by default (this is the flow root). **Exception:** if `intro` is
  ever reachable via push (not `replace`) — e.g. a "learn more" entry — render a
  `<BackButton fallback="/login" />` top-left inside the safe area, matching the standard
  auth-screen back affordance. Default flow: no back button.

### 5.2 BrandMark (`intro-brand-mark`)

| Prop | Type | Notes |
|---|---|---|
| `size` | `'lg'` (default) | wordmark uses `typography.h1`; halo circles ~100px |

- Two absolutely-positioned glass circles (`radius.full`), fills `` `${colors.primary2}2e` ``
  and `` `${colors.accent}2e` ``, offset to overlap ~40px.
- Row: `Couple` (`colors.primary2`) · `heart` Ionicon (`colors.accent`, 28) · `Flow`
  (`colors.primary2`), gap `spacing.xs`.
- States: static (no interaction). Decorative — `accessibilityRole="image"`,
  `accessibilityLabel="CoupleFlow"`; the two halo circles are
  `accessibilityElementsHidden`.

### 5.3 ValueProp

- Headline: `typography.h2` (28/700), `colors.text`, `textAlign:'center'`,
  `maxWidth ~320`, `numberOfLines={2}`.
- Subtitle: `typography.small` (14), `colors.textMuted`, centered, `spacing.sm` below the
  headline, `numberOfLines={2}`.

### 5.4 PrimaryButton — "Get Started" (`intro-primary-button`)

| Prop | Type | Notes |
|---|---|---|
| `label` | string | "Get Started" |
| `loading` | boolean | shows `ActivityIndicator`, hides label + arrow |
| `disabled` | boolean | `opacity 0.5`, no press |
| `onPress` | fn | → `router.replace('/register')` (unchanged) |

- Fill: `LinearGradient` using **`gradients.primaryGradient`** (`[primary, primary2]`) —
  replaces the hardcoded `['#a855f7','#7c3aed']`.
- Shape: `radius.lg` (16), `overflow:'hidden'`, height ≥ 52 (≥ 44pt target),
  `paddingVertical: spacing.lg`.
- Content row: label `typography.button` (16/600) `colors.text` + `arrow-forward`
  Ionicon (18, `colors.text`), gap `spacing.sm`, centered.
- Press: scale 0.98 / `activeOpacity 0.9`, `animation.fast`; keep the existing
  `Haptics.impactAsync(Light)` on press.
- **States:** default · pressed · loading · disabled (see §3.2 / §3.5).

### 5.5 SocialButton (`intro-social-button`) — recommended addition

| Prop | Type | Notes |
|---|---|---|
| `provider` | `'apple' \| 'google'` | drives icon + label |
| `loading` / `disabled` | boolean | same semantics as PrimaryButton |
| `onPress` | fn | triggers the provider flow (wire to the same `expo-auth-session` / Apple flow already in `register.tsx`) |

- Surface: `glassEffects.glassEnhanced`, `radius.lg`, height ≥ 52, full-width,
  `borderColor: colors.borderGlass`. **Outlined glass, not filled** — subordinate to the
  primary CTA.
- Apple button iOS-only (respect platform); Google both. Leading provider icon
  (`logo-apple` / `logo-google`, `colors.text`), centered label `typography.button`
  `colors.text`.
- Loading: `ActivityIndicator color={colors.text}` + "Connecting to {Provider}…".
- Divider above the group: a thin `colors.borderGlass` rule with a centered `or` label
  (`typography.caption`, `colors.textMuted`, `spacing.md` side padding).

> If social auth is out of scope for v1, omit §5.5 and the divider entirely — the screen
> degrades to exactly the original single-CTA + Sign-In layout, still fully tokenized.
> Nothing else changes. (That's why social is documented as additive.)

### 5.6 SignInLink

- Row, centered: "Already have an account? " (`typography.small`, `colors.textMuted`) +
  "Sign In" (`typography.smallBold`, `colors.primary2`) → `router.push('/login')`
  (unchanged). Tap target padded to ≥ 44pt (`padding: spacing.sm` + hit-slop).

### 5.7 LegalCaption — recommended addition

- Centered `typography.caption` `colors.textMuted`:
  "By continuing you agree to our **Terms** & **Privacy**." Terms/Privacy in
  `colors.primary2`, each ≥ 44pt tappable. Standard for an auth entry point; omit if no
  legal routes exist yet.

### 5.8 ErrorBanner (`intro-error-banner`)

See §3.5. `glassEffects.glass`, `warning` icon `colors.error`, title + body, dismiss `✕`.
`onRetry` optional. Renders `null` when there's no error (like `AttentionCard` returning
null when empty).

---

## 6. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| gradient `['#0f0a1e','#1a0a40','#0f0a1e']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| CTA gradient `['#a855f7','#7c3aed']` | `gradients.primaryGradient` (`[colors.primary, colors.primary2]`) |
| logo "Couple" `#a855f7` | `colors.primary2` |
| logo "Flow" `#ec4899` (pink) | `colors.primary2` |
| heart `#ec4899` (pink) | `colors.accent` (`#c084fc`) |
| circle `rgba(168,85,247,0.3)` | `` `${colors.primary2}2e` `` (~18%) |
| circle `rgba(236,72,153,0.3)` (pink) | `` `${colors.accent}2e` `` (~18%) |
| headline `#ffffff` | `colors.text` |
| subtitle / signIn `#9ca3af` | `colors.textMuted` |
| "Sign In" / links `#a855f7` | `colors.primary2` |
| CTA text `#ffffff` | `colors.text` |
| logo `fontSize:40, weight:800` | `typography.h1` (32/700) |
| headline `fontSize:26, weight:700, lineHeight:34` | `typography.h2` (28/700/36) |
| subtitle `fontSize:14` | `typography.small` (14) |
| CTA/link text `fontSize:16/14` | `typography.button` (16) / `typography.small` (14) |
| `borderRadius: 12` (CTA) | `radius.lg` (16) |
| `borderRadius: 50` (circles) | `radius.full` |
| paddings `24 / 32 / 40 / 20 / 8` | `spacing.xl / xxl / xxl / xl / sm` |
| gaps `8 / 4` | `spacing.sm / xs` |
| social buttons (new) | `glassEffects.glassEnhanced` + `colors.borderGlass` |
| error banner (new) | `glassEffects.glass` + `colors.error` |

Note: the existing bg gradient's *middle* stop (`#1a0a40`) already matches
`bgDarkPurple`'s middle stop — the token swap only corrects the two `#0f0a1e` end stops
to `#0f172a`, aligning this screen's background exactly with the rest of the app.

---

## 7. Accessibility

- **Touch targets:** Get Started, each social button, Sign In, and each legal link ≥
  44×44pt. Buttons are ≥ 52 tall; the text link and legal links use `spacing.sm` padding
  + `hitSlop` to reach 44.
- **Color independence:** the error state is conveyed by **icon (`warning`) + the word
  "Couldn't sign in" + color**, never color alone. Loading is conveyed by a **spinner +
  the verb "Connecting…"**, not motion alone.
- **Contrast:** `colors.text` and `colors.textMuted` on the dark purple gradient clear
  WCAG AA. Verify the retired-pink → `colors.accent` heart (`#c084fc`) and the
  `primary2` wordmarks against the darkest gradient stop; both are light-on-dark and pass.
  Legal `colors.textMuted` links must clear 4.5:1 — if `textMuted` at caption size is
  borderline, bump link portions to `colors.primary2`.
- **Screen-reader order:** brand ("CoupleFlow") → headline → subtitle → error banner (if
  present, announced with `accessibilityLiveRegion="polite"`) → Get Started → social
  buttons → Sign In → legal. Decorative halo circles are hidden from SR.
- **Labels:** Get Started → `accessibilityRole="button"`, label "Get started, create an
  account". Social → "Continue with Apple/Google". Sign In → "Sign in to an existing
  account". Loading buttons announce busy state (`accessibilityState={{ busy: true }}`).
- **Reduced motion:** the CTA press-scale, the social spinner container, and any halo
  breathing/fade use `animation.fast`; under reduce-motion they become instant. The
  `ActivityIndicator` itself is allowed (it's a status indicator, not decorative motion).
- **Dynamic Type:** headline/subtitle reflow (`numberOfLines` caps + no fixed heights on
  the text block); the two-group `space-between` layout absorbs taller text without
  pushing the CTA off-screen.

---

## 8. Edge cases

| Case | Behavior |
|---|---|
| **Long headline / large Dynamic Type** | Value block grows; `space-between` layout keeps the action stack anchored to the bottom safe area; headline `numberOfLines={2}` ellipsizes past two lines. |
| **Apple unavailable (Android)** | Apple social button not rendered; Google remains; divider still shown if ≥1 social method exists, else divider + social group omitted. |
| **No social methods configured** | Entire social group + `or` divider omitted; screen = brand + value + Get Started + Sign In + legal. |
| **Auth in flight** | Active method shows spinner + verb; all other controls `disabled` + `opacity 0.5` (prevents double submit). |
| **Rapid double-tap Get Started** | Debounced via `disabled` on first press (mirrors `register.tsx` `submitting` guard). |
| **Small devices (SE, <375w)** | `getResponsivePadding()` (already in design-system) may replace `spacing.xl`; buttons stay full-width; halo scales down. |
| **Very tall devices** | Extra space distributes via `space-between`; brand stays upper-middle, actions stay thumb-reachable. |

---

## 9. Developer notes

- **Reuse, don't reimplement:** `GradientBackground` (bg, variant `bgDarkPurple`),
  `Skeleton` (§3.3 first-paint), `BackButton` (only if `intro` is ever pushed).
  `ActivityIndicator` for in-flight auth follows the `dashboard.tsx` header pattern
  (`color={colors.primary2}` on glass, `colors.text` inside the gradient CTA).
- **Wire social auth to the existing flows:** `register.tsx` already contains the
  `expo-auth-session` Google hook and the Apple `AppleAuthentication` flow — the social
  buttons here should call into the same helpers rather than duplicating OAuth logic.
- **Navigation unchanged:** Get Started → `router.replace('/register')`; Sign In →
  `router.push('/login')`. Keep the existing `Haptics.impactAsync(Light)` on Get Started.
- **Retire pink globally on this screen:** there must be **zero** `#ec4899` /
  `rgba(236,72,153,…)` references after the redesign. The heart is `colors.accent`.
- **No local `StyleSheet` color/size constants** — every value resolves from
  `design-system.ts`. The only literals allowed are the `${token}2e` / `${token}55`
  opacity-suffixed strings for the halo and error border, which are derived from tokens.
- **States are the new surface area:** the current file has none. Add `loading` /
  `error` local state (or lift from the auth helpers) to drive §3.2 and §3.5. The empty
  state is intentionally the default (§3.4) — do not build a separate one.

---

## 10. Handoff checklist

- [x] Why documented (off-token gradient/type/spacing + off-palette pink + no states)
- [x] All states wireframed: default, loading (in-flight + optional first-paint skeleton), empty (= default), error
- [x] Brand unified to the purple family — pink `#ec4899` retired → `colors.accent` heart, `primary2` wordmarks
- [x] Every hardcoded color/gradient/font/spacing/radius mapped to a design-system token
- [x] Single-primary-action IA preserved; social fast-path added as additive/graceful-degrade
- [x] Component specs written for BrandMark, PrimaryButton, SocialButton, SignInLink, LegalCaption, ErrorBanner
- [x] Accessibility: 44pt targets, color-independent error/loading, SR order + labels, reduced motion, Dynamic Type
- [x] Edge cases documented (long text, no social, in-flight, small/tall devices)
- [x] Reuses shared components (GradientBackground, Skeleton, BackButton, ActivityIndicator pattern)
- [x] Component JSONs written (`docs/design/components/intro-*.json`)
</content>
</invoke>
