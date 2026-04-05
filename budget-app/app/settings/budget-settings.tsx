import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
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
  budget_id?: string | null;
};

type BudgetGroup = {
  id: string;
  name: string;
  type: 'income' | 'expense';
};

const PRESET_COLORS = ['#7c3aed', '#22c55e', '#ef4444', '#06b6d4', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'];

const formatCurrency = (v?: number) =>
  (v ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

export default function BudgetSettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7c3aed');
  const [newLimit, setNewLimit] = useState('');
  const [newRollover, setNewRollover] = useState(false);
  const [newBudgetId, setNewBudgetId] = useState('');
  const [sharePartner, setSharePartner] = useState(false);
  const [auth, setAuth] = useState<{ id: string; token?: string } | null>(null);
  const [budgets, setBudgets] = useState<BudgetGroup[]>([]);

  const load = async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setAuth({ id: user.id, token: user.token });
    try {
      const catData = await api.get(`/auth/categories/user/${user.id}`);
      setCategories(Array.isArray(catData) ? catData : []);
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const budgetData = await api.get(`/auth/budgets/user/${user.id}`, { month, year });
      setBudgets(Array.isArray(budgetData) ? budgetData : []);
    } catch (e) {
      console.error('Failed to load budgets:', e);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = categories.filter((c) => c.type === type);
  const budgetOptions = budgets.filter((b) => b.type === type);
  const totalMonthlyBudget = filtered.reduce((sum, c) => sum + (c.limit_amount || 0), 0);

  const updateCategory = async (cat: Category, updates: Partial<Category>) => {
    if (!auth?.id) { Alert.alert('Session', 'Please log in again.'); return; }
    try {
      const updated = await api.put(`/auth/categories/${cat.id}`, {
        name: updates.name ?? cat.name,
        color: updates.color ?? cat.color,
        limit_amount: updates.limit_amount ?? cat.limit_amount ?? 0,
        rollover_enabled: updates.rollover_enabled ?? cat.rollover_enabled ?? false,
        budget_id: updates.budget_id ?? cat.budget_id ?? null,
      });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...updated } : c)));
    } catch (e) {
      console.error('Failed to update category:', e);
      Alert.alert('Error', 'Could not update category');
    }
  };

  const handleAdd = async () => {
    if (!auth?.id) { Alert.alert('Session', 'Please log in again'); return; }
    if (!newName.trim()) { Alert.alert('Missing name', 'Enter a category name'); return; }
    try {
      const payload = {
        id: uuidv4(),
        name: newName.trim(),
        type,
        user_id: auth.id,
        color: newColor,
        limit_amount: newLimit ? parseFloat(newLimit) : 0,
        rollover_enabled: newRollover,
        budget_id: newBudgetId || null,
      };
      const created = await api.post(`/auth/categories`, payload);
      setCategories((prev) => [...prev, created]);
      setNewName('');
      setNewLimit('');
      setNewRollover(false);
      setNewBudgetId('');
    } catch (e) {
      console.error('Failed to add category:', e);
      Alert.alert('Error', 'Could not add category');
    }
  };

  const deleteCategory = (cat: Category) => {
    Alert.alert('Delete', `Remove "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/categories/${cat.id}`);
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
          } catch (e) {
            console.error('Failed to delete category:', e);
            Alert.alert('Error', 'Could not delete category');
          }
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#c084fc" />
            </TouchableOpacity>
            <Text style={styles.header}>Budget Settings</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Type toggle */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              {(['expense', 'income'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggle, type === t && styles.toggleActive]}
                  onPress={() => setType(t)}
                >
                  <Ionicons
                    name={t === 'expense' ? 'cart-outline' : 'cash-outline'}
                    size={16}
                    color={type === t ? '#c084fc' : '#64748b'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={type === t ? styles.toggleTextActive : styles.toggleText}>
                    {t === 'expense' ? 'Expenses' : 'Income'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Budget total */}
            <View style={styles.totalRow}>
              <View style={styles.totalIcon}>
                <Ionicons name="wallet-outline" size={18} color="#c084fc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.totalLabel}>Total Monthly Budget</Text>
                <Text style={styles.totalValue}>{formatCurrency(totalMonthlyBudget)}</Text>
              </View>
            </View>
          </View>

          {/* Category list */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              {type === 'expense' ? 'EXPENSE CATEGORIES' : 'INCOME CATEGORIES'}
            </Text>

            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={28} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>No categories yet</Text>
              </View>
            ) : (
              filtered.map((cat) => (
                <View key={cat.id} style={styles.catCard}>
                  {/* Name row */}
                  <View style={styles.catHeader}>
                    <View style={[styles.catIcon, { backgroundColor: `${cat.color || '#a855f7'}20`, borderColor: `${cat.color || '#a855f7'}40` }]}>
                      <Ionicons
                        name={type === 'expense' ? 'cart-outline' : 'cash-outline'}
                        size={16}
                        color={cat.color || '#a855f7'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>{cat.name}</Text>
                      <Text style={styles.catSub}>
                        {formatCurrency(cat.limit_amount)}/mo
                        {cat.rollover_enabled ? ' · Rollover' : ''}
                      </Text>
                    </View>
                    {cat.rollover_enabled && (
                      <View style={styles.rollBadge}>
                        <Ionicons name="refresh" size={11} color="#c084fc" />
                      </View>
                    )}
                    <TouchableOpacity onPress={() => deleteCategory(cat)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {/* Limit input */}
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Monthly limit</Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      placeholderTextColor="#475569"
                      defaultValue={cat.limit_amount ? String(cat.limit_amount) : ''}
                      onEndEditing={(e) =>
                        updateCategory(cat, { limit_amount: e.nativeEvent.text ? parseFloat(e.nativeEvent.text) : 0 })
                      }
                      placeholder="$0"
                    />
                  </View>

                  {/* Budget group */}
                  {budgetOptions.length > 0 && (
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>Group</Text>
                      <View style={styles.segmented}>
                        <TouchableOpacity
                          style={[styles.segItem, !cat.budget_id && styles.segItemActive]}
                          onPress={() => updateCategory(cat, { budget_id: null })}
                        >
                          <Text style={!cat.budget_id ? styles.segTextActive : styles.segText}>None</Text>
                        </TouchableOpacity>
                        {budgetOptions.map((b) => (
                          <TouchableOpacity
                            key={b.id}
                            style={[styles.segItem, cat.budget_id === b.id && styles.segItemActive]}
                            onPress={() => updateCategory(cat, { budget_id: b.id })}
                          >
                            <Text style={cat.budget_id === b.id ? styles.segTextActive : styles.segText}>{b.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Rollover */}
                  <View style={styles.switchRow}>
                    <Text style={styles.fieldLabel}>Rollover</Text>
                    <Switch
                      value={!!cat.rollover_enabled}
                      onValueChange={(v) => updateCategory(cat, { rollover_enabled: v })}
                      thumbColor="#fff"
                      trackColor={{ true: '#a855f7', false: 'rgba(255,255,255,0.15)' }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Add new */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ADD NEW {type.toUpperCase()} CATEGORY</Text>

            <View style={styles.addInputRow}>
              <View style={[styles.catIcon, { backgroundColor: `${newColor}20`, borderColor: `${newColor}40` }]}>
                <Ionicons name={type === 'expense' ? 'cart-outline' : 'cash-outline'} size={16} color={newColor} />
              </View>
              <TextInput
                placeholder="Category name"
                placeholderTextColor="#475569"
                value={newName}
                onChangeText={setNewName}
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <TextInput
              placeholder="Monthly limit (optional)"
              placeholderTextColor="#475569"
              value={newLimit}
              onChangeText={setNewLimit}
              keyboardType="numeric"
              style={styles.input}
            />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Enable rollover</Text>
              <Switch
                value={newRollover}
                onValueChange={setNewRollover}
                thumbColor="#fff"
                trackColor={{ true: '#a855f7', false: 'rgba(255,255,255,0.15)' }}
              />
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.fieldLabel}>Share with partner</Text>
                <Text style={styles.fieldHint}>Partner can see this category</Text>
              </View>
              <Switch
                value={sharePartner}
                onValueChange={setSharePartner}
                thumbColor="#fff"
                trackColor={{ true: '#a855f7', false: 'rgba(255,255,255,0.15)' }}
              />
            </View>

            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setNewColor(c)}
                  style={[styles.colorSwatch, { backgroundColor: c }, c === newColor && styles.colorSwatchActive]}
                />
              ))}
            </View>

            {budgetOptions.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Budget group</Text>
                <View style={styles.segmented}>
                  <TouchableOpacity
                    style={[styles.segItem, !newBudgetId && styles.segItemActive]}
                    onPress={() => setNewBudgetId('')}
                  >
                    <Text style={!newBudgetId ? styles.segTextActive : styles.segText}>None</Text>
                  </TouchableOpacity>
                  {budgetOptions.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.segItem, newBudgetId === b.id && styles.segItemActive]}
                      onPress={() => setNewBudgetId(b.id)}
                    >
                      <Text style={newBudgetId === b.id ? styles.segTextActive : styles.segText}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.saveText}>Save Category</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 10,
  },

  /* Toggle */
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleActive: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderColor: 'rgba(192,132,252,0.3)',
  },
  toggleText: { color: '#64748b', fontWeight: '700' },
  toggleTextActive: { color: '#c084fc', fontWeight: '800' },

  /* Total */
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  totalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },
  totalValue: { color: '#f8fafc', fontWeight: '800', fontSize: 22 },

  /* Category card */
  catCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  catName: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  catSub: { color: '#64748b', fontSize: 12, marginTop: 1 },
  rollBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Fields */
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12,
  },
  fieldLabel: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  fieldHint: { color: '#475569', fontSize: 11, marginTop: 1 },
  fieldInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 14,
    minWidth: 90,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: '#f8fafc',
    fontSize: 15,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },

  /* Segmented */
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segItem: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segItemActive: { borderColor: 'rgba(192,132,252,0.4)', backgroundColor: 'rgba(192,132,252,0.12)' },
  segText: { color: '#64748b', fontWeight: '700', fontSize: 12 },
  segTextActive: { color: '#c084fc', fontWeight: '800', fontSize: 12 },

  /* Colors */
  colorGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginVertical: 10 },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: '#fff' },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },

  /* Save */
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 14,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
