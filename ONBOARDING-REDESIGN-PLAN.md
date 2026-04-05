# CoupleFlow Onboarding Redesign — Implementation Plan

## Overview

Redesign the onboarding flow from the current 6-screen scattered approach into a streamlined, consolidated experience. The new flow removes unnecessary screens (theme-select, partner-mode as standalone pages) and adds the CoupleFlow Method introduction as the final onboarding step.

**Reference mockup:** `onboarding-screen-redesign.jsx` (React web mockup — must be translated to React Native)

---

## Current Flow (What Exists)

```
intro.tsx → theme-select.tsx → partner-mode.tsx → register.tsx → setup.tsx (3 steps) → dashboard
```

**6 separate route files**, each with its own navigation logic. The setup.tsx has an internal 3-step wizard (Welcome → Budget Goal → Bank Linking).

## New Flow (Target)

```
intro.tsx → register.tsx → onboarding.tsx (4 steps) → dashboard
```

**Step 0:** Welcome — CoupleFlow branding, overlapping circles, "Build your financial future, together"
**Step 1:** Invite Your Partner — email/phone input, skip option (replaces partner-mode.tsx + household-setup.tsx invite)
**Step 2:** Link Your Accounts — Plaid bank selection grid, security badge (replaces setup.tsx step 2)
**Step 3:** Choose Your CoupleFlow Path — 5-level Method roadmap with AI assessment teaser (NEW — differentiator)

---

## Phase 1: Consolidate Screens

### Task 1.1: Update `intro.tsx`

**File:** `budget-app/app/intro.tsx`

**Changes:**
- Keep as the entry point splash screen
- Update the "Get Started" button to route directly to `/register` (skip theme-select and partner-mode)
- Add subtle theme auto-detection: use system preference instead of a dedicated theme screen. Set theme via `setThemeChoice()` based on `Appearance.getColorScheme()` during intro load
- Refresh visual design:
  - Use the CoupleFlow logo with Heart icon between "Couple" (purple) and "Flow" (pink) — see mockup Step 0
  - Add the overlapping circles illustration (two circles, purple #a855f7 opacity 0.3 and pink #ec4899 opacity 0.3, positioned to overlap)
  - Tagline: "Build your financial future, together"
  - Subtitle: "Take control of your finances as a couple"

**Navigation change:**
```diff
- router.push('/theme-select')
+ // Auto-detect theme
+ const systemTheme = Appearance.getColorScheme() || 'dark';
+ await setThemeChoice(systemTheme);
+ router.push('/register')
```

### Task 1.2: Update `register.tsx`

**File:** `budget-app/app/register.tsx`

**Changes:**
- Keep existing registration form (name, email, password, OAuth) — it works well
- Update post-registration routing:

```diff
- // Current: routes to /setup
+ // New: route to /onboarding (the consolidated 4-step wizard)
  if (!userData.onboarding_complete) {
-   router.replace('/setup');
+   router.replace('/onboarding');
  }
```

- Do the same for the OAuth completion flow in `completeOAuthLogin()`
- Add a "Sign In" link at the bottom that routes to `/login`

### Task 1.3: Update `login.tsx`

**File:** `budget-app/app/login.tsx`

**Changes:**
- Update post-login routing to match:

```diff
  if (!userData.onboarding_complete) {
-   router.replace('/setup');
+   router.replace('/onboarding');
  }
```

---

## Phase 2: Build the New Onboarding Wizard

### Task 2.1: Rewrite `onboarding/index.tsx`

**File:** `budget-app/app/onboarding/index.tsx`

This is the main work. Replace the current content with a 4-step wizard component. Use `useState` to track `currentStep` (0–3).

#### Shared UI Elements (render outside the step switch):

**Status bar area** — standard, handled by Expo

**Step indicator dots** — 4 dots at top, active dot = #a855f7, inactive = rgba(255,255,255,0.15)
```tsx
<View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 }}>
  {[0, 1, 2, 3].map(i => (
    <View key={i} style={{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: i === currentStep ? '#a855f7' : 'rgba(255,255,255,0.15)'
    }} />
  ))}
</View>
```

**Bottom navigation bar** — back button (disabled on step 0), step counter "Step X of 4", forward button (disabled on step 3)
```tsx
<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
  <TouchableOpacity disabled={currentStep === 0} onPress={() => setCurrentStep(s => s - 1)}>
    <Ionicons name="chevron-back" size={20} color={currentStep === 0 ? '#5a5a6a' : '#a855f7'} />
  </TouchableOpacity>
  <Text style={{ color: '#9ca3af', fontSize: 12 }}>Step {currentStep + 1} of 4</Text>
  <TouchableOpacity disabled={currentStep === 3} onPress={() => setCurrentStep(s => s + 1)}>
    <Ionicons name="chevron-forward" size={20} color={currentStep === 3 ? '#5a5a6a' : '#ffffff'} />
  </TouchableOpacity>
</View>
```

#### Step 0: Welcome

**Purpose:** Set the emotional tone and introduce the app's value prop

**Layout (top to bottom):**
1. CoupleFlow logo text — "Couple" in #a855f7 + Heart icon (filled #ec4899) + "Flow" in #ec4899, fontSize 40+
2. Overlapping circles illustration — two `View` circles (100x100), purple and pink, opacity 0.3, overlapping by ~50px using `position: 'absolute'` and `left/right` offsets
3. Headline: "Build your financial future, together" — white, fontSize 26, fontWeight 700, textAlign center
4. Subtitle: "Take control of your finances as a couple" — #b0b0b0, fontSize 14
5. "Get Started" button — full-width, purple gradient (`LinearGradient` from expo-linear-gradient), borderRadius 12, padding 14
   - `onPress` → `setCurrentStep(1)`

**Haptic feedback:** `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on button press

#### Step 1: Invite Your Partner

**Purpose:** Capture partner's contact for household invite. This replaces both `partner-mode.tsx` AND the invite flow in `household-setup.tsx`.

**Layout:**
1. Title: "Invite Your Partner" — white, fontSize 24, fontWeight 700, textAlign center
2. Illustration: two phone icons (Ionicons `phone-portrait-outline`) with an arrow between them, purple and pink colored
3. Input field:
   - Label: "Partner's Email or Phone" — #9ca3af, fontSize 12
   - TextInput: placeholder "partner@example.com", dark background (#1a1a2e), border #3a3a4a, borderRadius 8
   - Store value in `const [partnerEmail, setPartnerEmail] = useState('')`
4. "Send Invite" button — purple gradient, full-width
   - `onPress`:
     - If `partnerEmail` is non-empty, call the household invite API: `POST /api/households/invite` with the email
     - Show success toast/haptic feedback
     - Advance to step 2: `setCurrentStep(2)`
     - If API fails, show error but still allow advancing
5. "Skip for now" link — transparent background, purple text (#a855f7), fontSize 14
   - `onPress` → `setCurrentStep(2)` (no API call)

**State:** `const [partnerEmail, setPartnerEmail] = useState('')`

**API integration:** Reuse the invite logic from `household-setup.tsx`. The existing `POST /api/households` and invite endpoints should work. If the user hasn't created a household yet, create one with a default name like "{UserName}'s Household" before sending the invite.

#### Step 2: Link Your Accounts

**Purpose:** Plaid bank account linking. Replaces `setup.tsx` Step 2.

**Layout:**
1. Title: "Link Your Accounts" — white, fontSize 24, fontWeight 700
2. "Powered by Plaid" badge — #9ca3af, fontSize 12, centered below title
3. Bank grid — 2x2 grid of bank tiles:
   ```
   [Chase 🏦]     [Bank of America 🏢]
   [Wells Fargo 🏛️] [Other Bank 💳]
   ```
   - Each tile: padding 20, borderRadius 12, border 1px #3a3a4a, dark bg
   - Selected tile: border 2px #a855f7
   - Track selection: `const [selectedBank, setSelectedBank] = useState(null)`
4. Security badge: Lock icon (green #10b981) + "We use bank-level encryption" text
5. "Connect" button — purple gradient
   - `onPress`:
     - Launch the Plaid Link flow (reuse the existing `usePlaidLink` or Plaid SDK integration from `link-account.tsx`)
     - On success, advance to step 3
     - On failure/dismiss, stay on step 2 (user can retry or skip)
6. "Skip" link — purple text
   - `onPress` → `setCurrentStep(3)`

**Important:** The Plaid integration already exists in the app. Reuse the existing `PlaidLink` component or the Plaid SDK setup from `link-account.tsx`. Do NOT rebuild Plaid integration from scratch.

#### Step 3: Choose Your CoupleFlow Path

**Purpose:** Introduce the 5-level CoupleFlow Method and create excitement about the AI-powered journey. This is NEW — doesn't exist in current app.

**Layout:**
1. Title: "Start Your CoupleFlow Journey" — white, fontSize 24, fontWeight 700
2. Subtitle: "Our AI will assess where you are" — #9ca3af, fontSize 12
3. Vertical roadmap — 5 steps connected by vertical lines:

   For each level, render:
   ```tsx
   <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
     {/* Left: icon circle + connector line */}
     <View style={{ alignItems: 'center' }}>
       <View style={{
         width: 40, height: 40, borderRadius: 20,
         backgroundColor: level.color + '33', // 20% opacity version
         alignItems: 'center', justifyContent: 'center'
       }}>
         <Ionicons name={level.icon} size={20} color={level.color} />
       </View>
       {index < 4 && (
         <View style={{ width: 2, height: 24, backgroundColor: '#3a3a4a', marginVertical: 8 }} />
       )}
     </View>
     {/* Right: text */}
     <View style={{ flex: 1, paddingTop: 4 }}>
       <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{level.title}</Text>
       <Text style={{ color: '#9ca3af', fontSize: 12 }}>{level.description}</Text>
     </View>
   </View>
   ```

   **The 5 levels:**
   | # | Title | Description | Icon (Ionicons) | Color |
   |---|-------|-------------|-----------------|-------|
   | 1 | Foundation | Set up budgets & emergency fund | `home-outline` | #a855f7 |
   | 2 | Attack Debt | Eliminate high-interest debt | `flame-outline` | #ec4899 |
   | 3 | Build Security | 3-6 month safety net | `shield-checkmark-outline` | #10b981 |
   | 4 | Grow Wealth | Invest & build assets | `trending-up-outline` | #a855f7 |
   | 5 | Dream Big | Plan your dream goals | `star-outline` | #ec4899 |

4. "Let's Go!" button — purple gradient, full-width
   - `onPress`:
     - Call `POST /api/auth/onboarding/complete` to mark onboarding as done (reuse existing endpoint from setup.tsx)
     - If budget goal wasn't set, use a default or skip it (we removed the budget goal step — it can be set later in Budget tab)
     - Haptic success feedback
     - `router.replace('/(tabs)/dashboard')`

**State to persist:** Save the user's initial CoupleFlow level assessment. For MVP, default everyone to Level 1 (Foundation). The AI advisor can re-assess after they link accounts and add data.

---

## Phase 3: Remove Deprecated Screens

### Task 3.1: Remove `theme-select.tsx`

**File:** `budget-app/app/theme-select.tsx`

- Delete this file entirely
- Theme is now auto-detected in intro.tsx
- Users can still change theme later in Settings

### Task 3.2: Remove `partner-mode.tsx`

**File:** `budget-app/app/partner-mode.tsx`

- Delete this file entirely
- Partner invitation is now handled in onboarding Step 1
- The "solo vs partner" distinction is implicit: if they skip the invite, they're solo

### Task 3.3: Deprecate `setup.tsx`

**File:** `budget-app/app/setup.tsx`

- Delete this file entirely
- Its Step 0 (Welcome) is replaced by onboarding Step 0
- Its Step 1 (Budget Goal) is deferred to the Budget tab — users set their budget when they first visit the Budget screen
- Its Step 2 (Bank Linking) is replaced by onboarding Step 2

### Task 3.4: Update `_layout.tsx` public routes

**File:** `budget-app/app/_layout.tsx`

Update the public routes list to remove deleted screens and ensure `/onboarding` is public:

```diff
  const publicRoutes = [
    '/intro',
-   '/welcome',
    '/login',
    '/register',
    '/onboarding',
-   '/theme-select',
-   '/partner-mode',
-   '/household-setup',
-   '/setup',
-   '/goals',
  ];
```

Keep `/household-setup` accessible as a standalone screen (it's used from Settings too), but remove it from the onboarding flow.

---

## Phase 4: Styling Guidelines

All screens must follow the CoupleFlow design system:

### Colors
```tsx
const colors = {
  background: '#0f0a1e',        // Main bg (previously some screens used #0b1021 or #0f172a — standardize)
  surface: '#1a1a2e',           // Card/input backgrounds
  surfaceBorder: '#3a3a4a',     // Borders on cards/inputs
  primary: '#7c3aed',           // Primary purple (buttons, gradient end)
  primaryLight: '#a855f7',      // Light purple (gradient start, active states)
  secondary: '#ec4899',         // Pink (partner-related)
  success: '#10b981',           // Green (positive, security)
  error: '#ef4444',             // Red
  warning: '#f59e0b',           // Amber
  textPrimary: '#ffffff',       // Main text
  textSecondary: '#9ca3af',     // Muted text
  textTertiary: '#5a5a6a',      // Disabled text
};
```

### Buttons
- **Primary:** `LinearGradient` from `#a855f7` to `#7c3aed` (135deg), borderRadius 12, padding 14, white text, fontWeight 600
- **Ghost/Skip:** transparent bg, #a855f7 text, fontSize 14, fontWeight 500
- **Back/Forward:** 44x44, borderRadius 12, icon-only

### Typography
- **Title:** fontSize 24-28, fontWeight 700, color white
- **Body:** fontSize 14, color #b0b0b0
- **Label:** fontSize 12, color #9ca3af
- **Button:** fontSize 16, fontWeight 600, color white

### Spacing
- Screen padding: 24px horizontal
- Section gaps: 32px
- Element gaps: 12-16px

### Animations
- Use `Animated` or `react-native-reanimated` for step transitions
- Fade in/slide from right when advancing steps
- Fade out/slide to left when going back
- Duration: 300ms, easing: ease-in-out
- Step indicator dots: animate backgroundColor with 300ms transition

---

## Phase 5: API Integration Summary

### Existing endpoints to reuse:
| Endpoint | Used in Step | Purpose |
|----------|-------------|---------|
| `POST /users/register` | (register.tsx) | Create account |
| `POST /users/login` | (register.tsx) | Auto-login after register |
| `POST /users/oauth/google` | (register.tsx) | Google OAuth |
| `POST /users/oauth/apple` | (register.tsx) | Apple OAuth |
| `POST /api/households` | Step 1 | Create household |
| `POST /api/households/:id/invite` | Step 1 | Invite partner |
| Plaid Link SDK | Step 2 | Bank account linking |
| `POST /api/auth/onboarding/complete` | Step 3 | Mark onboarding done |

### No new endpoints needed for MVP.

---

## Phase 6: Testing Checklist

After implementation, verify:

- [ ] Fresh user: intro → register → 4-step onboarding → dashboard (full happy path)
- [ ] OAuth users (Google, Apple) also route to onboarding if `onboarding_complete === false`
- [ ] Existing user login: routes to dashboard if `onboarding_complete === true`
- [ ] Existing user login: routes to onboarding if `onboarding_complete === false`
- [ ] Step 1 skip works (no crash, no API call)
- [ ] Step 1 invite sends API call and shows feedback
- [ ] Step 2 Plaid Link launches correctly
- [ ] Step 2 skip works
- [ ] Step 3 "Let's Go!" marks onboarding complete and routes to dashboard
- [ ] Back button works on all steps (disabled on step 0)
- [ ] Step indicator dots update correctly
- [ ] Theme auto-detection works (dark mode by default, respects system setting)
- [ ] Removed screens (theme-select, partner-mode, setup) no longer accessible
- [ ] Deep links to removed routes redirect gracefully (to /intro or /dashboard)
- [ ] Haptic feedback fires on button presses

---

## File Change Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `app/intro.tsx` | Update design, auto-detect theme, route to /register |
| MODIFY | `app/register.tsx` | Route to /onboarding instead of /setup |
| MODIFY | `app/login.tsx` | Route to /onboarding instead of /setup |
| REWRITE | `app/onboarding/index.tsx` | New 4-step wizard (this is the main work) |
| MODIFY | `app/_layout.tsx` | Update public routes list |
| DELETE | `app/theme-select.tsx` | Replaced by auto-detection |
| DELETE | `app/partner-mode.tsx` | Replaced by onboarding Step 1 |
| DELETE | `app/setup.tsx` | Replaced by onboarding Steps 0-3 |

**Estimated effort:** 4-6 hours for an experienced developer. The onboarding/index.tsx rewrite is ~60% of the work.
