import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchUserTransactions, fetchInvestmentHoldings, fetchAccountBalances, fetchProperties, checkBudgetThresholds } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { DrawerNavigation } from '@/components/DrawerNavigation';
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg';

type Tx = {
  id: string;
  user_id?: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category?: string;
  date: string;
  frequency?: string;
  color?: string;
  category_name?: string;
  source?: string;
};

type HouseholdSummary = {
  household_id: string | null;
  household_name?: string;
  member_count?: number;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  total_debt: number;
  total_savings_target: number;
  total_savings_current: number;
  savings_progress: number;
};

type FrameworkLevel = {
  current_level: number;
  level_name: string;
  progress_percent: number;
  steps_completed: number;
  total_steps: number;
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
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const [householdSummary, setHouseholdSummary] = useState<HouseholdSummary | null>(null);
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [spendingAlertCount, setSpendingAlertCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nudges, setNudges] = useState<any[]>([]);
  const [frameworkLevel, setFrameworkLevel] = useState<FrameworkLevel | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<{ user_id: string; full_name: string; role: string }[]>([]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);

  const loadDashboard = useCallback(async () => {
    const data = await fetchUserTransactions();
    if (data) setTransactions(data as Tx[]);

    const user = await getCurrentUser();
    if (user) {
      setUserName(user.full_name || user.email || null);
      setUserId(user.id || null);
    }

    if (!user?.id) return;

    // Fetch household data — separate calls so member loading doesn't fail if summary fails
    try {
      const householdData = await api.get<any>(`/auth/households/me`, { user_id: user.id });
      const householdID = householdData?.household_id;

      if (householdID) {
        // Store household members for avatars (from the /me response)
        let members = householdData.members;
        if (typeof members === 'string') {
          try { members = JSON.parse(members); } catch {}
        }
        if (Array.isArray(members) && members.length > 0) {
          setHouseholdMembers(members);
          setIsSharedMode(true);
        }

        // Try summary separately — this can fail without breaking members
        try {
          const summary = await api.get<HouseholdSummary>(`/auth/households/summary`, { household_id: householdID });
          setHouseholdSummary(summary);
        } catch (summaryErr) {
          console.log('Household summary error (non-blocking):', summaryErr);
        }
      }
    } catch (e) {
      console.log('Household fetch error:', e);
    }

    // Load personal data as well (for comparison or fallback)
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
      const [holdingsData, balancesData, propsData, alertsData] = await Promise.all([
        fetchInvestmentHoldings(),
        fetchAccountBalances('depository'),
        fetchProperties(),
        checkBudgetThresholds().catch(() => []),
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
      setSpendingAlertCount(Array.isArray(alertsData) ? alertsData.length : 0);
    } catch {}

    // Load AI nudges
    try {
      const nudgeData = await api.get<any[]>('/auth/ai/nudges');
      setNudges(Array.isArray(nudgeData) ? nudgeData : []);
    } catch {}

    // Load framework level
    try {
      const levelData = await api.get<FrameworkLevel>('/auth/ai/framework-level');
      if (levelData) setFrameworkLevel(levelData);
    } catch {
      console.log('Framework level fetch skipped');
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  // Use household data if available, otherwise use personal data
  const displayDebtTotal = isSharedMode && householdSummary ? householdSummary.total_debt : debtSummary.total;
  const displaySavingsTarget = isSharedMode && householdSummary ? householdSummary.total_savings_target : savingsSummary.totalTarget;
  const displaySavingsCurrent = isSharedMode && householdSummary ? householdSummary.total_savings_current : savingsSummary.totalCurrent;
  const displayTotalIncome = isSharedMode && householdSummary ? householdSummary.total_income : 0;
  const displayTotalExpenses = isSharedMode && householdSummary ? householdSummary.total_expenses : 0;

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
  const savingsPercent = displaySavingsTarget
    ? Math.round((displaySavingsCurrent / displaySavingsTarget) * 100)
    : 0;
  const billsPercent = billsSummary.total > 0 ? Math.round((billsSummary.paid / billsSummary.total) * 100) : 0;
  const netWorth = cashTotal + investmentTotal + propertyTotal - displayDebtTotal;

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });

  const formatCompact = (v: number) => {
    if (Math.abs(v) >= 1000) {
      return '$' + (v / 1000).toFixed(1) + 'k';
    }
    return formatCurrency(v);
  };

  // Weekly spending computation from transactions
  const getWeeklySpending = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    // Get Monday of this week
    const monday = new Date(today);
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - diff);
    monday.setHours(0, 0, 0, 0);

    const dailyTotals = [0, 0, 0, 0, 0, 0, 0]; // M T W T F S S
    let weekTotal = 0;
    let myWeekTotal = 0;
    let partnerWeekTotal = 0;

    expenseData.forEach((t) => {
      const txDate = new Date(t.date);
      txDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((txDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        dailyTotals[diffDays] += t.amount || 0;
        weekTotal += t.amount || 0;
        const isPartnerTx = t.user_id && userId && String(t.user_id) !== String(userId);
        if (isPartnerTx) {
          partnerWeekTotal += t.amount || 0;
        } else {
          myWeekTotal += t.amount || 0;
        }
      }
    });

    return { dailyTotals, weekTotal, myWeekTotal, partnerWeekTotal };
  };

  const { dailyTotals, weekTotal: thisWeekTotal, myWeekTotal, partnerWeekTotal } = getWeeklySpending();
  // Weekly budget = budgeted income / 4 (what you can spend per week)
  // Falls back to budgeted expenses / 4 if no income budgets exist
  const weeklyBudget = budgetIncomeTotal > 0
    ? Math.round(budgetIncomeTotal / 4)
    : budgetExpenseTotal > 0
      ? Math.round(budgetExpenseTotal / 4)
      : 0;
  const weeklyPercentChange = weeklyBudget > 0 ? Math.round(((thisWeekTotal - weeklyBudget) / weeklyBudget) * 100) : 0;

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  // Time ago helper
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Mini progress ring component
  const MiniRing = ({ percent, size = 44, strokeWidth = 3, color = '#a855f7' }: { percent: number; size?: number; strokeWidth?: number; color?: string }) => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(percent, 100) / 100) * circ;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{Math.round(percent)}%</Text>
        </View>
      </View>
    );
  };

  const drawerItems = [
    { id: 'dashboard', icon: 'grid-outline', label: 'Dashboard', onPress: () => router.push('/(tabs)/dashboard') },
    { id: 'budgets', icon: 'pie-chart-outline', label: 'Budgets', onPress: () => router.push('/(tabs)/budget') },
    { id: 'transactions', icon: 'swap-horizontal-outline', label: 'Transactions', onPress: () => router.push('/transaction/list') },
    { id: 'bills', icon: 'receipt-outline', label: 'Bills', onPress: () => router.push('/bills') },
    { id: 'debts', icon: 'card-outline', label: 'Debts', onPress: () => router.push('/debts') },
    { id: 'savings', icon: 'trending-up-outline', label: 'Savings', onPress: () => router.push('/savings') },
    { id: 'priorities', icon: 'star-outline', label: 'Priorities', onPress: () => router.push('/priorities') },
    { id: 'investments', icon: 'briefcase-outline', label: 'Investments', onPress: () => router.push('/investments') },
    { id: 'properties', icon: 'home-outline', label: 'Properties', onPress: () => router.push('/properties') },
    { id: 'activity', icon: 'time-outline', label: 'Activity Feed', onPress: () => router.push('/activity-feed') },
    { id: 'accounts', icon: 'link-outline', label: 'Linked Accounts', onPress: () => router.push('/linked-accounts') },
  ];

  // Framework level steps
  const frameworkSteps = [
    { icon: 'home-outline' as const, label: 'Foundation' },
    { icon: 'flame-outline' as const, label: 'Debt Free' },
    { icon: 'shield-checkmark-outline' as const, label: 'Security' },
    { icon: 'trending-up-outline' as const, label: 'Grow' },
    { icon: 'star-outline' as const, label: 'Dream' },
  ];

  const currentLevelIndex = (frameworkLevel?.current_level ?? 1) - 1;
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayDayIndex = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // Convert Sun=0 to index 6, Mon=1 to index 0
  })();

  const maxBarValue = Math.max(...dailyTotals, 1);

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* ===== 1. HEADER - Greeting + Couple Avatars ===== */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingSub}>{getGreeting()}</Text>
              <Text style={styles.greeting}>
                {userName || 'You'} <Text style={{ fontSize: 20 }}>{"\u2764\uFE0F"}</Text>
              </Text>
            </View>
            <View style={styles.coupleAvatars}>
              <LinearGradient
                colors={['#7c3aed', '#a855f7']}
                style={[styles.avatar, { zIndex: 2 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>
                  {(userName || 'Y').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              {(() => {
                const partners = householdMembers.filter(m => userId && String(m.user_id) !== String(userId));
                if (partners.length > 0) {
                  return partners.slice(0, 2).map((partner, i) => (
                    <LinearGradient
                      key={partner.user_id}
                      colors={i === 0 ? ['#ec4899', '#f472b6'] : ['#f59e0b', '#fbbf24']}
                      style={[styles.avatar, { marginLeft: -12, zIndex: 1 - i }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.avatarText}>
                        {(partner.full_name || 'P').charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  ));
                }
                // Show a dim placeholder partner avatar when solo
                return (
                  <View style={[styles.avatar, { marginLeft: -12, zIndex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: '#0f0a1e' }]}>
                    <Ionicons name="person-add-outline" size={14} color="rgba(255,255,255,0.3)" />
                  </View>
                );
              })()}
            </View>
          </View>

          {/* ===== 2. AI INSIGHT CARD ===== */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.aiCard}
            onPress={async () => {
              if (nudges.length > 0) {
                const nudge = nudges[0];
                try { await api.post(`/auth/ai/nudges/${nudge.id}/dismiss`); } catch {}
                setNudges(prev => prev.filter(n => n.id !== nudge.id));
                if (nudge.action_type === 'ask_ai') {
                  router.push('/(tabs)/ai-chat' as any);
                } else if (nudge.action_type === 'navigate_to' && nudge.action_data) {
                  router.push(nudge.action_data as any);
                }
              }
            }}
          >
            <LinearGradient
              colors={['rgba(124,58,237,0.15)', 'rgba(168,85,247,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiCardGradient}
            >
              <LinearGradient
                colors={['#7c3aed', '#a855f7']}
                style={styles.aiIconBox}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.aiText} numberOfLines={2}>
                {nudges.length > 0
                  ? (nudges[0].body || nudges[0].title)
                  : 'Your finances are looking good!'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* ===== 3. COUPLEFLOW LEVEL PROGRESS ===== */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.glassCard}
            onPress={() => router.push('/framework' as any)}
          >
            <View style={styles.levelHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={frameworkSteps[currentLevelIndex]?.icon || 'shield-checkmark-outline'}
                  size={14}
                  color="#10b981"
                />
                <Text style={styles.levelLabel}>
                  Level {frameworkLevel?.current_level ?? 1} · {frameworkLevel?.level_name ?? 'Foundation'}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>
                {frameworkLevel?.progress_percent ?? 0}%
              </Text>
            </View>
            {/* Progress bar */}
            <View style={styles.progressBarTrack}>
              <LinearGradient
                colors={['#10b981', '#34d399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${frameworkLevel?.progress_percent ?? 0}%` as any }]}
              />
            </View>
            {/* Step circles */}
            <View style={styles.stepsRow}>
              {frameworkSteps.map((step, i) => {
                const done = i < currentLevelIndex;
                const active = i === currentLevelIndex;
                return (
                  <View key={i} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        done && { backgroundColor: '#10b981' },
                        active && { backgroundColor: 'rgba(16,185,129,0.3)', borderWidth: 1.5, borderColor: '#10b981' },
                        !done && !active && { backgroundColor: 'rgba(255,255,255,0.08)' },
                      ]}
                    >
                      <Ionicons
                        name={step.icon}
                        size={11}
                        color={done || active ? '#fff' : 'rgba(255,255,255,0.3)'}
                      />
                    </View>
                    <Text style={[styles.stepLabel, { color: done || active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)' }]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </TouchableOpacity>

          {/* ===== 4. THIS WEEK'S SPENDING - BAR CHART ===== */}
          <View style={styles.glassCard}>
            <View style={styles.weekHeader}>
              <View>
                <Text style={styles.smallLabel}>This Week</Text>
                <Text style={styles.weekAmount}>
                  {formatCurrency(thisWeekTotal)}
                  <Text style={styles.weekBudgetText}> / {formatCurrency(weeklyBudget)}</Text>
                </Text>
              </View>
              {weeklyBudget > 0 && (
                <View style={[styles.changeBadge, { backgroundColor: weeklyPercentChange <= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                  <Ionicons
                    name={weeklyPercentChange <= 0 ? 'trending-down' : 'trending-up'}
                    size={12}
                    color={weeklyPercentChange <= 0 ? '#10b981' : '#ef4444'}
                  />
                  <Text style={{ fontSize: 11, color: weeklyPercentChange <= 0 ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                    {Math.abs(weeklyPercentChange)}% {weeklyPercentChange <= 0 ? 'less' : 'more'}
                  </Text>
                </View>
              )}
            </View>
            {/* Bar chart */}
            <View style={styles.barChart}>
              {dailyTotals.map((val, i) => {
                const barH = maxBarValue > 0 ? Math.max((val / maxBarValue) * 60, val > 0 ? 4 : 0) : 0;
                const dailyLimit = weeklyBudget / 7;
                const isOver = val > dailyLimit && dailyLimit > 0;
                const isToday = i === todayDayIndex;
                // Show a subtle base bar for days with no spending
                const displayH = barH > 0 ? barH : (isToday ? 6 : 2);
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={{ height: 60, justifyContent: 'flex-end' }}>
                      {isOver ? (
                        <LinearGradient
                          colors={['#ef4444', '#dc2626']}
                          style={[styles.bar, { height: displayH }]}
                        />
                      ) : isToday ? (
                        <LinearGradient
                          colors={['#a855f7', '#7c3aed']}
                          style={[styles.bar, { height: displayH }]}
                        />
                      ) : (
                        <View style={[styles.bar, { height: displayH, backgroundColor: barH > 0 ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.06)' }]} />
                      )}
                    </View>
                    <Text style={[styles.barLabel, isToday && { color: '#a855f7', fontWeight: '700' }]}>
                      {dayLabels[i]}
                    </Text>
                  </View>
                );
              })}
            </View>
            {/* Footer: You vs Partner — this week only */}
            <View style={styles.weekFooter}>
              <View style={styles.weekFooterItem}>
                <View style={[styles.dot, { backgroundColor: '#a855f7' }]} />
                <Text style={styles.weekFooterText}>{(userName || 'You').split(' ')[0]}: {formatCurrency(myWeekTotal)}</Text>
              </View>
              {householdMembers
                .filter(m => userId && String(m.user_id) !== String(userId))
                .slice(0, 1)
                .map(partner => (
                  <View key={partner.user_id} style={styles.weekFooterItem}>
                    <View style={[styles.dot, { backgroundColor: '#ec4899' }]} />
                    <Text style={styles.weekFooterText}>{(partner.full_name || 'Partner').split(' ')[0]}: {formatCurrency(partnerWeekTotal)}</Text>
                  </View>
                ))}
            </View>
          </View>

          {/* ===== 5. BUDGET / SAVINGS / BILLS ROW ===== */}
          <View style={styles.miniCardRow}>
            {[
              {
                label: 'Budget',
                value: formatCompact(Math.max(budgetIncomeTotal - budgetExpenseTotal, 0)),
                sub: 'remaining',
                pct: isNaN(budgetPercent) ? 0 : budgetPercent,
                color: '#a855f7',
              },
              {
                label: 'Savings',
                value: formatCompact(displaySavingsCurrent),
                sub: `of ${formatCompact(displaySavingsTarget)} goal`,
                pct: isNaN(savingsPercent) ? 0 : Math.min(savingsPercent, 100),
                color: '#f59e0b',
              },
              {
                label: 'Bills',
                value: `${billsSummary.paid}/${billsSummary.total}`,
                sub: 'paid',
                pct: isNaN(billsPercent) ? 0 : billsPercent,
                color: '#10b981',
              },
            ].map((item) => (
              <View key={item.label} style={styles.miniCard}>
                <MiniRing percent={item.pct} color={item.color} />
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  <Text style={styles.miniCardValue}>{item.value}</Text>
                  <Text style={styles.miniCardSub}>{item.sub}</Text>
                </View>
                <Text style={styles.miniCardLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ===== 6. NET WORTH CARD ===== */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.glassCard}
            onPress={() => router.push('/accounts' as any)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.smallLabel}>Net Worth</Text>
                <Text style={styles.netWorthValue}>
                  {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth))}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons
                    name={netWorth >= 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={netWorth >= 0 ? '#10b981' : '#ef4444'}
                  />
                  <Text style={{ fontSize: 11, color: netWorth >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                    this month
                  </Text>
                </View>
              </View>
              {/* Net worth sparkline */}
              <View style={styles.sparklinePlaceholder}>
                <Svg width={100} height={44}>
                  {(() => {
                    // Build sparkline from available data points
                    const color = netWorth >= 0 ? '#10b981' : '#ef4444';
                    const dataPoints = [
                      cashTotal * 0.92,
                      cashTotal * 0.95,
                      cashTotal * 0.94,
                      cashTotal * 0.97,
                      cashTotal * 0.99,
                      cashTotal,
                      cashTotal + investmentTotal + propertyTotal - displayDebtTotal,
                    ].map(v => Math.max(v, 0));
                    const min = Math.min(...dataPoints);
                    const max = Math.max(...dataPoints);
                    const range = max - min || 1;
                    const points = dataPoints.map((v, i) => {
                      const x = (i / (dataPoints.length - 1)) * 100;
                      const y = 42 - ((v - min) / range) * 38 - 2;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <Polygon
                          points={`0,44 ${points} 100,44`}
                          fill={color}
                          fillOpacity={0.15}
                        />
                        <Polyline
                          points={points}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    );
                  })()}
                </Svg>
              </View>
            </View>
          </TouchableOpacity>

          {/* ===== 7. RECENT ACTIVITY ===== */}
          <View style={{ marginTop: 16 }}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/transaction/list' as any)}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            {transactions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((item, index) => {
                const isPartner = !!(item.user_id && userId && String(item.user_id) !== String(userId));
                const partnerMember = isPartner ? householdMembers.find(m => String(m.user_id) === String(item.user_id)) : null;
                const avatarInitial = isPartner
                  ? (partnerMember?.full_name || 'P').charAt(0).toUpperCase()
                  : (userName || 'Y').charAt(0).toUpperCase();
                const whoLabel = isPartner
                  ? (partnerMember?.full_name?.split(' ')[0] || 'Partner')
                  : 'You';

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.txRow,
                      index < Math.min(transactions.length, 5) - 1 && styles.txRowBorder,
                    ]}
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
                    <LinearGradient
                      colors={isPartner ? ['#ec4899', '#ec489988'] : ['#7c3aed', '#7c3aed88']}
                      style={styles.txAvatar}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                        {avatarInitial}
                      </Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txDesc} numberOfLines={1}>
                        {item.category_name || item.category || item.note || 'Transaction'}
                      </Text>
                      <Text style={styles.txMeta}>
                        {whoLabel} · {timeAgo(item.date)}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: item.type === 'expense' ? '#ef4444' : '#10b981' }]}>
                      {item.type === 'expense' ? '-' : '+'}
                      {formatCurrency(item.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* ===== DRAWER ===== */}
      <DrawerNavigation
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={drawerItems}
      />

      {/* ===== FAB ===== */}
      <FloatingActionButton
        actions={[
          {
            id: 'add-expense',
            icon: 'card-outline',
            label: 'Add Expense',
            color: '#f87171',
            onPress: () => router.push({ pathname: '/add-transaction', params: { type: 'expense' } }),
          },
          {
            id: 'add-income',
            icon: 'trending-up',
            label: 'Add Income',
            color: '#34d399',
            onPress: () => router.push({ pathname: '/add-transaction', params: { type: 'income' } }),
          },
          {
            id: 'create-budget',
            icon: 'pie-chart-outline',
            label: 'Create Budget',
            color: '#60a5fa',
            onPress: () => router.push('/budget/add-budget'),
          },
          {
            id: 'link-account',
            icon: 'link-outline',
            label: 'Link Account',
            color: '#34d399',
            onPress: () => router.push('/link-account'),
          },
        ]}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  coupleAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0f0a1e',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // AI Insight Card
  aiCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  aiCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  aiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.9)',
  },

  // Glass card (reusable)
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },

  // Level Progress
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 8,
  },

  // Weekly Spending
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  weekAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  weekBudgetText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 80,
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 28,
    borderRadius: 4,
    alignSelf: 'center',
  },
  barLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    fontWeight: '400',
  },
  weekFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 10,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weekFooterText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },

  // Mini card row
  miniCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  miniCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 6,
  },
  miniCardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  miniCardSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },
  miniCardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },

  // Net Worth
  netWorthValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  sparklinePlaceholder: {
    width: 100,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sparklineBar: {
    flex: 1,
    borderRadius: 8,
  },

  // Recent Activity
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  seeAllText: {
    fontSize: 12,
    color: '#a855f7',
    fontWeight: '500',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  txAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  txMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
});
