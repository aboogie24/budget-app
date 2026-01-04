// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { findUserSession } from '../utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    };
    checkIntro();
  }, [pathname, router]);

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
      <Slot />
    </GestureHandlerRootView>
  );
}
