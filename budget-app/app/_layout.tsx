// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { clearUserSession, findUserSession } from '../utils/storage';

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
   
    const checkSession = async () => {
      //const clear = await clearUserSession();
      const user = await findUserSession();
      console.log('User session:', user); 
      if (!user && pathname !== '/login') {
        router.replace('/login');
      } 
      setLoading(false);
    };

    checkSession();
  }, [pathname]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}

