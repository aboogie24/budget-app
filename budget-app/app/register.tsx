import React, { useState, useMemo, useEffect } from 'react';
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
} from 'react-native';
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

const GOOGLE_CLIENT_IDS = {
  iosClientId: Constants.expoConfig?.extra?.GOOGLE_IOS_CLIENT_ID ?? '',
  androidClientId: Constants.expoConfig?.extra?.GOOGLE_ANDROID_CLIENT_ID ?? '',
  webClientId: Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID ?? '',
};

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: '#f87171' };
  if (score === 2) return { level: 2, label: 'Fair', color: '#fbbf24' };
  if (score === 3) return { level: 3, label: 'Good', color: '#60a5fa' };
  return { level: 4, label: 'Strong', color: '#34d399' };
}

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const API_URL = api.getBaseUrl();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

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

  const handleRegister = async () => {
    if (submitting) return;
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

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

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1225', '#0f0a1e']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.formWrapper}>
            {/* CoupleFlow logo */}
            <View style={styles.topRow}>
              <Text style={{ color: '#a855f7', fontSize: 18, fontWeight: '700' }}>Couple</Text>
              <Ionicons name="heart" size={16} color="#ec4899" />
              <Text style={{ color: '#ec4899', fontSize: 18, fontWeight: '700' }}>Flow</Text>
            </View>

            <View style={styles.container}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Start your financial journey together.</Text>

              <View style={styles.avatarCircle}>
                <Ionicons name="person-outline" size={32} color="#a855f7" />
              </View>

              {/* Full Name */}
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color="#94a3b8" />
                <TextInput
                  placeholder="Full name"
                  placeholderTextColor="#64748b"
                  value={fullName}
                  onChangeText={setFullName}
                  style={styles.inputBare}
                  autoCapitalize="words"
                  textContentType="name"
                  autoComplete="name"
                />
              </View>

              {/* Email */}
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color="#94a3b8" />
                <TextInput
                  placeholder="Email"
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.inputBare}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              {/* Password */}
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.inputBare}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Password strength meter */}
              {password.length > 0 && (
                <>
                  <View style={styles.passwordMeter}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.meterBar,
                          { backgroundColor: i <= strength.level ? strength.color : 'rgba(255,255,255,0.1)' },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.meterLabel, { color: strength.color }]}>{strength.label} password</Text>
                </>
              )}

              {/* Confirm Password */}
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                <TextInput
                  placeholder="Confirm Password"
                  placeholderTextColor="#64748b"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.inputBare}
                  secureTextEntry={!showConfirm}
                  autoComplete="password-new"
                  textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Password match indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchRow}>
                  <Ionicons
                    name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={password === confirmPassword ? '#34d399' : '#f87171'}
                  />
                  <Text style={{ color: password === confirmPassword ? '#34d399' : '#f87171', fontSize: 12, marginLeft: 4 }}>
                    {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={handleRegister} style={[styles.button, submitting && { opacity: 0.6 }]} disabled={submitting}>
                <LinearGradient
                  colors={['#a855f7', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonInner}
                >
                  <Text style={styles.buttonText}>{submitting ? 'Creating account...' : 'Continue'}</Text>
                  {!submitting && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OAuth buttons */}
              <View style={styles.ssoRow}>
                <TouchableOpacity
                  style={[styles.ssoBtn, !googleRequest && { opacity: 0.4 }]}
                  onPress={() => promptGoogleAsync()}
                  disabled={!googleRequest || submitting}
                >
                  <Ionicons name="logo-google" size={18} color="#e5e7eb" />
                  <Text style={styles.ssoBtnText}>Google</Text>
                </TouchableOpacity>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.ssoBtn}
                    onPress={handleAppleSignIn}
                    disabled={submitting}
                  >
                    <Ionicons name="logo-apple" size={18} color="#e5e7eb" />
                    <Text style={styles.ssoBtnText}>Apple</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={() => router.replace('/login')} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={{ color: '#c084fc', fontWeight: '700' }}>Log in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  formWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 32,
  },
  container: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    color: '#94a3b8',
    marginBottom: 16,
    fontSize: 14,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(168,85,247,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 40,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  inputRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputBare: { flex: 1, color: '#f8fafc', fontSize: 15 },
  passwordMeter: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  meterBar: { height: 4, flex: 1, borderRadius: 999 },
  meterLabel: { fontSize: 11, marginBottom: 10, fontWeight: '600' },
  matchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  button: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(100,116,139,0.3)',
  },
  dividerText: {
    fontSize: 12,
    color: '#64748b',
  },
  ssoRow: { flexDirection: 'row', gap: 12 },
  ssoBtn: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ssoBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginLink: { marginTop: 16, alignItems: 'center', paddingBottom: 4 },
  loginLinkText: { color: '#94a3b8', fontSize: 14 },
});
