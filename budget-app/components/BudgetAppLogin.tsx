// components/BudgetAppLogin.tsx
import { View, Text, TextInput, TouchableOpacity, ImageBackground, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { authenticateUser } from '@/utils/auth';
import { setUserSession } from '../utils/storage';
import { useState } from 'react';

export default function BudgetAppLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    console.log(`Attempting login with ${email}`);

    
		const result = await authenticateUser(email, password);
		console.log('result =' + result.success)
		console.log('first login =' + result.isFirstLogin)
		if (result.success) {
			await setUserSession(email);
			router.replace(result.isFirstLogin ? '/setup' : '/login'); 
		} else {
			alert('Invalid login')
		}
  
  
  };

  const handleRegister = () => {
    // Navigate to registration screen
    router.push('/register');
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?fit=crop&w=800&q=80' }}
      style={styles.imageBackground}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.6)"]}
        style={styles.gradientOverlay}
      >
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Login</Text>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
          />

          <TouchableOpacity onPress={handleLogin} style={styles.button}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRegister} style={styles.registerButton}>
            <Text style={styles.registerText}>Don't have an account? Register</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  imageBackground: {
    flex: 1,
    justifyContent: 'center'
  },
  gradientOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  loginContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  input: {
    borderBottomWidth: 1,
    marginBottom: 20,
    paddingVertical: 8
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    marginBottom: 10
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold'
  },
  registerButton: {
    paddingVertical: 10
  },
  registerText: {
    color: '#4CAF50',
    textAlign: 'center',
    textDecorationLine: 'underline'
  }
});
