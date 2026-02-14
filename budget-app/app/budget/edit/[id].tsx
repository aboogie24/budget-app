import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';
import DateTimePicker from '@react-native-community/datetimepicker';

type Category = { id: string; name: string; type: string };

export default function EditBudget() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  const [name, setName] = useState((params.name as string) || '');
  const [amount, setAmount] = useState((params.amount as string) || '');
  const [type, setType] = useState<'income' | 'expense'>((params.type as 'income' | 'expense') || 'expense');
  const [categoryId, setCategoryId] = useState((params.category_id as string) || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [frequency, setFrequency] = useState((params.frequency as string) || 'monthly');
  const [startDate, setStartDate] = useState(() => {
    const raw = params.start_date as string;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [shared, setShared] = useState((params.is_shared as string) === '1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCats = async () => {
      const user = await getCurrentUser();
      if (!user?.id) return;
      const headers = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;
      const res = await fetch(`${API_URL}/categories/user/${user.id}`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    };
    loadCats();
  }, []);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.id) {
      Alert.alert('Session', 'Please log in again.');
      return;
    }
    if (!name.trim() || !amount || isNaN(Number(amount))) {
      Alert.alert('Missing fields', 'Enter a name and valid amount.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        amount: parseFloat(amount),
        type,
        category_id: categoryId || undefined,
        start_date: startDate.toISOString(),
        frequency: frequency || 'monthly',
        user_id: user.id,
        id: params.id || uuidv4(),
        is_shared: shared,
      };
      const res = await fetch(`${API_URL}/budgets/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      Alert.alert('Saved', 'Budget updated.');
      router.replace('/(tabs)/budget');
    } catch (e) {
      Alert.alert('Error', 'Could not save budget.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#1b0d30', '#2d0c53']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/budget')} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={20} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.header}>Edit Budget</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Budget name"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />

            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="$0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.toggleRow}>
              {(['income', 'expense'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggle, type === t && styles.toggleActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={type === t ? styles.toggleTextActive : styles.toggleText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.selectBox}>
              {categories
                .filter((c) => (c.type || '').toLowerCase() === type)
                .map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.selectItem, categoryId === cat.id && styles.selectItemActive]}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text style={styles.selectText}>{cat.name}</Text>
                    {categoryId === cat.id ? <Ionicons name="checkmark" size={16} color="#c084fc" /> : null}
                  </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.toggleRow}>
              {['monthly', 'weekly', 'biweekly', '1st-15th'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.toggleSmall, frequency === f && styles.toggleActive]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={frequency === f ? styles.toggleTextActive : styles.toggleText}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.toggleRow, { marginTop: 6 }]}>
              <Text style={[styles.label, { flex: 1, marginBottom: 0 }]}>Share with household</Text>
              <TouchableOpacity
                style={[styles.toggleSmall, shared && styles.toggleActive]}
                onPress={() => setShared((prev) => !prev)}
              >
                <Text style={shared ? styles.toggleTextActive : styles.toggleText}>{shared ? 'Shared' : 'Personal'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color="#c084fc" />
              <Text style={styles.datePickerText}>
                {startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(_, selected) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (selected) setStartDate(selected);
                }}
                themeVariant="dark"
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.datePickerDone}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Budget'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { color: '#f8fafc', fontWeight: '800', fontSize: 18 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  label: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#f8fafc',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleSmall: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleActive: { borderColor: '#c084fc', backgroundColor: 'rgba(192,132,252,0.14)' },
  toggleText: { color: '#cbd5e1', fontWeight: '700', textTransform: 'capitalize' },
  toggleTextActive: { color: '#f8fafc', fontWeight: '800', textTransform: 'capitalize' },
  selectBox: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  selectItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectItemActive: { backgroundColor: 'rgba(192,132,252,0.1)' },
  selectText: { color: '#f8fafc', fontWeight: '700' },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  datePickerText: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  datePickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(192,132,252,0.15)',
    marginTop: 4,
  },
  datePickerDoneText: { color: '#c084fc', fontWeight: '700', fontSize: 13 },
});
