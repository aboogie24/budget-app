// app/setup.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { markUserNotFirstLogin } from '../utils/storage';
import { updateUserProfile } from '../utils/storage';

export default function SetupScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  const [name, setName] = useState('');
  const [budgetGoal, setBudgetGoal] = useState('');

  const completeSetup = async () => {
    if (!name || !budgetGoal) {
      Alert.alert('Missing info', 'Please enter your name and budget goal.');
      return;
    }

    try {
      await updateUserProfile(String(email), { name, budgetGoal });
      await markUserNotFirstLogin(String(email));
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      console.error('Setup error:', error);
      Alert.alert('Error', 'Something went wrong during setup.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Welcome to BudgetApp!</Text>
      <Text style={styles.subheader}>Let's finish setting up your account.</Text>

      <TextInput
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <TextInput
        placeholder="Monthly Budget Goal ($)"
        value={budgetGoal}
        onChangeText={setBudgetGoal}
        keyboardType="numeric"
        style={styles.input}
      />

      <TouchableOpacity onPress={completeSetup} style={styles.button}>
        <Text style={styles.buttonText}>Finish Setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subheader: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderBottomWidth: 1,
    paddingVertical: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
