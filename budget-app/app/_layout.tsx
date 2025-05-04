// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { clearUserSession, findUserSession } from '../utils/storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthGuard } from '@/hooks/useAuthGuard';


export default function AppLayout() {
  const loading = useAuthGuard();

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

