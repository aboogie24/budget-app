import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import { useRouter } from 'expo-router';
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';

type Budget = {
  id: string;
  name: string;
  amount: number;
  type: string;
  household_id?: string | null;
  category_name?: string | null;
  category_id?: string | null;
  start_date?: string;
  frequency?: string;
};

type Category = { id: string; name: string; type: string };
type CategorySummary = {
  cat: Category;
  total: number;
  spent: number;
  left: number;
  percent: number;
  budgets: Budget[];
};

export default function BudgetScreen() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [shared, setShared] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [saving, setSaving] = useState(false);
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user?.id) return;
      const headers = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;
      const [budRes, catRes] = await Promise.all([
        fetch(`${API_URL}/budgets/user/${user.id}`, { credentials: 'include', headers }),
        fetch(`${API_URL}/categories/user/${user.id}`, { credentials: 'include', headers }),
      ]);
      if (budRes.ok) {
        const data = await budRes.json();
        setBudgets(Array.isArray(data) ? data : []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    };
    load();
  }, []);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (c.type || '').toLowerCase() === type),
    [categories, type]
  );

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const income = budgets.filter((b) => (b.type || '').toLowerCase() === 'income');
  const expense = budgets.filter((b) => (b.type || '').toLowerCase() === 'expense');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const expenseCategories = useMemo(
    () => categories.filter((c) => (c.type || '').toLowerCase() === 'expense'),
    [categories]
  );

  const categorySummaries: CategorySummary[] = useMemo(() => {
    return expenseCategories
      .map((cat) => {
        const catBudgets = expense.filter((b) => (b.category_id || '') === cat.id);
        const total = catBudgets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const spent = catBudgets.reduce((sum, b) => sum + (b.amount || 0) * 0.72, 0); // placeholder utilization
        const left = Math.max(total - spent, 0);
        const percent = total ? Math.min(100, Math.round((spent / total) * 100)) : 0;
        return { cat, total, spent, left, percent, budgets: catBudgets };
      })
      .filter((s) => s.budgets.length > 0);
  }, [expense, expenseCategories]);

  const visibleCategories = useMemo(
    () =>
      categorySummaries.filter((s) =>
        categoryFilter === 'all' ? true : s.cat.id === categoryFilter
      ),
    [categorySummaries, categoryFilter]
  );

  const totalBudget = visibleCategories.reduce((sum, s) => sum + s.total, 0);
  const totalSpent = visibleCategories.reduce((sum, s) => sum + s.spent, 0);
  const totalRemaining = Math.max(totalBudget - totalSpent, 0);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    if (!name.trim() || !amount || isNaN(Number(amount))) {
      return;
    }
    setSaving(true);
    const body: any = {
      id: uuidv4(),
      user_id: user.id,
      name: name.trim(),
      amount: parseFloat(amount),
      type,
      category_id: categoryId || null,
      frequency,
      start_date: new Date().toISOString(),
      household_id: shared ? undefined : '',
    };
    const headers = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;
    const res = await fetch(`${API_URL}/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved = await res.json();
      setBudgets((prev) => [...prev, saved]);
      setName('');
      setAmount('');
      setCategoryId('');
      setShared(false);
      setShowAdd(false);
    }
    setSaving(false);
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
                <Ionicons name="arrow-back" size={18} color="#e2e8f0" />
              </TouchableOpacity>
              <Text style={styles.logoText}>Budgets</Text>
            </View>
            <Ionicons name="sparkles-outline" size={20} color="#cbd5e1" />
          </View>

          <View style={styles.monthSwitcher}>
            <Ionicons name="chevron-back" size={16} color="#cbd5e1" />
            <Text style={styles.monthLabel}>Dec 2025</Text>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>Monthly Overview</Text>
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>
                  {totalBudget ? `${Math.round((totalSpent / Math.max(totalBudget, 1)) * 100)}% used` : '0% used'}
                </Text>
              </View>
            </View>
            <View style={styles.overviewRow}>
              <View>
                <Text style={styles.subText}>Total Budget</Text>
                <Text style={styles.value}>{formatCurrency(totalBudget)}</Text>
              </View>
              <View>
                <Text style={styles.subText}>Spent</Text>
                <Text style={[styles.value, { color: '#f59e0b' }]}>{formatCurrency(totalSpent)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.subText}>Remaining</Text>
                <Text style={[styles.value, { color: '#22c55e' }]}>{formatCurrency(totalRemaining)}</Text>
              </View>
            </View>
            <View style={styles.progressBarTrackWide}>
              <View
                style={[
                  styles.progressBarFillWide,
                  { width: `${totalBudget ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}%` },
                ]}
              />
            </View>
            <View style={styles.overviewFooter}>
              <Text style={styles.footerText}>{formatCurrency(totalSpent)} spent</Text>
              <Text style={styles.footerText}>{formatCurrency(totalRemaining)} left</Text>
            </View>
          </View>

          <View style={styles.alertCard}>
            <View style={styles.iconCircleAlt}>
              <Ionicons name="sparkles" size={18} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Spending Alert</Text>
              <Text style={styles.alertText}>
                You are close to your dining budget. Consider cooking at home this weekend to stay on track!
              </Text>
              <TouchableOpacity style={styles.suggestionBtn}>
                <Text style={styles.suggestionText}>View Suggestions</Text>
                <Ionicons name="arrow-forward" size={14} color="#c084fc" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>Categories ({visibleCategories.length})</Text>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() =>
                setCategoryFilter((prev) => (prev === 'all' ? (expenseCategories[0]?.id || 'all') : 'all'))
              }
            >
              <Ionicons name="filter" size={16} color="#cbd5e1" />
              <Text style={styles.filterText}>{categoryFilter === 'all' ? 'All' : 'Filtered'}</Text>
            </TouchableOpacity>
          </View>

          {visibleCategories.map((catSummary) => {
            const { cat, total, spent, left, percent, budgets: catBudgets } = catSummary;
            const alertLabel = percent >= 100 ? 'Over budget' : percent >= 90 ? 'Approaching limit' : '';
            const alertColor = percent >= 100 ? '#f87171' : '#fbbf24';
            const firstBudget = catBudgets[0];
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.budgetCard}
                onPress={() =>
                  firstBudget
                    ? router.push({
                        pathname: '/budget/edit/[id]',
                        params: {
                          id: firstBudget.id,
                          name: firstBudget.name,
                          amount: String(firstBudget.amount),
                          type: firstBudget.type,
                          category_id: firstBudget.category_id || '',
                          household_id: firstBudget.household_id || '',
                          frequency: firstBudget.frequency || '',
                          start_date: firstBudget.start_date || '',
                        },
                      })
                    : null
                }
              >
                <View style={styles.budgetHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="cart-outline" size={18} color="#c084fc" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.budgetTitle}>{cat.name}</Text>
                    <Text style={styles.budgetSub}>
                      {formatCurrency(spent)} of {formatCurrency(total)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.percent}>{percent}%</Text>
                    {firstBudget?.household_id ? <Text style={styles.sharedBadge}>Shared</Text> : null}
                  </View>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(percent, 100)}%` }]} />
                </View>
                <View style={styles.budgetFooter}>
                  <View>
                    <Text style={styles.footerText}>{formatCurrency(spent)} spent</Text>
                    <Text style={styles.footerText}>Recent</Text>
                    <Text style={styles.footerTextFaint}>
                      {catBudgets.length > 1 ? `${catBudgets.length} items` : '-'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <TouchableOpacity>
                      <Text style={styles.viewAll}>View all</Text>
                    </TouchableOpacity>
                    <Text style={styles.footerText}>{formatCurrency(left)} left</Text>
                  </View>
                </View>
                {alertLabel ? (
                  <View style={[styles.alertPillRow, { borderColor: alertColor + '55' }]}>
                    <Ionicons name={alertLabel === 'Over budget' ? 'warning' : 'alert-circle'} size={14} color={alertColor} />
                    <Text style={[styles.alertPillText, { color: alertColor }]}>{alertLabel}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>

        <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>New Budget</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Ionicons name="close" size={20} color="#e5e7eb" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.sheetLabel}>Budget Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Groceries"
                  placeholderTextColor="#cbd5e1"
                  style={styles.sheetInput}
                />

                <Text style={styles.sheetLabel}>Category</Text>
                <View style={styles.categoryGrid}>
                  {filteredCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catPill, categoryId === cat.id && styles.catPillActive]}
                      onPress={() => setCategoryId(cat.id)}
                    >
                      <Text style={styles.catText}>{cat.name}</Text>
                      {categoryId === cat.id ? <Ionicons name="checkmark" size={14} color="#c084fc" /> : null}
                    </TouchableOpacity>
                  ))}
                  {!filteredCategories.length && <Text style={{ color: '#cbd5e1' }}>No categories for this type.</Text>}
                </View>

                <Text style={styles.sheetLabel}>Monthly Limit</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="$0"
                  placeholderTextColor="#cbd5e1"
                  keyboardType="numeric"
                  style={styles.sheetInput}
                />

                <View style={styles.toggleRow}>
                  {(['expense', 'income'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.toggle, type === t && styles.toggleActive]}
                      onPress={() => setType(t)}
                    >
                      <Text style={type === t ? styles.toggleTextActive : styles.toggleText}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.toggleRow}>
                  <Text style={[styles.sheetLabel, { flex: 1, marginBottom: 0 }]}>Share with partner</Text>
                  <Switch
                    value={shared}
                    onValueChange={setShared}
                    thumbColor="#fff"
                    trackColor={{ true: '#c084fc', false: '#475569' }}
                  />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? 'Saving...' : 'Create Budget'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { color: '#e5e7eb', fontWeight: '700', fontSize: 15 },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  monthLabel: { color: '#e5e7eb', fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  pillBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
  },
  pillText: { color: '#c084fc', fontWeight: '700', fontSize: 12 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  progressBarTrackWide: { height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginTop: 14 },
  progressBarFillWide: { height: 10, borderRadius: 12, backgroundColor: '#c084fc' },
  overviewFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  subText: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  value: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  alertCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
  },
  iconCircleAlt: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { color: '#e5e7eb', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  alertText: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
  suggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  suggestionText: { color: '#c084fc', fontWeight: '800' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterText: { color: '#e5e7eb', fontWeight: '700', fontSize: 12 },
  budgetCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 16 },
  budgetSub: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  percent: { color: '#c084fc', fontWeight: '800', fontSize: 16 },
  progressBarTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, marginTop: 12 },
  progressBarFill: { height: 8, backgroundColor: '#22c55e', borderRadius: 10 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footerText: { color: '#cbd5e1', fontSize: 12 },
  footerTextFaint: { color: 'rgba(226,232,240,0.5)', fontSize: 12 },
  viewAll: { color: '#c084fc', fontWeight: '700', fontSize: 12, marginBottom: 6 },
  listTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  listAmount: { color: '#c084fc', fontWeight: '700' },
  sharedBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    color: '#c084fc',
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#b26ef8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(18,10,44,0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: Dimensions.get('window').height * 0.75,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  sheetLabel: { color: '#cbd5e1', fontWeight: '700', marginBottom: 6 },
  sheetInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#f8fafc',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catPillActive: { borderColor: '#c084fc', backgroundColor: 'rgba(192,132,252,0.12)' },
  catText: { color: '#f8fafc', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  alertPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  alertPillText: { fontWeight: '700', fontSize: 12 },
});
