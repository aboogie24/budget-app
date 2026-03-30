import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from './apiClient';
import type { Router } from 'expo-router';

const PUSH_TOKEN_KEY = 'expoPushToken';

// Check if we're running in Expo Go (push notifications removed in SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

// Configure how notifications appear when the app is in the foreground.
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Registers the device for push notifications and sends the token to the backend.
 * Should be called after the user is authenticated.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    console.log('Push notifications are not supported in Expo Go — use a development build');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check / request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#c084fc',
      });
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? '15c3004a-989d-45ed-ae17-903dae308ca9',
    });
    const token = tokenData.data;

    // Only register with backend if the token has changed
    const previousToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token !== previousToken) {
      const userId = await api.getUserId();
      if (userId) {
        await api.post('/auth/push-token', {
          user_id: userId,
          token,
          platform: 'expo',
        });
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
        console.log('Push token registered:', token);
      }
    }

    return token;
  } catch (err) {
    console.error('Failed to register push notifications:', err);
    return null;
  }
}

/**
 * Sets up notification response handlers for tap-to-navigate.
 * Call this once in the root layout.
 */
export function setupNotificationHandlers(router: Router) {
  if (isExpoGo) {
    return () => {};
  }

  // When user taps a notification
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string> | undefined;
    if (data?.screen) {
      router.push(data.screen as any);
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Removes the stored push token and unregisters from the backend.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (token) {
    try {
      await api.delete('/auth/push-token', { token } as any);
    } catch {
      // ignore — best effort
    }
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
