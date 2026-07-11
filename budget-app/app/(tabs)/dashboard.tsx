import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  fetchUserTransactions,
  fetchInvestmentHoldings,
  fetchAccountBalances,
  fetchProperties,
  fetchAttention,
  recordNetWorthSnapshot,
  fetchDashboardStatus,
  type AttentionItem,
  type NetWorthSnapshotPoint,
  type DashboardStatusResponse,
} from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { DrawerNavigation } from '@/components/DrawerNavigation';
import { AttentionCard } from '@/components/AttentionCard';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius, typography } from '@/utils/design-system';
import { StatusHeadlineCard, type HeadlineStatus } from '@/components/dashboard/StatusHeadlineCard';
import { ThisWeekProof } from '@/components/dashboard/ThisWeekProof';
import { TrajectoryStrip } from '@/components/dashboard/TrajectoryStrip';
import { ScopeToggle, type Scope } from '@/components/dashboard/ScopeToggle';
import { RecentActivity, type RecentTx, type PartnerGlyph } from '@/components/dashboard/RecentActivity';

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

type Member = { user_id: string; full_name: string; role: string };

// severity ordering for worst-signal-wins
const SEVERITY: Record<Exclude<HeadlineStatus, 'setup'>, number> = { good: 0, watch: 1, alert: 2 };
const severityMin = (...s: Exclude<HeadlineStatus, 'setup'>[]) =>
  s.reduce((worst, cur) => (SEVERITY[cur] > SEVERITY[worst] ? cur : worst), 'good' as Exclude<HeadlineStatus, 'setup'>);

const compact = (v: number) => {
  if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(1) + 'k';
  return '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
};

export default function DashboardScreen() {
  const router = useRouter();

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [debtSummary, setDebtSummary] = useState({ total: 0 });
  const [savingsSummary, setSavingsSummary] = useState({ totalTarget: 0, totalCurrent: 0 });
  const [billsData, setBillsData] = useState<any[]>([]);
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const [householdSummary, setHouseholdSummary] = useState<HouseholdSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [frameworkLevel, setFrameworkLevel] = useState<FrameworkLevel | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Member[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotPoint[]>([]);

  const [scope, setScope] = useState<Scope>('household');
  const [statusResp, setStatusResp] = useState<DashboardStatusResponse | null>(null);
  const [statusErrored, setStatusErrored] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const monthEnd = useMemo(() => new Date(currentYear, currentMonth + 1, 0), [currentYear, currentMonth]);

  // ── Data loading ── preserves the original fetch flow; adds the status verdict.
  const loadDashboard = useCallback(async (activeScope: Scope) => {
    const data = await fetchUserTransactions();
    if (data) setTransactions(data as Tx[]);

    const user = await getCurrentUser();
    if (user) {
      setUserName(user.full_name || user.email || null);
      setUserId(user.id || null);
    }
    if (!user?.id) {
      setLoading(false);
      setLoadedOnce(true);
      return;
    }

    // Household data — separate calls so member loading survives a summary failure.
    try {
      const householdData = await api.get<any>(`/auth/households/me`, { user_id: user.id });
      const householdID = householdData?.household_id;
      if (householdID) {
        let members = householdData.members;
        if (typeof members === 'string') {
          try { members = JSON.parse(members); } catch {}
        }
        if (Array.isArray(members) && members.length > 0) {
          setHouseholdMembers(members);
        }
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

    let localDebt = 0;
    try {
      const debts = await api.get(`/auth/debts`, { user_id: user.id });
      const debtsArray = Array.isArray(debts) ? debts : [];
      const totalDebt = debtsArray.reduce((sum, d) => sum + (d.balance || 0), 0);
      setDebtSummary({ total: totalDebt });
      localDebt = totalDebt;
    } catch (e) {
      console.error('Debts fetch error:', e);
    }

    try {
      const goals = await api.get(`/auth/savings-goals`, { user_id: user.id });
      const goalsArray = Array.isArray(goals) ? goals : [];
      const totalTarget = goalsArray.reduce((sum, g) => sum + (g.target_amount || 0), 0);
      const totalCurrent = goalsArray.reduce((sum, g) => sum + (g.current_amount || 0), 0);
      setSavingsSummary({ totalTarget, totalCurrent });
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
      setBillsData(Array.isArray(bills) ? bills : []);
    } catch (e) {
      console.error('Bills fetch error:', e);
    }

    let localCash = 0;
    let localInvestments = 0;
    let localProperties = 0;
    try {
      const [holdingsData, balancesData, propsData] = await Promise.all([
        fetchInvestmentHoldings(),
        fetchAccountBalances('depository'),
        fetchProperties(),
      ]);
      const invTotal = (Array.isArray(holdingsData) ? holdingsData : []).reduce(
        (sum: number, h: any) => sum + (h.institution_value || 0), 0,
      );
      setInvestmentTotal(invTotal);
      localInvestments = invTotal;
      const cash = (Array.isArray(balancesData) ? balancesData : []).reduce(
        (sum: number, a: any) => sum + (a.current_balance || 0), 0,
      );
      setCashTotal(cash);
      localCash = cash;
      const propTotal = (Array.isArray(propsData) ? propsData : []).reduce(
        (sum: number, p: any) => sum + (p.manual_value || p.zestimate || 0), 0,
      );
      setPropertyTotal(propTotal);
      localProperties = propTotal;
    } catch {}

    try {
      const levelData = await api.get<FrameworkLevel>('/auth/ai/framework-level');
      if (levelData) setFrameworkLevel(levelData);
    } catch {
      console.log('Framework level fetch skipped');
    }

    try {
      const att = await fetchAttention();
      setAttention(Array.isArray(att?.items) ? att.items : []);
    } catch (e) {
      console.log('Attention fetch error (non-blocking):', e);
    }

    // Net-worth snapshot (idempotent upsert) + trailing window for the sparkline.
    try {
      const snapTotal = localCash + localInvestments + localProperties - localDebt;
      const res = await recordNetWorthSnapshot(
        { cash: localCash, investments: localInvestments, properties: localProperties, debt: localDebt, total: snapTotal },
        30,
      );
      setNetWorthHistory(Array.isArray(res?.snapshots) ? res.snapshots : []);
    } catch (e) {
      console.log('Net-worth snapshot error (non-blocking):', e);
    }

    // ── Status verdict ── scope=personal for "Me". On failure we fall back to
    // a client-side worst-signal-wins verdict computed below.
    try {
      const statusScope = activeScope === 'me' ? 'personal' : 'household';
      const s = await fetchDashboardStatus(statusScope);
      setStatusResp(s);
      setStatusErrored(false);
    } catch (e) {
      console.log('Status fetch error (falling back):', e);
      setStatusResp(null);
      setStatusErrored(true);
    }

    setLoading(false);
    setLoadedOnce(true);
  }, [currentMonth, currentYear]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboard(scope);
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard, scope]);

  useEffect(() => {
    loadDashboard(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(scope);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadDashboard]),
  );

  // Solo users are forced into "me" scope with no toggle.
  const isCouple = householdMembers.length >= 2;
  const effectiveScope: Scope = isCouple ? scope : 'me';

  const onScopeChange = useCallback((next: Scope) => {
    setScope(next);
    // Re-fetch the status verdict scoped; the rest of the screen re-derives locally.
    (async () => {
      try {
        const statusScope = next === 'me' ? 'personal' : 'household';
        const s = await fetchDashboardStatus(statusScope);
        setStatusResp(s);
        setStatusErrored(false);
      } catch {
        setStatusResp(null);
        setStatusErrored(true);
      }
    })();
  }, []);

  // ── Scope-filtered transactions ──
  const scopedTx = useMemo(() => {
    if (effectiveScope === 'me') {
      return transactions.filter((t) => userId && String(t.user_id) === String(userId));
    }
    return transactions;
  }, [transactions, effectiveScope, userId]);

  // ── This-month cash flow (locally computable, for the error fallback) ──
  const { monthInflow, monthOutflow, monthFlow } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of scopedTx) {
      const d = new Date(t.date);
      if (d < monthStart || d > monthEnd) continue;
      if (t.type === 'income') inflow += t.amount || 0;
      else if (t.type === 'expense') outflow += t.amount || 0;
    }
    return { monthInflow: inflow, monthOutflow: outflow, monthFlow: inflow - outflow };
  }, [scopedTx, monthStart, monthEnd]);

  // ── Budget totals (personal budgets; household uses summary savings/debt) ──
  const countOccurrencesInMonth = useCallback((startDate?: string, frequency?: string) => {
    const freq = (frequency || '').toLowerCase();
    const start = startDate ? new Date(startDate) : monthStart;
    if (start > monthEnd) return 0;
    if (freq === 'weekly' || freq === 'biweekly') {
      const step = freq === 'weekly' ? 7 : 14;
      let count = 0;
      const current = new Date(Math.max(start.getTime(), monthStart.getTime()));
      current.setDate(current.getDate() + ((7 + start.getDay() - current.getDay()) % 7));
      while (current <= monthEnd) { count++; current.setDate(current.getDate() + step); }
      return count;
    }
    if (freq === '1st-15th') return 2;
    return 1;
  }, [monthStart, monthEnd]);

  const budgetIncomeTotal = useMemo(() => budgetsData
    .filter((b) => (b.type || '').toLowerCase() === 'income')
    .reduce((sum, b) => sum + (b.amount || 0) * countOccurrencesInMonth(b.start_date, b.frequency), 0),
    [budgetsData, countOccurrencesInMonth]);
  const budgetExpenseTotal = useMemo(() => budgetsData
    .filter((b) => (b.type || '').toLowerCase() === 'expense')
    .reduce((sum, b) => sum + (b.amount || 0) * countOccurrencesInMonth(b.start_date, b.frequency), 0),
    [budgetsData, countOccurrencesInMonth]);

  const budgetPercentUsed = budgetExpenseTotal > 0
    ? Math.min(999, Math.round((monthOutflow / budgetExpenseTotal) * 100))
    : 0;

  // Savings + debt: household summary in household scope, else personal.
  const useHousehold = effectiveScope === 'household' && householdSummary;
  const savingsTarget = useHousehold ? householdSummary!.total_savings_target : savingsSummary.totalTarget;
  const savingsCurrent = useHousehold ? householdSummary!.total_savings_current : savingsSummary.totalCurrent;
  const displayDebtTotal = useHousehold ? householdSummary!.total_debt : debtSummary.total;
  const savingsPercent = savingsTarget > 0 ? Math.round((savingsCurrent / savingsTarget) * 100) : 0;

  const netWorth = cashTotal + investmentTotal + propertyTotal - displayDebtTotal;

  // ── Bills (scoped: Me filters to this user's bills via user_id when present) ──
  const scopedBills = useMemo(() => {
    if (effectiveScope === 'me' && userId) {
      return billsData.filter((b: any) => !b.user_id || String(b.user_id) === String(userId));
    }
    return billsData;
  }, [billsData, effectiveScope, userId]);
  const billsPaid = scopedBills.filter((b: any) => b.status === 'paid').length;
  const billsTotal = scopedBills.length;
  const billsOverdue = scopedBills.filter((b: any) => b.status === 'overdue').length;
  const billsDueSoon = scopedBills.filter((b: any) => b.status === 'due' || b.status === 'due_soon').length;

  // ── Weekly spending (Sunday→Saturday), from scoped transactions ──
  const { dailyTotals, thisWeekTotal } = useMemo(() => {
    const today = new Date();
    const dow = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);

    const totals = [0, 0, 0, 0, 0, 0, 0];
    let week = 0;
    scopedTx.forEach((t) => {
      if (t.type !== 'expense') return;
      const dateStr = typeof t.date === 'string' ? t.date.slice(0, 10) : '';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
      if (!m) return;
      const txDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const diff = Math.floor((txDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= dow) {
        totals[diff] += t.amount || 0;
        week += t.amount || 0;
      }
    });
    return { dailyTotals: totals, thisWeekTotal: week };
  }, [scopedTx]);

  const weeklyBudget = budgetIncomeTotal > 0
    ? Math.round(budgetIncomeTotal / 4)
    : budgetExpenseTotal > 0 ? Math.round(budgetExpenseTotal / 4) : 0;

  // ── Client-side status fallback (worst-signal-wins) ──
  const clientStatus = useMemo<{ status: Exclude<HeadlineStatus, 'setup'>; headline: string }>(() => {
    const billsStatus: Exclude<HeadlineStatus, 'setup'> =
      billsOverdue > 0 ? 'alert' : billsDueSoon > 0 ? 'watch' : 'good';

    let spendStatus: Exclude<HeadlineStatus, 'setup'> = 'good';
    if (weeklyBudget > 0) {
      const over = ((thisWeekTotal - weeklyBudget) / weeklyBudget) * 100;
      if (over > 20) spendStatus = 'alert';
      else if (over > 5) spendStatus = 'watch';
    }

    const cashFlowStatus: Exclude<HeadlineStatus, 'setup'> =
      monthFlow < 0 ? 'alert' : monthFlow < 50 ? 'watch' : 'good';

    const overall = severityMin(billsStatus, spendStatus, cashFlowStatus);

    // Deterministic per-state sentence.
    let headline: string;
    if (overall === 'good') {
      headline = weeklyBudget > 0 && thisWeekTotal < weeklyBudget
        ? "You're under budget and bills are covered — nice week."
        : 'Everything looks on track this week.';
    } else if (overall === 'watch') {
      if (spendStatus === 'watch') headline = "Spending's running a bit hot this week — keep an eye on it.";
      else if (billsStatus === 'watch') headline = 'A bill is coming due soon — worth a look.';
      else headline = "Cash flow's near flat this month — keep an eye on it.";
    } else {
      if (billsStatus === 'alert') headline = "Heads up — a bill is overdue. Let's get it handled.";
      else if (cashFlowStatus === 'alert') headline = "You're spending more than you're bringing in this month.";
      else headline = "Spending's well over budget this week — time to reset.";
    }
    return { status: overall, headline };
  }, [billsOverdue, billsDueSoon, weeklyBudget, thisWeekTotal, monthFlow]);

  // ── Empty (new household / no data) detection ──
  const isEmpty = loadedOnce && !loading && transactions.length === 0 && budgetsData.length === 0;

  // ── Resolve headline props (endpoint wins; else fallback) ──
  const headlineStatus: HeadlineStatus = isEmpty
    ? 'setup'
    : (statusResp?.status ?? clientStatus.status);
  const headlineText = isEmpty
    ? "Let's get your first numbers in — link an account or add a transaction."
    : (statusResp?.headline || clientStatus.headline);
  const heroCashFlow = statusResp?.hero_value ?? monthFlow;
  const heroIn = statusResp?.signals?.income_month ?? monthInflow;
  const heroOut = statusResp?.signals?.expense_month ?? monthOutflow;

  // ── Recent transactions (last 3, actual) ──
  const recentTx: RecentTx[] = useMemo(() =>
    [...scopedTx]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3),
    [scopedTx]);

  // Partner glyph: A → primary2/◑, B → info/◐, shared/unknown/Me-scope → none.
  const resolvePartner = useCallback((tx: RecentTx): PartnerGlyph => {
    if (effectiveScope === 'me') return null;
    if (!tx.user_id || !userId) return null;
    if (String(tx.user_id) === String(userId)) {
      const me = householdMembers.find((m) => String(m.user_id) === String(userId));
      return { glyph: '◑', color: colors.primary2, name: (me?.full_name || userName || 'You').split(' ')[0] };
    }
    const partner = householdMembers.find((m) => String(m.user_id) === String(tx.user_id));
    if (!partner) return null;
    return { glyph: '◐', color: colors.info, name: (partner.full_name || 'Partner').split(' ')[0] };
  }, [effectiveScope, userId, householdMembers, userName]);

  // ── Greeting ──
  const greeting = (() => {
    const h = new Date().getHours();
    const word = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return `${word}, ${(userName || 'there').split(' ')[0]}`;
  })();

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayIndex = new Date().getDay();

  // Net-worth delta % from history (first vs last).
  const netWorthDeltaPercent = useMemo(() => {
    if (netWorthHistory.length < 2) return null;
    const first = netWorthHistory[0].total;
    const last = netWorthHistory[netWorthHistory.length - 1].total;
    if (!first) return null;
    return Math.round(((last - first) / Math.abs(first)) * 1000) / 10;
  }, [netWorthHistory]);

  const showSkeleton = loading && !loadedOnce;
  const hasTrajectory = frameworkLevel != null || netWorthHistory.length >= 2 || netWorth !== 0;

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

  const partners = householdMembers.filter((m) => userId && String(m.user_id) !== String(userId));

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.drawerBtn} onPress={() => setDrawerOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.greetingWrap}>
            <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
          </View>

          <View style={styles.headerRight}>
            {loading && loadedOnce && <ActivityIndicator color={colors.primary2} size="small" />}
            {isCouple && (
              <View style={styles.avatars}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{(userName || 'Y').charAt(0).toUpperCase()}</Text>
                </View>
                {partners.slice(0, 1).map((p) => (
                  <View key={p.user_id} style={[styles.avatar, styles.avatarOverlap, { backgroundColor: colors.info }]}>
                    <Text style={styles.avatarText}>{(p.full_name || 'P').charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}
            <ScopeToggle value={scope} onChange={onScopeChange} visible={isCouple} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary2} colors={[colors.primary2]} />
          }
        >
          {showSkeleton ? (
            <View style={{ gap: spacing.lg }}>
              <StatusHeadlineCard loading status="good" headline="" cashFlow={0} />
              <View style={{ gap: spacing.md }}>
                <Skeleton width={80} height={12} />
                <ThisWeekProof
                  loading
                  spentThisWeek={0} weeklyBudget={0} weeklyByDay={[0, 0, 0, 0, 0, 0, 0]}
                  todayIndex={todayIndex} dayLabels={dayLabels}
                  budgetPercentUsed={0} savingsCurrent={0} savingsTarget={0} savingsProgressPercent={0}
                  billsPaid={0} billsTotal={0}
                />
              </View>
              <TrajectoryStrip loading netWorth={0} level={1} levelName="" progressPercent={0} />
              <View style={{ gap: spacing.md }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skelRow}>
                    <Skeleton width={36} height={36} borderRadius={radius.md} />
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      <Skeleton width="60%" height={12} />
                      <Skeleton width="40%" height={10} />
                    </View>
                    <Skeleton width={60} height={14} />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <>
              {/* ── TIER 1: Status Headline ── */}
              <StatusHeadlineCard
                status={headlineStatus}
                headline={headlineText}
                cashFlow={heroCashFlow}
                moneyIn={isEmpty ? undefined : heroIn}
                moneyOut={isEmpty ? undefined : heroOut}
                errored={statusErrored && !isEmpty}
                onRetry={() => loadDashboard(scope)}
                onCtaPress={() => router.push('/link-account' as any)}
              />

              {isEmpty ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="sparkles-outline" size={24} color={colors.textDark} />
                  <Text style={styles.emptyText}>Nothing to show yet — this fills in as money moves.</Text>
                </View>
              ) : (
                <>
                  {/* ── TIER 2: Attention (only when non-empty) ── */}
                  <View style={{ marginTop: spacing.xl }}>
                    <AttentionCard items={attention} onActionComplete={() => loadDashboard(scope)} />
                  </View>

                  {/* ── TIER 3: This-week proof ── */}
                  <View style={attention.length > 0 ? undefined : { marginTop: spacing.xl }}>
                    <ThisWeekProof
                      spentThisWeek={thisWeekTotal}
                      weeklyBudget={weeklyBudget}
                      weeklyByDay={dailyTotals}
                      todayIndex={todayIndex}
                      dayLabels={dayLabels}
                      budgetPercentUsed={budgetPercentUsed}
                      savingsCurrent={savingsCurrent}
                      savingsTarget={savingsTarget}
                      savingsProgressPercent={savingsPercent}
                      billsPaid={billsPaid}
                      billsTotal={billsTotal}
                      onBudgetPress={() => router.push('/(tabs)/budget' as any)}
                      onSavingsPress={() => router.push('/savings' as any)}
                      onBillsPress={() => router.push('/bills' as any)}
                    />
                  </View>

                  {/* ── TIER 4: Trajectory strip ── */}
                  {hasTrajectory && (
                    <View style={{ marginTop: spacing.lg }}>
                      <TrajectoryStrip
                        netWorth={netWorth}
                        netWorthDeltaPercent={netWorthDeltaPercent}
                        netWorthHistory={netWorthHistory}
                        level={frameworkLevel?.current_level ?? 1}
                        levelName={frameworkLevel?.level_name ?? 'Foundation'}
                        progressPercent={frameworkLevel?.progress_percent ?? 0}
                        onPress={() => router.push('/framework' as any)}
                      />
                    </View>
                  )}

                  {/* ── TIER 5: Recent activity ── */}
                  <View style={{ marginTop: spacing.lg }}>
                    <RecentActivity
                      transactions={recentTx}
                      resolvePartner={resolvePartner}
                      onSeeAll={() => router.push('/transaction/list' as any)}
                      onPressTx={(tx) =>
                        router.push({
                          pathname: '/transaction/[id]',
                          params: {
                            id: tx.id,
                            type: tx.type,
                            amount: String(tx.amount),
                            note: tx.note,
                            category_name: tx.category_name || tx.category,
                            date: tx.date,
                            source: tx.source,
                          },
                        })
                      }
                    />
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <DrawerNavigation isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} items={drawerItems} />

      <FloatingActionButton
        actions={[
          { id: 'add-expense', icon: 'card-outline', label: 'Add Expense', color: colors.error, onPress: () => router.push({ pathname: '/add-transaction', params: { type: 'expense' } }) },
          { id: 'add-income', icon: 'trending-up', label: 'Add Income', color: colors.success, onPress: () => router.push({ pathname: '/add-transaction', params: { type: 'income' } }) },
          { id: 'create-budget', icon: 'pie-chart-outline', label: 'Create Budget', color: colors.info, onPress: () => router.push('/budget/add-budget') },
          { id: 'link-account', icon: 'link-outline', label: 'Link Account', color: colors.success, onPress: () => router.push('/link-account') },
        ]}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  drawerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  greetingWrap: {
    flex: 1,
  },
  greeting: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
