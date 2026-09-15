import React, { useEffect, useState } from 'react';
import { IntroSplash } from '@/components/intro-Splash';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { colors, spacing, typography, radius } from '@/utils/design-system';
import { api } from '@/utils/apiClient';
import { successHaptic, errorHaptic } from '@/utils/haptics';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { IntroBrandMark } from '@/components/intro-BrandMark';
import { IntroPrimaryButton } from '@/components/intro-PrimaryButton';
import { IntroSocialButton, type SocialProvider } from '@/components/intro-SocialButton';
import { IntroErrorBanner } from '@/components/intro-ErrorBanner';

const GOOGLE_CLIENT_IDS = {
  iosClientId: Constants.expoConfig?.extra?.GOOGLE_IOS_CLIENT_ID ?? '',
  androidClientId: Constants.expoConfig?.extra?.GOOGLE_ANDROID_CLIENT_ID ?? '',
  webClientId: Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID ?? '',
};

/** Which auth action, if any, is currently in flight. */
type ActiveAuth = null | 'google' | 'apple';

type ErrorInfo = { title: string; message: string } | null;

export default function IntroScreen() {
  const router = useRouter();
  const API_URL = api.getBaseUrl();

  const [active, setActive] = useState<ActiveAuth>(null);
  const [error, setError] = useState<ErrorInfo>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const inFlight = active !== null;

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    ...GOOGLE_CLIENT_IDS,
    selectAccount: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const available =
          Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
        if (mounted) setAppleAvailable(!!available);
      } catch {
        if (mounted) setAppleAvailable(false);
      } finally {
        if (mounted) setCheckingConfig(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params.id_token;
      handleGoogleToken(idToken);
    } else if (googleResponse?.type === 'error') {
      setActive(null);
      errorHaptic();
      setError({ title: "Couldn't sign in", message: 'Check your connection and try again.' });
    } else if (googleResponse?.type === 'dismiss' || googleResponse?.type === 'cancel') {
      setActive(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const handleGetStarted = async () => {
    if (inFlight) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/register');
  };

  const goToLogin = () => {
    if (inFlight) return;
    router.push('/login');
  };

  const completeOAuthLogin = async (data: any) => {
    const user = data.user;
    const session = { ...user, token: data.token };
    await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
    successHaptic();
    router.replace(user?.onboarding_complete ? '/(tabs)/dashboard' : '/onboarding');
  };

  const handleGoogleToken = async (idToken: string) => {
    try {
      const response = await fetch(`${API_URL}/users/oauth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!response.ok) {
        errorHaptic();
        setError({ title: "Couldn't sign in", message: 'Check your connection and try again.' });
        return;
      }
      const data = await response.json();
      await completeOAuthLogin(data);
    } catch (err) {
      console.error('Google OAuth error:', err);
      errorHaptic();
      setError({ title: "Couldn't sign in", message: 'Check your connection and try again.' });
    } finally {
      setActive(null);
    }
  };

  const startGoogle = () => {
    if (inFlight || !googleRequest) return;
    setError(null);
    setActive('google');
    promptGoogleAsync();
  };

  const startApple = async () => {
    if (inFlight) return;
    setError(null);
    try {
      setActive('apple');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const appleFullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');

      const response = await fetch(`${API_URL}/users/oauth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          email: credential.email ?? '',
          full_name: appleFullName,
        }),
      });
      if (!response.ok) {
        errorHaptic();
        setError({ title: "Couldn't sign in", message: 'Check your connection and try again.' });
        return;
      }
      const data = await response.json();
      await completeOAuthLogin(data);
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple OAuth error:', err);
      errorHaptic();
      setError({ title: "Couldn't sign in", message: 'Check your connection and try again.' });
    } finally {
      setActive(null);
    }
  };

  const onSocialPress = (provider: SocialProvider) => {
    if (provider === 'google') startGoogle();
    else startApple();
  };

  const socialProviders: SocialProvider[] = [
    ...(appleAvailable ? (['apple'] as const) : []),
    'google',
  ];
  const hasSocial = socialProviders.length > 0;

  return (
    <IntroSplash>
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.topGroup}>
            <IntroBrandMark />
            <Text style={styles.headline} numberOfLines={2}>
              Build your financial future, together
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Take control of your money as a couple
            </Text>
          </View>

          <View style={styles.actions}>
            {checkingConfig ? (
              <View style={styles.skeletonStack}>
                <Skeleton height={52} borderRadius={radius.lg} />
                <Skeleton height={52} borderRadius={radius.lg} />
                <Skeleton height={52} borderRadius={radius.lg} />
                <View style={styles.skeletonLink}>
                  <Skeleton height={16} width={180} borderRadius={radius.sm} />
                </View>
              </View>
            ) : (
              <>
                <IntroErrorBanner
                  title={error?.title}
                  message={error?.message}
                  onDismiss={() => setError(null)}
                />

                <IntroPrimaryButton
                  label="Get Started"
                  onPress={handleGetStarted}
                  disabled={inFlight}
                />

                {hasSocial && (
                  <>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerLabel}>or</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {socialProviders.map((provider) => (
                      <IntroSocialButton
                        key={provider}
                        provider={provider}
                        onPress={() => onSocialPress(provider)}
                        loading={active === provider}
                        disabled={
                          inFlight
                            ? active !== provider
                            : provider === 'google' && !googleRequest
                        }
                      />
                    ))}
                  </>
                )}

                <TouchableOpacity
                  onPress={goToLogin}
                  disabled={inFlight}
                  style={[styles.signInLink, inFlight && styles.dimmed]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to an existing account"
                  accessibilityState={{ disabled: inFlight }}
                >
                  <Text style={styles.signInText}>
                    Already have an account? <Text style={styles.signInAction}>Sign In</Text>
                  </Text>
                </TouchableOpacity>

                <Text style={styles.legal}>
                  By continuing you agree to our{' '}
                  <Text style={styles.legalLink}>Terms</Text> &{' '}
                  <Text style={styles.legalLink}>Privacy</Text>.
                </Text>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
    </IntroSplash>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  topGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xl,
  },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  actions: {
    gap: spacing.md,
  },
  skeletonStack: {
    gap: spacing.md,
  },
  skeletonLink: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderGlass,
  },
  dividerLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  signInLink: {
    alignItems: 'center',
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  dimmed: {
    opacity: 0.5,
  },
  signInText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  signInAction: {
    ...typography.smallBold,
    color: colors.primary2,
  },
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  legalLink: {
    color: colors.primary2,
  },
});
