# Login Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/components/BudgetAppLogin.tsx`
(rendered by route `budget-app/app/login.tsx`)
**Archetype:** auth / form (root entry screen — **no BackButton**, this is a
navigation root reached before the tab stack)

---

## 1. Why this redesign exists

The login screen is visually a **different app** from the rest of CoupleFlow. Like the
old calendar, it bypasses the design system entirely and hardcodes its own palette,
gradient, surfaces, and type:

- Its own background gradient `['#0f0a1e','#1a1035','#0f0a1e']` — **not** the app's
  `gradients.bgDarkPurple`. The purple hue and stops are subtly off from every
  redesigned screen (dashboard, calendar), so it reads as a stranger.
- A **pink** brand accent (`#ec4899` for the "Flow" wordmark, the heart icon, and a logo
  circle) that appears **nowhere** in `design-system.ts`. The app's accent language is
  purple/violet (`primary #7c3aed`, `primary2 #a855f7`, `accent #c084fc`). Pink is a
  legacy brand color that fragments the identity.
- Hardcoded surfaces: input rows use `rgba(255,255,255,0.06)` + `rgba(255,255,255,0.08)`
  borders — hand-rolled glass that doesn't match `glassEffects.glass` /
  `colors.glassLight` used by every card in the app.
- Hardcoded type: `fontSize: 32/26/15/14/12` with local weights instead of
  `typography.h1 / h3 / body / small / caption`.
- Hardcoded spacing: literals `48, 32, 24, 16, 14, 12, 10, 8` instead of the
  `spacing` scale.
- Placeholder text `#6b7280`, muted text `#9ca3af/#64748b`, disabled `opacity: 0.4` —
  none tokenized.

It also has **no proper state coverage** for an auth form: submit failures surface via a
raw `alert()`, there is no inline field-level error, no inline error banner, no disabled
affordance beyond the button label swapping to "Logging in…", and no skeleton for the
brief OAuth-request warm-up (`!googleRequest`).

This redesign does two things:

1. **Adopts the design system** — every color, radius, space, font, gradient, and surface
   comes from `design-system.ts`. Background becomes
   `<GradientBackground variant="bgDarkPurple">`. Pink is retired in favor of the purple
   accent scale. No magic numbers, no local color constants.
2. **Completes the auth information architecture** — a single glass "auth card" holds the
   form; errors become **inline** (banner + per-field), the primary action has real
   disabled/loading states, and OAuth-warmup shows a skeleton instead of a dead 40%-opacity
   button.

The screen stays recognizably the same: logo → welcome → email/password → Log In →
"Or continue with" → Google/Apple → Sign up link. We are re-skinning and hardening it,
not rebuilding the flow.

---

## 2. The core visual idea — "One glass auth card on the app's own background"

Every redesigned screen in CoupleFlow is: `GradientBackground(bgDarkPurple)` → glass
cards → tokenized type. Login should read as the **front door of that same house**.

| Element | Redesigned treatment | Tokens |
|---|---|---|
| Background | App gradient, not a bespoke one | `<GradientBackground variant="bgDarkPurple">` |
| Brand mark | Purple overlapping circles + purple "CoupleFlow" wordmark, heart in `accent` | `colors.primary`, `colors.primary2`, `colors.accent` |
| Form container | **One `glassFloating` card** grouping the inputs + primary CTA (Gestalt: the login task is one unit) | `glassEffects.glassFloating`, `radius.xl` |
| Input rows | Tokenized glass rows, focus + error variants | `glassEffects.glass`, `colors.borderGlass`, `colors.primary2` (focus), `colors.error` (error) |
| Primary CTA | Purple gradient button | `gradients.primaryGradient` (`primary → primary2`) |
| OAuth buttons | Tokenized glass rows, filled icons | `glassEffects.glass` |
| All text | Type scale, muted for secondary | `typography.*`, `colors.text / textMuted` |

The one intentional composition choice: **wrap the form fields + primary button in a
single `glassFloating` card**. Today they float loose on the gradient. Grouping them into
one elevated card (the same `glassFloating` the calendar summary header earns) gives the
primary task visual weight and matches how the app frames its most important content.
Logo, divider, OAuth, and sign-up link stay **outside** the card so the card = "the thing
you fill in."

---

## 3. Layout structure

```
GradientBackground(bgDarkPurple)
└─ SafeAreaView
   └─ KeyboardAvoidingView (iOS: padding)
      └─ ScrollView (flexGrow:1, justifyContent:'center', keyboardShouldPersistTaps)
         ├─ Brand block          (logo circles, wordmark, tagline)   — centered
         ├─ Welcome block        (title + subtitle)                  — left-aligned
         ├─ ── Error banner ──   (conditional, only on submit error)
         ├─ Auth card [glassFloating]
         │   ├─ Email field      (icon + input, focus/error states)
         │   ├─ Password field   (icon + input + eye toggle)
         │   ├─ Forgot password  (right-aligned link)
         │   └─ Log In button    (primaryGradient, loading/disabled)
         ├─ Divider              ("Or continue with")
         ├─ OAuth row            (Google · Apple[iOS])
         └─ Sign-up link         ("Don't have an account? Sign up")
```

Screen padding: `spacing.xl` horizontal (matches the 24px the current screen uses, now
tokenized). Vertical rhythm between blocks: `spacing.xl`.

---

## 4. Wireframes — all states

### 4a. Default / populated

```
┌──────────────────────────────────────────────┐
│                                                │
│                  ●●                            │  ← two overlapping purple circles
│              Couple ♥ Flow                     │  ← wordmark, heart = colors.accent
│           FOR COUPLES & SHARED GOALS           │  ← tagline, caption, letterSpacing
│                                                │
│   Welcome back                                 │  ← typography.h3, colors.text
│   Log in to your financial journey.            │  ← typography.small, colors.textMuted
│                                                │
│  ┌──────────────────────────────────────────┐ │  ← AUTH CARD (glassFloating)
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ ✉  alex@coupleflow.app               │ │ │  ← email field (glass row)
│  │ └──────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ 🔒 ••••••••••               👁        │ │ │  ← password field + eye toggle
│  │ └──────────────────────────────────────┘ │ │
│  │                        Forgot password?  │ │  ← link, colors.primary2
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │              Log In                   │ │ │  ← primaryGradient button
│  │ └──────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ───────────  Or continue with  ───────────    │  ← divider
│                                                │
│  ┌────────────────────┐ ┌────────────────────┐ │
│  │  G   Google        │ │    Apple        │ │  ← OAuth glass buttons
│  └────────────────────┘ └────────────────────┘ │
│                                                │
│      Don't have an account?  Sign up           │  ← accent link
└──────────────────────────────────────────────┘
```

### 4b. Loading — OAuth warm-up + submit-in-flight

Two distinct loading moments:

**(i) OAuth request warming up** (`!googleRequest`): today the Google button drops to
`opacity: 0.4` and is dead. Replace with a **Skeleton** standing in for the OAuth row so
the layout doesn't jump and the state reads as "loading", not "broken/disabled".

```
│  ───────────  Or continue with  ───────────    │
│                                                │
│  ┌────────────────────┐ ┌────────────────────┐ │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │  ← <Skeleton height={48}
│  └────────────────────┘ └────────────────────┘ │       borderRadius={radius.md}/> ×N
```

**(ii) Submit in flight** (`submitting`): the Log In button shows a spinner + "Logging in…",
the whole card is `pointerEvents:'none'` (fields non-editable), and OAuth buttons disable.

```
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │        ◌  Logging in…                 │ │ │  ← ActivityIndicator + label
│  │ └──────────────────────────────────────┘ │ │     button stays primaryGradient
```

### 4c. Empty (first field state / no input yet)

The "empty" state for an auth form = **untouched fields with placeholders**, plus the
primary button in its **disabled** style until both fields are non-empty. This gives the
user a visible "not ready yet" affordance the current screen lacks (today the button is
always fully enabled and only fails on submit).

```
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ ✉  Email                             │ │ │  ← placeholder, colors.textDark
│  │ └──────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ 🔒 Password                  👁       │ │ │
│  │ └──────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │              Log In                   │ │ │  ← DISABLED: primaryGradient at
│  │ └──────────────────────────────────────┘ │ │     0.5 opacity, no press feedback
```

### 4d. Error — inline banner + per-field

Replace the raw `alert()` with an **inline error banner** at the top of the auth card and,
where the error is field-specific, an error-state border + helper line on the field.

```
│  ┌──────────────────────────────────────────┐ │
│  │ ⚠  Email or password is incorrect.        │ │  ← ERROR BANNER (see §5.4)
│  │    icon + word "incorrect" + red = not     │ │     errorGradient tint OR
│  │    color-only                              │ │     glass + colors.error border
│  ├──────────────────────────────────────────┤ │
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ ✉  alex@coupleflow.app               │ │ │  ← field border → colors.error
│  │ └──────────────────────────────────────┘ │ │
│  │ ⚠ Check this email                        │ │  ← per-field helper (caption, error)
│  │ ┌──────────────────────────────────────┐ │ │
│  │ │ 🔒 ••••••••                  👁       │ │ │  ← field border → colors.error
│  │ └──────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────┘ │
```

Error taxonomy (drives banner copy + which fields highlight):

| Cause | Banner copy | Field highlight | Icon |
|---|---|---|---|
| 401 / bad credentials | "Email or password is incorrect." | both fields (border only, no helper — don't reveal which) | `alert-circle-outline` |
| Empty on submit (if button ever enabled) | "Enter your email and password." | the empty field(s) + helper | `alert-circle-outline` |
| Network / server unreachable | "Can't reach CoupleFlow. Check your connection and try again." | none | `cloud-offline-outline` + **Retry** |
| OAuth failure (Google/Apple) | "Google Sign-In didn't work. Try again or use email." | none | `alert-circle-outline` |

Banner is dismissible (auto-clears on next keystroke in any field) and is **announced to
screen readers** via `accessibilityLiveRegion="assertive"`.

---

## 5. Component specs

### 5.1 BrandMark

Centered logo block. Retires pink; uses the purple accent scale.

- **Overlapping circles:** two 48px circles, `radius.full`, offset `spacing.xl` (28→24
  acceptable; use `spacing.xl`). Colors: circle A `colors.primary2` at 0.9 alpha, circle B
  `colors.accent` at 0.9 alpha (was pink `#ec4899`).
- **Wordmark:** `Couple` + heart + `Flow`, all `typography.h1` weight `700`.
  - "Couple" and "Flow" both `colors.primary2` (unified — was purple + pink split).
  - Heart `Ionicons name="heart"` size 28, `colors.accent` (was pink).
- **Tagline:** `typography.caption`, `colors.primary2`, `letterSpacing: 0.5`,
  uppercase "FOR COUPLES & SHARED GOALS".
- Margin below block: `spacing.xxl`.

### 5.2 WelcomeHeader

- **Title:** "Welcome back" — `typography.h3`, `colors.text`, `letterSpacing: -0.5`
  (was 26px/700; h3 is 24/600 — acceptable, or bump to `typography.h2` if a heavier look
  is wanted. Recommend `h3` to match dashboard section headers).
- **Subtitle:** "Log in to your financial journey." — `typography.small`,
  `colors.textMuted`.
- Left-aligned, `gap: spacing.sm`, margin below `spacing.xl`.

### 5.3 AuthCard  (new grouping — `glassFloating`)

Wraps EmailField, PasswordField, ForgotLink, LoginButton (+ optional ErrorBanner at top).

- Style: `glassEffects.glassFloating`, `padding: spacing.xl`, `borderRadius: radius.xl`,
  `gap: spacing.lg`.
- `pointerEvents: submitting ? 'none' : 'auto'`.

### 5.4 ErrorBanner

- Layout: row, `gap: spacing.sm`, `padding: spacing.md`, `borderRadius: radius.md`,
  `marginBottom: spacing.md`.
- Surface: `glassEffects.glass` with `borderColor: colors.error` (1px) and a faint
  `colors.error` tint background (e.g. `rgba(239,68,68,0.10)`). Keep it inside the card,
  above the first field.
- Icon: per taxonomy (`alert-circle-outline` / `cloud-offline-outline`), size 18,
  `colors.error`.
- Text: `typography.small`, `colors.text` (not muted — errors must be legible).
- **Color-independent:** always pairs an icon **and** an explicit word
  ("incorrect", "can't reach", "didn't work") with the red, never red alone.
- Network variant renders a trailing **Retry** `TouchableOpacity` (`typography.smallBold`,
  `colors.primary2`, 44pt target).
- `accessibilityLiveRegion="assertive"`, `accessibilityRole="alert"`.

### 5.5 AuthField  (Email / Password)

Shared field component; `variant` = `email | password`.

- **Container:** `glassEffects.glass`, `paddingHorizontal: spacing.md`,
  `paddingVertical: spacing.md`, `borderRadius: radius.md`, row, `gap: spacing.sm`,
  min height 48 (≥44pt target).
- **Leading icon:** `mail-outline` / `lock-closed-outline`, size 20.
  - Default `colors.textMuted`; focused `colors.primary2`; error `colors.error`.
- **Input:** `typography.body`, `color: colors.text`, `placeholderTextColor: colors.textDark`.
  - Email: `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`.
  - Password: `secureTextEntry={!showPassword}`, `autoComplete="password"`.
- **Trailing (password only):** eye toggle `eye-outline / eye-off-outline`, size 20.
  Default `colors.textMuted`, active `colors.primary2`. `hitSlop` to 44pt.
- **States:**

  | State | Border | Leading icon |
  |---|---|---|
  | default | `colors.borderGlass` | `colors.textMuted` |
  | focused | `colors.primary2` (1.5px) | `colors.primary2` |
  | error | `colors.error` (1.5px) | `colors.error` |
  | disabled (submitting) | `colors.borderGlass`, container 0.6 opacity | `colors.textMuted` |

- **Per-field helper** (error only): `typography.caption`, `colors.error`,
  prefixed with a small `alert-circle` glyph, `marginTop: spacing.xs`.

### 5.6 ForgotLink

- Right-aligned (`alignSelf: 'flex-end'`).
- `typography.smallBold`, `colors.primary2` (was `#a855f7` — same hue, now tokenized).
- 44pt tap target via `hitSlop`.

### 5.7 LoginButton  (primary CTA)

- Gradient: `gradients.primaryGradient` (`primary → primary2`), diagonal
  `start {0,0} → end {1,1}`.
- `borderRadius: radius.lg`, `paddingVertical: spacing.lg`, centered, min height 48.
- Label: `typography.button` (`colors.text` / white).
- **States:**

  | State | Treatment |
  |---|---|
  | default | full-opacity gradient, label "Log In" |
  | pressed | scale 0.98 / opacity 0.9 (`animation.fast`) |
  | disabled (empty fields) | gradient at 0.5 opacity, no press feedback, `accessibilityState={{disabled:true}}` |
  | loading (submitting) | `ActivityIndicator` (white) + "Logging in…", non-interactive |

- Enable rule: `email.trim().length > 0 && password.length > 0 && !submitting`.

### 5.8 Divider

- Row: line — label — line. Lines `flex:1`, `height:1`,
  `backgroundColor: colors.borderLight`. Label "Or continue with"
  `typography.caption`, `colors.textMuted`, `gap: spacing.md`, `marginVertical: spacing.xl`.

### 5.9 OAuthButton (×2, in a `gap: spacing.md` row)

- Each: `flex:1`, `glassEffects.glass`, row, centered, `gap: spacing.sm`,
  `paddingVertical: spacing.md`, `borderRadius: radius.md`, min height 48.
- Icon `logo-google` / `logo-apple` size 20 `colors.text`; label `typography.smallBold`
  `colors.text`.
- Apple button only renders on iOS (unchanged).
- **Warm-up state:** while `!googleRequest`, render `<Skeleton height={48}
  borderRadius={radius.md} style={{flex:1}} />` in the Google slot instead of a dimmed
  button. Once ready, cross-fade to the real button (`animation.medium`).
- Disabled while `submitting`: 0.6 opacity, non-interactive.

### 5.10 SignUpLink

- Centered, `paddingBottom: spacing.xl`.
- "Don't have an account? " `typography.small` `colors.textMuted` + "Sign up"
  `typography.smallBold` `colors.accent` (was `#c084fc` → `colors.accent`, exact match).
- 44pt tap target.

---

## 6. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0f0a1e','#1a1035','#0f0a1e']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| logo circle `rgba(168,85,247,0.9)` | `colors.primary2` @ 0.9 |
| logo circle `rgba(236,72,153,0.9)` (pink) | `colors.accent` @ 0.9 |
| heart `#ec4899` (pink) | `colors.accent` |
| `coupleText #a855f7` | `colors.primary2` |
| `flowText #ec4899` (pink) | `colors.primary2` (unify wordmark) |
| `tagline #a855f7` | `colors.primary2` |
| `welcomeTitle #ffffff` | `colors.text` |
| `welcomeSubtitle #9ca3af` | `colors.textMuted` |
| input row bg `rgba(255,255,255,0.06)` | `colors.glassLight` (via `glassEffects.glass`) |
| input row border `rgba(255,255,255,0.08)` | `colors.borderGlass` |
| input focus / eye-active `#a855f7` | `colors.primary2` |
| `inputBare` text `#ffffff` | `colors.text` |
| placeholder `#6b7280` | `colors.textDark` |
| leading input icons `#94a3b8` | `colors.textMuted` |
| `forgotText #a855f7` | `colors.primary2` |
| login btn gradient `['#a855f7','#7c3aed']` | `gradients.primaryGradient` (`[primary, primary2]`) |
| login btn text `#fff` | `colors.text` |
| divider line `rgba(100,116,139,0.3)` | `colors.borderLight` |
| divider text `#64748b` | `colors.textMuted` |
| oauth btn bg `rgba(255,255,255,0.04)` | `colors.glassLight` (via `glassEffects.glass`) |
| oauth btn border `rgba(255,255,255,0.08)` | `colors.borderGlass` |
| oauth icon/text `#e5e7eb / #fff` | `colors.text` |
| signup text `#9ca3af` | `colors.textMuted` |
| signup "Sign up" `#c084fc` | `colors.accent` |
| disabled `opacity: 0.4` | `0.5` (button) / `0.6` (fields, oauth) — consistent disabled scale |
| `alert()` on failure | inline `ErrorBanner` (§5.4) + per-field error state |
| `padding: 24` | `spacing.xl` |
| gaps/margins `48/32/24/16/12/10/8` | `spacing.xxxl/xxl/xl/lg/md/sm` |
| `borderRadius: 14` (btn), `12` (fields/oauth) | `radius.lg` (btn), `radius.md` (fields/oauth) |
| card container (new) | `glassEffects.glassFloating`, `radius.xl` |
| font sizes `32/26/16/15/14/12` + weights | `typography.h1/h3/body/small/caption/button` |

---

## 7. States summary

| State | Treatment |
|---|---|
| **Default / populated** | §4a — brand, welcome, auth card, divider, OAuth, sign-up. |
| **Empty (untouched)** | §4c — placeholder fields (`colors.textDark`), Log In **disabled** (0.5 opacity) until both fields non-empty. |
| **Focused field** | Field border + leading icon → `colors.primary2` (1.5px). |
| **Loading — OAuth warm-up** | §4b(i) — `<Skeleton height={48} borderRadius={radius.md}/>` in OAuth slots while `!googleRequest`; cross-fade to buttons when ready. |
| **Loading — submitting** | §4b(ii) — button spinner + "Logging in…", card `pointerEvents:'none'`, fields/OAuth disabled (0.6 opacity). |
| **Error — bad credentials** | §4d — banner "Email or password is incorrect." + both field borders red (no per-field helper, don't reveal which). |
| **Error — network** | banner "Can't reach CoupleFlow…" + **Retry** button. |
| **Error — OAuth** | banner "Google/Apple Sign-In didn't work. Try again or use email." |
| **Disabled** | Log In disabled until fields valid; OAuth disabled during submit. |
| **Overflow — long email** | input `numberOfLines={1}`; the field row never grows — text scrolls within the input. |
| **Small screens** | `ScrollView flexGrow:1 justifyContent:'center'` already handles vertical centering; on short viewports content scrolls, brand block shrinks margin from `spacing.xxl` → `spacing.xl`. |
| **Keyboard open** | `KeyboardAvoidingView` (iOS padding) + `keyboardShouldPersistTaps="handled"` (both preserved); tapping outside dismisses via `TouchableWithoutFeedback` (preserved). |

---

## 8. Accessibility

- **Touch targets:** all interactive elements ≥ 44×44pt — fields min-height 48, Log In
  min-height 48, OAuth buttons min-height 48, eye toggle / Forgot / Sign-up padded via
  `hitSlop` to 44.
- **Color-independent status:** the error state is conveyed by **icon + explicit word +
  color** (banner icon + "incorrect"/"can't reach"/"didn't work" + red border), never by
  red alone. Focus is conveyed by border-width change **and** color, not color-only.
  Disabled button is conveyed by opacity **and** `accessibilityState.disabled`.
- **Contrast (WCAG AA):** body/label text uses `colors.text` on dark glass (passes 4.5:1);
  secondary uses `colors.textMuted` (verify ≥4.5:1 on `bgDarkPurple` — it is
  `#94a3b8` on ~`#1a0a40`, passes). Placeholder `colors.textDark` is decorative/low-stakes;
  do **not** put load-bearing info only in placeholders. Error text uses `colors.text`
  (full contrast), not dimmed.
- **Screen-reader labels:**
  - Email field: `accessibilityLabel="Email"`, `accessibilityHint="Enter your account email"`.
  - Password field: `accessibilityLabel="Password"`; eye toggle
    `accessibilityLabel="Show password" / "Hide password"`, `accessibilityRole="button"`.
  - Log In: `accessibilityRole="button"`, `accessibilityState={{ disabled, busy: submitting }}`,
    label "Log In" (or "Logging in" when busy).
  - OAuth: `accessibilityLabel="Continue with Google" / "Continue with Apple"`.
  - Forgot / Sign-up: `accessibilityRole="link"`.
  - ErrorBanner: `accessibilityRole="alert"`, `accessibilityLiveRegion="assertive"` so
    failures are announced immediately.
- **Reading order:** brand → "Welcome back" → subtitle → (error banner, if present) →
  email → password → forgot → Log In → divider → Google → Apple → sign-up.
- **Reduced motion:** button press scale, OAuth skeleton cross-fade, and any focus
  transition use `animation.fast/medium`; under `prefers-reduced-motion` / RN reduce-motion
  setting, swap for instant state changes (no scale/pulse) — the `Skeleton` pulse should
  freeze to a static block.

---

## 9. Developer notes

- **Retire pink globally on this screen.** `#ec4899` and `#c084fc`-as-brand map to
  `colors.accent`; the wordmark unifies on `colors.primary2`. Do not reintroduce a pink
  literal — it is not in `design-system.ts` and fragments the identity.
- **Reuse, don't re-implement:** `GradientBackground` for the background, `Skeleton` for
  the OAuth warm-up state. Do not hand-roll either.
- **Do not use `alert()`** for auth failures. Route all failures through the inline
  `ErrorBanner` state (§5.4). Keep the existing `errorHaptic()` / `successHaptic()` calls —
  pair the error haptic with showing the banner.
- **Preserve all logic:** the `handleLogin` / `handleGoogleToken` / `handleAppleSignIn`
  flows, `AsyncStorage` session write, `onboarding_complete` routing, Google/Apple request
  hooks, and `KeyboardAvoidingView` behavior are unchanged. This is a presentation +
  state-surface redesign only.
- **Button enable gating** is new UX; if the team prefers to keep the button always
  enabled and validate on submit, keep the disabled *visual* only for `submitting` and
  drop the empty-field gating — but the empty-field disable is recommended (matches native
  auth conventions and removes a class of alert-on-submit failures).
- **`glassFloating` shadow** already carries elevation; don't add an extra shadow to the
  auth card.
- Consider extracting `AuthField`, `OAuthButton`, and `ErrorBanner` as small local
  components — they'll be reused verbatim by the `register.tsx` screen (same archetype),
  which should get the identical treatment in a follow-up.

---

## 10. Handoff checklist

- [x] All states designed (default, empty/untouched, focused, loading×2, error×3, disabled, overflow, small-screen, keyboard)
- [x] Every old hardcoded value mapped to a design-system token
- [x] Bespoke gradient → `<GradientBackground variant="bgDarkPurple">`
- [x] Pink brand color retired in favor of the purple/accent scale
- [x] `alert()` failures replaced with inline `ErrorBanner` + per-field error state
- [x] Loading uses shared `Skeleton` (OAuth warm-up) + button spinner (submit)
- [x] Accessibility: 44pt targets, color-independent status, SR labels, live-region error, reduced motion
- [x] Functionality preserved (auth flows, session, routing, keyboard handling unchanged)
- [x] Component specs written (§5) and cross-referenced to `docs/design/components/login-*.json`
