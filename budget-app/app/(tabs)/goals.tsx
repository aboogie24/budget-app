import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import {
  fetchInvestmentHoldings,
  fetchAccountBalances,
  fetchProperties,
  recordNetWorthSnapshot,
  type NetWorthSnapshotPoint,
} from '@/utils/api';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { BackButton } from '@/components/BackButton';
import { Sparkline } from '@/components/Sparkline';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  commonStyles,
  gradients,
} from '@/utils/design-system';

// ── Types ──
type Holding = { id: string; security_name?: string; ticker_symbol?: string; institution_value: number };
type Debt = { id: string; name: string; balance: number; apr?: number; min_payment?: number; debt_category?: string; liability_type?: string; original_balance?: number; opening_balance?: number };
type Bill = { id: string; name: string; amount_due: number; status?: string };
type Account = {
  id: string;
  name: string;
  type?: string;
  subtype?: string;
  current_balance: number;
  institution_name?: string;
  mask?: string;
};
type Property = {
  id: string;
  street_address?: string;
  city?: string;
  state?: string;
  zestimate?: number;
  manual_value?: number;
};

// ── Constants ──
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MASK = '••••••';

// Tokenized category palette (no literals) — maps an asset/debt kind to a design-system color.
const CATEGORY_COLORS = {
  property: colors.primary,
  investments: colors.success,
  cash: colors.info,
  debt: colors.error,
} as const;

// ── Helpers ──
const formatCurrency = (v: number): string =>
  (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCompact = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1000000) return (v < 0 ? '-' : '') + '$' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return (v < 0 ? '-' : '') + '$' + (abs / 1000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return (v < 0 ? '-' : '') + '$' + abs.toLocaleString();
};

const mask = (visible: boolean, text: string): string => (visible ? text : MASK);

type AllocationSegment = { label: string; pct: number; color: string; amount: string };
type AccountItem = {
  name: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  balance: number;
  trendData?: number[];
  route?: string;
};
type DebtPayoffItem = { name: string; paid: number; remaining: number; barColor: string; statusWord: string; eta: string };

// ══════════════════════════════════════════════════════════════
// GoalsAllocationDonut — tokenized donut (was inline DonutChart)
// ══════════════════════════════════════════════════════════════
function GoalsAllocationDonut({
  segments,
  size = 120,
  strokeWidth = 16,
  centerLabel,
  centerValue,
}: {
  segments: { pct: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.glassLight} strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const dash = (seg.pct / 100) * circ;
          const gap = circ - dash;
          const rot = (offset / 100) * 360 - 90;
          offset += seg.pct;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="butt"
              transform={`rotate(${rot}, ${size / 2}, ${size / 2})`}
            />
          );
        })}
      </Svg>
      {(centerLabel || centerValue) && (
        <View style={styles.donutCenter}>
          {centerLabel && <Text style={styles.donutCenterLabel}>{centerLabel}</Text>}
          {centerValue && <Text style={styles.donutCenterValue}>{centerValue}</Text>}
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// GoalsCashFlowChart — tokenized bar chart (was inline CashFlowChart)
// ══════════════════════════════════════════════════════════════
function GoalsCashFlowChart({ data }: { data: { month: string; income: number; expenses: number }[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expenses)), 1);
  const barMaxHeight = 68;

  return (
    <View style={styles.cashFlowChartRow}>
      {data.map((d, i) => {
        const incomeH = Math.max(spacing.xs, (d.income / maxVal) * barMaxHeight);
        const expenseH = Math.max(spacing.xs, (d.expenses / maxVal) * barMaxHeight);
        return (
          <View key={i} style={styles.cashFlowBarCol}>
            <View style={styles.cashFlowBarPair}>
              <LinearGradient colors={gradients.successGradient} style={[styles.cashFlowBar, { height: incomeH }]} />
              <LinearGradient colors={gradients.errorGradient} style={[styles.cashFlowBar, { height: expenseH, opacity: 0.8 }]} />
            </View>
            <Text style={styles.cashFlowBarLabel}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// GoalsSectionHeader — expandable Assets/Debts header
// ══════════════════════════════════════════════════════════════
function GoalsSectionHeader({
  title,
  total,
  expanded,
  onToggle,
  count,
  balanceVisible,
}: {
  title: string;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  balanceVisible: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title}, ${count} accounts, total ${
        balanceVisible ? formatCurrency(total) : 'hidden'
      }. ${expanded ? 'Expanded' : 'Collapsed'}. Double tap to toggle.`}
    >
      <View style={styles.rowCenterGap}>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={colors.textMuted}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      </View>
      <Text style={[styles.sectionTotal, { color: total < 0 ? colors.error : colors.success }]}>
        {mask(balanceVisible, formatCurrency(total))}
      </Text>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════
// GoalsAccountRow — a single account/debt row
// ══════════════════════════════════════════════════════════════
function GoalsAccountRow({
  name,
  subtitle,
  iconName,
  iconColor,
  balance,
  trendData,
  balanceVisible,
  onPress,
}: {
  name: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  balance: number;
  trendData?: number[];
  balanceVisible: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.accountRow}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}, ${subtitle}, ${
        balanceVisible ? formatCurrency(balance) : 'hidden'
      }.${onPress ? ' Double tap to open.' : ''}`}
    >
      <View style={[styles.accountIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={iconName} size={16} color={iconColor} />
      </View>
      <View style={styles.accountTextWrap}>
        <Text style={styles.accountName} numberOfLines={1}>{name}</Text>
        <Text style={styles.accountSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <View style={styles.accountRight}>
        {trendData && trendData.length >= 2 && (
          <Sparkline values={trendData} color={balance < 0 ? colors.error : colors.success} width={50} height={24} />
        )}
        <Text style={[styles.accountBalance, { color: balance < 0 ? colors.error : colors.text }]}>
          {mask(balanceVisible, formatCurrency(balance))}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════
// GoalsDebtProgressRow — one debt payoff bar
// ══════════════════════════════════════════════════════════════
function GoalsDebtProgressRow({ debt, last, balanceVisible }: { debt: DebtPayoffItem; last: boolean; balanceVisible: boolean }) {
  return (
    <View
      style={{ marginBottom: last ? 0 : spacing.md }}
      accessibilityLabel={`${debt.name}, ${
        balanceVisible ? formatCurrency(debt.remaining) : 'hidden'
      } left, ${debt.paid} percent paid off, ${debt.statusWord}.`}
    >
      <View style={styles.debtRowTop}>
        <Text style={styles.debtName} numberOfLines={1}>{debt.name}</Text>
        <Text style={styles.debtMeta}>
          {mask(balanceVisible, formatCurrency(debt.remaining))} left{debt.eta ? ` · ${debt.eta}` : ''}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={[colors.primary, debt.barColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${Math.max(debt.paid, 2)}%` }]}
        />
      </View>
      <Text style={styles.debtStatus}>
        {debt.paid}% paid off · {debt.statusWord}
      </Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// GoalsSkeleton — layout-matched loading placeholder
// ══════════════════════════════════════════════════════════════
function GoalsSkeleton() {
  return (
    <View style={{ gap: spacing.lg }}>
      {/* Hero (floating) */}
      <View style={[glassEffects.glassFloating, styles.heroCard]}>
        <Skeleton width={120} height={12} />
        <Skeleton width={200} height={34} style={{ marginTop: spacing.sm }} />
        <Skeleton width={160} height={14} style={{ marginTop: spacing.sm }} />
        <View style={[styles.splitBar, { marginTop: spacing.lg }]}>
          <View style={styles.flex1}>
            <Skeleton width={70} height={10} />
            <Skeleton width={110} height={16} style={{ marginTop: spacing.sm }} />
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.flex1}>
            <Skeleton width={70} height={10} />
            <Skeleton width={110} height={16} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </View>

      {/* Composition */}
      <View style={[glassEffects.glass, styles.card]}>
        <Skeleton width={120} height={14} />
        <View style={styles.donutRow}>
          <Skeleton width={120} height={120} borderRadius={radius.full} />
          <View style={styles.flex1}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={12} style={{ marginBottom: spacing.md }} />
            ))}
          </View>
        </View>
      </View>

      {/* Cash flow */}
      <View style={[glassEffects.glass, styles.card]}>
        <Skeleton width={100} height={14} />
        <View style={[styles.cashFlowChartRow, { marginTop: spacing.md }]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.cashFlowBarCol}>
              <Skeleton width={26} height={60} borderRadius={radius.sm} />
            </View>
          ))}
        </View>
      </View>

      {/* Accounts */}
      <View style={[glassEffects.glass, styles.card]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skelAccountRow}>
            <Skeleton width={38} height={38} borderRadius={radius.md} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="60%" height={12} />
              <Skeleton width="40%" height={10} />
            </View>
            <Skeleton width={70} height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function FinancesScreen() {
  const router = useRouter();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>('assets');

  // Data
  const [debts, setDebts] = useState<Debt[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [budgets, setBudgets] = useState<any>(null);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotPoint[]>([]);

  // ── Load Data ──
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const user = await getCurrentUser();
      if (!user?.id) {
        setError('No user found');
        setLoading(false);
        setLoadedOnce(true);
        return;
      }

      const [debtsData, billsData, holdingsData, accountsData, propertiesData] = await Promise.all([
        api.get('/auth/debts', { user_id: user.id }).catch(() => []),
        api.get('/auth/bills', { user_id: user.id }).catch(() => []),
        fetchInvestmentHoldings().catch(() => []),
        fetchAccountBalances().catch(() => []),
        fetchProperties().catch(() => []),
      ]);

      // Try to load budgets for income/expenses
      let budgetData = null;
      try {
        budgetData = await api.get(`/auth/budgets/user/${user.id}`);
      } catch {}

      const nextDebts = Array.isArray(debtsData) ? (debtsData as Debt[]) : [];
      const nextHoldings = Array.isArray(holdingsData) ? (holdingsData as Holding[]) : [];
      const nextAccounts = Array.isArray(accountsData) ? (accountsData as Account[]) : [];
      const nextProperties = Array.isArray(propertiesData) ? (propertiesData as Property[]) : [];

      setDebts(nextDebts);
      setBills(Array.isArray(billsData) ? (billsData as Bill[]) : []);
      setHoldings(nextHoldings);
      setAccounts(nextAccounts);
      setProperties(nextProperties);
      setBudgets(budgetData);
      setError(null);

      // ── Real net-worth history (no fabricated data). Record an idempotent
      // snapshot and read back the trailing window. Sparkline shows
      // "Collecting…" until there are ≥ 2 real points.
      try {
        const localCash = nextAccounts
          .filter((a) => a.type !== 'credit' && a.type !== 'loan' && a.type !== 'investment')
          .reduce((s, a) => s + (a.current_balance || 0), 0);
        const localInvestments = nextHoldings.reduce((s, h) => s + (h.institution_value || 0), 0);
        const localProperties = nextProperties.reduce((s, p) => s + (p.zestimate || p.manual_value || 0), 0);
        const localDebt = nextDebts.reduce((s, d) => s + (d.balance || 0), 0);
        const snapTotal = localCash + localInvestments + localProperties - localDebt;
        const res = await recordNetWorthSnapshot(
          { cash: localCash, investments: localInvestments, properties: localProperties, debt: localDebt, total: snapTotal },
          180,
        );
        setNetWorthHistory(Array.isArray(res?.snapshots) ? res.snapshots : []);
      } catch (snapErr) {
        console.log('Net-worth snapshot error (non-blocking):', snapErr);
      }
    } catch (e) {
      console.error('Failed to load finance data:', e);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // ── Computed values ──
  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.type !== 'credit' && a.type !== 'loan' && a.type !== 'investment'),
    [accounts],
  );
  const cashTotal = cashAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const investmentTotal = holdings.reduce((sum, h) => sum + (h.institution_value || 0), 0);
  const propertyTotal = properties.reduce((sum, p) => sum + (p.zestimate || p.manual_value || 0), 0);
  const debtTotal = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

  const totalAssets = cashTotal + investmentTotal + propertyTotal;
  const totalDebts = debtTotal;
  const netWorth = totalAssets - totalDebts;

  // Real net-worth trend values for the sparkline (real snapshots only).
  const netWorthValues = useMemo(() => netWorthHistory.map((p) => p.total), [netWorthHistory]);

  // Delta over the trailing 30 days — the history window is 180 days, and a
  // first-vs-last diff across all of it misrepresented a "this month" label.
  const netWorthDelta = useMemo(() => {
    if (netWorthHistory.length < 2) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const recent = netWorthHistory.filter(
      (p) => new Date(`${String(p.date).slice(0, 10)}T12:00:00`) >= cutoff,
    );
    const series = recent.length >= 2 ? recent : netWorthHistory;
    const first = series[0].total;
    const last = series[series.length - 1].total;
    if (!first) return null;
    return {
      pct: Math.round(((last - first) / Math.abs(first)) * 1000) / 10,
      amount: last - first,
    };
  }, [netWorthHistory]);

  // Asset allocation segments (tokenized palette)
  const allocationSegments = useMemo<AllocationSegment[]>(() => {
    if (totalAssets <= 0) return [{ label: 'No assets', pct: 100, color: colors.glassStrong, amount: '$0' }];
    const segments: AllocationSegment[] = [];
    if (propertyTotal > 0) segments.push({ label: 'Property', pct: Math.round((propertyTotal / totalAssets) * 100), color: CATEGORY_COLORS.property, amount: formatCompact(propertyTotal) });
    if (investmentTotal > 0) segments.push({ label: 'Investments', pct: Math.round((investmentTotal / totalAssets) * 100), color: CATEGORY_COLORS.investments, amount: formatCompact(investmentTotal) });
    if (cashTotal > 0) segments.push({ label: 'Cash', pct: Math.round((cashTotal / totalAssets) * 100), color: CATEGORY_COLORS.cash, amount: formatCompact(cashTotal) });
    // Drop slices that round to 0% — they draw a stray cap dot and a "0%"
    // legend row. Then reconcile the last slice so the visible set sums to 100.
    const visible = segments.filter((seg) => seg.pct > 0);
    if (visible.length > 0) {
      const assigned = visible.reduce((s, seg) => s + seg.pct, 0);
      const diff = 100 - assigned;
      if (diff !== 0) visible[visible.length - 1].pct += diff;
    }
    return visible;
  }, [totalAssets, propertyTotal, investmentTotal, cashTotal]);

  // ── Cash flow (this-month real; prior months only when real history exists) ──
  const now = new Date();
  const countMonthlyAmount = (amount: number, frequency: string) => {
    const f = (frequency || '').toLowerCase();
    if (f === 'weekly') return amount * 4;
    if (f === 'biweekly') return amount * 2;
    if (f === '1st-15th') return amount * 2;
    return amount; // monthly or default
  };

  const currentMonthIncome = useMemo(() => {
    if (budgets && Array.isArray(budgets)) {
      return budgets
        .filter((b: any) => (b.type || '').toLowerCase() === 'income')
        .reduce((sum: number, b: any) => sum + countMonthlyAmount(b.amount || 0, b.frequency), 0);
    }
    return 0;
  }, [budgets]);

  const currentMonthExpenses = useMemo(() => {
    if (budgets && Array.isArray(budgets)) {
      return budgets
        .filter((b: any) => (b.type || '').toLowerCase() === 'expense')
        .reduce((sum: number, b: any) => sum + countMonthlyAmount(b.amount || 0, b.frequency), 0);
    }
    return bills.reduce((sum, b) => sum + (b.amount_due || 0), 0);
  }, [budgets, bills]);

  // Honesty rule: only render months for which we have a real value. We have a
  // real value only for the current month (budget/bills derived). No Math.random().
  const cashFlowData = useMemo(() => {
    const month = MONTH_NAMES[now.getMonth()];
    return [{ month, income: currentMonthIncome, expenses: currentMonthExpenses }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthIncome, currentMonthExpenses]);

  const hasCashFlow = currentMonthIncome > 0 || currentMonthExpenses > 0;
  const currentMonthSaved = currentMonthIncome - currentMonthExpenses;
  const currentMonthLabel = MONTH_NAMES[now.getMonth()];

  // ── Asset account rows (no fabricated trend arrays) ──
  const assetAccountList = useMemo<AccountItem[]>(() => {
    const list: AccountItem[] = [];
    properties.forEach((p) => {
      const val = p.zestimate || p.manual_value || 0;
      list.push({
        name: p.street_address || 'Property',
        subtitle: [p.city, p.state].filter(Boolean).join(', ') || 'Property',
        iconName: 'business',
        iconColor: CATEGORY_COLORS.property,
        balance: val,
        route: '/properties',
      });
    });
    cashAccounts.forEach((a) => {
      const bal = a.current_balance || 0;
      list.push({
        name: a.name || 'Account',
        subtitle: [a.institution_name, a.mask ? `··${a.mask}` : ''].filter(Boolean).join(' ') || a.subtype || 'Bank',
        iconName: a.subtype === 'savings' ? 'wallet' : 'business-outline',
        iconColor: CATEGORY_COLORS.cash,
        balance: bal,
        route: '/accounts',
      });
    });
    if (holdings.length > 0) {
      list.push({
        name: 'Investments',
        subtitle: `${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`,
        iconName: 'bar-chart',
        iconColor: CATEGORY_COLORS.investments,
        balance: investmentTotal,
        route: '/investments',
      });
    }
    return list;
  }, [properties, cashAccounts, holdings, investmentTotal]);

  const debtAccountList = useMemo<AccountItem[]>(
    () =>
      debts.map((d) => ({
        name: d.name,
        subtitle: d.apr ? `${d.apr}% APR` : d.liability_type || 'Debt',
        iconName: (d.liability_type === 'mortgage' ? 'business' : d.liability_type === 'auto' ? 'car' : d.liability_type === 'student' ? 'school' : 'card') as keyof typeof Ionicons.glyphMap,
        iconColor: CATEGORY_COLORS.debt,
        balance: -(d.balance || 0),
        route: '/debts',
      })),
    [debts],
  );

  // ── Debt payoff items (color + status word, never color alone) ──
  const debtPayoffItems = useMemo<DebtPayoffItem[]>(
    () =>
      debts.map((d) => {
        const current = d.balance || 0;
        // Prefer a real original/opening balance if the API exposes one; else estimate.
        const original = d.original_balance || d.opening_balance || (current > 0 ? current * 1.3 : 1);
        const paid = original > 0 ? Math.min(100, Math.round(((original - current) / original) * 100)) : 0;
        let eta = '';
        if (d.min_payment && d.min_payment > 0 && current > 0) {
          const monthsLeft = Math.ceil(current / d.min_payment);
          const payoffDate = new Date(now.getFullYear(), now.getMonth() + monthsLeft, 1);
          eta = `${MONTH_NAMES[payoffDate.getMonth()]} ${payoffDate.getFullYear()}`;
        }
        let barColor = colors.error;
        let statusWord = 'Just started';
        if (paid > 60) {
          barColor = colors.success;
          statusWord = 'On track';
        } else if (paid >= 30) {
          barColor = colors.warning;
          statusWord = 'In progress';
        }
        return { name: d.name, paid, remaining: current, barColor, statusWord, eta };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debts],
  );

  // ── Empty detection: brand-new household with nothing to show. ──
  const isEmpty =
    loadedOnce &&
    !error &&
    totalAssets === 0 &&
    totalDebts === 0 &&
    assetAccountList.length === 0 &&
    debtAccountList.length === 0;

  const showSkeleton = loading && !loadedOnce;

  // ── Quick-access chips (navigation, not content) ──
  const quickAccess: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
    { icon: 'card-outline', label: 'Debts', route: '/debts' },
    { icon: 'receipt-outline', label: 'Bills', route: '/bills' },
    { icon: 'wallet-outline', label: 'Savings', route: '/savings' },
    { icon: 'cash-outline', label: 'Budget', route: '/(tabs)/budget' },
    { icon: 'flag-outline', label: 'Priorities', route: '/priorities' },
    { icon: 'map-outline', label: 'Plans', route: '/plans' },
    { icon: 'swap-horizontal-outline', label: 'Transactions', route: '/transaction/list' },
  ];

  // ── Header (renders immediately, even under skeleton) ──
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <BackButton fallback="/(tabs)/dashboard" />
        <Text style={styles.headerTitle}>Finances</Text>
      </View>
      <View style={styles.headerActions}>
        {loading && loadedOnce && <ActivityIndicator color={colors.primary2} size="small" />}
        <TouchableOpacity
          onPress={() => setBalanceVisible((v) => !v)}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={balanceVisible ? 'Hide balances' : 'Show balances'}
        >
          <Ionicons name={balanceVisible ? 'eye' : 'eye-off'} size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuickAccess = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickAccessRow}
      style={styles.quickAccessScroll}
    >
      {quickAccess.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={styles.chip}
          onPress={() => router.push(item.route as any)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Ionicons name={item.icon} size={14} color={colors.primary2} />
          <Text style={styles.chipLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── FAB (single add affordance) ──
  const fab = (
    <FloatingActionButton
      actions={[
        { id: 'link-account', icon: 'link-outline', label: 'Link Account', color: colors.success, onPress: () => router.push('/link-account' as any) },
        { id: 'add-property', icon: 'home-outline', label: 'Add Property', color: colors.primary, onPress: () => router.push('/properties' as any) },
        { id: 'add-debt', icon: 'card-outline', label: 'Add Debt', color: colors.error, onPress: () => router.push('/debts' as any) },
      ]}
    />
  );

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {renderHeader()}
        {renderQuickAccess()}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary2} colors={[colors.primary2]} />
          }
        >
          {showSkeleton ? (
            <GoalsSkeleton />
          ) : error ? (
            // ── Error state (glass card, replaces charts) ──
            <>
              {netWorth !== 0 && (
                <View style={[glassEffects.glassFloating, styles.heroCard]}>
                  <Text style={styles.heroLabel}>Combined Net Worth</Text>
                  <Text style={styles.heroAmount}>{mask(balanceVisible, formatCurrency(netWorth))}</Text>
                </View>
              )}
              <View style={[glassEffects.glass, styles.card, styles.errorCard]}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
                <Text style={styles.errorTitle}>Couldn't load your finances</Text>
                <TouchableOpacity onPress={() => loadData()} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : isEmpty ? (
            // ── Empty state (onboarding card + CTA) ──
            <View style={[glassEffects.glass, styles.card, styles.emptyCard]}>
              <Ionicons name="wallet-outline" size={32} color={colors.textDark} />
              <Text style={styles.emptyTitle}>Let's see your net worth</Text>
              <Text style={styles.emptySubcopy}>Link an account or add a property to build the full picture.</Text>
              <TouchableOpacity
                onPress={() => router.push('/link-account' as any)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Link an account"
                style={styles.emptyCtaWrap}
              >
                <LinearGradient colors={[colors.primary, colors.primary2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyCta}>
                  <Text style={styles.emptyCtaText}>Link an account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ═══ TIER 1 — Net Worth Hero (only card that floats) ═══ */}
              <View
                style={[glassEffects.glassFloating, styles.heroCard]}
                accessibilityLabel={`Combined net worth, ${
                  balanceVisible ? formatCurrency(netWorth) : 'hidden'
                }${netWorthDelta ? `, ${netWorthDelta.pct >= 0 ? 'up' : 'down'} ${Math.abs(netWorthDelta.pct)} percent` : ''}. Assets ${
                  balanceVisible ? formatCurrency(totalAssets) : 'hidden'
                }, debts ${balanceVisible ? formatCurrency(totalDebts) : 'hidden'}.`}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.heroLabel}>Combined Net Worth</Text>
                    <Text style={styles.heroAmount}>{mask(balanceVisible, formatCurrency(netWorth))}</Text>
                    {balanceVisible && netWorthDelta && (
                      <View style={styles.heroDeltaRow}>
                        <View
                          style={[
                            styles.deltaBadge,
                            { backgroundColor: `${netWorthDelta.pct >= 0 ? colors.success : colors.error}1f` },
                          ]}
                        >
                          <Ionicons
                            name={netWorthDelta.pct >= 0 ? 'arrow-up' : 'arrow-down'}
                            size={11}
                            color={netWorthDelta.pct >= 0 ? colors.success : colors.error}
                          />
                          <Text style={[styles.deltaBadgeText, { color: netWorthDelta.pct >= 0 ? colors.success : colors.error }]}>
                            {netWorthDelta.pct >= 0 ? '+' : ''}{netWorthDelta.pct.toFixed(1)}%
                          </Text>
                        </View>
                        <Text style={styles.deltaSubtext}>
                          · {netWorthDelta.amount >= 0 ? '+' : ''}{formatCompact(netWorthDelta.amount)} past 30 days
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.heroSparkline}>
                    <Sparkline values={netWorthValues} color={colors.primary2} width={90} height={44} />
                  </View>
                </View>

                {/* Assets / Debts split bar */}
                <View style={styles.splitBar}>
                  <View style={styles.flex1}>
                    <Text style={styles.splitLabel}>Total Assets</Text>
                    <View style={styles.splitValueRow}>
                      <Ionicons name="arrow-up" size={13} color={colors.success} />
                      <Text style={[styles.splitValue, { color: colors.success }]}>
                        {mask(balanceVisible, formatCurrency(totalAssets))}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.splitDivider} />
                  <View style={styles.flex1}>
                    <Text style={styles.splitLabel}>Total Debts</Text>
                    <View style={styles.splitValueRow}>
                      <Ionicons name="arrow-down" size={13} color={colors.error} />
                      <Text style={[styles.splitValue, { color: colors.error }]}>
                        {mask(balanceVisible, formatCurrency(totalDebts))}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ═══ TIER 2 — Composition (Asset Allocation) ═══ */}
              {totalAssets > 0 && (
                <View style={[glassEffects.glass, styles.card, styles.tierGap]}>
                  <Text style={styles.cardTitle}>Asset Allocation</Text>
                  <View style={styles.donutRow}>
                    <GoalsAllocationDonut
                      segments={allocationSegments}
                      size={120}
                      strokeWidth={16}
                      centerLabel="TOTAL"
                      centerValue={balanceVisible ? formatCompact(totalAssets) : MASK}
                    />
                    <View style={styles.legendWrap}>
                      {allocationSegments.map((seg, i) => (
                        <View key={i} style={styles.legendRow}>
                          <View style={styles.legendLeft}>
                            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                            <Text style={styles.legendLabel} numberOfLines={1}>{seg.label}</Text>
                          </View>
                          <View style={styles.legendRight}>
                            <Text style={styles.legendAmount}>{balanceVisible ? seg.amount : MASK}</Text>
                            <Text style={styles.legendPct}>{seg.pct}%</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ═══ TIER 3 — Cash Flow ═══ */}
              {hasCashFlow && (
                <View style={[glassEffects.glass, styles.card]}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Cash Flow</Text>
                    <Text style={styles.cardHeaderMeta}>This month</Text>
                  </View>

                  <GoalsCashFlowChart data={cashFlowData} />

                  {/* Legend */}
                  <View style={styles.cashFlowLegend}>
                    <View style={styles.rowCenterGapSm}>
                      <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                      <Text style={styles.cashFlowLegendText}>Income</Text>
                    </View>
                    <View style={styles.rowCenterGapSm}>
                      <View style={[styles.legendDot, { backgroundColor: colors.error, opacity: 0.8 }]} />
                      <Text style={styles.cashFlowLegendText}>Expenses</Text>
                    </View>
                  </View>

                  {/* This-month summary */}
                  <View style={styles.cashFlowSummary}>
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryColLabel}>{currentMonthLabel} Income</Text>
                      <Text style={[styles.summaryColValue, { color: colors.success }]}>
                        {mask(balanceVisible, formatCurrency(currentMonthIncome))}
                      </Text>
                    </View>
                    <View style={styles.summaryColDivider} />
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryColLabel}>{currentMonthLabel} Spent</Text>
                      <Text style={[styles.summaryColValue, { color: colors.error }]}>
                        {mask(balanceVisible, formatCurrency(currentMonthExpenses))}
                      </Text>
                    </View>
                    <View style={styles.summaryColDivider} />
                    <View style={styles.summaryCol}>
                      <Text style={styles.summaryColLabel}>Saved</Text>
                      <Text style={[styles.summaryColValue, { color: currentMonthSaved >= 0 ? colors.primary2 : colors.error }]}>
                        {mask(balanceVisible, formatCurrency(currentMonthSaved))}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ═══ TIER 4 — Accounts (expandable) ═══ */}
              <View style={[glassEffects.glass, styles.accountsCard]}>
                <GoalsSectionHeader
                  title="Assets"
                  total={totalAssets}
                  expanded={expandedSection === 'assets'}
                  onToggle={() => setExpandedSection(expandedSection === 'assets' ? null : 'assets')}
                  count={assetAccountList.length}
                  balanceVisible={balanceVisible}
                />
                {expandedSection === 'assets' &&
                  assetAccountList.map((acc, i) => (
                    <GoalsAccountRow
                      key={`asset-${i}`}
                      name={acc.name}
                      subtitle={acc.subtitle}
                      iconName={acc.iconName}
                      iconColor={acc.iconColor}
                      balance={acc.balance}
                      trendData={acc.trendData}
                      balanceVisible={balanceVisible}
                      onPress={acc.route ? () => router.push(acc.route as any) : undefined}
                    />
                  ))}

                <View style={commonStyles.divider} />

                <GoalsSectionHeader
                  title="Debts"
                  total={-totalDebts}
                  expanded={expandedSection === 'debts'}
                  onToggle={() => setExpandedSection(expandedSection === 'debts' ? null : 'debts')}
                  count={debtAccountList.length}
                  balanceVisible={balanceVisible}
                />
                {expandedSection === 'debts' &&
                  debtAccountList.map((acc, i) => (
                    <GoalsAccountRow
                      key={`debt-${i}`}
                      name={acc.name}
                      subtitle={acc.subtitle}
                      iconName={acc.iconName}
                      iconColor={acc.iconColor}
                      balance={acc.balance}
                      trendData={acc.trendData}
                      balanceVisible={balanceVisible}
                      onPress={() => router.push('/debts' as any)}
                    />
                  ))}
              </View>

              {/* ═══ TIER 5 — Debt Payoff Progress ═══ */}
              {debts.length > 0 && (
                <View style={[glassEffects.glass, styles.card]}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Debt Payoff Progress</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/plans' as any)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel="View plan"
                    >
                      <Text style={styles.viewPlan}>View plan ›</Text>
                    </TouchableOpacity>
                  </View>

                  {debtPayoffItems.map((debt, i) => (
                    <GoalsDebtProgressRow
                      key={i}
                      debt={debt}
                      last={i === debtPayoffItems.length - 1}
                      balanceVisible={balanceVisible}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {fab}
    </GradientBackground>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES (tokens only)
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // ── Layout ──
  flex1: { flex: 1, minWidth: 0 },
  rowCenterGap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowCenterGapSm: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Quick access ──
  quickAccessScroll: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  quickAccessRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 44,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },

  // ── Cards ──
  card: {
    padding: spacing.lg,
  },
  tierGap: {},
  cardTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardHeaderMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // ── Hero (Tier 1) ──
  heroCard: {
    padding: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  heroAmount: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs + 2,
    letterSpacing: -1,
  },
  heroDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  deltaBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  deltaSubtext: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroSparkline: {
    marginLeft: spacing.sm,
  },
  splitBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: `${colors.bg}33`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  splitLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  splitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  splitValue: {
    ...typography.bodyBold,
  },
  splitDivider: {
    width: 1,
    backgroundColor: colors.borderGlass,
  },

  // ── Composition (Tier 2) ──
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenterLabel: {
    ...typography.caption,
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
  },
  donutCenterValue: {
    ...typography.smallBold,
    color: colors.text,
    marginTop: 1,
  },
  legendWrap: {
    flex: 1,
    gap: spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendLabel: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendAmount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  legendPct: {
    ...typography.smallBold,
    color: colors.text,
    minWidth: 34,
    textAlign: 'right',
  },

  // ── Cash flow (Tier 3) ──
  cashFlowChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 100,
    paddingHorizontal: 2,
  },
  cashFlowBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  cashFlowBarPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 72,
    gap: 3,
  },
  cashFlowBar: {
    width: 12,
    borderRadius: radius.sm,
  },
  cashFlowBarLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  cashFlowLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cashFlowLegendText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cashFlowSummary: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    backgroundColor: `${colors.bg}26`,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryColLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  summaryColValue: {
    ...typography.smallBold,
    marginTop: 2,
  },
  summaryColDivider: {
    width: 1,
    backgroundColor: colors.borderGlass,
  },

  // ── Accounts (Tier 4) ──
  accountsCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  sectionTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  sectionTotal: {
    ...typography.smallBold,
  },
  countBadge: {
    backgroundColor: colors.glassMedium,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    minHeight: 44,
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    ...typography.smallBold,
    color: colors.text,
  },
  accountSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  accountBalance: {
    ...typography.smallBold,
    flexShrink: 0,
  },

  // ── Debt payoff (Tier 5) ──
  debtRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  debtName: {
    ...typography.small,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  debtMeta: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
  },
  progressTrack: {
    height: spacing.sm - 2,
    backgroundColor: colors.glassLight,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: spacing.sm - 2,
    borderRadius: radius.full,
  },
  debtStatus: {
    ...typography.caption,
    color: colors.textDark,
    marginTop: spacing.xs,
  },
  viewPlan: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '600',
  },

  // ── Empty state ──
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  emptySubcopy: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyCtaWrap: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  emptyCta: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  emptyCtaText: {
    ...typography.button,
    color: colors.text,
  },

  // ── Error state ──
  errorCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.smallBold,
    color: colors.text,
    textAlign: 'center',
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
    marginTop: spacing.xs,
  },

  // ── Skeleton helpers ──
  skelAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
});
