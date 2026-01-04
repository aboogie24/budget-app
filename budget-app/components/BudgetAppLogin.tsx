// components/BudgetAppLogin.tsx
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export default function BudgetAppLogin() {
  const colors = {
    primary: '#7c3aed',
    secondary: '#b26ef8',
    background: '#0b1021',
    surface: 'rgba(255,255,255,0.08)',
    text: '#f8fafc',
    muted: '#cbd5e1',
    border: 'rgba(255,255,255,0.15)',
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080'; // fallback

  const handleLogin = async () => {
		try {
			const response = await fetch(`${API_URL}/users/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
        // credentials allow the backend session cookie to be stored for /auth routes
				credentials: 'include',
				body: JSON.stringify({ email, password }),
			});
			
			if (!response.ok) {
				alert('Login failed');
				return;
			}
	
			const data = await response.json();
			const user = data.user;
			console.log('User logging in:', user)

			const session = { ...user, token: data.token };
			await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
	
			router.replace(user.isFirstLogin ? '/setup' : '/(tabs)/dashboard');
		} catch (err) {
			console.error('Login error:', err);
			alert('Unable to login. Check your connection.');
		}
    // console.log(`Attempting login with ${email}`);

    
		// const result = await authenticateUser(email, password);
		// console.log('result =' + result.success)
		// console.log('first login =' + result.isFirstLogin)
		// if (result.success) {
		// 	await setUserSession(email);
		// 	router.replace(result.isFirstLogin ? '/setup' : '/login'); 
		// } else {
		// 	alert('Invalid login')
		// }
  
  
  };

  const handleRegister = () => {
    // Navigate to registration screen
    router.push('/register');
  };

  return (
    <LinearGradient
      colors={['#0b1021', '#371160', '#2b0f50']}
      style={styles.screen}
    >
      <View style={styles.loginContainer}>
        <Text style={[styles.tagline, { color: colors.secondary }]}>For couples & shared goals</Text>
        <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Log in to track budgets, debts, and savings together.
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
          secureTextEntry
        />

        <TouchableOpacity onPress={handleLogin} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleRegister} style={[styles.buttonGhost, { borderColor: colors.secondary }]}>
          <Text style={[styles.buttonGhostText, { color: colors.secondary }]}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24 },
  loginContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonGhost: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
  },
  buttonGhostText: {
    fontWeight: '700',
    fontSize: 16,
  },
});
