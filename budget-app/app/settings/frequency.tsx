import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const FIELDS = [
  { key: 'weekly', label: 'Weekly', icon: 'calendar-outline' as const, hint: 'times per month' },
  { key: 'biweekly', label: 'Biweekly', icon: 'swap-horizontal-outline' as const, hint: 'times per month' },
  { key: 'monthly', label: 'Monthly', icon: 'today-outline' as const, hint: 'times per month' },
];

export default function FrequencySettingsScreen() {
  const [weekly, setWeekly] = useState('4');
  const [biweekly, setBiweekly] = useState('2');
  const [monthly, setMonthly] = useState('1');

  const values: Record<string, { get: string; set: (v: string) => void }> = {
    weekly: { get: weekly, set: setWeekly },
    biweekly: { get: biweekly, set: setBiweekly },
    monthly: { get: monthly, set: setMonthly },
  };

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('frequencyMultipliers');
      if (stored) {
        const v = JSON.parse(stored);
        setWeekly(String(v.weekly));
        setBiweekly(String(v.biweekly));
        setMonthly(String(v.monthly));
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    const settings = {
      weekly: parseInt(weekly) || 4,
      biweekly: parseInt(biweekly) || 2,
      monthly: parseInt(monthly) || 1,
    };
    try {
      await AsyncStorage.setItem('frequencyMultipliers', JSON.stringify(settings));
      Alert.alert('Saved', 'Frequency settings updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  const handleReset = () => {
    Alert.alert('Reset', 'Restore default values?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          const defaults = { weekly: 4, biweekly: 2, monthly: 1 };
          await AsyncStorage.setItem('frequencyMultipliers', JSON.stringify(defaults));
          setWeekly('4');
          setBiweekly('2');
          setMonthly('1');
          Alert.alert('Done', 'Defaults restored.');
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#c084fc" />
            </TouchableOpacity>
            <Text style={styles.header}>Frequency</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>MULTIPLIERS</Text>
            <Text style={styles.desc}>
              Control how frequencies convert to monthly amounts for budget calculations.
            </Text>

            {FIELDS.map((f) => (
              <View key={f.key} style={styles.fieldCard}>
                <View style={styles.fieldLeft}>
                  <View style={styles.fieldIcon}>
                    <Ionicons name={f.icon} size={18} color="#c084fc" />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <Text style={styles.fieldHint}>{f.hint}</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.fieldInput}
                  value={values[f.key].get}
                  onChangeText={values[f.key].set}
                  keyboardType="numeric"
                  placeholderTextColor="#475569"
                />
              </View>
            ))}
          </View>

          <View style={{ gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Reset to Defaults</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1 },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },

  /* Card */
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 6,
  },
  desc: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },

  /* Field */
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(192,132,252,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  fieldHint: { color: '#64748b', fontSize: 12, marginTop: 1 },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },

  /* Buttons */
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resetBtnText: { color: '#94a3b8', fontWeight: '700', fontSize: 14 },
});
