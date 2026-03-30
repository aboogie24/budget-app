// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { findUserSession, clearUserSession } from '../utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { registerForPushNotifications, setupNotificationHandlers } from '../utils/notifications';
import { ThemeProvider } from '../utils/ThemeContext';
import { onAuthFailure, ensureFreshToken } from '../utils/apiClient';

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

  // Proactively refresh the token when the app comes back to the
  // foreground so users don't hit a 401 mid-session.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        ensureFreshToken();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const checkIntro = async () => {
      const session = await findUserSession();
      // Avoid redirect loop if already on public screens
      const isPublic =
        pathname?.startsWith('/intro') ||
        pathname?.startsWith('/welcome') ||
        pathname?.startsWith('/login') ||
        pathname?.startsWith('/register') ||
        pathname?.startsWith('/onboarding') ||
        pathname?.startsWith('/theme-select') ||
        pathname?.startsWith('/partner-mode') ||
        pathname?.startsWith('/household-setup') ||
        pathname?.startsWith('/goals');

      if (!session && !isPublic) {
        router.replace('/intro');
      }

      // Register for push notifications once the user is logged in
      if (session && !notificationsSetup.current) {
        notificationsSetup.current = true;
        registerForPushNotifications();
      }

      // Silently refresh the token if it's close to expiring
      if (session) {
        ensureFreshToken();
      }

      setLoading(false);
    };
    checkIntro();
  }, [pathname, router]);

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
        <Slot />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
