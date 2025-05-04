// app/(tabs)/settings.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

  const [weekly, setWeekly] = useState('4');
  const [biweekly, setBiweekly] = useState('2');
  const [monthly, setMonthly] = useState('1');

  const handleSave = async () => {
    const settings = {
      weekly: parseInt(weekly),
      biweekly: parseInt(biweekly),
      monthly: parseInt(monthly),
    };

    try {
      await AsyncStorage.setItem('frequencyMultipliers', JSON.stringify(settings));
      Alert.alert('Saved', 'Settings updated');
    } catch (e) {
      console.error('Error saving settings:', e);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('budgetAppSession');
    router.replace('/login');
  };

	const handleReset = async () => {
		const defaults = { weekly: 4, biweekly: 2, monthly: 1 };
		try {
			await AsyncStorage.setItem('frequencyMultipliers', JSON.stringify(defaults));
			setWeekly('4');
			setBiweekly('2');
			setMonthly('1');
			Alert.alert('Reset', 'Defaults restored');
		} catch (e) {
			console.error('Error resetting settings:', e);
			Alert.alert('Error', 'Failed to reset settings');
		}
	};

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Frequency Settings</Text>

      <Text>Weekly (times/month)</Text>
      <TextInput
        style={styles.input}
        value={weekly}
        onChangeText={setWeekly}
        keyboardType="numeric"
      />

      <Text>Biweekly (times/month)</Text>
      <TextInput
        style={styles.input}
        value={biweekly}
        onChangeText={setBiweekly}
        keyboardType="numeric"
      />

      <Text>Monthly (times/month)</Text>
      <TextInput
        style={styles.input}
        value={monthly}
        onChangeText={setMonthly}
        keyboardType="numeric"
      />

      <TouchableOpacity onPress={handleSave} style={[styles.button, { backgroundColor: '#4CAF50' }]}>
        <Text style={styles.buttonText}>Save Settings</Text>
      </TouchableOpacity>

			<TouchableOpacity onPress={handleReset} style={[styles.button, { backgroundColor: '#2196F3', marginTop: 16 }]}>
				<Text style={styles.buttonText}>Reset to Default</Text>
			</TouchableOpacity>

      <TouchableOpacity onPress={handleLogout} style={[styles.button, { backgroundColor: '#e53935', marginTop: 16 }]}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 12,
    borderRadius: 6,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
