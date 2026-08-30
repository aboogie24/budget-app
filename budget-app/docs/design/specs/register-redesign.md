# Register (Create Account) Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Archetype:** Auth / Form
**Route / file:** `register` → `budget-app/app/register.tsx`
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Sibling screen (must stay consistent with):** `budget-app/components/BudgetAppLogin.tsx` (the `login` route)

---

## 1. Why this redesign exists

The register screen is a **standalone visual island**. Like the pre-redesign calendar and
dashboard, it hardcodes everything and never touches `design-system.ts`:

- **Its own background gradient** — `['#0f0a1e', '#1a1225', '#0f0a1e']` (note: this doesn't
  even match its own sibling login screen, which uses `['#0f0a1e', '#1a1035', '#0f0a1e']`).
- **Its own color literals** — `#a855f7`, `#ec4899`, `#94a3b8`, `#64748b`, `#f8fafc`,
  `#c084fc`, plus a separate password-strength palette (`#f87171`, `#fbbf24`, `#60a5fa`,
  `#34d399`) that overlaps but does not equal the semantic tokens.
- **Its own surfaces** — `rgba(255,255,255,0.06)` cards and `rgba(255,255,255,0.08)` borders,
  hand-rolled instead of `glassEffects` / `colors.borderGlass`.
- **Magic numbers everywhere** — `borderRadius: 20/14/12`, paddings `22/20/16/12/10/8`, font
  sizes `28/18/15/14/12/11`, weights `800`, `letterSpacing: -0.5`. None come from the scale.

The result is the same problem the reference screens had: it *feels like a different app*.
The two OAuth screens (login + register) are near-identical hand-copies of each other, so
they drift independently and neither one uses the system.

### What this redesign does

1. **Adopts the design system fully** — background becomes
   `<GradientBackground variant="bgDarkPurple">`; every color, radius, space, font, and glass
   surface comes from `design-system.ts`. No local literals, no magic numbers.
2. **Adds the standard screen chrome** — a real header row with `BackButton` (the reference
   screens all have one; this screen currently has none, so the only way back to login is the
   footer link — a dead end if you arrived via deep link).
3. **Improves the form's information architecture** — groups the four fields into a single
   glass "form card", promotes password feedback into a proper inline validation system, and
   makes every status **color-independent** (icon + word + color), which the current
   strength meter and match indicator fail (they lean on color alone).
4. **Keeps it recognizably the same screen** — same brand lockup, same four fields, same
   password strength meter, same match indicator, same primary CTA, same Google/Apple SSO,
   same "Already have an account? Log in" footer. Functionality is 1:1 preserved.

> **Consistency note for the implementer:** this spec deliberately mirrors the login screen's
> structure (logo lockup → welcome heading → glass form → primary CTA → divider → OAuth →
> footer link). Apply the *same* tokenized treatment to login when it is redesigned so the
> two auth screens stay a matched pair. Where this spec and login differ, this spec wins and
> login should follow.

---

## 2. Layout structure & information architecture

The screen is a single vertically-scrolling column, centered when short, scrollable when the
keyboard is up. Top-to-bottom hierarchy:

```
GradientBackground (bgDarkPurple)
└─ SafeAreaView
   └─ KeyboardAvoidingView (iOS: padding)
      └─ Header row .......... BackButton (left)  ·  brand lockup (center)  ·  40pt spacer (right)
      └─ ScrollView (keyboardShouldPersistTaps="handled", dismiss on tap-outside)
         ├─ Hero block ....... avatar chip + "Create account" (h2) + subtitle
         ├─ Form card ........ glass card containing:
         │     ├─ Full name field
         │     ├─ Email field
         │     ├─ Password field  (+ inline strength meter, conditional)
         │     └─ Confirm field   (+ inline match row, conditional)
         ├─ Primary CTA ...... "Create account" gradient button
         ├─ Divider .......... "or sign up with"
         ├─ OAuth row ........ Google · Apple(iOS)
         └─ Footer link ...... "Already have an account? Log in"
```

**IA changes vs. current:**

- The brand lockup **moves into the header** (center), so the hero block leads with the task
  ("Create account"), not the logo. This matches the reference screens where the header is
  the anchor and the content leads with purpose.
- The four fields are wrapped in **one glass form card** (they were four loose rows). This
  applies Gestalt proximity: "this is the block you fill in," visually separated from the
  CTA and SSO below.
- The `BackButton` gives a real, conventional way back to login.

---

## 3. Wireframes — all states

### 3a. Default / populated (390×844)

```
┌──────────────────────────────────────────────────────────┐
│  ┌────┐            Couple ♥ Flow                          │  ← header: BackButton +
│  │ ←  │                                        (40pt gap) │    centered brand lockup
│  └────┘                                                   │
│                                                           │
│                    ╭──────────╮                           │
│                    │    👤     │   ← avatar chip           │
│                    ╰──────────╯      (primary2 tint)      │
│                                                           │
│                  Create account                           │  ← typography.h2
│         Start your money journey, together.               │  ← typography.small, muted
│                                                           │
│   ┌─────────────────────────────────────────────────┐    │
│   │  👤  Alex Rivera                                  │    │  ← form card (glass)
│   ├─────────────────────────────────────────────────┤    │    field rows w/ leading
│   │  ✉   alex@example.com                             │    │    icon + bare input
│   ├─────────────────────────────────────────────────┤    │
│   │  🔒  ••••••••••                          👁        │    │  ← eye toggle (44pt)
│   │  ▆▆▆▆  ▆▆▆▆  ▆▆▆▆  ░░░░                            │    │  ← strength meter (4 bars)
│   │  ✓ Good — add a symbol to make it strong           │    │  ← label: icon+word+color
│   ├─────────────────────────────────────────────────┤    │
│   │  🔒  ••••••••••                          👁        │    │
│   │  ✓ Passwords match                                 │    │  ← match row: icon+word
│   └─────────────────────────────────────────────────┘    │
│                                                           │
│   ┌─────────────────────────────────────────────────┐    │
│   │            Create account          →              │    │  ← primary CTA (gradient)
│   └─────────────────────────────────────────────────┘    │
│                                                           │
│   ──────────────  or sign up with  ──────────────        │  ← divider
│                                                           │
│   ┌────────────────────┐   ┌────────────────────┐        │
│   │  G   Google         │   │     Apple        │        │  ← OAuth row (Apple iOS only)
│   └────────────────────┘   └────────────────────┘        │
│                                                           │
│           Already have an account?  Log in                │  ← footer link (accent word)
└──────────────────────────────────────────────────────────┘
```

### 3b. Loading / submitting (CTA busy state)

The screen has no data to fetch, so its "loading" is **submit-in-flight** (`submitting`).
The whole form disables and the CTA shows a spinner + label. Reuse `Skeleton` only in the
rare gated case below.

```
│   ┌─────────────────────────────────────────────────┐    │
│   │   ⟳  Creating your account…                       │    │  ← CTA: ActivityIndicator +
│   └─────────────────────────────────────────────────┘    │    label, gradient dimmed 0.6
│                                                           │
│   (all fields + OAuth buttons dimmed to 0.5, disabled)    │
```

**Optional skeleton case:** if Google's `useIdTokenAuthRequest` request object is still
initializing (`!googleRequest`), the Google button renders a **Skeleton pill** in place of
its label instead of the current opacity-0.4 hack — so the button reads as "loading" not
"broken."

```
│   ┌────────────────────┐   ┌────────────────────┐        │
│   │  ▬▬▬▬▬▬▬▬▬▬▬  │   │     Apple        │        │  ← Skeleton width 60, height 14
│   └────────────────────┘   └────────────────────┘        │
```

### 3c. Empty state (pristine form — first paint)

There is no "no data" empty state for a create-account form; the pristine form **is** the
empty state. Encode emptiness through placeholders + a disabled-looking (but still tappable)
CTA:

```
│   ┌─────────────────────────────────────────────────┐    │
│   │  👤  Full name                                    │    │  ← placeholders in textDark
│   │  ✉   Email                                        │    │
│   │  🔒  Password                            👁        │    │  ← no meter yet (pw empty)
│   │  🔒  Confirm password                    👁        │    │  ← no match row yet
│   └─────────────────────────────────────────────────┘    │
│   ┌─────────────────────────────────────────────────┐    │
│   │            Create account          →              │    │  ← CTA visually "quiet"
│   └─────────────────────────────────────────────────┘    │    (see §5.4 idle vs ready)
```

The strength meter and match row are **conditional** — they only mount once the relevant
field has content (preserves current behavior). This keeps the pristine form calm.

### 3d. Error / validation state (inline, replaces `Alert`)

The current screen throws four native `Alert.alert(...)` dialogs (missing fields, mismatch,
weak password, server failure). The redesign keeps native `Alert` as an **acceptable
fallback**, but promotes the two most common cases to **inline glass banners** at the top of
the form card so the user never leaves the screen and sees exactly which field is wrong.

```
│   ┌─────────────────────────────────────────────────┐    │
│   │ ⚠  Registration failed                            │    │  ← error banner: icon +
│   │    That email is already in use. Try logging in.  │    │    title + message, dashed
│   └─────────────────────────────────────────────────┘    │    error-tinted glass row
│   ┌─────────────────────────────────────────────────┐    │
│   │  👤  Alex Rivera                                  │    │
│   │  ✉   alex@example.com                      ⚠      │    │  ← field-level marker on the
│   │  ...                                              │    │    offending field
```

Per-field inline validation (color-independent — always icon + word):

| Condition | Marker | Copy |
|---|---|---|
| Empty required field on submit | `alert-circle` `colors.error` | "Required" |
| Invalid email format | `alert-circle` `colors.error` | "Enter a valid email" |
| Password < 8 chars on submit | `alert-circle` `colors.warning` | "Use at least 8 characters" |
| Passwords don't match | `close-circle` `colors.error` | "Passwords do not match" |

---

## 4. Token mapping (no magic numbers)

Every hardcoded value in the current `register.tsx` → its design-system token.

### Background & container

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0f0a1e','#1a1225','#0f0a1e']}>` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `container` `backgroundColor: 'rgba(255,255,255,0.06)'` | `glassEffects.glass` (`colors.glassLight`) |
| `container` `borderColor: 'rgba(255,255,255,0.08)'` | `colors.borderGlass` |
| `container` `borderRadius: 20` | `radius.xl` |
| `container` `padding: 22` | `spacing.lg` (16) or `spacing.xl` (24) — use `spacing.lg` |
| `formWrapper` `paddingHorizontal: 20` | `spacing.lg` (16) via `commonStyles.scrollContent` |
| `topRow` `marginBottom: 32` | `spacing.xxl` |

### Brand lockup

| Old | Token |
|---|---|
| `Couple` text `#a855f7`, `fontSize: 18`, `fontWeight: '700'` | `colors.primary2`, `typography.bodyBold` (16) |
| heart icon `#ec4899` | keep pink as **brand accent** — see Developer Notes §9 (not in tokens; treat as the one sanctioned brand literal, matching login) |
| `Flow` text `#ec4899` | brand-pink literal (same as heart) |

### Hero block

| Old | Token |
|---|---|
| `title` `fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: '#fff'` | `typography.h2` (28/700) + `colors.text` |
| `subtitle` `color: '#94a3b8', fontSize: 14` | `typography.small` + `colors.textMuted` |
| `avatarCircle` `backgroundColor: 'rgba(168,85,247,0.1)'` | `colors.primary2` @ 10–12% tint |
| `avatarCircle` `borderColor: 'rgba(168,85,247,0.25)'` | `colors.primary2` @ 25% |
| `avatarCircle` icon `#a855f7`, `size 32` | `colors.primary2` |
| `avatarCircle` `width/height 72, borderRadius 36` | keep 72; `radius.full` |

### Input rows

| Old | Token |
|---|---|
| `inputRow` `backgroundColor: 'rgba(255,255,255,0.06)'` | `colors.glassLight` (via `glassEffects.glass` surface) |
| `inputRow` `borderColor: 'rgba(255,255,255,0.08)'` | `colors.borderGlass` |
| `inputRow` `borderRadius: 12` | `radius.md` |
| `inputRow` `paddingVertical/Horizontal: 12` | `spacing.md` |
| `inputRow` `marginBottom: 10` / `gap: 8` | `spacing.md` between fields; `gap: spacing.sm` |
| leading icon `#94a3b8` | `colors.textMuted` |
| `inputBare` `color: '#f8fafc', fontSize: 15` | `colors.text`, `typography.body` (16) |
| placeholder `#64748b` | `colors.textDark` |
| eye icon `#94a3b8` | `colors.textMuted`; **active** state → `colors.primary2` (matches login's toggle) |

### Password strength meter

| Old | Token |
|---|---|
| `Weak '#f87171'` | `colors.error` |
| `Fair '#fbbf24'` | `colors.warning` |
| `Good '#60a5fa'` | `colors.info` |
| `Strong '#34d399'` | `colors.success` |
| empty bar `'rgba(255,255,255,0.1)'` | `colors.glassStrong` (0.12) |
| `meterBar` `height: 4, borderRadius: 999` | keep 4; `radius.full` |
| `passwordMeter` `gap: 6` | `spacing.sm` (8) |
| `meterLabel` `fontSize: 11, fontWeight: '600'` | `typography.caption` (12) |

### Match indicator

| Old | Token |
|---|---|
| match `#34d399` | `colors.success` |
| mismatch `#f87171` | `colors.error` |
| `fontSize: 12` | `typography.caption` |

### Primary CTA

| Old | Token |
|---|---|
| `LinearGradient colors={['#a855f7','#7c3aed']}` | `gradients.primaryGradient` (`[colors.primary, colors.primary2]`) — note order: use primary→primary2 for consistency with the system |
| `button` `borderRadius: 14` | `radius.lg` (16) |
| `buttonInner` `paddingVertical: 16` | `spacing.lg` |
| `buttonText` `#fff, fontWeight: '800', fontSize: 16` | `colors.text`, `typography.button` (16/600) |
| `submitting && { opacity: 0.6 }` | keep 0.6 dim; add `ActivityIndicator` (`colors.text`) |

### Divider

| Old | Token |
|---|---|
| `dividerLine` `'rgba(100,116,139,0.3)'` | `colors.borderLight` |
| `dividerText` `#64748b, fontSize: 12` | `colors.textMuted`, `typography.caption` |
| `marginVertical: 24` / `gap: 12` | `spacing.xl` / `spacing.md` |

### OAuth buttons

| Old | Token |
|---|---|
| `ssoBtn` `backgroundColor: 'rgba(255,255,255,0.06)'` | `colors.glassLight` |
| `ssoBtn` `borderColor: 'rgba(255,255,255,0.08)'` | `colors.borderGlass` |
| `ssoBtn` `borderRadius: 12` | `radius.md` |
| `ssoBtn` `paddingVertical: 14` / `gap: 8/12` | `spacing.md` / `spacing.sm` / `spacing.md` |
| icon `#e5e7eb` | `colors.text` |
| `ssoBtnText` `#fff, fontSize: 14, fontWeight: '600'` | `colors.text`, `typography.smallBold` |
| `!googleRequest && { opacity: 0.4 }` | replace with `Skeleton` label (see §3b) |

### Footer link

| Old | Token |
|---|---|
| `loginLinkText` `#94a3b8, fontSize: 14` | `colors.textMuted`, `typography.small` |
| `Log in` inline `#c084fc, fontWeight: '700'` | `colors.accent`, `typography.smallBold` |
| `marginTop: 16` | `spacing.lg` |

### Header (new)

| Element | Token |
|---|---|
| header row | `commonStyles.header` (flex row, `marginBottom: spacing.xl`) |
| BackButton | `<BackButton fallback="/login" />` — its own tokenized styles |
| brand lockup center | `typography.bodyBold`, `colors.primary2` + brand-pink |

---

## 5. Component specs (implementer-ready)

### 5.1 `RegisterHeader`

Standard screen header, matching the reference screens' pattern.

- **Layout:** `flexDirection: row`, `justifyContent: 'space-between'`, `alignItems: 'center'`,
  `marginBottom: spacing.xl` (= `commonStyles.header`).
- **Left:** `<BackButton fallback="/login" />` (40×40, tokenized). Because register is usually
  pushed from login (`router.push('/register')`), `router.back()` works; `fallback="/login"`
  covers deep-link entry.
- **Center:** brand lockup — `Couple` (`colors.primary2`) + heart icon (brand-pink, size 16) +
  `Flow` (brand-pink), `typography.bodyBold`. `flexDirection: row`, `gap: spacing.xs`.
- **Right:** empty `View width: 40` spacer to keep the lockup optically centered.
- **A11y:** BackButton `accessibilityLabel="Back to log in"`. Lockup is `accessibilityRole="header"`, label "CoupleFlow".

### 5.2 `RegisterHero`

- Avatar chip: 72×72, `radius.full`, fill `colors.primary2` @12%, border 2px `colors.primary2`
  @25%, centered `person-outline` (size 32, `colors.primary2`). `alignSelf: 'center'`,
  `marginBottom: spacing.lg`.
- Title: "Create account", `typography.h2`, `colors.text`, centered.
- Subtitle: "Start your money journey, together.", `typography.small`, `colors.textMuted`,
  centered, `marginBottom: spacing.lg`.
- **Decorative** avatar → `accessibilityElementsHidden` / `importantForAccessibility="no"`.

### 5.3 `RegisterField`  (reused for all 4 inputs)

| Prop | Type | Notes |
|---|---|---|
| `icon` | Ionicons name | leading glyph, `colors.textMuted`, size 18 |
| `value` / `onChangeText` | string / fn | controlled |
| `placeholder` | string | `colors.textDark` |
| `secure` | boolean | renders eye toggle when true |
| `error` | string \| null | when set, shows field-level marker + border tint (§3d) |
| `...TextInputProps` | — | keyboardType, autoComplete, textContentType passthrough |

- **Container:** `glassEffects.glass` surface + `colors.borderGlass`, `radius.md`,
  `padding: spacing.md`, `flexDirection: row`, `alignItems: center`, `gap: spacing.sm`.
- **Input:** `flex: 1`, `colors.text`, `typography.body`.
- **Eye toggle** (secure only): 44×44 touch target (`hitSlop` to reach 44), icon
  `eye-outline` / `eye-off-outline`, `colors.textMuted`; when revealed → `colors.primary2`.
- **States:** default · focused (border → `colors.primary2` @40%, optional) · error (border
  `colors.error`, trailing `alert-circle` + helper text below) · disabled (opacity 0.5 while
  `submitting`).
- **Spacing:** `marginBottom: spacing.md` between fields inside the form card.

### 5.4 `RegisterFormCard`

Wraps the four `RegisterField`s + conditional feedback rows in one glass card.

- **Surface:** `glassEffects.glass`, `radius.xl`, `padding: spacing.lg`.
- **Order:** error banner (conditional) → Full name → Email → Password → StrengthMeter
  (conditional) → Confirm → MatchRow (conditional).
- The **error banner** (§3d) is an inline row: `alert-circle` (`colors.error`) + title
  (`typography.smallBold`, `colors.text`) + message (`typography.caption`, `colors.textMuted`),
  dashed 1px `colors.error` border, `colors.error` @8% fill, `radius.md`, `padding: spacing.md`,
  `marginBottom: spacing.md`.

### 5.5 `PasswordStrengthMeter`

- Renders only when `password.length > 0` (preserve current gating).
- Four bars, `flex: 1`, `height: 4`, `radius.full`, `gap: spacing.sm`. Filled bars up to
  `strength.level` use the level token (`error`/`warning`/`info`/`success`); the rest use
  `colors.glassStrong`.
- **Label (color-independent):** icon + word + guidance, e.g.
  `✓ Strong password` / `▲ Good — add a symbol to make it strong`. Icon:
  `checkmark-circle` (Strong/Good) or `alert-circle` (Fair/Weak). Text
  `typography.caption` in the matching level color. **The word ("Weak/Fair/Good/Strong")
  is always present** so the bar color is never the sole signal.
- Map the existing `getPasswordStrength` levels 1–4 to `error/warning/info/success`.

### 5.6 `PasswordMatchRow`

- Renders only when `confirmPassword.length > 0`.
- Icon `checkmark-circle` (`colors.success`) / `close-circle` (`colors.error`) + text
  "Passwords match" / "Passwords do not match", `typography.caption`, matching color,
  `marginBottom: spacing.sm`. Word + icon carry the meaning; color reinforces only.

### 5.7 `RegisterPrimaryCTA`

| State | Visual |
|---|---|
| **idle** (form incomplete) | `gradients.primaryGradient`, label "Create account" + `arrow-forward`, full opacity but note it is always tappable (validation runs on press and surfaces inline errors — do **not** hard-disable, so users learn what's missing) |
| **ready** (all fields valid) | identical; optionally add a subtle scale-on-press (`animation.fast`) |
| **submitting** | opacity 0.6, `ActivityIndicator` (`colors.text`) + "Creating your account…", `disabled` |
| **pressed** | `activeOpacity 0.85` / scale 0.98 under `animation.fast` |

- Surface: gradient, `radius.lg`, `paddingVertical: spacing.lg`, row-centered, `gap: spacing.sm`.
- Text: `typography.button`, `colors.text`.

### 5.8 `OAuthRow`

- Row of `OAuthButton`s, `gap: spacing.md`; Apple only on `Platform.OS === 'ios'`.
- Each button: `glassEffects.glass` + `colors.borderGlass`, `radius.md`,
  `paddingVertical: spacing.md`, row-centered, `gap: spacing.sm`, `flex: 1`. Icon
  `logo-google` / `logo-apple` (`colors.text`, size 18) + label `typography.smallBold`.
- **Google loading:** while `!googleRequest`, swap the label for `<Skeleton width={60} height={14} />` and keep `disabled`. No opacity-0.4 "broken" look.

### 5.9 `FooterLoginLink`

- Centered, `marginTop: spacing.lg`, `typography.small`, `colors.textMuted`; the "Log in"
  word is `colors.accent` + `typography.smallBold`. `onPress → router.replace('/login')`
  (preserve current behavior). 44pt tappable height via padding.

---

## 6. Component inventory

| Component | Type | Variants | States |
|---|---|---|---|
| RegisterHeader | chrome | — | default |
| RegisterHero | display | — | default |
| RegisterFormCard | container | — | default, error, submitting |
| RegisterField | input | text, email, secure | default, focused, error, disabled |
| PasswordStrengthMeter | feedback | weak, fair, good, strong | hidden (pw empty), visible |
| PasswordMatchRow | feedback | match, mismatch | hidden, visible |
| RegisterPrimaryCTA | action | — | idle, ready, submitting, pressed |
| OAuthRow / OAuthButton | action | google, apple | default, loading (google), disabled |
| FooterLoginLink | nav | — | default, pressed |

---

## 7. Spacing & layout summary

- Screen horizontal padding: `spacing.lg` (via `commonStyles.scrollContent`)
- Header → hero gap: `spacing.xl`
- Between form fields: `spacing.md`
- Form card padding: `spacing.lg`
- Form card → CTA gap: `spacing.lg`
- CTA → divider: `spacing.xl`
- Divider → OAuth: `spacing.xl`
- OAuth → footer: `spacing.lg`
- Field row internal padding: `spacing.md`; icon↔input gap: `spacing.sm`
- Max content width: keep the existing 420 cap (`maxWidth: 420`, centered) for tablet/web.

---

## 8. Accessibility

- **Touch targets ≥ 44×44pt:** eye toggles (currently size-18 icons with an 8pt hitSlop ≈ 34
  — bump hitSlop or wrap to reach 44); OAuth buttons; CTA; footer link; BackButton (already 40
  + 12 hitSlop = 64 effective).
- **Color-independent status (icon + word + color):**
  - Strength meter always shows the **word** (Weak/Fair/Good/Strong) + an icon, not just bar
    color.
  - Match row always shows "Passwords match / do not match" + check/close icon.
  - Field errors always show a word ("Required", "Enter a valid email") + `alert-circle`.
- **Contrast (WCAG AA):** `colors.text` (#f8fafc) and `colors.textMuted` (#94a3b8) on dark
  glass both clear 4.5:1. Placeholder `colors.textDark` (#475569) is intentionally low — it's
  placeholder, not content; ensure the typed value uses `colors.text`. Verify the
  `colors.info` (#3b82f6) "Good" label clears 4.5:1 on the card; if borderline, pair with the
  word (already required) — meaning never depends on it.
- **Screen-reader order:** BackButton → brand ("CoupleFlow", header) → "Create account"
  (header) → subtitle → Full name field → Email → Password (+ "password strength: Good") →
  Confirm (+ "Passwords match") → "Create account" button → "or sign up with" → Google →
  Apple → "Already have an account, Log in" link. Decorative avatar hidden from SR.
- **Field labels:** each `TextInput` gets an explicit `accessibilityLabel` (placeholder alone
  is not a reliable label): "Full name", "Email", "Password", "Confirm password". Eye toggle
  label: "Show password" / "Hide password".
- **Keyboard / form UX:** preserve `KeyboardAvoidingView` + tap-to-dismiss; add
  `returns`/`onSubmitEditing` chaining (name → email → password → confirm → submit) and
  `keyboardShouldPersistTaps="handled"` on the ScrollView so taps on the CTA register while
  the keyboard is open.
- **Reduced motion:** CTA press-scale and any strength-bar fill transition use
  `animation.fast`; under `prefers-reduced-motion` (or RN `AccessibilityInfo.isReduceMotionEnabled`)
  swap to instant state changes.

---

## 9. Developer notes

- **Background:** replace the outer `<LinearGradient>` with `<GradientBackground variant="bgDarkPurple">`;
  do not re-implement. Wrap contents in `SafeAreaView` (from `react-native-safe-area-context`,
  as dashboard does) so the header clears the notch.
- **Brand pink is the one sanctioned literal.** `#ec4899` (heart + "Flow") is a brand color
  not present in `design-system.ts`. Both auth screens already use it. Keep it as a single
  named constant at the top of the file (e.g. `BRAND_PINK`) rather than sprinkling the hex —
  or, preferably, propose adding `colors.brandPink` to the design system in a separate change
  (do **not** edit `design-system.ts` as part of this screen's work).
- **Reuse, don't rebuild:** `GradientBackground`, `BackButton`, `Skeleton`. The existing
  `EmptyState` / `ErrorState` shared components depend on `ThemeContext`/`componentDefaults`
  (a *different* theme layer than `design-system.ts`); for consistency with the reference
  screens, build the inline error banner (§5.4) directly from `design-system.ts` tokens rather
  than pulling in that second theme system.
- **Preserve all logic verbatim:** `getPasswordStrength`, `handleRegister` (register →
  auto-login → `router.replace('/onboarding')`), `handleGoogleToken`, `handleAppleSignIn`,
  `completeOAuthLogin`, the Google `useEffect`, haptics (`successHaptic`/`errorHaptic`), and
  the uuid/session storage flow. This is a **visual + IA** redesign only.
- **Validation surfacing:** keep the existing `Alert.alert` calls as a fallback, but wire the
  same conditions into the inline banner/field markers (§3d) so the primary experience stays
  on-screen. The strength/match logic already exists; just re-skin its output.
- **CTA is not hard-disabled on incomplete form** — it runs validation on press and surfaces
  inline errors, which teaches the user what's missing (better than a dead grey button).
  It *is* disabled during `submitting`.
- **Sibling parity:** apply this exact token treatment to `BudgetAppLogin.tsx` when it is
  redesigned so login + register remain a matched pair.

---

## 10. Handoff checklist

- [x] Why documented (bespoke styling, no design-system usage, drift from sibling login)
- [x] All states wireframed (default, submitting/loading + skeleton, empty/pristine, error/validation)
- [x] Every hardcoded color / gradient / radius / spacing / font mapped to a token
- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Standard header with `BackButton` added
- [x] Shared components reused (GradientBackground, BackButton, Skeleton)
- [x] Component specs written with props/states/tokens (§5) + component JSONs
- [x] Accessibility: 44pt targets, color-independent status, SR order, labels, reduced motion
- [x] Functionality preserved (all handlers, haptics, session flow untouched)
- [x] Sibling-parity note for login included
