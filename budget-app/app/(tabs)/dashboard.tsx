import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchUserTransactions, fetchInvestmentHoldings, fetchAccountBalances } from '@/utils/api';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';

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

export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [debtSummary, setDebtSummary] = useState({ total: 0, minPayment: 0, count: 0 });
  const [savingsSummary, setSavingsSummary] = useState({ totalTarget: 0, totalCurrent: 0, count: 0 });
  const [billsSummary, setBillsSummary] = useState({ paid: 0, total: 0 });
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);

  const loadDashboard = useCallback(async () => {
    const data = await fetchUserTransactions();
    if (data) setTransactions(data as Tx[]);

    const user = await getCurrentUser();
    if (user) setUserName(user.full_name || user.email || null);

    if (!user?.id) return;
    const authHeaders = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;

    const debtsRes = await fetch(`${API_URL}/auth/debts?user_id=${user.id}`, { credentials: 'include', headers: authHeaders });
    const debts = debtsRes.ok ? await debtsRes.json() : [];
    const totalDebt = (Array.isArray(debts) ? debts : []).reduce((sum, d) => sum + (d.balance || 0), 0);
    const minPayments = (Array.isArray(debts) ? debts : []).reduce((sum, d) => sum + (d.min_payment || 0), 0);
    setDebtSummary({ total: totalDebt, minPayment: minPayments, count: Array.isArray(debts) ? debts.length : 0 });

    const savingsRes = await fetch(`${API_URL}/auth/savings-goals?user_id=${user.id}`, { credentials: 'include', headers: authHeaders });
    const goals = savingsRes.ok ? await savingsRes.json() : [];
    const totalTarget = (Array.isArray(goals) ? goals : []).reduce((sum, g) => sum + (g.target_amount || 0), 0);
    const totalCurrent = (Array.isArray(goals) ? goals : []).reduce((sum, g) => sum + (g.current_amount || 0), 0);
    setSavingsSummary({ totalTarget, totalCurrent, count: Array.isArray(goals) ? goals.length : 0 });

    const budgetRes = await fetch(`${API_URL}/budgets/user/${user.id}?month=${currentMonth}&year=${currentYear}`, {
      credentials: 'include',
      headers: authHeaders,
    });
    const budgets = budgetRes.ok ? await budgetRes.json() : [];
    setBudgetsData(Array.isArray(budgets) ? budgets : []);

    const billsRes = await fetch(`${API_URL}/auth/bills?user_id=${user.id}`, { credentials: 'include', headers: authHeaders });
    const bills = billsRes.ok ? await billsRes.json() : [];
    const billsArr = Array.isArray(bills) ? bills : [];
    const paidCount = billsArr.filter((b: any) => b.status === 'paid').length;
    setBillsSummary({ paid: paidCount, total: billsArr.length });

    try {
      const [holdingsData, balancesData] = await Promise.all([
        fetchInvestmentHoldings(),
        fetchAccountBalances('depository'),
      ]);
      const invTotal = (Array.isArray(holdingsData) ? holdingsData : []).reduce(
        (sum: number, h: any) => sum + (h.institution_value || 0), 0
      );
      setInvestmentTotal(invTotal);
      const cash = (Array.isArray(balancesData) ? balancesData : []).reduce(
        (sum: number, a: any) => sum + (a.current_balance || 0), 0
      );
      setCashTotal(cash);
    } catch {}
  }, [API_URL, currentMonth, currentYear]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

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
      // align to same weekday as start
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
  const netWorth = cashTotal + investmentTotal - debtSummary.total;

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="heart-outline" size={16} color="#c084fc" />
              </View>
            <Text style={styles.logoText}>CoupleFlow</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push('/insights' as any)}>
              <Ionicons name="bar-chart-outline" size={20} color="#cbd5e1" />
            </TouchableOpacity>
            <Ionicons name="sunny-outline" size={18} color="#cbd5e1" />
          </View>
        </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.greetingSub}>Afternoon,</Text>
            <Text style={styles.greeting}>
              {userName || 'You'} <Text style={{ color: '#c084fc' }}>{"\u2764"}</Text>
            </Text>
          </View>

        <View style={styles.card}>
          <View style={styles.alertRow}>
            <Ionicons name="sparkles-outline" size={18} color="#c084fc" />
            <Text style={styles.alertText}>You stayed under groceries this week — nicely done! 🎉</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>This Month's Progress</Text>
          <View style={styles.progressRow}>
            {[
              {
                label: 'Budget',
                percent: isNaN(budgetPercent) ? 0 : budgetPercent,
                sub: `${formatCurrency(Math.max(budgetIncomeTotal - budgetExpenseTotal, 0))} `,
              },
              { label: 'Savings', percent: isNaN(savingsPercent) ? 0 : savingsPercent, sub: `${formatCurrency(savingsSummary.totalCurrent)} / ${formatCurrency(savingsSummary.totalTarget)}` },
              { label: 'Bills', percent: isNaN(billsPercent) ? 0 : billsPercent, sub: `${billsSummary.paid} of ${billsSummary.total} paid` },
            ].map((item) => (
              <View key={item.label} style={styles.progressItem}>
                <View style={styles.ringOuter}>
                  <View style={[styles.ringInner, { width: `${item.percent}%` }]} />
                  <Text style={styles.ringText}>{item.percent}%</Text>
                </View>
                <Text style={styles.progressLabel}>{item.label}</Text>
                <Text style={styles.progressSub}>{item.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {(cashTotal > 0 || investmentTotal > 0 || debtSummary.total > 0) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Net Worth</Text>
            <View style={{ marginTop: 4, gap: 6 }}>
              {cashTotal > 0 && (
                <View style={styles.nwRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="wallet-outline" size={16} color="#60a5fa" />
                    <Text style={styles.nwLabel}>Cash</Text>
                  </View>
                  <Text style={[styles.nwValue, { color: '#60a5fa' }]}>{formatCurrency(cashTotal)}</Text>
                </View>
              )}
              {investmentTotal > 0 && (
                <TouchableOpacity style={styles.nwRow} onPress={() => router.push('/investments' as any)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="trending-up-outline" size={16} color="#34d399" />
                    <Text style={styles.nwLabel}>Investments</Text>
                  </View>
                  <Text style={[styles.nwValue, { color: '#34d399' }]}>{formatCurrency(investmentTotal)}</Text>
                </TouchableOpacity>
              )}
              {debtSummary.total > 0 && (
                <TouchableOpacity style={styles.nwRow} onPress={() => router.push('/debts' as any)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="card-outline" size={16} color="#f87171" />
                    <Text style={styles.nwLabel}>Debts</Text>
                  </View>
                  <Text style={[styles.nwValue, { color: '#f87171' }]}>-{formatCurrency(debtSummary.total)}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.nwDivider} />
              <View style={styles.nwRow}>
                <Text style={styles.nwTotalLabel}>Net Worth</Text>
                <Text style={[styles.nwTotalValue, { color: netWorth >= 0 ? '#34d399' : '#f87171' }]}>
                  {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth))}
                </Text>
              </View>
            </View>
          </View>
        )}

          <View style={styles.cardMuted}>
            <Text style={styles.cardMutedText}>Viewing shared household activity</Text>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionLabel}>Recent Activity</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() =>
                router.push({
                  pathname: '/transaction/list',
                })
              }
            >
              <Text style={styles.viewAllText}>View all</Text>
              <Ionicons name="chevron-forward" size={16} color="#f8fafc" />
            </TouchableOpacity>
            {transactions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 3)
              .map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.activityCard}
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: {
                        id: item.id,
                        type: item.type,
                        amount: String(item.amount),
                        note: item.note,
                        category_name: item.category_name || item.category,
                        date: item.date,
                        source: item.source,
                      },
                    })
                  }
                >
                  <View
                    style={[
                      styles.activityIcon,
                      { backgroundColor: item.type === 'expense' ? 'rgba(255,255,255,0.08)' : 'rgba(16,185,129,0.1)' },
                    ]}
                  >
                    <Ionicons
                      name={item.type === 'expense' ? 'cart-outline' : 'trending-up-outline'}
                      size={20}
                      color={item.type === 'expense' ? '#c084fc' : '#34d399'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{item.category || item.category_name || 'Transaction'}</Text>
                    <Text style={styles.activitySub}>{item.note || item.type}</Text>
                  </View>
                  <Text style={[styles.activityAmount, { color: item.type === 'expense' ? '#f87171' : '#34d399' }]}>
                    {item.type === 'expense' ? '-' : '+'}
                    {formatCurrency(item.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-transaction')}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>+</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 12 },
  logoText: { color: '#e5e7eb', fontWeight: '700', fontSize: 15 },
  greetingSub: { color: '#cbd5e1', fontSize: 14 },
  greeting: { color: '#f8fafc', fontSize: 26, fontWeight: '800' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 14,
  },
  cardMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 10,
  },
  cardMutedText: { color: '#cbd5e1', textAlign: 'center', fontWeight: '600' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertText: { color: '#e5e7eb', fontWeight: '600' },
  sectionLabel: { color: '#cbd5e1', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressItem: { alignItems: 'center', flex: 1 },
  ringOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ringInner: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    height: 6,
    borderRadius: 12,
    backgroundColor: '#c084fc',
  },
  ringText: { color: '#f8fafc', fontWeight: '800', fontSize: 18 },
  progressLabel: { color: '#e5e7eb', fontWeight: '700', fontSize: 13 },
  progressSub: { color: '#cbd5e1', fontSize: 12 },
  activityCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  activitySub: { color: '#cbd5e1', fontSize: 12 },
  activityAmount: { fontWeight: '800', fontSize: 15 },
  viewAllButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#a855f7',
    borderRadius: 12,
  },
  viewAllText: { color: '#f8fafc', fontWeight: '800', fontSize: 12 },
  nwRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nwLabel: { color: '#cbd5e1', fontSize: 13 },
  nwValue: { fontWeight: '700', fontSize: 14 },
  nwDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  nwTotalLabel: { color: '#f8fafc', fontWeight: '800', fontSize: 15 },
  nwTotalValue: { fontWeight: '800', fontSize: 18 },
  fab: {
    position: 'absolute',
    bottom: 90,
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
});
