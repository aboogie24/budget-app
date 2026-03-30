import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchUserTransactions, fetchInvestmentHoldings, fetchAccountBalances, fetchProperties } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { useTheme } from '@/utils/ThemeContext';
import { GlassCard } from '@/components/GlassCard';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { DrawerNavigation } from '@/components/DrawerNavigation';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { componentDefaults } from '@/utils/theme';

type Tx = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category?: string;
  date: string;
  frequency?: string;
  color?: string;
  category_name?: string;
};

export default function DashboardScreenV2() {
  const router = useRouter();
  const { themeValues, theme } = useTheme();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [debtSummary, setDebtSummary] = useState({ total: 0, minPayment: 0, count: 0 });
  const [savingsSummary, setSavingsSummary] = useState({ totalTarget: 0, totalCurrent: 0, count: 0 });
  const [billsSummary, setBillsSummary] = useState({ paid: 0, total: 0 });
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchUserTransactions();
      if (data) setTransactions(data as Tx[]);

      const user = await getCurrentUser();
      if (user) setUserName(user.full_name || user.email || null);

      if (!user?.id) return;

      try {
        const debts = await api.get(`/auth/debts`, { user_id: user.id });
        const debtsArray = Array.isArray(debts) ? debts : [];
        const totalDebt = debtsArray.reduce((sum, d) => sum + (d.balance || 0), 0);
        const minPayments = debtsArray.reduce((sum, d) => sum + (d.min_payment || 0), 0);
        setDebtSummary({ total: totalDebt, minPayment: minPayments, count: debtsArray.length });
      } catch (e) {
        console.error('Debts fetch error:', e);
      }

      try {
        const goals = await api.get(`/auth/savings-goals`, { user_id: user.id });
        const goalsArray = Array.isArray(goals) ? goals : [];
        const totalTarget = goalsArray.reduce((sum, g) => sum + (g.target_amount || 0), 0);
        const totalCurrent = goalsArray.reduce((sum, g) => sum + (g.current_amount || 0), 0);
        setSavingsSummary({ totalTarget, totalCurrent, count: goalsArray.length });
      } catch (e) {
        console.error('Savings goals fetch error:', e);
      }

      try {
        const budgets = await api.get(`/auth/budgets/user/${user.id}`, { month: currentMonth, year: currentYear });
        setBudgetsData(Array.isArray(budgets) ? budgets : []);
      } catch (e) {
        console.error('Budgets fetch error:', e);
      }

      try {
        const bills = await api.get(`/auth/bills`, { user_id: user.id });
        const billsArr = Array.isArray(bills) ? bills : [];
        const paidCount = billsArr.filter((b: any) => b.status === 'paid').length;
        setBillsSummary({ paid: paidCount, total: billsArr.length });
      } catch (e) {
        console.error('Bills fetch error:', e);
      }

      try {
        const [holdingsData, balancesData, propsData] = await Promise.all([
          fetchInvestmentHoldings(),
          fetchAccountBalances('depository'),
          fetchProperties(),
        ]);
        const invTotal = (Array.isArray(holdingsData) ? holdingsData : []).reduce(
          (sum: number, h: any) => sum + (h.institution_value || 0), 0
        );
        setInvestmentTotal(invTotal);
        const cash = (Array.isArray(balancesData) ? balancesData : []).reduce(
          (sum: number, a: any) => sum + (a.current_balance || 0), 0
        );
        setCashTotal(cash);
        const propTotal = (Array.isArray(propsData) ? propsData : []).reduce(
          (sum: number, p: any) => sum + (p.manual_value || p.zestimate || 0), 0
        );
        setPropertyTotal(propTotal);
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, currentMonth, currentYear]);

  useEffect(() => {
    setLoading(true);
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const expenseData = transactions.filter((t) => t.type === 'expense');
  const incomeData = transactions.filter((t) => t.type === 'income');
  const totalIncome = incomeData.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpenses = expenseData.reduce((sum, t) => sum + (t.amount || 0), 0);

  const countOccurrencesInMonth = (startDate?: string, frequency?: string) => {
    const freq = (frequency || '').toLowerCase();
    const start = startDate ? new Date(startDate) : monthStart;
    if (start > monthEnd) return 0;
    if (freq === 'weekly' || freq === 'biweekly') {
      const step = freq === 'weekly' ? 7 : 14;
      let count = 0;
      const current = new Date(Math.max(start.getTime(), monthStart.getTime()));
      current.setDate(current.getDate() + ((7 + start.getDay() - current.getDay()) % 7));
      while (current <= monthEnd) {
        count++;
        current.setDate(current.getDate() + step);
      }
      return count;
    }
    if (freq === '1st-15th') return 2;
    if (freq === 'monthly' || freq === '') return 1;
    return 1;
  };

  const budgetIncomeTotal = budgetsData
    .filter((b) => (b.type || '').toLowerCase() === 'income')
    .reduce((sum, b) => sum + (b.amount || 0) * countOccurrencesInMonth(b.start_date, b.frequency), 0);
  const budgetExpenseTotal = budgetsData
    .filter((b) => (b.type || '').toLowerCase() === 'expense')
    .reduce((sum, b) => sum + (b.amount || 0) * countOccurrencesInMonth(b.start_date, b.frequency), 0);

  const budgetPercent =
    budgetsData.length && budgetIncomeTotal
      ? Math.max(0, Math.min(100, Math.round(100 - (budgetExpenseTotal / budgetIncomeTotal) * 100)))
      : 0;
  const savingsPercent = savingsSummary.totalTarget
    ? Math.round((savingsSummary.totalCurrent / savingsSummary.totalTarget) * 100)
    : 0;
  const billsPercent = billsSummary.total > 0 ? Math.round((billsSummary.paid / billsSummary.total) * 100) : 0;
  const netWorth = cashTotal + investmentTotal + propertyTotal - debtSummary.total;

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });

  const fabActions = [
    { id: '1', icon: 'card-outline', label: 'Expense', color: '#ef4444', onPress: () => router.push('/add-transaction') },
    { id: '2', icon: 'trending-up-outline', label: 'Income', color: '#10b981', onPress: () => router.push('/add-transaction') },
    { id: '3', icon: 'calendar-outline', label: 'Bill', color: '#3b82f6', onPress: () => router.push('/bills') },
    { id: '4', icon: 'piggy-bank-outline', label: 'Goal', color: '#f59e0b', onPress: () => router.push('/savings') },
  ];

  const drawerItems = [
    { id: '1', icon: 'home-outline', label: 'Dashboard', onPress: () => {} },
    { id: '2', icon: 'wallet-outline', label: 'Budgets', onPress: () => router.push('/(tabs)/budget') },
    { id: '3', icon: 'calendar-outline', label: 'Bills', onPress: () => router.push('/bills') },
    { id: '4', icon: 'card-outline', label: 'Debts', onPress: () => router.push('/debts') },
    { id: '5', icon: 'piggy-bank-outline', label: 'Savings', onPress: () => router.push('/savings') },
    { id: '6', icon: 'trending-up-outline', label: 'Investments', onPress: () => router.push('/investments') },
    { id: '7', icon: 'settings-outline', label: 'Settings', onPress: () => router.push('/(tabs)/settings') },
  ];

  return (
    <LinearGradient colors={themeValues.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: componentDefaults.spacing.lg, paddingBottom: 160 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <View style={[styles.logoBadge, { backgroundColor: `${themeValues.accent}20` }]}>
                <Ionicons name="heart-outline" size={16} color={themeValues.accent} />
              </View>
              <Text style={[styles.logoText, { color: themeValues.textPrimary }]}>CoupleFlow</Text>
            </View>
            <TouchableOpacity onPress={() => setDrawerOpen(true)}>
              <Ionicons name="menu-outline" size={24} color={themeValues.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Greeting */}
          <View style={{ marginTop: componentDefaults.spacing.lg }}>
            <Text style={[styles.greetingSub, { color: themeValues.textMuted }]}>Good afternoon,</Text>
            <Text style={[styles.greeting, { color: themeValues.textPrimary }]}>
              {userName || 'You'} <Text style={{ color: themeValues.accent }}>{"\u2764"}</Text>
            </Text>
          </View>

          {/* Error State */}
          {error && (
            <GlassCard
              variant="light"
              style={{ marginTop: componentDefaults.spacing.md }}
              padding={componentDefaults.spacing.md}
            >
              <View style={{ flexDirection: 'row', gap: componentDefaults.spacing.md }}>
                <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: themeValues.textPrimary, fontWeight: '600' }]}>
                    Failed to load data
                  </Text>
                  <Text style={[{ color: themeValues.textMuted, fontSize: 12 }]}>{error}</Text>
                </View>
                <TouchableOpacity onPress={loadDashboard} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={16} color={themeValues.accent} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}

          {/* Progress Cards */}
          {loading ? (
            <>
              <SkeletonCard lines={4} style={{ marginTop: componentDefaults.spacing.lg }} />
              <SkeletonCard lines={3} />
            </>
          ) : (
            <>
              <GlassCard
                variant="default"
                style={{ marginTop: componentDefaults.spacing.lg }}
                padding={componentDefaults.spacing.lg}
              >
                <Text style={[styles.sectionLabel, { color: themeValues.textSecondary }]}>This Month's Progress</Text>
                <View style={styles.progressRow}>
                  {[
                    {
                      label: 'Budget',
                      percent: isNaN(budgetPercent) ? 0 : budgetPercent,
                      sub: `${formatCurrency(Math.max(budgetIncomeTotal - budgetExpenseTotal, 0))}`,
                    },
                    { label: 'Savings', percent: isNaN(savingsPercent) ? 0 : savingsPercent, sub: `${formatCurrency(savingsSummary.totalCurrent)}` },
                    { label: 'Bills', percent: isNaN(billsPercent) ? 0 : billsPercent, sub: `${billsSummary.paid} of ${billsSummary.total}` },
                  ].map((item) => (
                    <View key={item.label} style={styles.progressItem}>
                      <View
                        style={[
                          styles.ringOuter,
                          {
                            borderColor: `${themeValues.accent}30`,
                            backgroundColor: `${themeValues.accent}10`,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.ringInner,
                            { width: `${item.percent}%`, backgroundColor: themeValues.accent },
                          ]}
                        />
                        <Text style={[styles.ringText, { color: themeValues.textPrimary }]}>{item.percent}%</Text>
                      </View>
                      <Text style={[styles.progressLabel, { color: themeValues.textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.progressSub, { color: themeValues.textMuted }]}>{item.sub}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>

              {/* Net Worth */}
              {(cashTotal > 0 || investmentTotal > 0 || propertyTotal > 0 || debtSummary.total > 0) && (
                <GlassCard
                  variant="default"
                  style={{ marginTop: componentDefaults.spacing.lg }}
                  padding={componentDefaults.spacing.lg}
                >
                  <Text style={[styles.sectionLabel, { color: themeValues.textSecondary }]}>Net Worth</Text>
                  <View style={{ marginTop: componentDefaults.spacing.md, gap: componentDefaults.spacing.sm }}>
                    {cashTotal > 0 && (
                      <View style={styles.nwRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: componentDefaults.spacing.md }}>
                          <Ionicons name="wallet-outline" size={16} color="#60a5fa" />
                          <Text style={[styles.nwLabel, { color: themeValues.textSecondary }]}>Cash</Text>
                        </View>
                        <Text style={[styles.nwValue, { color: '#60a5fa' }]}>{formatCurrency(cashTotal)}</Text>
                      </View>
                    )}
                    {investmentTotal > 0 && (
                      <TouchableOpacity style={styles.nwRow} onPress={() => router.push('/investments' as any)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: componentDefaults.spacing.md }}>
                          <Ionicons name="trending-up-outline" size={16} color="#34d399" />
                          <Text style={[styles.nwLabel, { color: themeValues.textSecondary }]}>Investments</Text>
                        </View>
                        <Text style={[styles.nwValue, { color: '#34d399' }]}>{formatCurrency(investmentTotal)}</Text>
                      </TouchableOpacity>
                    )}
                    {debtSummary.total > 0 && (
                      <TouchableOpacity style={styles.nwRow} onPress={() => router.push('/debts' as any)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: componentDefaults.spacing.md }}>
                          <Ionicons name="card-outline" size={16} color="#f87171" />
                          <Text style={[styles.nwLabel, { color: themeValues.textSecondary }]}>Debts</Text>
                        </View>
                        <Text style={[styles.nwValue, { color: '#f87171' }]}>-{formatCurrency(debtSummary.total)}</Text>
                      </TouchableOpacity>
                    )}
                    <View style={[styles.nwDivider, { backgroundColor: `${themeValues.textMuted}20` }]} />
                    <View style={styles.nwRow}>
                      <Text style={[styles.nwTotalLabel, { color: themeValues.textPrimary }]}>Net Worth</Text>
                      <Text
                        style={[
                          styles.nwTotalValue,
                          { color: netWorth >= 0 ? '#34d399' : '#f87171' },
                        ]}
                      >
                        {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth))}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              )}

              {/* Recent Activity */}
              {transactions.length > 0 ? (
                <View style={{ marginTop: componentDefaults.spacing.lg }}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionLabel, { color: themeValues.textSecondary, marginBottom: 0 }]}>Recent Activity</Text>
                    <TouchableOpacity onPress={() => router.push('/transaction/list')}>
                      <Text style={[styles.viewAllText, { color: themeValues.accent }]}>View all</Text>
                    </TouchableOpacity>
                  </View>
                  {transactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 3)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.activityCard,
                          {
                            backgroundColor: themeValues.glassLight.backgroundColor,
                            borderColor: themeValues.glassLight.borderColor,
                          },
                        ]}
                        onPress={() =>
                          router.push({
                            pathname: '/transaction/[id]',
                            params: { id: item.id, type: item.type, amount: String(item.amount), note: item.note },
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.activityIcon,
                            {
                              backgroundColor:
                                item.type === 'expense'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(16, 185, 129, 0.15)',
                            },
                          ]}
                        >
                          <Ionicons
                            name={item.type === 'expense' ? 'cart-outline' : 'trending-up-outline'}
                            size={20}
                            color={item.type === 'expense' ? '#ef4444' : '#10b981'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.activityTitle, { color: themeValues.textPrimary }]}>
                            {item.category || item.category_name || 'Transaction'}
                          </Text>
                          <Text style={[styles.activitySub, { color: themeValues.textMuted }]}>
                            {item.note || item.type}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.activityAmount,
                            { color: item.type === 'expense' ? '#ef4444' : '#10b981' },
                          ]}
                        >
                          {item.type === 'expense' ? '-' : '+'}
                          {formatCurrency(item.amount)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              ) : (
                <EmptyState
                  icon="list-outline"
                  title="No transactions yet"
                  description="Start tracking your finances by adding your first transaction"
                  actionLabel="Add transaction"
                  onAction={() => router.push('/add-transaction')}
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <FloatingActionButton actions={fabActions} />

      {/* Drawer */}
      <DrawerNavigation isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} items={drawerItems} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: componentDefaults.spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: componentDefaults.spacing.sm },
  logoBadge: { padding: componentDefaults.spacing.sm, borderRadius: componentDefaults.borderRadius.sm },
  logoText: { fontWeight: '700', fontSize: componentDefaults.fontSize.lg },
  greetingSub: { fontSize: componentDefaults.fontSize.md },
  greeting: { fontSize: componentDefaults.fontSize['3xl'], fontWeight: '800' },
  sectionLabel: { fontSize: componentDefaults.fontSize.md, fontWeight: '700', marginBottom: componentDefaults.spacing.md },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressItem: { alignItems: 'center', flex: 1 },
  ringOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: componentDefaults.spacing.sm,
  },
  ringInner: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    height: 6,
    borderRadius: 12,
  },
  ringText: { fontWeight: '800', fontSize: componentDefaults.fontSize.lg },
  progressLabel: { fontWeight: '700', fontSize: componentDefaults.fontSize.md },
  progressSub: { fontSize: componentDefaults.fontSize.xs },
  nwRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nwLabel: { fontSize: componentDefaults.fontSize.md },
  nwValue: { fontWeight: '700', fontSize: componentDefaults.fontSize.md },
  nwDivider: { height: 1, marginVertical: componentDefaults.spacing.sm },
  nwTotalLabel: { fontWeight: '800', fontSize: componentDefaults.fontSize.lg },
  nwTotalValue: { fontWeight: '800', fontSize: componentDefaults.fontSize.xl },
  activityCard: {
    borderRadius: componentDefaults.borderRadius.md,
    padding: componentDefaults.spacing.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: componentDefaults.spacing.md,
    marginBottom: componentDefaults.spacing.md,
  },
  activityIcon: { width: 40, height: 40, borderRadius: componentDefaults.borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontWeight: '700', fontSize: componentDefaults.fontSize.md },
  activitySub: { fontSize: componentDefaults.fontSize.xs },
  activityAmount: { fontWeight: '800', fontSize: componentDefaults.fontSize.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: componentDefaults.spacing.md },
  viewAllText: { fontWeight: '700', fontSize: componentDefaults.fontSize.sm },
});
