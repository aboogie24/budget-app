import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import { LinearGradient } from 'expo-linear-gradient';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { api } from '@/utils/apiClient';
import { successHaptic, errorHaptic } from '@/utils/haptics';
import GradientBackground from '@/components/GradientBackground';
import { BackButton } from '@/components/BackButton';
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

// Brand pink — the one sanctioned literal not present in design-system.ts.
// Both auth screens use it for the heart + "Flow" lockup. Kept as a single
// named constant here rather than sprinkled hex (see spec §9).
const BRAND_PINK = '#ec4899';

// Map the 1–4 strength level to a semantic design-system color and an
// icon so meaning never depends on color alone (spec §5.5).
type StrengthLevel = 1 | 2 | 3 | 4;
const STRENGTH_META: Record<
  StrengthLevel,
  { color: string; icon: 'checkmark-circle' | 'alert-circle'; hint: string }
> = {
  1: { color: colors.error, icon: 'alert-circle', hint: 'Use at least 8 characters' },
  2: { color: colors.warning, icon: 'alert-circle', hint: 'Add a number or symbol' },
  3: { color: colors.info, icon: 'checkmark-circle', hint: 'Add a symbol to make it strong' },
  4: { color: colors.success, icon: 'checkmark-circle', hint: 'password' },
};

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1 as StrengthLevel, label: 'Weak', color: colors.error };
  if (score === 2) return { level: 2 as StrengthLevel, label: 'Fair', color: colors.warning };
  if (score === 3) return { level: 3 as StrengthLevel, label: 'Good', color: colors.info };
  return { level: 4 as StrengthLevel, label: 'Strong', color: colors.success };
}

// ─── Field errors surfaced inline (spec §3d) ───
type FieldErrors = {
  fullName?: string | null;
  email?: string | null;
  password?: string | null;
  confirmPassword?: string | null;
};

type BannerError = { title: string; message: string } | null;

// ─── RegisterField (spec §5.3) ───
type RegisterFieldProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  secure?: boolean;
  reveal?: boolean;
  onToggleReveal?: () => void;
  error?: string | null;
  disabled?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'style'>;

const RegisterField = React.forwardRef<TextInput, RegisterFieldProps>(function RegisterField(
  {
    icon,
    value,
    onChangeText,
    placeholder,
    accessibilityLabel,
    secure,
    reveal,
    onToggleReveal,
    error,
    disabled,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.fieldBlock, disabled && styles.disabled]}>
      <View
        style={[
          styles.fieldRow,
          focused && styles.fieldRowFocused,
          !!error && styles.fieldRowError,
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDark}
          style={styles.inputBare}
          editable={!disabled}
          accessibilityLabel={accessibilityLabel}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure ? !reveal : false}
          {...inputProps}
        />
        {secure && onToggleReveal && (
          <TouchableOpacity
            onPress={onToggleReveal}
            hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={reveal ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={reveal ? colors.primary2 : colors.textMuted}
            />
          </TouchableOpacity>
        )}
        {!!error && !secure && (
          <Ionicons name="alert-circle" size={18} color={colors.error} />
        )}
      </View>
      {!!error && (
        <View style={styles.fieldErrorRow}>
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <Text style={styles.fieldErrorText}>{error}</Text>
        </View>
      )}
    </View>
  );
});

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<BannerError>(null);
  const router = useRouter();
  const API_URL = api.getBaseUrl();

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword;

  // Refs for onSubmitEditing chaining (spec §8).
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Google Sign-In hook
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    ...GOOGLE_CLIENT_IDS,
    selectAccount: true,
  });

  // Handle Google response when it arrives
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params.id_token;
      handleGoogleToken(idToken);
    }
  }, [googleResponse]);

  // Validate + surface inline (spec §3d). Native Alert kept as fallback.
  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!fullName) next.fullName = 'Required';
    if (!email) next.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email';
    if (!password) next.password = 'Required';
    else if (password.length < 8) next.password = 'Use at least 8 characters';
    if (!confirmPassword) next.confirmPassword = 'Required';
    else if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (submitting) return;
    setBanner(null);
    if (!fullName || !email || !password || !confirmPassword) {
      validate();
      Alert.alert('Missing fields', 'Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      validate();
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      validate();
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (!validate()) return;

    const id = uuidv4();

    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, full_name: fullName, email, password }),
      });

      const errorText = !response.ok ? await response.text() : null;
      if (!response.ok) {
        errorHaptic();
        setBanner({ title: 'Registration failed', message: errorText || 'Please try again.' });
        Alert.alert('Registration failed', errorText || 'Please try again.');
        setSubmitting(false);
        return;
      }

      const data = await response.json();
      const user = data?.user ?? { email, id, isFirstLogin: true };

      // Auto-login
      const loginRes = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) {
        Alert.alert('Login needed', 'Registered successfully. Please log in.');
        router.replace('/login');
        setSubmitting(false);
        return;
      }
      const loginData = await loginRes.json();
      const session = { ...(loginData.user || user), token: loginData.token };
      await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));

      successHaptic();
      router.replace('/onboarding');
    } catch (err) {
      console.error('Register error:', err);
      errorHaptic();
      setBanner({ title: 'Error', message: 'Could not register user.' });
      Alert.alert('Error', 'Could not register user.');
    } finally {
      setSubmitting(false);
    }
  };

  // Shared helper: save session and navigate after OAuth success
  const completeOAuthLogin = async (data: any) => {
    const user = data.user;
    const session = { ...user, token: data.token };
    await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
    successHaptic();
    router.replace(user.onboarding_complete ? '/(tabs)/dashboard' : '/onboarding');
  };

  // Google: send ID token to our backend
  const handleGoogleToken = async (idToken: string) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/users/oauth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        errorHaptic();
        Alert.alert('Google Sign-In failed', errorText || 'Please try again.');
        return;
      }
      const data = await response.json();
      await completeOAuthLogin(data);
    } catch (err) {
      console.error('Google OAuth error:', err);
      errorHaptic();
      Alert.alert('Error', 'Could not sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  // Apple Sign-In handler
  const handleAppleSignIn = async () => {
    if (submitting) return;
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        Alert.alert('Not Available', 'Apple Sign-In is not available on this device.');
        return;
      }
      setSubmitting(true);
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
        const errorText = await response.text().catch(() => '');
        errorHaptic();
        Alert.alert('Apple Sign-In failed', errorText || 'Please try again.');
        return;
      }
      const data = await response.json();
      await completeOAuthLogin(data);
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return; // user cancelled
      console.error('Apple OAuth error:', err);
      errorHaptic();
      Alert.alert('Error', 'Could not sign in with Apple.');
    } finally {
      setSubmitting(false);
    }
  };

  const strengthMeta = STRENGTH_META[strength.level];

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header row: BackButton · brand lockup · spacer (spec §5.1) */}
          <View style={styles.header}>
            <BackButton fallback="/login" />
            <View
              style={styles.brandLockup}
              accessibilityRole="header"
              accessibilityLabel="CoupleFlow"
            >
              <Text style={styles.brandCouple}>Couple</Text>
              <Ionicons name="heart" size={16} color={BRAND_PINK} />
              <Text style={styles.brandFlow}>Flow</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.contentColumn}>
                {/* Hero block (spec §5.2) */}
                <View
                  style={styles.avatarChip}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                >
                  <Ionicons name="person-outline" size={32} color={colors.primary2} />
                </View>
                <Text style={styles.title} accessibilityRole="header">
                  Create account
                </Text>
                <Text style={styles.subtitle}>Start your money journey, together.</Text>

                {/* Form card (spec §5.4) */}
                <View style={styles.formCard}>
                  {/* Inline error banner (spec §3d / §5.4) */}
                  {banner && (
                    <View style={styles.banner}>
                      <Ionicons name="alert-circle" size={18} color={colors.error} />
                      <View style={styles.bannerTextCol}>
                        <Text style={styles.bannerTitle}>{banner.title}</Text>
                        <Text style={styles.bannerMessage}>{banner.message}</Text>
                      </View>
                    </View>
                  )}

                  <RegisterField
                    icon="person-outline"
                    value={fullName}
                    onChangeText={(t) => {
                      setFullName(t);
                      if (fieldErrors.fullName) setFieldErrors((e) => ({ ...e, fullName: null }));
                    }}
                    placeholder="Full name"
                    accessibilityLabel="Full name"
                    error={fieldErrors.fullName}
                    disabled={submitting}
                    autoCapitalize="words"
                    textContentType="name"
                    autoComplete="name"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    blurOnSubmit={false}
                  />

                  <RegisterField
                    ref={emailRef}
                    icon="mail-outline"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: null }));
                    }}
                    placeholder="Email"
                    accessibilityLabel="Email"
                    error={fieldErrors.email}
                    disabled={submitting}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    blurOnSubmit={false}
                  />

                  <RegisterField
                    ref={passwordRef}
                    icon="lock-closed-outline"
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: null }));
                    }}
                    placeholder="Password"
                    accessibilityLabel="Password"
                    error={fieldErrors.password}
                    disabled={submitting}
                    secure
                    reveal={showPassword}
                    onToggleReveal={() => setShowPassword((v) => !v)}
                    autoComplete="password-new"
                    textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    blurOnSubmit={false}
                  />

                  {/* Password strength meter (spec §5.5), color-independent */}
                  {password.length > 0 && (
                    <View style={styles.meterBlock}>
                      <View style={styles.meterBars}>
                        {[1, 2, 3, 4].map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.meterBar,
                              {
                                backgroundColor:
                                  i <= strength.level ? strength.color : colors.glassStrong,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.meterLabelRow}>
                        <Ionicons
                          name={strengthMeta.icon}
                          size={13}
                          color={strength.color}
                        />
                        <Text style={[styles.meterLabel, { color: strength.color }]}>
                          {strength.level === 4
                            ? 'Strong password'
                            : `${strength.label} — ${strengthMeta.hint}`}
                        </Text>
                      </View>
                    </View>
                  )}

                  <RegisterField
                    ref={confirmRef}
                    icon="lock-closed-outline"
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      if (fieldErrors.confirmPassword)
                        setFieldErrors((e) => ({ ...e, confirmPassword: null }));
                    }}
                    placeholder="Confirm password"
                    accessibilityLabel="Confirm password"
                    error={fieldErrors.confirmPassword}
                    disabled={submitting}
                    secure
                    reveal={showConfirm}
                    onToggleReveal={() => setShowConfirm((v) => !v)}
                    autoComplete="password-new"
                    textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                    returnKeyType="go"
                    onSubmitEditing={handleRegister}
                  />

                  {/* Password match row (spec §5.6), color-independent */}
                  {confirmPassword.length > 0 && (
                    <View style={styles.matchRow}>
                      <Ionicons
                        name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={passwordsMatch ? colors.success : colors.error}
                      />
                      <Text
                        style={[
                          styles.matchText,
                          { color: passwordsMatch ? colors.success : colors.error },
                        ]}
                      >
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Primary CTA (spec §5.7) — not hard-disabled unless submitting */}
                <TouchableOpacity
                  onPress={handleRegister}
                  style={[styles.cta, submitting && styles.ctaSubmitting]}
                  disabled={submitting}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                  accessibilityState={{ disabled: submitting, busy: submitting }}
                >
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaInner}
                  >
                    {submitting ? (
                      <>
                        <ActivityIndicator color={colors.text} />
                        <Text style={styles.ctaText}>Creating your account…</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.ctaText}>Create account</Text>
                        <Ionicons name="arrow-forward" size={18} color={colors.text} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or sign up with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* OAuth row (spec §5.8) */}
                <View style={styles.oauthRow}>
                  <TouchableOpacity
                    style={[styles.oauthBtn, submitting && styles.disabled]}
                    onPress={() => promptGoogleAsync()}
                    disabled={!googleRequest || submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Sign up with Google"
                  >
                    <Ionicons name="logo-google" size={18} color={colors.text} />
                    {googleRequest ? (
                      <Text style={styles.oauthText}>Google</Text>
                    ) : (
                      <Skeleton width={60} height={14} />
                    )}
                  </TouchableOpacity>
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={[styles.oauthBtn, submitting && styles.disabled]}
                      onPress={handleAppleSignIn}
                      disabled={submitting}
                      accessibilityRole="button"
                      accessibilityLabel="Sign up with Apple"
                    >
                      <Ionicons name="logo-apple" size={18} color={colors.text} />
                      <Text style={styles.oauthText}>Apple</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Footer login link (spec §5.9) */}
                <TouchableOpacity
                  onPress={() => router.replace('/login')}
                  style={styles.footerLink}
                  accessibilityRole="link"
                  accessibilityLabel="Already have an account? Log in"
                >
                  <Text style={styles.footerText}>
                    Already have an account? <Text style={styles.footerAccent}>Log in</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },

  // Header (spec §5.1 — matches commonStyles.header)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandCouple: { ...typography.bodyBold, color: colors.primary2 },
  brandFlow: { ...typography.bodyBold, color: BRAND_PINK },
  headerSpacer: { width: 40 },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentColumn: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  // Hero (spec §5.2)
  avatarChip: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Form card (spec §5.4)
  formCard: {
    ...glassEffects.glass,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  // Inline error banner (spec §3d)
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.error,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerTextCol: { flex: 1 },
  bannerTitle: { ...typography.smallBold, color: colors.text },
  bannerMessage: { ...typography.caption, color: colors.textMuted },

  // Field (spec §5.3)
  fieldBlock: { marginBottom: spacing.md },
  fieldRow: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldRowFocused: {
    borderColor: 'rgba(168,85,247,0.4)',
  },
  fieldRowError: {
    borderColor: colors.error,
  },
  inputBare: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  fieldErrorText: { ...typography.caption, color: colors.error },
  disabled: { opacity: 0.5 },

  // Strength meter (spec §5.5)
  meterBlock: { marginBottom: spacing.md, marginTop: -spacing.xs },
  meterBars: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  meterBar: { flex: 1, height: 4, borderRadius: radius.full },
  meterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meterLabel: { ...typography.caption },

  // Match row (spec §5.6)
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  matchText: { ...typography.caption },

  // Primary CTA (spec §5.7)
  cta: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  ctaSubmitting: { opacity: 0.6 },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  ctaText: { ...typography.button, color: colors.text },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  dividerText: { ...typography.caption, color: colors.textMuted },

  // OAuth (spec §5.8)
  oauthRow: { flexDirection: 'row', gap: spacing.md },
  oauthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  oauthText: { ...typography.smallBold, color: colors.text },

  // Footer (spec §5.9)
  footerLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  footerText: { ...typography.small, color: colors.textMuted },
  footerAccent: { ...typography.smallBold, color: colors.accent },
});
