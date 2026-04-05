// components/BudgetAppLogin.tsx
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export default function BudgetAppLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const API_URL = api.getBaseUrl();

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

  const completeOAuthLogin = async (data: any) => {
    const user = data.user;
    const session = { ...user, token: data.token };
    await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
    successHaptic();
    router.replace(user.onboarding_complete ? '/(tabs)/dashboard' : '/onboarding');
  };

  const handleLogin = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        errorHaptic();
        alert(errorText || 'Login failed. Check your email and password.');
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
      alert('Unable to connect to server. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

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
        errorHaptic();
        alert('Google Sign-In failed. Please try again.');
        return;
      }
      await completeOAuthLogin(await response.json());
    } catch (err) {
      console.error('Google OAuth error:', err);
      errorHaptic();
      alert('Could not sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (submitting) return;
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        alert('Apple Sign-In is not available on this device.');
        return;
      }
      setSubmitting(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      const response = await fetch(`${API_URL}/users/oauth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_token: credential.identityToken, email: credential.email ?? '', full_name: fullName }),
      });
      if (!response.ok) {
        errorHaptic();
        alert('Apple Sign-In failed.');
        return;
      }
      await completeOAuthLogin(await response.json());
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      console.error('Apple OAuth error:', err);
      errorHaptic();
      alert('Could not sign in with Apple.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Logo Section */}
            <View style={styles.logoContainer}>
              {/* Overlapping circles */}
              <View style={styles.circlesRow}>
                <View style={[styles.logoCircle, { backgroundColor: 'rgba(168,85,247,0.9)', left: 0 }]} />
                <View style={[styles.logoCircle, { backgroundColor: 'rgba(236,72,153,0.9)', left: 28 }]} />
              </View>

              <View style={styles.brandingRow}>
                <Text style={styles.coupleText}>Couple</Text>
                <Ionicons name="heart" size={28} color="#ec4899" />
                <Text style={styles.flowText}>Flow</Text>
              </View>

              <Text style={styles.tagline}>For couples & shared goals</Text>
            </View>

            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome back</Text>
              <Text style={styles.welcomeSubtitle}>Log in to your financial journey.</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color="#94a3b8" />
                <TextInput
                  placeholder="Email"
                  placeholderTextColor="#6b7280"
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
                <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.inputBare}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={showPassword ? '#a855f7' : '#94a3b8'} />
                </TouchableOpacity>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Log In Button */}
              <TouchableOpacity onPress={handleLogin} disabled={submitting} style={{ borderRadius: 14, overflow: 'hidden' }}>
                <LinearGradient
                  colors={['#a855f7', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginBtn}
                >
                  <Text style={styles.loginBtnText}>{submitting ? 'Logging in...' : 'Log In'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* OAuth Buttons */}
            <View style={styles.oauthRow}>
              <TouchableOpacity
                style={[styles.oauthBtn, !googleRequest && { opacity: 0.4 }]}
                onPress={() => promptGoogleAsync()}
                disabled={!googleRequest || submitting}
              >
                <Ionicons name="logo-google" size={20} color="#e5e7eb" />
                <Text style={styles.oauthBtnText}>Google</Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.oauthBtn}
                  onPress={handleAppleSignIn}
                  disabled={submitting}
                >
                  <Ionicons name="logo-apple" size={20} color="#e5e7eb" />
                  <Text style={styles.oauthBtnText}>Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Sign Up Link */}
            <TouchableOpacity onPress={() => router.push('/register')} style={styles.signupLink}>
              <Text style={styles.signupText}>
                Don't have an account? <Text style={{ color: '#c084fc', fontWeight: '700' }}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  circlesRow: {
    width: 80,
    height: 48,
    position: 'relative',
    marginBottom: 16,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'absolute',
    top: 0,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  coupleText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#a855f7',
  },
  flowText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ec4899',
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a855f7',
    letterSpacing: 0.5,
  },

  // Welcome
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // Form
  form: {
    gap: 16,
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputBare: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
  },
  forgotRow: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 12,
    color: '#a855f7',
    fontWeight: '600',
  },
  loginBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Divider
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
    fontWeight: '500',
  },

  // OAuth
  oauthRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  oauthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  oauthBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Sign up
  signupLink: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  signupText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
