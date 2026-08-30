# Fix: Logged-in Users Redirected Through Welcome Screens

## The Bug

When a logged-in user opens the app, they briefly see the welcome/intro screens before landing on the dashboard. They should go straight to the home tab.

## Root Cause

There are **two problems** in the navigation flow that combine to cause this:

### Problem 1: `_layout.tsx` only handles the "no session" case

The root layout (`app/_layout.tsx`, line 50) checks:

```typescript
if (!session && !isPublic) {
  router.replace('/intro');
}
```

But it **never redirects authenticated users away from public routes**. So when a logged-in user opens the app, they land on `/` (which renders `index.tsx` = LoginScreen). The layout sees they have a session and does nothing — it lets the login screen render.

### Problem 2: `index.tsx` IS the LoginScreen with a delayed redirect

`app/index.tsx` renders `<BudgetAppLogin />` immediately, then runs a `useEffect` to check the session and redirect. This means:

1. App opens → layout loads → loading spinner
2. Layout finishes → renders `<Slot />` → `index.tsx` = **LoginScreen flashes**
3. LoginScreen's `useEffect` fires → finds session → `router.replace('/(tabs)/dashboard')`
4. Dashboard loads

The user sees: **Spinner → Login flash → Dashboard** (or potentially **Spinner → Intro → Login → Dashboard** if there's any AsyncStorage timing issue).

### Problem 3: `useAuthGuard` hook exists but isn't used

`hooks/useAuthGuard.ts` already has the correct logic — it redirects logged-in users away from public paths to the dashboard. But it's not imported or used anywhere in the layout or screen files.

## The Fix

### Step 1: Update `app/_layout.tsx` — Add authenticated user redirect

In the `checkIntro` function, after the existing `!session && !isPublic` check, add the reverse case:

```typescript
const checkIntro = async () => {
  const session = await findUserSession();

  const isPublic =
    pathname?.startsWith('/intro') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/household-setup');

  // Unauthenticated user on a protected route → send to intro
  if (!session && !isPublic) {
    router.replace('/intro');
    setLoading(false);
    return;
  }

  // ADD THIS: Authenticated user on a public route or root → send to dashboard
  // (but allow onboarding if they haven't finished it)
  const isRootOrPublic = pathname === '/' || isPublic;
  if (session && isRootOrPublic) {
    if (pathname?.startsWith('/onboarding')) {
      // Let them finish onboarding — don't redirect
    } else if (pathname?.startsWith('/household-setup')) {
      // Let them finish household setup — don't redirect
    } else if (!session.onboarding_complete) {
      router.replace('/onboarding');
      setLoading(false);
      return;
    } else {
      router.replace('/(tabs)/dashboard');
      setLoading(false);
      return;
    }
  }

  // Register for push notifications once logged in
  if (session && !notificationsSetup.current) {
    notificationsSetup.current = true;
    registerForPushNotifications();
  }

  if (session) {
    ensureFreshToken();
  }

  setLoading(false);
};
```

**Key behaviors:**
- Logged-in user opens app → immediately goes to dashboard (no login/intro flash)
- Logged-in user who hasn't finished onboarding → goes to onboarding (not dashboard)
- Logged-in user already in onboarding → stays there (no redirect loop)
- Not logged in → goes to intro (existing behavior, unchanged)

### Step 2: Simplify `app/index.tsx` — Remove redundant session check

Since `_layout.tsx` now handles the redirect, `index.tsx` no longer needs its own session check. Simplify it:

```typescript
import BudgetAppLogin from '../components/BudgetAppLogin';
import React from 'react';

export default function LoginScreen() {
  // Auth redirect is handled by _layout.tsx
  // This screen only renders for unauthenticated users
  return <BudgetAppLogin />;
}
```

The `useEffect` with `findUserSession()` + `router.replace` is now redundant and can cause race conditions with the layout-level redirect. Remove it.

### Step 3: Clean up `hooks/useAuthGuard.ts`

Two options:

**Option A (Recommended):** Delete the file entirely. The root layout now handles all auth routing centrally. Having auth logic in two places is a bug waiting to happen.

**Option B:** Keep it but remove the console.logs (lines 15-17) and make sure no screen imports it. It's dead code either way after the `_layout.tsx` fix.

If any screens currently import `useAuthGuard`, update them to remove the import since the layout handles it.

### Step 4: Prevent the `useEffect` from re-running unnecessarily

The current `_layout.tsx` has:

```typescript
useEffect(() => { checkIntro(); }, [pathname, router]);
```

This re-runs on **every pathname change**, which means:
- User navigates to `/settings` → `checkIntro` runs again
- User navigates to `/budget` → `checkIntro` runs again

This is wasteful and can cause flickers. Change the dependency to only run on mount and when auth state actually changes:

```typescript
// Run once on mount
useEffect(() => {
  checkIntro();
}, []);

// Re-run only when the app comes to foreground (handles session expiry)
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      checkIntro();
      ensureFreshToken();
    }
  });
  return () => sub.remove();
}, []);
```

This replaces both the existing `checkIntro` effect AND the existing `AppState` effect (which currently only calls `ensureFreshToken`). Consolidate them.

### Step 5: Add `intro` to the public route check for `/intro`

Currently the `intro.tsx` screen does NOT check if the user is already logged in. If a logged-in user somehow navigates to `/intro` directly, they'd see the welcome screen with no redirect. The `_layout.tsx` fix (Step 1) handles this at the layout level, so no change needed in `intro.tsx` itself.

## Files to Modify

| File | Action |
|------|--------|
| `app/_layout.tsx` | Add authenticated-user redirect, consolidate effects |
| `app/index.tsx` | Remove redundant session check useEffect |
| `hooks/useAuthGuard.ts` | Delete or clean up (remove console.logs at minimum) |

## Testing

1. **Logged-in user, onboarding complete:** Open app → should go straight to dashboard, no flash of login/intro
2. **Logged-in user, onboarding NOT complete:** Open app → should go to onboarding wizard
3. **Logged-in user in onboarding:** Should stay on onboarding, no redirect loop
4. **Not logged in:** Open app → should see intro screen
5. **Session expires while app is backgrounded:** Bring app to foreground → should redirect to login
6. **Deep link to a protected route while not logged in:** Should redirect to intro
7. **Navigate between tabs:** Should NOT trigger any auth re-checks or flickers
