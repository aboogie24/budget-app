// app/register.tsx
import React, { useState } from 'react';
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
import { saveUser, UserData } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground } from 'react-native';
import Constants from 'expo-constants';
import { Alert as RNAlert } from 'react-native';

export default function RegisterScreen() {
  const colors = {
    primary: '#7c3aed',
    secondary: '#b26ef8',
    background: '#f7f8ff',
    surface: '#ffffff',
    text: '#0f172a',
    muted: '#6b7280',
    border: '#e5e7eb',
  };

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080'; // fallback

  const handleRegister = async () => {
    if (submitting) return;
    if (!email || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    const id = uuidv4();

    try {
        setSubmitting(true);
        console.log('Sending request..... to ', API_URL);
        const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id,
            full_name: fullName,
            email,
            password,
        }),
        });

        const errorText = !response.ok ? await response.text() : null;
        console.log('Reponse status:', response.status, errorText);
        if (!response.ok) {
            Alert.alert('Registration failed', errorText || 'Please try again.');
            setSubmitting(false);
            return;
        }

        const data = await response.json();
        const user = data?.user ?? { email, id, isFirstLogin: true };

        // Immediately log in to retrieve token/session
        const loginRes = await fetch(`${API_URL}/users/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        const loginErr = !loginRes.ok ? await loginRes.text() : null;
        if (!loginRes.ok) {
          console.log('Auto-login after register failed', loginRes.status, loginErr);
          Alert.alert('Login needed', 'Registered, please log in.');
          router.replace('/login');
          setSubmitting(false);
          return;
        }
        const loginData = await loginRes.json();
        const session = { ...(loginData.user || user), token: loginData.token };

        await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));

        Alert.alert(
          'Link bank account?',
          'Connect now to pull in transactions automatically.',
          [
            {
              text: 'Link now',
              onPress: () => router.replace('/link-account'),
            },
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => router.replace({ pathname: '/setup', params: { email: session.email } }),
            },
          ],
          { cancelable: true }
        );
    } catch (err) {
        console.error('Register error:', err);
        alert('Could not register user.');
    } finally {
        setSubmitting(false);
    }
    // if (!email || !password || !confirmPassword) {
    //   Alert.alert('Missing fields', 'Please fill out all fields.');
    //   return;
    // }
    // if (password !== confirmPassword) {
    //   Alert.alert('Password mismatch', 'Passwords do not match.');
    //   return;
    // }

    // const user: UserData = {
    //   email,
    //   password,
    //   isFirstLogin: true
    // };

    // try {
    //   await saveUser(user);
    //   Alert.alert('Success', 'User registered! Please log in.');
    //   router.replace('/login');
    // } catch (error) {
    //   console.error('Registration error:', error);
    //   Alert.alert('Error', 'Something went wrong during registration.');
    // }
  };
  const handleSSO = (provider: 'google' | 'apple') => {
    RNAlert.alert(
      `${provider === 'google' ? 'Google' : 'Apple'} Sign-In`,
      'SSO is not configured in this build. Wire provider keys and flow here.',
      [{ text: 'OK', onPress: () => router.replace('/login') }]
    );
  };

  return (
    <LinearGradient colors={['#f7f4ff', '#f8fbff']} style={styles.imageBackground}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.formWrapper}>
            <View style={styles.headerRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="heart-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.logoText}>CoupleFlow</Text>
              <Ionicons name="moon-outline" size={18} color={colors.muted} />
            </View>

            <View style={styles.progressRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.progressDot, i === 2 && styles.progressDotActive]} />
              ))}
            </View>

            <View style={styles.container}>
              <Text style={styles.title}>Create Your Account</Text>
              <Text style={styles.subtitle}>Let’s get you started on your financial journey together.</Text>

              <View style={styles.avatarCircle}>
                <Ionicons name="person-outline" size={40} color={colors.primary} />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color={colors.muted} />
                <TextInput
                  placeholder="Full name"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  style={styles.inputBare}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} />
                <TextInput
                  placeholder="Email"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  style={styles.inputBare}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  style={styles.inputBare}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                />
                <Ionicons name="eye-outline" size={18} color={colors.muted} />
              </View>

              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  placeholder="Confirm Password"
                  placeholderTextColor={colors.muted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.inputBare}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType={Platform.OS === 'ios' ? 'newPassword' : 'password'}
                />
              </View>

              <View style={styles.passwordMeter}>
                <View style={[styles.meterBar, { backgroundColor: '#f87171' }]} />
                <View style={[styles.meterBar, { backgroundColor: '#e5e7eb' }]} />
                <View style={[styles.meterBar, { backgroundColor: '#e5e7eb' }]} />
                <View style={[styles.meterBar, { backgroundColor: '#e5e7eb' }]} />
              </View>
              <Text style={styles.meterLabel}>Weak password</Text>

              <TouchableOpacity onPress={handleRegister} style={[styles.button, submitting && { opacity: 0.6 }]} disabled={submitting}>
                <Text style={styles.buttonText}>{submitting ? 'Registering...' : 'Continue  →'}</Text>
              </TouchableOpacity>

              <Text style={[styles.subtitle, { marginTop: 12 }]}>Register with</Text>
              <View style={[styles.ssoRow, { flexDirection: 'row', justifyContent: 'center', gap: 12 }]}>
                <TouchableOpacity style={[styles.ssoIconBtn]} onPress={() => handleSSO('google')}>
                  <Ionicons name="logo-google" size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ssoIconBtn]} onPress={() => handleSSO('apple')}>
                  <Ionicons name="logo-apple" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => router.replace('/login')} style={[styles.buttonGhost, { borderColor: colors.secondary }]}>
                <Text style={[styles.buttonGhostText, { color: colors.secondary }]}>Already have an account? Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  imageBackground: {
    flex: 1,
    justifyContent: 'center',
  },
  formWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 22,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  logoBadge: { backgroundColor: '#ede9fe', padding: 8, borderRadius: 12 },
  logoText: { color: '#1f2937', fontWeight: '700', fontSize: 14 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 12, alignSelf: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#e5e7eb' },
  progressDotActive: { backgroundColor: '#7c3aed', width: 16 },
  tagline: { textAlign: 'center', color: '#7c3aed', fontWeight: '700', fontSize: 13, marginBottom: 6 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    color: '#0f172a',
  },
  subtitle: { textAlign: 'center', color: '#6b7280', marginBottom: 16, fontSize: 15 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  inputRow: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputBare: { flex: 1, color: '#0f172a' },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  passwordMeter: { flexDirection: 'row', gap: 6, marginTop: 8 },
  meterBar: { height: 4, flex: 1, borderRadius: 999 },
  meterLabel: { color: '#f87171', fontSize: 12, marginTop: 4, marginBottom: 8 },
  button: {
    backgroundColor: '#7c3aed',
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonGhost: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    marginTop: 10,
  },
  buttonGhostText: {
    fontWeight: '700',
    fontSize: 16,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  ssoRow: { marginTop: 12, gap: 10 },
  ssoIconBtn: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
