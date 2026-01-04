import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import { router } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  limit_amount?: number;
  rollover_enabled?: boolean;
};

const presetColors = ['#7c3aed', '#22c55e', '#ef4444', '#06b6d4', '#f59e0b', '#3b82f6'];
const formatCurrency = (v?: number) =>
  (v ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

export default function BudgetSettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7c3aed');
  const [newLimit, setNewLimit] = useState('');
  const [newRollover, setNewRollover] = useState(false);
  const [sharePartner, setSharePartner] = useState(false);
  const [auth, setAuth] = useState<{ id: string; token?: string } | null>(null);
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  const load = async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setAuth({ id: user.id, token: user.token });
    const headers = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;
    const res = await fetch(`${API_URL}/categories/user/${user.id}`, { headers, credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = categories.filter((c) => c.type === type);

  const updateCategory = async (cat: Category, updates: Partial<Category>) => {
    if (!auth?.id) {
      Alert.alert('Session', 'Please log in again.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/categories/${cat.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: updates.name ?? cat.name,
          color: updates.color ?? cat.color,
          limit_amount: updates.limit_amount ?? cat.limit_amount ?? 0,
          rollover_enabled: updates.rollover_enabled ?? cat.rollover_enabled ?? false,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...updated } : c)));
    } catch (e) {
      Alert.alert('Error', 'Could not update category');
    }
  };

  const handleAdd = async () => {
    if (!auth?.id) {
      Alert.alert('Session', 'Please log in again');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Missing name', 'Enter a category name');
      return;
    }
    try {
      const payload = {
        id: uuidv4(),
        name: newName.trim(),
        type,
        user_id: auth.id,
        color: newColor,
        limit_amount: newLimit ? parseFloat(newLimit) : 0,
        rollover_enabled: newRollover,
      };
      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setCategories((prev) => [...prev, created]);
      setNewName('');
      setNewLimit('');
      setNewRollover(false);
    } catch (e) {
      Alert.alert('Error', 'Could not add category');
    }
  };

  const totalMonthlyBudget = filtered.reduce((sum, c) => sum + (c.limit_amount || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.header}>Budget Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Manage categories, limits & rollovers</Text>
          <View style={styles.toggleRow}>
            {['expense', 'income'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.toggle, type === t && styles.toggleActive]}
                onPress={() => setType(t as 'income' | 'expense')}
              >
                <Text style={type === t ? styles.toggleTextActive : styles.toggleText}>
                  {t === 'expense' ? 'Expenses' : 'Income'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="wallet-outline" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Total Monthly Budget</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalMonthlyBudget)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 4 }]}>
            {type === 'expense' ? 'Expense Categories' : 'Income Categories'}
          </Text>
          {filtered.length > 0 && (
            <View style={styles.reorderRow}>
              <Ionicons name="reorder-three" size={18} color="#94a3b8" />
              <Text style={styles.reorderText}>Reorder</Text>
            </View>
          )}

          {filtered.length === 0 ? (
            <Text style={{ color: '#94a3b8', marginTop: 6 }}>No categories yet. Add one below.</Text>
          ) : (
            filtered.map((cat) => (
              <View key={cat.id} style={styles.categoryCard}>
                <View style={styles.nameRow}>
                  <View
                    style={[
                      styles.iconPill,
                      {
                        backgroundColor: `${cat.color || '#a855f7'}22`,
                        borderColor: cat.color || '#a855f7',
                      },
                    ]}
                  >
                    <Ionicons name={type === 'expense' ? 'cart-outline' : 'cash-outline'} size={18} color={cat.color || '#a855f7'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{cat.name}</Text>
                    <Text style={styles.itemSub}>
                      {formatCurrency(cat.limit_amount)} {cat.rollover_enabled ? '• Rollover' : ''}
                    </Text>
                  </View>
                  {cat.rollover_enabled && (
                    <View style={styles.tag}>
                      <Ionicons name="refresh" size={12} color="#7c3aed" />
                      <Text style={styles.tagText}>Rollover</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => router.push('/(tabs)/budget')}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.limitRow, { marginTop: 10 }]}>
                  <Text style={styles.label}>Monthly limit</Text>
                  <TextInput
                    style={[styles.limitInput, { flex: 0.6 }]}
                    keyboardType="numeric"
                    defaultValue={cat.limit_amount ? String(cat.limit_amount) : ''}
                    onEndEditing={(e) =>
                      updateCategory(cat, {
                        limit_amount: e.nativeEvent.text ? parseFloat(e.nativeEvent.text) : 0,
                      })
                    }
                    placeholder="$0"
                  />
                </View>
                <View style={styles.rollRow}>
                  <Text style={styles.label}>Enable rollover</Text>
                  <Switch
                    value={!!cat.rollover_enabled}
                    onValueChange={(v) => updateCategory(cat, { rollover_enabled: v })}
                    thumbColor="#fff"
                    trackColor={{ true: '#a855f7', false: '#cbd5e1' }}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add new {type} category</Text>
          <View style={styles.inputRow}>
            <View style={styles.iconInput}>
              <Ionicons name={type === 'expense' ? 'cart-outline' : 'cash-outline'} size={18} color="#7c3aed" />
            </View>
            <TextInput
              placeholder="Category name"
              value={newName}
              onChangeText={setNewName}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
          </View>
          <TextInput
            placeholder="Monthly limit (optional)"
            value={newLimit}
            onChangeText={setNewLimit}
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.rollRow}>
            <Text style={styles.label}>Enable rollover</Text>
            <Switch
              value={newRollover}
              onValueChange={setNewRollover}
              thumbColor="#fff"
              trackColor={{ true: '#a855f7', false: '#cbd5e1' }}
            />
          </View>
          <View style={styles.rollRow}>
            <View>
              <Text style={styles.label}>Share with partner</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>Partner can see this category</Text>
            </View>
            <Switch
              value={sharePartner}
              onValueChange={setSharePartner}
              thumbColor="#fff"
              trackColor={{ true: '#a855f7', false: '#cbd5e1' }}
            />
          </View>
          <Text style={styles.label}>Pick a color</Text>
          <View style={styles.colorGrid}>
            {presetColors.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setNewColor(c)}
                style={[styles.colorSwatch, c === newColor && styles.colorSwatchActive, { backgroundColor: c }]}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
            <Text style={styles.saveText}>Save Category</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f3ff' },
  container: { padding: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  header: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionTitle: { color: '#4b5563', fontWeight: '700', marginBottom: 12, fontSize: 14 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  toggleActive: {
    backgroundColor: '#ede9fe',
    borderColor: '#c084fc',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  toggleText: { color: '#94a3b8', fontWeight: '700' },
  toggleTextActive: { color: '#6d28d9', fontWeight: '800' },
  itemRow: { borderTopWidth: 1, borderColor: '#e2e8f0', paddingVertical: 12, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { fontWeight: '700', color: '#0f172a', flex: 1 },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: '#475569', fontWeight: '600' },
  limitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  rollRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  colorGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginVertical: 8 },
  colorSwatch: { width: 34, height: 34, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#7c3aed' },
  categoryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  itemSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryLabel: { color: '#475569', fontWeight: '700', fontSize: 12 },
  summaryValue: { color: '#0f172a', fontWeight: '900', fontSize: 20 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  reorderText: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#eef2ff',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: { color: '#6d28d9', fontWeight: '700', fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconInput: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ede9fe',
  },
});
