// app/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { saveUser, UserData } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    console.log('Generated UUID:', uuidv4());
    const id = uuidv4();

    try {
        console.log('Sending request.....');
        const response = await fetch('http://10.0.20.204:8080/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id,
            email,
            password,
        }),
        });

        console.log('Reponse status:', response.status);
        if (!response.ok) {
            alert('Registration failed');
            return;
        }

        await AsyncStorage.setItem(
        'budgetAppSession',
        JSON.stringify({ email, id, isFirstLogin: true })
        );

        router.replace('/login'); // or '/dashboard' depending on flow
    } catch (err) {
        console.error('Register error:', err);
        alert('Could not register user.');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

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

      <TextInput
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={styles.input}
        secureTextEntry
      />

      <TouchableOpacity onPress={handleRegister} style={styles.button}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderBottomWidth: 1,
    marginBottom: 20,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
