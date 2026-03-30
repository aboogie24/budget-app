import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Dimensions, Platform, Modal, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import DateTimePicker from '@react-native-community/datetimepicker';
import { checkBudgetThresholds } from '@/utils/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { ProgressRing } from '@/components/ProgressRing';

type Category = { id: string; name: string; type: string; budget_id?: string | null };

type CategorySummary = { id: string; name: string; spent: number };

type BudgetSummaryItem = {
  id: string;
  name: string;
  type: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percent: number;
  frequency: string;
  household_id?: string | null;
  is_shared?: boolean;
  categories: CategorySummary[];
  source?: string;
};

type SummaryResponse = {
  month: number;
  year: number;
  total_income: number;
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  budgets: BudgetSummaryItem[];
};

export default function BudgetScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [shared, setShared] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [budgetFilter, setBudgetFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });
  const [alertedBudgets, setAlteredBudgets] = useState<Record<string, { percent: number; threshold: number }>>({});
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const date = new Date(monthYear.year, monthYear.month, 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }, [monthYear]);

  const changeMonth = useCallback((delta: number) => {
    setMonthYear((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { month: next.getMonth(), year: next.getFullYear() };
    });
  }, []);

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    try {
      const [data, catData] = await Promise.all([
        api.get(`/auth/budgets/user/${user.id}/summary`, { month: monthYear.month + 1, year: monthYear.year }),
        api.get(`/auth/categories/user/${user.id}`),
      ]);
      const summary: SummaryResponse = data;
      setSummary(summary);
      setCategories(Array.isArray(catData) ? catData : []);
      setError(null);
      setLoading(false);
    } catch (e) {
      console.error('Budget screen fetch error', e);
      setError('Failed to load budgets');
      setLoading(false);
    }
  }, [monthYear.month, monthYear.year]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Check budget thresholds on screen focus
      const checkThresholds = async () => {
        try {
          const alerts = await checkBudgetThresholds();
          const alertMap: Record<string, { percent: number; threshold: number }> = {};
          if (Array.isArray(alerts)) {
            alerts.forEach((alert: any) => {
              if (alert.over_threshold || alert.percentUsed >= alert.threshold_percent) {
                alertMap[alert.budget_id] = {
                  percent: alert.percent_used,
                  threshold: alert.threshold_percent,
                };
              }
            });
          }
          setAlteredBudgets(alertMap);
        } catch (e) {
          console.error('Failed to check budget thresholds', e);
        }
      };
      checkThresholds();
    }, [loadData])
  );

  useEffect(() => {
    setCategoryId('');
  }, [type]);

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const totalIncome = summary?.total_income ?? 0;
  const totalBudgeted = summary?.total_budgeted ?? 0;
  const totalSpent = summary?.total_spent ?? 0;
  const totalRemaining = summary?.total_remaining ?? 0;
  const budgetItems = summary?.budgets ?? [];

  const visibleBudgets = useMemo(
    () => budgetItems.filter((b) => (budgetFilter === 'all' ? true : b.id === budgetFilter)),
    [budgetItems, budgetFilter]
  );

  const budgetOnly = useMemo(() => visibleBudgets.filter((b) => b.source !== 'bill'), [visibleBudgets]);
  const billOnly = useMemo(() => visibleBudgets.filter((b) => b.source === 'bill'), [visibleBudgets]);
  const [budgetsExpanded, setBudgetsExpanded] = useState(true);
  const [billsExpanded, setBillsExpanded] = useState(true);

  const budgetsSummary = useMemo(() => {
    const incomeItems = budgetOnly.filter((b) => b.type === 'income');
    const expenseItems = budgetOnly.filter((b) => b.type !== 'income');
    const incomeTotal = incomeItems.reduce((s, b) => s + b.budgeted, 0);
    const expenseTotal = expenseItems.reduce((s, b) => s + b.budgeted, 0);
    const incomeCount = incomeItems.length;
    const expenseCount = expenseItems.length;
    return { incomeTotal, expenseTotal, incomeCount, expenseCount };
  }, [budgetOnly]);

  const billsSummary = useMemo(() => {
    const total = billOnly.reduce((s, b) => s + b.budgeted, 0);
    const paid = billOnly.filter((b) => b.spent >= b.budgeted && b.budgeted > 0).length;
    return { total, paid, count: billOnly.length };
  }, [billOnly]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const t = (c.type || '').toLowerCase();
      return t === type || t === '' || t === 'category';
    });
  }, [categories, type]);

  const handleSave = async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    if (!name.trim() || !amount || isNaN(Number(amount))) {
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        id: uuidv4(),
        user_id: user.id,
        name: name.trim(),
        amount: parseFloat(amount),
        type,
        category_id: categoryId || null,
        frequency,
        start_date: startDate.toISOString(),
        is_shared: shared,
      };
      await api.post(`/auth/budgets`, body);
      setName('');
      setAmount('');
      setCategoryId('');
      setShared(false);
      setShowAdd(false);
      loadData();
    } catch (e) {
      console.error('Failed to save budget:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
        >
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
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
              <Ionicons name="chevron-back" size={16} color="#cbd5e1" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </>
          ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>Monthly Overview</Text>
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>
                  {totalBudgeted
                    ? `${Math.round((totalSpent / Math.max(totalBudgeted, 1)) * 100)}% used`
                    : '0% used'}
                </Text>
              </View>
            </View>
            <View style={styles.overviewRow}>
              <View>
                <Text style={styles.subText}>Total Income</Text>
                <Text style={styles.value}>{formatCurrency(totalIncome)}</Text>
              </View>
              <View>
                <Text style={styles.subText}>Budgeted</Text>
                <Text style={[styles.value, { color: '#f59e0b' }]}>{formatCurrency(totalBudgeted)}</Text>
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
                  { width: `${totalBudgeted ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0}%` },
                ]}
              />
            </View>
            <View style={styles.overviewFooter}>
              <Text style={styles.footerText}>{formatCurrency(totalSpent)} spent</Text>
              <Text style={styles.footerText}>{formatCurrency(Math.max(totalBudgeted - totalSpent, 0))} left to spend</Text>
            </View>
          </View>

          {budgetItems.some((b) => b.percent >= 90) && (
            <View style={styles.alertCard}>
              <View style={styles.iconCircleAlt}>
                <Ionicons name="sparkles" size={18} color="#8b5cf6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>Spending Alert</Text>
                <Text style={styles.alertText}>
                  {budgetItems.filter((b) => b.percent >= 100).length > 0
                    ? `You've exceeded ${budgetItems.filter((b) => b.percent >= 100).map((b) => b.name).join(', ')} budget(s).`
                    : `You're close to your ${budgetItems.filter((b) => b.percent >= 90).map((b) => b.name).join(', ')} budget(s). Consider cutting back to stay on track!`}
                </Text>
              </View>
            </View>
          )}

          {error && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                loadData();
              }}
            />
          )}

          {!error && budgetItems.length === 0 && (
            <EmptyState
              icon="wallet-outline"
              title="No budgets yet"
              description="Create your first budget to start tracking your spending and income"
              actionLabel="Create Budget"
              onAction={() => setShowAdd(true)}
            />
          )}

          {!error && budgetItems.length > 0 && (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.sectionLabel}>Overview</Text>
                <TouchableOpacity
                  style={styles.filterBtn}
                  onPress={() =>
                    setBudgetFilter((prev) => (prev === 'all' ? (budgetItems[0]?.id || 'all') : 'all'))
                  }
                >
                  <Ionicons name="filter" size={16} color="#cbd5e1" />
                  <Text style={styles.filterText}>{budgetFilter === 'all' ? 'All' : 'Filtered'}</Text>
                </TouchableOpacity>
              </View>

              {/* Budgets Section */}
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setBudgetsExpanded((v) => !v)}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(192,132,252,0.12)' }]}>
                <Ionicons name="wallet-outline" size={16} color="#c084fc" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Budgets ({budgetOnly.length})</Text>
                <Text style={styles.sectionSub}>
                  <Text style={{ color: '#34d399' }}>{budgetsSummary.incomeCount} income</Text>
                  {' · '}
                  <Text style={{ color: '#f87171' }}>{budgetsSummary.expenseCount} expense</Text>
                  {' · '}
                  {formatCurrency(budgetsSummary.incomeTotal - budgetsSummary.expenseTotal)} net
                </Text>
              </View>
            </View>
            <Ionicons name={budgetsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#cbd5e1" />
          </TouchableOpacity>

          {budgetsExpanded && budgetOnly.map((b) => {
            const isIncome = b.type === 'income';
            const accentColor = isIncome ? '#34d399' : '#f87171';
            const iconName = isIncome ? 'trending-up-outline' : 'trending-down-outline';
            const iconBg = isIncome ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)';
            const barColor = isIncome ? '#34d399' : '#22c55e';
            const alertLabel = b.spent > b.budgeted ? (isIncome ? 'Goal reached' : 'Over budget') : b.spent === b.budgeted && b.budgeted > 0 ? 'On target' : b.percent >= 90 ? (isIncome ? 'Almost there' : 'Approaching limit') : '';
            const alertColor = b.spent > b.budgeted ? (isIncome ? '#34d399' : '#f87171') : b.spent === b.budgeted ? '#34d399' : '#fbbf24';
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.budgetCard}
                onPress={() =>
                  router.push({
                    pathname: '/budget/edit/[id]',
                    params: {
                      id: b.id,
                      name: b.name,
                      amount: String(b.budgeted),
                      type: b.type,
                      category_id: '',
                      household_id: b.household_id || '',
                      is_shared: b.is_shared ? '1' : '0',
                      frequency: b.frequency || '',
                      start_date: '',
                    },
                  })
                }
              >
                <View style={styles.budgetHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                    <Ionicons name={iconName} size={18} color={accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.budgetTitle}>{b.name}</Text>
                      <View style={[styles.billStatusChip, { backgroundColor: isIncome ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }]}>
                        <Text style={[styles.billStatusText, { color: accentColor }]}>
                          {isIncome ? 'Income' : 'Expense'}
                        </Text>
                      </View>
                      {alertedBudgets[b.id] && !isIncome && (
                        <View style={[
                          styles.alertBadge,
                          { backgroundColor: alertedBudgets[b.id].percent >= 100 ? '#ef4444' : '#eab308' }
                        ]}>
                          <Ionicons
                            name={alertedBudgets[b.id].percent >= 100 ? 'warning' : 'alert-circle'}
                            size={12}
                            color="#fff"
                          />
                        </View>
                      )}
                    </View>
                    <Text style={styles.budgetSub}>
                      {formatCurrency(b.spent)} of {formatCurrency(b.budgeted)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <ProgressRing
                      progress={Math.min(b.percent / 100, 1)}
                      size={56}
                      strokeWidth={4}
                      color={b.percent > 80 ? '#ef4444' : b.percent > 60 ? '#f59e0b' : '#34d399'}
                      backgroundColor="rgba(255,255,255,0.1)"
                    />
                    {b.is_shared && (
                      <View style={styles.sharedBadgeNew}>
                        <Ionicons name="people" size={12} color="#a855f7" />
                        <Text style={styles.sharedBadgeText}>Shared</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(b.percent, 100)}%`, backgroundColor: barColor }]} />
                </View>
                <View style={styles.budgetFooter}>
                  <View>
                    <Text style={styles.footerText}>{formatCurrency(b.spent)} {isIncome ? 'earned' : 'spent'}</Text>
                    <Text style={styles.footerText}>Categories</Text>
                    <Text style={styles.footerTextFaint}>
                      {b.categories.length > 0 ? `${b.categories.length} items` : '-'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <TouchableOpacity>
                      <Text style={[styles.viewAll, { color: accentColor }]}>View all</Text>
                    </TouchableOpacity>
                    <Text style={styles.footerText}>{formatCurrency(b.remaining)} left</Text>
                  </View>
                </View>
                {alertLabel ? (
                  <View style={[styles.alertPillRow, { borderColor: alertColor + '55' }]}>
                    <Ionicons name={alertLabel === 'Over budget' ? 'warning' : alertLabel === 'Goal reached' || alertLabel === 'On target' ? 'checkmark-circle' : 'alert-circle'} size={14} color={alertColor} />
                    <Text style={[styles.alertPillText, { color: alertColor }]}>{alertLabel}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {/* Bills Section */}
          {billOnly.length > 0 && (
            <>
              <TouchableOpacity style={[styles.sectionHeader, { marginTop: 6 }]} onPress={() => setBillsExpanded((v) => !v)}>
                <View style={styles.sectionHeaderLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                    <Ionicons name="receipt-outline" size={16} color="#60a5fa" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Bills ({billOnly.length})</Text>
                    <Text style={styles.sectionSub}>
                      {billsSummary.paid} of {billsSummary.count} paid &middot; {formatCurrency(billsSummary.total)} total
                    </Text>
                  </View>
                </View>
                <Ionicons name={billsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#cbd5e1" />
              </TouchableOpacity>

              {billsExpanded && billOnly.map((b) => {
                const isPaid = b.spent >= b.budgeted && b.budgeted > 0;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.budgetCard}
                    onPress={() =>
                      router.push({
                        pathname: '/budget/edit/[id]',
                        params: {
                          id: b.id,
                          name: b.name,
                          amount: String(b.budgeted),
                          type: b.type,
                          category_id: '',
                          household_id: b.household_id || '',
                          is_shared: b.is_shared ? '1' : '0',
                          frequency: b.frequency || '',
                          start_date: '',
                        },
                      })
                    }
                  >
                    <View style={styles.budgetHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                        <Ionicons name="receipt-outline" size={18} color="#60a5fa" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.budgetTitle}>{b.name}</Text>
                          <View style={[styles.billStatusChip, isPaid ? styles.billStatusPaid : styles.billStatusUnpaid]}>
                            <Text style={[styles.billStatusText, { color: isPaid ? '#34d399' : '#fbbf24' }]}>
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.budgetSub}>
                          {formatCurrency(b.budgeted)} due
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {b.is_shared && (
                          <View style={styles.sharedBadgeNew}>
                            <Ionicons name="people" size={12} color="#a855f7" />
                            <Text style={styles.sharedBadgeText}>Shared</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(b.percent, 100)}%`, backgroundColor: isPaid ? '#34d399' : '#60a5fa' }]} />
                    </View>
                    <View style={styles.budgetFooter}>
                      <Text style={styles.footerText}>{formatCurrency(b.spent)} paid</Text>
                      <Text style={styles.footerText}>{formatCurrency(b.remaining)} remaining</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
            </>
          )}
          )}
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

                <Text style={styles.sheetLabel}>Start Date</Text>
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
  monthBtn: { padding: 4 },
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
  sharedBadgeNew: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  sharedBadgeText: {
    color: '#a855f7',
    fontWeight: '700',
    fontSize: 11,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toggleActive: {
    borderColor: '#c084fc',
    backgroundColor: 'rgba(192,132,252,0.15)',
  },
  toggleText: { color: '#cbd5e1', fontWeight: '700', textTransform: 'capitalize' },
  toggleTextActive: { color: '#c084fc', fontWeight: '700', textTransform: 'capitalize' },
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
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  datePickerText: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  datePickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(192,132,252,0.15)',
    marginBottom: 10,
  },
  datePickerDoneText: { color: '#c084fc', fontWeight: '700', fontSize: 13 },

  /* Collapsible section headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 15 },
  sectionSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },

  /* Bill status chips */
  billStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  billStatusPaid: { backgroundColor: 'rgba(52,211,153,0.12)' },
  billStatusUnpaid: { backgroundColor: 'rgba(251,191,36,0.12)' },
  billStatusText: { fontSize: 10, fontWeight: '700' },

  /* Alert badge for budget threshold */
  alertBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
