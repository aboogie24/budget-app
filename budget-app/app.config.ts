import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'budget-app',
  slug: 'coupleflow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'budgetapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.github.aboogie.budgetapp',
    usesAppleSignIn: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    package: 'com.github.aboogie.budgetapp',
  },
  web: {
    bundler: 'metro',
    output: 'static' as const,
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#0f172a',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '15.1' },
        android: { compileSdkVersion: 34, minSdkVersion: 24 },
      },
    ],
    'expo-font',
    'expo-apple-authentication',
    'expo-web-browser',
    '@react-native-community/datetimepicker',
  ],
  experiments: {
    typedRoutes: true,
  },
  owner: 'alfred2424s-organization',
  runtimeVersion: '1.0.0',
  updates: {
    url: 'https://u.expo.dev/15c3004a-989d-45ed-ae17-903dae308ca9',
  },
  extra: {
    API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080',
    GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    router: {},
    eas: {
      projectId: '15c3004a-989d-45ed-ae17-903dae308ca9',
    },
  },
});
