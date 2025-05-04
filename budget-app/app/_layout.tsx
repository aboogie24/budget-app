// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { clearUserSession, findUserSession } from '../utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
   
    const checkSession = async () => {
      //const clear = await clearUserSession();
      const user = await findUserSession();
      console.log('User session:', user); 
      if (user && pathname === '/login') {
        router.replace('/dashboard');
      } 
      setLoading(false);
    };

    checkSession();
  }, [pathname]);

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

