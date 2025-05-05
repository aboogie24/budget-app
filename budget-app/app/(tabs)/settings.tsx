// app/(tabs)/settings.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await AsyncStorage.removeItem('budgetAppSession');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('../settings/frequency')}
      >
        <Text style={styles.menuText}>Frequency Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('../settings/categories')}
      >
        <Text style={styles.menuText}>Manage Categories</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: '#e53935', marginTop: 40 }]}
        onPress={handleLogout}
      >
        <Text style={[styles.menuText, { color: 'white' }]}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  menuItem: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 16,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
