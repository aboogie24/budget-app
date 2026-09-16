// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { findUserSession, clearUserSession } from '../utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { registerForPushNotifications, setupNotificationHandlers } from '../utils/notifications';
import { ThemeProvider } from '../utils/ThemeContext';
import { onAuthFailure, ensureFreshToken, api } from '../utils/apiClient';
import { persistOnboardingComplete } from '../utils/onboarding';
import ErrorBoundary from '../components/ErrorBoundary';

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const notificationsSetup = useRef(false);

  // When the API layer detects that the session is fully expired and
  // cannot be refreshed, clear local storage and send the user to login.
  useEffect(() => {
    const unsubscribe = onAuthFailure(async () => {
      await clearUserSession();
      router.replace('/login');
    });
    return unsubscribe;
  }, [router]);

  // Auth check + token refresh — runs once on mount and when app comes to foreground
  const checkAuth = async () => {
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

    // Authenticated user on a public route or root → send to dashboard
    const isRootOrPublic = pathname === '/' || isPublic;
    if (session && isRootOrPublic) {
      if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/household-setup')) {
        // Let them finish onboarding/setup — don't redirect
      } else {
        // C026: prefer server onboarding_complete so cold start never re-enters wizard
        let complete = !!session.onboarding_complete;
        if (!complete && session.id) {
          try {
            const me = await api.get<any>('/auth/users/me', { user_id: session.id });
            if (me?.onboarding_complete === true) {
              complete = true;
              await persistOnboardingComplete(true);
            }
          } catch {
            // keep local flag
          }
        }
        if (!complete) {
          router.replace('/onboarding');
          setLoading(false);
          return;
        }
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

  // Run once on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Re-run when app comes to foreground (handles session expiry)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAuth();
      }
    });
    return () => sub.remove();
  }, []);

  // Set up notification tap handlers
  useEffect(() => {
    const cleanup = setupNotificationHandlers(router);
    return cleanup;
  }, [router]);

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ErrorBoundary>
          <Slot />
        </ErrorBoundary>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
