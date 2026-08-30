// app/login.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { api } from '@/utils/apiClient';
import { successHaptic, errorHaptic } from '@/utils/haptics';
import { findUserSession } from '@/utils/storage';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

const GOOGLE_CLIENT_IDS = {
  iosClientId: Constants.expoConfig?.extra?.GOOGLE_IOS_CLIENT_ID ?? '',
  androidClientId: Constants.expoConfig?.extra?.GOOGLE_ANDROID_CLIENT_ID ?? '',
  webClientId: Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID ?? '',
};

// ─── Error surface taxonomy (spec §4d) ───
type LoginErrorKind = 'credentials' | 'network' | 'oauth' | null;

type AuthError = {
  kind: LoginErrorKind;
  message: string;
  icon: 'alert-circle-outline' | 'cloud-offline-outline';
  fieldsHighlighted: boolean; // highlight email + password borders
  canRetry: boolean;
};

const AUTH_ERRORS: Record<Exclude<LoginErrorKind, null>, AuthError> = {
  credentials: {
    kind: 'credentials',
    message: 'Email or password is incorrect.',
    icon: 'alert-circle-outline',
    fieldsHighlighted: true,
    canRetry: false,
  },
  network: {
    kind: 'network',
    message: "Can't reach CoupleFlow. Check your connection and try again.",
    icon: 'cloud-offline-outline',
    fieldsHighlighted: false,
    canRetry: true,
  },
  oauth: {
    kind: 'oauth',
    message: "Google Sign-In didn't work. Try again or use email.",
    icon: 'alert-circle-outline',
    fieldsHighlighted: false,
    canRetry: false,
  },
};

// ─── Inline error banner (spec §5.4) ───
function LoginErrorBanner({ error, onRetry }: { error: AuthError; onRetry: () => void }) {
  return (
    <View
      style={styles.errorBanner}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name={error.icon} size={18} color={colors.error} />
      <Text style={styles.errorBannerText}>{error.message}</Text>
      {error.canRetry && (
        <TouchableOpacity
          onPress={onRetry}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.errorRetryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Shared auth field (spec §5.5) ───
type AuthFieldProps = {
  variant: 'email' | 'password';
  value: string;
  onChangeText: (t: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  hasError: boolean;
  disabled: boolean;
  showPassword?: boolean;
  onToggleShowPassword?: () => void;
};

function LoginAuthField({
  variant,
  value,
  onChangeText,
  focused,
  onFocus,
  onBlur,
  hasError,
  disabled,
  showPassword,
  onToggleShowPassword,
}: AuthFieldProps) {
  const isPassword = variant === 'password';
  const leadingIcon = isPassword ? 'lock-closed-outline' : 'mail-outline';

  const iconColor = hasError
    ? colors.error
    : focused
      ? colors.primary2
      : colors.textMuted;

  const borderColor = hasError
    ? colors.error
    : focused
      ? colors.primary2
      : colors.borderGlass;

  return (
    <View
      style={[
        styles.field,
        { borderColor, borderWidth: hasError || focused ? 1.5 : 1 },
        disabled && styles.fieldDisabled,
      ]}
    >
      <Ionicons name={leadingIcon} size={20} color={iconColor} />
      <TextInput
        placeholder={isPassword ? 'Password' : 'Email'}
        placeholderTextColor={colors.textDark}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={!disabled}
        style={styles.fieldInput}
        numberOfLines={1}
        accessibilityLabel={isPassword ? 'Password' : 'Email'}
        accessibilityHint={
          isPassword ? 'Enter your account password' : 'Enter your account email'
        }
        {...(isPassword
          ? {
              secureTextEntry: !showPassword,
              autoComplete: 'password' as const,
              textContentType: 'password' as const,
            }
          : {
              keyboardType: 'email-address' as const,
              autoCapitalize: 'none' as const,
              autoComplete: 'email' as const,
              textContentType: 'emailAddress' as const,
            })}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={onToggleShowPassword}
          disabled={disabled}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={showPassword ? colors.primary2 : colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── OAuth button (spec §5.9) ───
function LoginOAuthButton({
  provider,
  onPress,
  disabled,
}: {
  provider: 'google' | 'apple';
  onPress: () => void;
  disabled: boolean;
}) {
  const isGoogle = provider === 'google';
  return (
    <TouchableOpacity
      style={[styles.oauthBtn, disabled && styles.oauthBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={isGoogle ? 'Continue with Google' : 'Continue with Apple'}
    >
      <Ionicons
        name={isGoogle ? 'logo-google' : 'logo-apple'}
        size={20}
        color={colors.text}
      />
      <Text style={styles.oauthBtnText}>{isGoogle ? 'Google' : 'Apple'}</Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const API_URL = api.getBaseUrl();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<AuthError | null>(null);

  // Redirect if already logged in (preserved from route contract)
  useEffect(() => {
    const checkIfLoggedIn = async () => {
      const user = await findUserSession();
      if (user) {
        if (user.onboarding_complete) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/onboarding');
        }
      }
    };
    checkIfLoggedIn();
  }, []);

  // Google Sign-In
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    ...GOOGLE_CLIENT_IDS,
    selectAccount: true,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      handleGoogleToken(googleResponse.params.id_token);
    }
  }, [googleResponse]);

  // Banner auto-clears on next keystroke in any field (spec §4d)
  const clearError = () => {
    if (error) setError(null);
  };

  const completeOAuthLogin = async (data: any) => {
    const user = data.user;
    const session = { ...user, token: data.token };
    await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
    successHaptic();
    router.replace(user.onboarding_complete ? '/(tabs)/dashboard' : '/onboarding');
  };

  const handleLogin = async () => {
    if (submitting) return;
    if (email.trim().length === 0 || password.length === 0) return;
    setError(null);
    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        errorHaptic();
        setError(AUTH_ERRORS.credentials);
        return;
      }

      const data = await response.json();
      const user = data.user;
      const session = { ...user, token: data.token };
      await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
      successHaptic();
      router.replace(user.onboarding_complete ? '/(tabs)/dashboard' : '/onboarding');
    } catch (err) {
      console.error('Login error:', err);
      errorHaptic();
      setError(AUTH_ERRORS.network);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    if (submitting) return;
    setError(null);
    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/users/oauth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!response.ok) {
        errorHaptic();
        setError(AUTH_ERRORS.oauth);
        return;
      }
      await completeOAuthLogin(await response.json());
    } catch (err) {
      console.error('Google OAuth error:', err);
      errorHaptic();
      setError(AUTH_ERRORS.oauth);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (submitting) return;
    setError(null);
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        errorHaptic();
        setError({ ...AUTH_ERRORS.oauth, message: 'Apple Sign-In is not available on this device.' });
        return;
      }
      setSubmitting(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      const response = await fetch(`${API_URL}/users/oauth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          email: credential.email ?? '',
          full_name: fullName,
        }),
      });
      if (!response.ok) {
        errorHaptic();
        setError({ ...AUTH_ERRORS.oauth, message: "Apple Sign-In didn't work. Try again or use email." });
        return;
      }
      await completeOAuthLogin(await response.json());
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      console.error('Apple OAuth error:', err);
      errorHaptic();
      setError({ ...AUTH_ERRORS.oauth, message: "Apple Sign-In didn't work. Try again or use email." });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;
  const fieldsHaveError = error?.fieldsHighlighted ?? false;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Brand block */}
              <View style={styles.brandBlock}>
                <View style={styles.circlesRow}>
                  <View
                    style={[
                      styles.logoCircle,
                      { backgroundColor: colors.primary2, opacity: 0.9, left: 0 },
                    ]}
                  />
                  <View
                    style={[
                      styles.logoCircle,
                      { backgroundColor: colors.accent, opacity: 0.9, left: spacing.xl },
                    ]}
                  />
                </View>

                <View style={styles.brandingRow}>
                  <Text style={styles.wordmark}>Couple</Text>
                  <Ionicons name="heart" size={28} color={colors.accent} />
                  <Text style={styles.wordmark}>Flow</Text>
                </View>

                <Text style={styles.tagline}>FOR COUPLES & SHARED GOALS</Text>
              </View>

              {/* Welcome block */}
              <View style={styles.welcomeBlock}>
                <Text style={styles.welcomeTitle}>Welcome back</Text>
                <Text style={styles.welcomeSubtitle}>Log in to your financial journey.</Text>
              </View>

              {/* Auth card */}
              <View
                style={styles.authCard}
                pointerEvents={submitting ? 'none' : 'auto'}
              >
                {error && (
                  <LoginErrorBanner
                    error={error}
                    onRetry={handleLogin}
                  />
                )}

                <LoginAuthField
                  variant="email"
                  value={email}
                  onChangeText={(t) => {
                    clearError();
                    setEmail(t);
                  }}
                  focused={focusedField === 'email'}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  hasError={fieldsHaveError}
                  disabled={submitting}
                />

                <LoginAuthField
                  variant="password"
                  value={password}
                  onChangeText={(t) => {
                    clearError();
                    setPassword(t);
                  }}
                  focused={focusedField === 'password'}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  hasError={fieldsHaveError}
                  disabled={submitting}
                  showPassword={showPassword}
                  onToggleShowPassword={() => setShowPassword((s) => !s)}
                />

                <TouchableOpacity
                  style={styles.forgotRow}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="link"
                  accessibilityLabel="Forgot password"
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={!canSubmit}
                  activeOpacity={0.9}
                  style={[styles.loginBtnWrap, !canSubmit && !submitting && styles.loginBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={submitting ? 'Logging in' : 'Log In'}
                  accessibilityState={{ disabled: !canSubmit, busy: submitting }}
                >
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.loginBtn}
                  >
                    {submitting ? (
                      <View style={styles.loginBtnBusy}>
                        <ActivityIndicator size="small" color={colors.text} />
                        <Text style={styles.loginBtnText}>Logging in…</Text>
                      </View>
                    ) : (
                      <Text style={styles.loginBtnText}>Log In</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OAuth row */}
              <View style={styles.oauthRow}>
                {!googleRequest ? (
                  <Skeleton height={48} borderRadius={radius.md} style={{ flex: 1 }} />
                ) : (
                  <LoginOAuthButton
                    provider="google"
                    onPress={() => promptGoogleAsync()}
                    disabled={submitting}
                  />
                )}
                {Platform.OS === 'ios' && (
                  <LoginOAuthButton
                    provider="apple"
                    onPress={handleAppleSignIn}
                    disabled={submitting}
                  />
                )}
              </View>

              {/* Sign-up link */}
              <TouchableOpacity
                onPress={() => router.push('/register')}
                style={styles.signupLink}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="link"
                accessibilityLabel="Sign up for an account"
              >
                <Text style={styles.signupText}>
                  Don't have an account? <Text style={styles.signupTextAccent}>Sign up</Text>
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },

  // Brand
  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  circlesRow: {
    width: 48 + spacing.xl,
    height: 48,
    position: 'relative',
    marginBottom: spacing.lg,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    position: 'absolute',
    top: 0,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wordmark: {
    ...typography.h1,
    fontWeight: '700',
    color: colors.primary2,
  },
  tagline: {
    ...typography.caption,
    color: colors.primary2,
    letterSpacing: 0.5,
  },

  // Welcome
  welcomeBlock: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  welcomeTitle: {
    ...typography.h3,
    color: colors.text,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Auth card
  authCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },

  // Error banner
  errorBanner: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderColor: colors.error,
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  errorBannerText: {
    ...typography.small,
    color: colors.text,
    flex: 1,
  },
  errorRetryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  // Field
  field: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  fieldInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },

  // Forgot
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  // Login button
  loginBtnWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    minHeight: 48,
  },
  loginBtnBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loginBtnText: {
    ...typography.button,
    color: colors.text,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // OAuth
  oauthRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  oauthBtn: {
    ...glassEffects.glass,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
  },
  oauthBtnDisabled: {
    opacity: 0.6,
  },
  oauthBtnText: {
    ...typography.smallBold,
    color: colors.text,
  },

  // Sign up
  signupLink: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  signupText: {
    ...typography.small,
    color: colors.textMuted,
  },
  signupTextAccent: {
    ...typography.smallBold,
    color: colors.accent,
  },
});
