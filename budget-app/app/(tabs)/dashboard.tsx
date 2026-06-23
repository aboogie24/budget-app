import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchUserTransactions, fetchInvestmentHoldings, fetchAccountBalances, fetchProperties, checkBudgetThresholds, fetchAttention, recordNetWorthSnapshot, type AttentionItem, type NetWorthSnapshotPoint } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { DrawerNavigation } from '@/components/DrawerNavigation';
import { Skeleton } from '@/components/Skeleton';
import { AttentionCard } from '@/components/AttentionCard';
import { Sparkline } from '@/components/Sparkline';
import Svg, { Circle } from 'react-native-svg';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotPoint[]>([]);

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
    let localDebt = 0;
    try {
      const debts = await api.get(`/auth/debts`, { user_id: user.id });
      const debtsArray = Array.isArray(debts) ? debts : [];
      const totalDebt = debtsArray.reduce((sum, d) => sum + (d.balance || 0), 0);
      const minPayments = debtsArray.reduce((sum, d) => sum + (d.min_payment || 0), 0);
      setDebtSummary({ total: totalDebt, minPayment: minPayments, count: debtsArray.length });
      localDebt = totalDebt;
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

    let localCash = 0;
    let localInvestments = 0;
    let localProperties = 0;
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
      localInvestments = invTotal;
      const cash = (Array.isArray(balancesData) ? balancesData : []).reduce(
        (sum: number, a: any) => sum + (a.current_balance || 0), 0
      );
      setCashTotal(cash);
      localCash = cash;
      const propTotal = (Array.isArray(propsData) ? propsData : []).reduce(
        (sum: number, p: any) => sum + (p.manual_value || p.zestimate || 0), 0
      );
      setPropertyTotal(propTotal);
      localProperties = propTotal;
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

    // Load attention items (rules-based "what to act on now")
    try {
      const att = await fetchAttention();
      setAttention(Array.isArray(att?.items) ? att.items : []);
    } catch (e) {
      console.log('Attention fetch error (non-blocking):', e);
    }

    // Record today's net-worth snapshot (idempotent — upsert on user_id+date)
    // and pull back the trailing window for the sparkline.
    try {
      const snapTotal = localCash + localInvestments + localProperties - localDebt;
      const res = await recordNetWorthSnapshot({
        cash: localCash,
        investments: localInvestments,
        properties: localProperties,
        debt: localDebt,
        total: snapTotal,
      }, 30);
      setNetWorthHistory(Array.isArray(res?.snapshots) ? res.snapshots : []);
    } catch (e) {
      console.log('Net-worth snapshot error (non-blocking):', e);
    }

    setLoading(false);
  }, [currentMonth, currentYear]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard]);

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

  // Month-to-date inflow / outflow / net — drives the "this month" delta next
  // to net worth (replacing the synthetic sparkline). Excludes internal
  // transfers since those are not income or expense.
  const { monthInflow, monthOutflow, monthFlow } = (() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of transactions) {
      const d = new Date(t.date);
      if (d < monthStart || d > monthEnd) continue;
      if (t.type === 'income') inflow += t.amount || 0;
      else if (t.type === 'expense') outflow += t.amount || 0;
    }
    return { monthInflow: inflow, monthOutflow: outflow, monthFlow: inflow - outflow };
  })();

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

  // Weekly spending computation from transactions. Week runs Sunday → Saturday.
  const getWeeklySpending = () => {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun .. 6=Sat
    // Start of this week (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    const dailyTotals = [0, 0, 0, 0, 0, 0, 0]; // S M T W T F S
    let weekTotal = 0;
    let myWeekTotal = 0;
    let partnerWeekTotal = 0;
    let lastWeekTotal = 0;

    expenseData.forEach((t) => {
      // Bucket by calendar day, ignoring time + timezone. The backend stores
      // timestamps and serializes to UTC; treating them as local Date objects
      // shifts west-of-UTC users' late-night transactions into the previous
      // day, which empties out the current week. Parsing the YYYY-MM-DD
      // prefix directly avoids the shift.
      const dateStr = typeof t.date === 'string' ? t.date.slice(0, 10) : '';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
      if (!m) return;
      const txDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const diffDays = Math.floor((txDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      // Only count days that have actually happened (Sun → today). Future
      // days in the visible week stay empty — they haven't happened yet, and
      // any future-dated rows (scheduled bills, recurring placeholders) would
      // otherwise paint bars on days nothing has actually been spent.
      if (diffDays >= 0 && diffDays <= dow) {
        dailyTotals[diffDays] += t.amount || 0;
        weekTotal += t.amount || 0;
        const isPartnerTx = t.user_id && userId && String(t.user_id) !== String(userId);
        if (isPartnerTx) {
          partnerWeekTotal += t.amount || 0;
        } else {
          myWeekTotal += t.amount || 0;
        }
      } else if (diffDays >= -7 && diffDays < 0) {
        lastWeekTotal += t.amount || 0;
      }
    });

    return { dailyTotals, weekTotal, myWeekTotal, partnerWeekTotal, lastWeekTotal };
  };

  const { dailyTotals, weekTotal: thisWeekTotal, myWeekTotal, partnerWeekTotal, lastWeekTotal } = getWeeklySpending();

  // Week-over-week delta — percentage change vs same window last week.
  const weekOverWeekPct = lastWeekTotal > 0
    ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
    : null;

  // Weekly recap (shown only on Sun/Mon when last week's window is "fresh").
  // Week boundary is Sun→Sat. Aggregates the previous full Sun-Sat: total
  // spent, top category, sibling-week delta. Hidden the rest of the week
  // to avoid stale recap fatigue.
  const dow = new Date().getDay(); // 0=Sun
  const showRecap = (dow === 0 || dow === 1) && lastWeekTotal > 0;
  const lastWeekTopCategory = (() => {
    if (!showRecap) return null;
    const today = new Date();
    const thisSunday = new Date(today);
    thisSunday.setDate(today.getDate() - dow);
    thisSunday.setHours(0, 0, 0, 0);
    const lastSunday = new Date(thisSunday);
    lastSunday.setDate(thisSunday.getDate() - 7);
    const totals = new Map<string, number>();
    for (const t of expenseData) {
      // TZ-safe calendar-day parse, matching getWeeklySpending().
      const dateStr = typeof t.date === 'string' ? t.date.slice(0, 10) : '';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
      if (!m) continue;
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (d < lastSunday || d >= thisSunday) continue;
      const key = t.category_name || t.category || 'Uncategorized';
      totals.set(key, (totals.get(key) || 0) + (t.amount || 0));
    }
    let topName = '';
    let topAmt = 0;
    for (const [name, amt] of totals) {
      if (amt > topAmt) { topName = name; topAmt = amt; }
    }
    return topName ? { name: topName, amount: topAmt } : null;
  })();
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

  // Money Mood — a single emoji + label + color summarizing the week.
  // Reads signals already loaded; no extra fetch. Picks the "darkest" mood
  // any signal warrants, so a single overdrawn category can dim the whole
  // mood even if everything else is fine.
  const moneyMood = (() => {
    // Default: neutral while we wait for data.
    if (loading) return { emoji: '🙂', color: '#94a3b8', label: 'Loading' };

    // Aggregate severity from a few signals.
    let severity = 0; // 0 great → 4 bad
    if (attention.some((a) => a.action === 'reconnect')) severity = Math.max(severity, 3);
    if (attention.some((a) => a.action === 'mark_paid')) severity = Math.max(severity, 2);
    if (weeklyBudget > 0) {
      if (weeklyPercentChange > 50) severity = Math.max(severity, 4);
      else if (weeklyPercentChange > 20) severity = Math.max(severity, 3);
      else if (weeklyPercentChange > 5) severity = Math.max(severity, 2);
      else if (weeklyPercentChange > -10) severity = Math.max(severity, 1);
      // <= -10% under budget → 0 (great)
    }
    if (monthFlow < 0) severity = Math.max(severity, 2);

    switch (severity) {
      case 0: return { emoji: '😎', color: '#10b981', label: 'Crushing it' };
      case 1: return { emoji: '🙂', color: '#60a5fa', label: 'On track' };
      case 2: return { emoji: '😐', color: '#eab308', label: 'Watch out' };
      case 3: return { emoji: '😬', color: '#f59e0b', label: 'Tight week' };
      default: return { emoji: '😰', color: '#ef4444', label: 'Reset needed' };
    }
  })();

  // Under-budget streak — count consecutive days back from today (inclusive)
  // where daily expense ≤ daily budget. Stops at first day over. Returns 0
  // when there's no budget set so we don't show a misleading "0 day streak".
  const underBudgetStreak = (() => {
    if (!weeklyBudget || weeklyBudget <= 0) return 0;
    const dailyLimit = weeklyBudget / 7;
    // Build a quick day-keyed total map of expenses (last 90 days max).
    const totals = new Map<string, number>();
    expenseData.forEach((t) => {
      const dateStr = typeof t.date === 'string' ? t.date.slice(0, 10) : '';
      if (!dateStr) return;
      totals.set(dateStr, (totals.get(dateStr) || 0) + (t.amount || 0));
    });
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // Walk back up to 90 days.
    for (let i = 0; i < 90; i++) {
      const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const spent = totals.get(ymd) || 0;
      if (spent <= dailyLimit) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  })();

  // Achievements — derived from current state, no persistence yet. Each is
  // a static badge that lights up when its condition is met.
  const achievements = (() => {
    const hasBankSyncedTx = transactions.some((t) => ['teller', 'bank', 'flinks'].includes(String(t.source || '')));
    const verifiedCount = transactions.filter((t: any) => t.user_verified).length;
    const netWorthNow = cashTotal + investmentTotal + propertyTotal - displayDebtTotal;
    return [
      { id: 'first-link', emoji: '🔗', label: 'First link', unlocked: hasBankSyncedTx, hint: 'Link a bank account' },
      { id: 'budget-set', emoji: '📊', label: 'Budget set', unlocked: budgetsData.length > 0, hint: 'Create a budget' },
      { id: 'reviewer', emoji: '✅', label: 'Reviewer', unlocked: verifiedCount >= 10, hint: 'Verify 10 transactions' },
      { id: 'savings-1k', emoji: '💸', label: '$1k saved', unlocked: displaySavingsCurrent >= 1000, hint: 'Save your first $1k' },
      { id: 'positive-nw', emoji: '🌱', label: 'In the green', unlocked: netWorthNow > 0, hint: 'Get net worth above zero' },
      { id: 'nw-10k', emoji: '💎', label: '$10k club', unlocked: netWorthNow >= 10000, hint: 'Net worth ≥ $10k' },
    ];
  })();

  // Signal-driven sub-tagline that goes under the time-of-day greeting.
  // Reads the data we already loaded — no extra fetch. Prioritizes the most
  // useful one-liner the user can act on right now.
  const getTagline = (): string => {
    if (loading) return '';
    if (attention.length > 0) {
      const n = attention.length;
      return `${n} thing${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} your attention`;
    }
    if (weeklyBudget > 0 && weeklyPercentChange > 5) {
      return `You're ${weeklyPercentChange}% over your weekly budget`;
    }
    if (weeklyBudget > 0 && weeklyPercentChange < -10) {
      return `You're ${Math.abs(weeklyPercentChange)}% under budget this week — nice`;
    }
    if (monthFlow > 0) {
      return `Up ${formatCompact(monthFlow)} this month`;
    }
    if (monthFlow < 0) {
      return `Down ${formatCompact(Math.abs(monthFlow))} this month`;
    }
    return 'Here\'s your money snapshot';
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
  // Week runs Sunday → Saturday.
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayDayIndex = new Date().getDay(); // 0=Sun..6=Sat — matches column order

  const maxBarValue = Math.max(...dailyTotals, 1);

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
        >

          {/* ===== 1. HEADER - Greeting + Couple Avatars ===== */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingSub}>{getGreeting()}</Text>
              <Text style={styles.greeting}>
                {userName || 'You'} <Text style={{ fontSize: 22 }}>{moneyMood.emoji}</Text>
              </Text>
              {loading ? (
                <Skeleton width={180} height={11} style={{ marginTop: 4 }} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <View style={[styles.moodPill, { borderColor: `${moneyMood.color}55`, backgroundColor: `${moneyMood.color}1a` }]}>
                    <Text style={[styles.moodPillText, { color: moneyMood.color }]}>{moneyMood.label}</Text>
                  </View>
                  {underBudgetStreak > 0 && (
                    <View style={styles.streakPill}>
                      <Ionicons name="flame" size={11} color="#f59e0b" />
                      <Text style={styles.streakPillText}>{underBudgetStreak}d streak</Text>
                    </View>
                  )}
                  <Text style={styles.greetingTagline} numberOfLines={1}>
                    {getTagline()}
                  </Text>
                </View>
              )}
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

          {/* ===== 1.5 ACHIEVEMENTS ROW ===== */}
          {!loading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementsRow}
            >
              {achievements.map((a) => (
                <View
                  key={a.id}
                  style={[
                    styles.achBadge,
                    a.unlocked ? styles.achBadgeUnlocked : styles.achBadgeLocked,
                  ]}
                >
                  <Text style={[styles.achEmoji, !a.unlocked && { opacity: 0.35 }]}>{a.emoji}</Text>
                  <Text
                    style={[
                      styles.achLabel,
                      { color: a.unlocked ? '#f8fafc' : 'rgba(255,255,255,0.4)' },
                    ]}
                    numberOfLines={1}
                  >
                    {a.unlocked ? a.label : a.hint}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ===== 2a. ATTENTION CARD (rules-based, actionable) ===== */}
          <AttentionCard items={attention} onActionComplete={loadDashboard} />

          {/* ===== 2a.5. WEEKLY RECAP (Sun/Mon only) ===== */}
          {showRecap && (
            <View style={styles.recapCard}>
              <View style={styles.recapHeader}>
                <Ionicons name="calendar-outline" size={14} color="#a855f7" />
                <Text style={styles.recapHeaderText}>Last week's recap</Text>
              </View>
              <View style={styles.recapBody}>
                <View style={styles.recapStat}>
                  <Text style={styles.recapStatValue}>{formatCompact(lastWeekTotal)}</Text>
                  <Text style={styles.recapStatLabel}>spent</Text>
                </View>
                {lastWeekTopCategory && (
                  <View style={styles.recapStat}>
                    <Text style={styles.recapStatValue} numberOfLines={1}>{lastWeekTopCategory.name}</Text>
                    <Text style={styles.recapStatLabel}>top category</Text>
                  </View>
                )}
                {weekOverWeekPct !== null && (
                  <View style={styles.recapStat}>
                    <Text style={[styles.recapStatValue, { color: weekOverWeekPct <= 0 ? '#10b981' : '#ef4444' }]}>
                      {weekOverWeekPct <= 0 ? '↓' : '↑'} {Math.abs(weekOverWeekPct)}%
                    </Text>
                    <Text style={styles.recapStatLabel}>vs week before</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ===== 2b. AI INSIGHT CARD (only when there's a real nudge) ===== */}
          {nudges.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.aiCard}
              onPress={async () => {
                const nudge = nudges[0];
                try { await api.post(`/auth/ai/nudges/${nudge.id}/dismiss`); } catch {}
                setNudges(prev => prev.filter(n => n.id !== nudge.id));
                if (nudge.action_type === 'ask_ai') {
                  router.push('/(tabs)/ai-chat' as any);
                } else if (nudge.action_type === 'navigate_to' && nudge.action_data) {
                  router.push(nudge.action_data as any);
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
                  {nudges[0].body || nudges[0].title}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
              </LinearGradient>
            </TouchableOpacity>
          )}

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
                {loading ? (
                  <Skeleton width={160} height={22} style={{ marginTop: 4 }} />
                ) : (
                  <Text style={styles.weekAmount}>
                    {formatCurrency(thisWeekTotal)}
                    <Text style={styles.weekBudgetText}> / {formatCurrency(weeklyBudget)}</Text>
                  </Text>
                )}
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
            {(() => {
              const hasAnySpending = dailyTotals.some((v) => v > 0);
              const today = new Date();
              const dow = today.getDay(); // 0=Sun..6=Sat
              const BAR_TRACK_H = 70;
              return (
                <View style={styles.barChart}>
                  {dailyTotals.map((val, i) => {
                    const dayDate = new Date(today);
                    dayDate.setDate(today.getDate() - dow + i);
                    const ymd = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
                    const dailyLimit = weeklyBudget / 7;
                    const isOver = val > dailyLimit && dailyLimit > 0;
                    const isToday = i === todayDayIndex;
                    // Real bar height — proportional to today's max when there's
                    // any data this week. When the whole week is zero, every bar
                    // renders as a visible "ghost track" so the chart structure
                    // doesn't disappear.
                    const fillH = hasAnySpending && val > 0
                      ? Math.max((val / maxBarValue) * BAR_TRACK_H, 6)
                      : 0;
                    return (
                      <View key={i} style={styles.barCol}>
                        {/* Track: always visible so the chart reads as a chart */}
                        <View style={[styles.barTrack, { height: BAR_TRACK_H }]}>
                          {/* Fill */}
                          {fillH > 0 ? (
                            isOver ? (
                              <LinearGradient
                                colors={['#ef4444', '#dc2626']}
                                style={[styles.bar, { height: fillH }]}
                              />
                            ) : isToday ? (
                              <LinearGradient
                                colors={['#a855f7', '#7c3aed']}
                                style={[styles.bar, { height: fillH }]}
                              />
                            ) : (
                              <View style={[styles.bar, { height: fillH, backgroundColor: 'rgba(168,85,247,0.6)' }]} />
                            )
                          ) : isToday ? (
                            // "Today" marker even with no data — small purple dot at the base.
                            <View style={[styles.bar, { height: 6, backgroundColor: '#a855f7' }]} />
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => router.push({ pathname: '/transaction/list', params: { date: ymd } })}
                          style={styles.barLabelHit}
                          activeOpacity={0.6}
                          hitSlop={{ top: 8, bottom: 4, left: 4, right: 4 }}
                        >
                          <Text style={[styles.barLabel, isToday && { color: '#a855f7', fontWeight: '700' }]}>
                            {dayLabels[i]}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
            {!dailyTotals.some((v) => v > 0) && !loading && (
              <Text style={styles.barEmptyText}>No expenses logged this week.</Text>
            )}
            {/* Footer: You vs Partner — this week, plus week-over-week delta */}
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
              {weekOverWeekPct !== null && (
                <View style={styles.weekFooterItem}>
                  <Ionicons
                    name={weekOverWeekPct <= 0 ? 'arrow-down' : 'arrow-up'}
                    size={10}
                    color={weekOverWeekPct <= 0 ? '#10b981' : '#ef4444'}
                  />
                  <Text style={[styles.weekFooterText, { color: weekOverWeekPct <= 0 ? '#10b981' : '#ef4444' }]}>
                    {Math.abs(weekOverWeekPct)}% vs last wk
                  </Text>
                </View>
              )}
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
                route: '/(tabs)/budget' as const,
              },
              {
                label: 'Savings',
                value: formatCompact(displaySavingsCurrent),
                sub: `of ${formatCompact(displaySavingsTarget)} goal`,
                pct: isNaN(savingsPercent) ? 0 : Math.min(savingsPercent, 100),
                color: '#f59e0b',
                route: '/savings' as const,
              },
              {
                label: 'Bills',
                value: `${billsSummary.paid}/${billsSummary.total}`,
                sub: 'paid',
                pct: isNaN(billsPercent) ? 0 : billsPercent,
                color: '#10b981',
                route: '/bills' as const,
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.miniCard}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.8}
              >
                <MiniRing percent={item.pct} color={item.color} />
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  {loading ? (
                    <Skeleton width={50} height={14} />
                  ) : (
                    <Text style={styles.miniCardValue}>{item.value}</Text>
                  )}
                  <Text style={styles.miniCardSub}>{item.sub}</Text>
                </View>
                <Text style={styles.miniCardLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ===== 6. NET WORTH CARD ===== */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.glassCard}
            onPress={() => router.push('/accounts' as any)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Net Worth</Text>
                {loading ? (
                  <Skeleton width={140} height={28} style={{ marginTop: 6 }} />
                ) : (
                  <Text style={styles.netWorthValue}>
                    {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth))}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons
                    name={monthFlow >= 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={monthFlow >= 0 ? '#10b981' : '#ef4444'}
                  />
                  <Text style={{ fontSize: 11, color: monthFlow >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                    {monthFlow >= 0 ? '+' : '-'}{formatCompact(Math.abs(monthFlow))} this month
                  </Text>
                </View>
              </View>
              {/* Right rail: real 30-day net-worth sparkline */}
              <View style={styles.sparklineWrap}>
                <Sparkline
                  values={netWorthHistory.map((p) => p.total)}
                  width={100}
                  height={44}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* ===== 7. RECENT ACTIVITY ===== */}
          <View style={{ marginTop: 16 }}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              {transactions.length > 0 && (
                <TouchableOpacity onPress={() => router.push('/transaction/list' as any)}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading && transactions.length === 0 ? (
              <View style={{ gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                    <Skeleton width={36} height={36} borderRadius={10} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="60%" height={12} />
                      <Skeleton width="40%" height={10} />
                    </View>
                    <Skeleton width={60} height={14} />
                  </View>
                ))}
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.activityEmpty}>
                <Ionicons name="receipt-outline" size={28} color="rgba(255,255,255,0.25)" />
                <Text style={styles.activityEmptyTitle}>No transactions yet</Text>
                <Text style={styles.activityEmptySub}>
                  Link a bank account or add a transaction to get started.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    style={styles.activityEmptyBtnPrimary}
                    onPress={() => router.push('/link-account' as any)}
                  >
                    <Ionicons name="link-outline" size={14} color="#fff" />
                    <Text style={styles.activityEmptyBtnPrimaryText}>Link account</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.activityEmptyBtnGhost}
                    onPress={() => router.push({ pathname: '/add-transaction', params: { type: 'expense' } })}
                  >
                    <Text style={styles.activityEmptyBtnGhostText}>Add manually</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
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
  greetingTagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    flexShrink: 1,
  },
  moodPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  moodPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  streakPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
  },

  // Achievements
  achievementsRow: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 14,
  },
  achBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  achBadgeUnlocked: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderColor: 'rgba(124,58,237,0.35)',
  },
  achBadgeLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  achEmoji: {
    fontSize: 14,
  },
  achLabel: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 110,
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
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    maxWidth: 28,
    borderRadius: 4,
    alignSelf: 'stretch',
  },
  barLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
    fontWeight: '400',
  },
  barLabelHit: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  barEmptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
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
  sparklineWrap: {
    width: 100,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Weekly recap card (Sun/Mon)
  recapCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.18)',
  },
  recapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  recapHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#a855f7',
    textTransform: 'uppercase',
  },
  recapBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  recapStat: {
    flex: 1,
    minWidth: 0,
  },
  recapStatValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  recapStatLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginTop: 2,
  },

  // Recent activity empty state
  activityEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activityEmptyTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 8,
  },
  activityEmptySub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  activityEmptyBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
  },
  activityEmptyBtnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  activityEmptyBtnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  activityEmptyBtnGhostText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    fontSize: 12,
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
