import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function FrequencySettingsScreen() {
  const [weekly, setWeekly] = useState('4');
  const [biweekly, setBiweekly] = useState('2');
  const [monthly, setMonthly] = useState('1');

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await AsyncStorage.getItem('frequencyMultipliers');
      if (stored) {
        const values = JSON.parse(stored);
        setWeekly(String(values.weekly));
        setBiweekly(String(values.biweekly));
        setMonthly(String(values.monthly));
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    const settings = {
      weekly: parseInt(weekly),
      biweekly: parseInt(biweekly),
      monthly: parseInt(monthly),
    };

    try {
      await AsyncStorage.setItem(
        'frequencyMultipliers',
        JSON.stringify(settings)
      );
      Alert.alert('Saved', 'Frequency settings updated');
    } catch (e) {
      console.error('Error saving settings:', e);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleReset = async () => {
    const defaults = { weekly: 4, biweekly: 2, monthly: 1 };
    try {
      await AsyncStorage.setItem(
        'frequencyMultipliers',
        JSON.stringify(defaults)
      );
      setWeekly('4');
      setBiweekly('2');
      setMonthly('1');
      Alert.alert('Reset', 'Defaults restored');
    } catch (e) {
      console.error('Error resetting settings:', e);
      Alert.alert('Error', 'Failed to reset settings');
    }
  };

  const handleReturn = () => {
    router.replace('/(tabs)/settings');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Frequency Multipliers</Text>

      <View style={styles.settingRow}>
        <Text style={styles.label}>Weekly (times/month):</Text>
        <TextInput
          style={styles.input}
          value={weekly}
          onChangeText={setWeekly}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.label}>Biweekly (times/month):</Text>
        <TextInput
          style={styles.input}
          value={biweekly}
          onChangeText={setBiweekly}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.label}>Monthly (times/month):</Text>
        <TextInput
          style={styles.input}
          value={monthly}
          onChangeText={setMonthly}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#4CAF50' }]} onPress={handleSave}>
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#2196F3', marginTop: 12 }]}
        onPress={handleReset}
      >
        <Text style={styles.buttonText}>Reset to Defaults</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#FF0000', marginTop: 12 }]}
        onPress={handleReturn}
      >
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  settingRow: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
  },
  button: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
