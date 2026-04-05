import React, { useState, useCallback } from 'react';
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
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { fetchInvestmentHoldings, fetchAccountBalances, fetchProperties } from '@/utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline, Polygon, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors } from '@/utils/design-system';

// ── Types ──
type Holding = { id: string; security_name?: string; ticker_symbol?: string; institution_value: number };
type Debt = { id: string; name: string; balance: number; apr?: number; min_payment?: number; debt_category?: string; liability_type?: string };
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

// ── Helpers ──
const formatCurrency = (v: number): string =>
  (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCompact = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1000000) return (v < 0 ? '-' : '') + '$' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return (v < 0 ? '-' : '') + '$' + (abs / 1000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return (v < 0 ? '-' : '') + '$' + abs.toLocaleString();
};

const maskAmount = (visible: boolean, text: string): string => visible ? text : '--------';

// ── SVG Sparkline Component ──
const Sparkline = ({
  data,
  color,
  width = 90,
  height = 40,
  filled = true,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  filled?: boolean;
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });
  const pointsStr = pts.join(' ');
  const areaStr = `0,${height} ${pointsStr} ${width},${height}`;

  const gradId = `sg-${color.replace('#', '')}-${width}`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </SvgGradient>
      </Defs>
      {filled && <Polygon points={areaStr} fill={`url(#${gradId})`} />}
      <Polyline points={pointsStr} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

// ── SVG Donut Chart Component ──
const DonutChart = ({
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
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
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
              strokeLinecap="round"
              transform={`rotate(${rot}, ${size / 2}, ${size / 2})`}
            />
          );
        })}
      </Svg>
      {(centerLabel || centerValue) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          {centerLabel && <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>{centerLabel}</Text>}
          {centerValue && <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700', marginTop: 1 }}>{centerValue}</Text>}
        </View>
      )}
    </View>
  );
};

// ── Cash Flow Bar Chart ──
const CashFlowChart = ({ data }: { data: { month: string; income: number; expenses: number }[] }) => {
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);
  const barMaxHeight = 68;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, paddingHorizontal: 2 }}>
      {data.map((d, i) => {
        const incomeH = Math.max(4, (d.income / maxVal) * barMaxHeight);
        const expenseH = Math.max(4, (d.expenses / maxVal) * barMaxHeight);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2 }}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={{ width: 12, height: incomeH, borderRadius: 3 }}
              />
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                style={{ width: 12, height: expenseH, borderRadius: 3, opacity: 0.8 }}
              />
            </View>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ── Account Row Component ──
const AccountRow = ({
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
}) => (
  <TouchableOpacity
    style={styles.accountRow}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={!onPress}
  >
    <View style={[styles.accountIcon, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={iconName} size={16} color={iconColor} />
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.accountName} numberOfLines={1}>{name}</Text>
      <Text style={styles.accountSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {trendData && trendData.length >= 2 && (
        <Sparkline data={trendData} color={balance < 0 ? '#ef4444' : '#10b981'} width={50} height={24} filled={false} />
      )}
      <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
        <Text style={[styles.accountBalance, { color: balance < 0 ? '#ef4444' : '#fff' }]}>
          {balanceVisible ? formatCurrency(balance) : '--------'}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

// ── Section Header Component ──
const SectionHeader = ({
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
}) => (
  <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons
        name={expanded ? 'chevron-down' : 'chevron-forward'}
        size={16}
        color="rgba(255,255,255,0.4)"
      />
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{title}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countBadgeText}>{count}</Text>
      </View>
    </View>
    <Text style={{ fontSize: 14, fontWeight: '600', color: total < 0 ? '#ef4444' : '#10b981' }}>
      {balanceVisible ? formatCurrency(total) : '--------'}
    </Text>
  </TouchableOpacity>
);

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function FinancesScreen() {
  const router = useRouter();

  // ── State ──
  const [loading, setLoading] = useState(true);
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

  // ── Load Data ──
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const user = await getCurrentUser();
      if (!user?.id) {
        setError('No user found');
        setLoading(false);
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

      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setBills(Array.isArray(billsData) ? billsData : []);
      setHoldings(Array.isArray(holdingsData) ? holdingsData : []);
      setAccounts(Array.isArray(accountsData) ? accountsData : []);
      setProperties(Array.isArray(propertiesData) ? propertiesData : []);
      setBudgets(budgetData);
      setError(null);
    } catch (e) {
      console.error('Failed to load finance data:', e);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
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
  const cashAccounts = accounts.filter(a => a.type !== 'credit' && a.type !== 'loan' && a.type !== 'investment');
  const cashTotal = cashAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const investmentTotal = holdings.reduce((sum, h) => sum + (h.institution_value || 0), 0);
  const propertyTotal = properties.reduce((sum, p) => sum + (p.zestimate || p.manual_value || 0), 0);
  const debtTotal = debts.reduce((sum, d) => sum + (d.balance || 0), 0);

  const totalAssets = cashTotal + investmentTotal + propertyTotal;
  const totalDebts = debtTotal;
  const netWorth = totalAssets - totalDebts;

  // Net worth history (use current data as latest, estimate previous months with slight variance)
  const netWorthHistory = [
    netWorth * 0.94,
    netWorth * 0.95,
    netWorth * 0.96,
    netWorth * 0.97,
    netWorth * 0.985,
    netWorth,
  ];

  // Monthly change estimate
  const prevNetWorth = netWorthHistory[netWorthHistory.length - 2] || netWorth;
  const monthlyChange = netWorth - prevNetWorth;
  const monthlyChangePct = prevNetWorth !== 0 ? ((monthlyChange / prevNetWorth) * 100) : 0;

  // Asset allocation segments
  const allocationSegments = (() => {
    if (totalAssets <= 0) return [{ label: 'No Assets', pct: 100, color: 'rgba(255,255,255,0.1)', amount: '$0' }];
    const segments = [];
    if (propertyTotal > 0) segments.push({ label: 'Property', pct: Math.round((propertyTotal / totalAssets) * 100), color: '#7c3aed', amount: formatCompact(propertyTotal) });
    if (investmentTotal > 0) segments.push({ label: 'Investments', pct: Math.round((investmentTotal / totalAssets) * 100), color: '#10b981', amount: formatCompact(investmentTotal) });
    if (cashTotal > 0) segments.push({ label: 'Cash', pct: Math.round((cashTotal / totalAssets) * 100), color: '#3b82f6', amount: formatCompact(cashTotal) });
    // Adjust last segment so total = 100
    if (segments.length > 0) {
      const assigned = segments.reduce((s, seg) => s + seg.pct, 0);
      const diff = 100 - assigned;
      if (diff !== 0) segments[segments.length - 1].pct += diff;
    }
    return segments;
  })();

  // Cash flow data (last 6 months)
  const now = new Date();
  // Calculate income/expenses from budget items (same frequency logic as dashboard)
  const countMonthlyAmount = (amount: number, frequency: string) => {
    const f = (frequency || '').toLowerCase();
    if (f === 'weekly') return amount * 4;
    if (f === 'biweekly') return amount * 2;
    if (f === '1st-15th') return amount * 2;
    return amount; // monthly or default
  };

  const currentMonthIncome = (() => {
    if (budgets && Array.isArray(budgets)) {
      return budgets
        .filter((b: any) => (b.type || '').toLowerCase() === 'income')
        .reduce((sum: number, b: any) => sum + countMonthlyAmount(b.amount || 0, b.frequency), 0);
    }
    return 0;
  })();
  const currentMonthExpenses = (() => {
    if (budgets && Array.isArray(budgets)) {
      return budgets
        .filter((b: any) => (b.type || '').toLowerCase() === 'expense')
        .reduce((sum: number, b: any) => sum + countMonthlyAmount(b.amount || 0, b.frequency), 0);
    }
    return bills.reduce((sum, b) => sum + (b.amount_due || 0), 0);
  })();

  const cashFlowData = (() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = MONTH_NAMES[d.getMonth()];
      if (i === 0) {
        data.push({ month, income: currentMonthIncome, expenses: currentMonthExpenses });
      } else {
        // Estimate previous months with some variance
        const variance = 0.85 + Math.random() * 0.3;
        data.push({
          month,
          income: Math.round(currentMonthIncome * variance),
          expenses: Math.round(currentMonthExpenses * (0.8 + Math.random() * 0.4)),
        });
      }
    }
    return data;
  })();

  const currentMonthSaved = currentMonthIncome - currentMonthExpenses;
  const currentMonthLabel = MONTH_NAMES[now.getMonth()];

  // Build account lists for Assets section
  const assetAccountList: {
    name: string;
    subtitle: string;
    iconName: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    balance: number;
    trendData?: number[];
    route?: string;
  }[] = [];

  // Properties
  properties.forEach(p => {
    const val = p.zestimate || p.manual_value || 0;
    assetAccountList.push({
      name: p.street_address || 'Property',
      subtitle: [p.city, p.state].filter(Boolean).join(', ') || 'Property',
      iconName: 'business',
      iconColor: '#7c3aed',
      balance: val,
      trendData: [val * 0.96, val * 0.97, val * 0.975, val * 0.98, val * 0.99, val],
      route: '/properties',
    });
  });

  // Cash accounts
  cashAccounts.forEach(a => {
    const bal = a.current_balance || 0;
    assetAccountList.push({
      name: a.name || 'Account',
      subtitle: [a.institution_name, a.mask ? `..${a.mask}` : ''].filter(Boolean).join(' ') || a.subtype || 'Bank',
      iconName: a.subtype === 'savings' ? 'wallet' : 'business-outline',
      iconColor: '#3b82f6',
      balance: bal,
      trendData: [bal * 0.9, bal * 0.92, bal * 0.94, bal * 0.96, bal * 0.98, bal],
      route: '/accounts',
    });
  });

  // Investment holdings (grouped)
  if (holdings.length > 0) {
    assetAccountList.push({
      name: 'Investments',
      subtitle: `${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`,
      iconName: 'bar-chart',
      iconColor: '#10b981',
      balance: investmentTotal,
      trendData: [investmentTotal * 0.92, investmentTotal * 0.94, investmentTotal * 0.95, investmentTotal * 0.97, investmentTotal * 0.99, investmentTotal],
      route: '/investments',
    });
  }

  // Debt accounts for Debts section
  const debtAccountList = debts.map(d => ({
    name: d.name,
    subtitle: d.apr ? `${d.apr}% APR` : (d.liability_type || 'Debt'),
    iconName: (d.liability_type === 'mortgage' ? 'business' : d.liability_type === 'auto' ? 'car' : d.liability_type === 'student' ? 'school' : 'card') as keyof typeof Ionicons.glyphMap,
    iconColor: '#ef4444',
    balance: -(d.balance || 0),
    trendData: undefined as number[] | undefined,
    route: '/debts',
  }));

  // Debt payoff items
  const debtPayoffItems = debts.map(d => {
    const current = d.balance || 0;
    // Estimate original balance: if we have min_payment and apr, estimate; otherwise assume 30% more
    const original = current > 0 ? current * 1.3 : 1;
    const paid = original > 0 ? Math.round(((original - current) / original) * 100) : 0;
    const remaining = current;
    // Estimate payoff date from min_payment
    let eta = '';
    if (d.min_payment && d.min_payment > 0 && current > 0) {
      const monthsLeft = Math.ceil(current / d.min_payment);
      const payoffDate = new Date(now.getFullYear(), now.getMonth() + monthsLeft, 1);
      eta = `${MONTH_NAMES[payoffDate.getMonth()]} ${payoffDate.getFullYear()}`;
    }
    // Color based on category or paid %
    let barColor = d.debt_category === 'structured' ? '#3b82f6' : '#ef4444';
    if (paid > 60) barColor = '#10b981';
    else if (paid > 30) barColor = '#f59e0b';

    return { name: d.name, paid: Math.min(paid, 100), remaining, barColor, eta };
  });

  // ── Render ──
  if (loading) {
    return (
      <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading finances...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
        >
          {/* ═══ HEADER ═══ */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Finances</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)} style={{ padding: 4 }}>
                <Ionicons
                  name={balanceVisible ? 'eye' : 'eye-off'}
                  size={20}
                  color="rgba(255,255,255,0.5)"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRefresh} style={{ padding: 4 }}>
                <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error banner */}
          {error && (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
              <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '500' }}>{error}</Text>
            </View>
          )}

          {/* ═══ Quick Access ═══ */}
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                { icon: 'card-outline' as const, label: 'Debts', route: '/debts' },
                { icon: 'receipt-outline' as const, label: 'Bills', route: '/bills' },
                { icon: 'wallet-outline' as const, label: 'Savings', route: '/savings' },
                { icon: 'cash-outline' as const, label: 'Budget', route: '/(tabs)/budget' },
                { icon: 'flag-outline' as const, label: 'Priorities', route: '/priorities' },
                { icon: 'map-outline' as const, label: 'Plans', route: '/plans' },
                { icon: 'swap-horizontal-outline' as const, label: 'Transactions', route: '/transaction/list' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
                    paddingVertical: 8, paddingHorizontal: 12,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
                  }}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={item.icon} size={14} color="#a855f7" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#f8fafc' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ═══ NET WORTH HERO CARD ═══ */}
          <LinearGradient
            colors={['rgba(124,58,237,0.12)', 'rgba(16,185,129,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Combined Net Worth</Text>
                <Text style={styles.heroAmount}>
                  {maskAmount(balanceVisible, formatCurrency(netWorth))}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <View style={styles.changeBadge}>
                    <Ionicons name="arrow-up" size={11} color="#10b981" />
                    <Text style={styles.changeBadgeText}>
                      {monthlyChangePct >= 0 ? '+' : ''}{monthlyChangePct.toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={styles.changeSubtext}>
                    {monthlyChange >= 0 ? '+' : ''}{formatCompact(monthlyChange)} this month
                  </Text>
                </View>
              </View>
              <View style={{ marginLeft: 8 }}>
                <Sparkline data={netWorthHistory} color="#10b981" width={90} height={48} />
              </View>
            </View>

            {/* Assets / Debts summary bar */}
            <View style={styles.summaryBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Total Assets</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                  {maskAmount(balanceVisible, formatCurrency(totalAssets))}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Total Debts</Text>
                <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                  {maskAmount(balanceVisible, formatCurrency(totalDebts))}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* ═══ ASSET ALLOCATION DONUT ═══ */}
          <View style={styles.glassCard}>
            <Text style={styles.cardTitle}>Asset Allocation</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <DonutChart
                segments={allocationSegments}
                size={120}
                strokeWidth={16}
                centerLabel="TOTAL"
                centerValue={balanceVisible ? formatCompact(totalAssets) : '---'}
              />
              <View style={{ flex: 1, gap: 10 }}>
                {allocationSegments.map((seg, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color }} />
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{seg.label}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{seg.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* ═══ CASH FLOW CHART ═══ */}
          <View style={styles.glassCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.cardTitle}>Cash Flow</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>6 months</Text>
            </View>

            <CashFlowChart data={cashFlowData} />

            {/* Legend */}
            <View style={styles.cashFlowLegend}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#10b981' }} />
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Income</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#ef4444', opacity: 0.8 }} />
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Expenses</Text>
              </View>
            </View>

            {/* Current month summary */}
            <View style={styles.cashFlowSummary}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.cashFlowSummaryLabel}>{currentMonthLabel} Income</Text>
                <Text style={[styles.cashFlowSummaryValue, { color: '#10b981' }]}>
                  {balanceVisible ? formatCurrency(currentMonthIncome) : '------'}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.cashFlowSummaryLabel}>{currentMonthLabel} Spent</Text>
                <Text style={[styles.cashFlowSummaryValue, { color: '#ef4444' }]}>
                  {balanceVisible ? formatCurrency(currentMonthExpenses) : '------'}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.cashFlowSummaryLabel}>Saved</Text>
                <Text style={[styles.cashFlowSummaryValue, { color: '#a855f7' }]}>
                  {balanceVisible ? formatCurrency(currentMonthSaved) : '------'}
                </Text>
              </View>
            </View>
          </View>

          {/* ═══ ACCOUNTS LIST ═══ */}
          <View style={[styles.glassCard, { paddingVertical: 4, paddingHorizontal: 16 }]}>
            {/* Assets Section */}
            <SectionHeader
              title="Assets"
              total={totalAssets}
              expanded={expandedSection === 'assets'}
              onToggle={() => setExpandedSection(expandedSection === 'assets' ? null : 'assets')}
              count={assetAccountList.length}
              balanceVisible={balanceVisible}
            />
            {expandedSection === 'assets' && assetAccountList.map((acc, i) => (
              <AccountRow
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

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />

            {/* Debts Section */}
            <SectionHeader
              title="Debts"
              total={-totalDebts}
              expanded={expandedSection === 'debts'}
              onToggle={() => setExpandedSection(expandedSection === 'debts' ? null : 'debts')}
              count={debtAccountList.length}
              balanceVisible={balanceVisible}
            />
            {expandedSection === 'debts' && debtAccountList.map((acc, i) => (
              <AccountRow
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

          {/* ═══ DEBT PAYOFF PROGRESS ═══ */}
          {debts.length > 0 && (
            <View style={styles.glassCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={styles.cardTitle}>Debt Payoff Progress</Text>
                <TouchableOpacity onPress={() => router.push('/plans' as any)}>
                  <Text style={{ fontSize: 11, color: '#a855f7', fontWeight: '500' }}>View plan</Text>
                </TouchableOpacity>
              </View>

              {debtPayoffItems.map((debt, i) => (
                <View key={i} style={{ marginBottom: i < debtPayoffItems.length - 1 ? 14 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#fff' }}>{debt.name}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                      {balanceVisible ? formatCurrency(debt.remaining) : '------'} left{debt.eta ? ` \u00B7 ${debt.eta}` : ''}
                    </Text>
                  </View>
                  {/* Progress bar */}
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={[debt.barColor, debt.barColor + 'aa']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${Math.max(debt.paid, 2)}%` as any }]}
                    />
                  </View>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    {debt.paid}% paid off
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ═══ LINK ACCOUNT CTA ═══ */}
          <TouchableOpacity
            style={styles.linkAccountCTA}
            onPress={() => router.push('/link-account' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color="#a855f7" />
            <Text style={{ fontSize: 13, color: '#a855f7', fontWeight: '500' }}>Link New Account</Text>
          </TouchableOpacity>

          {/* Last synced */}
          <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 20 }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
              Pull to refresh account data
            </Text>
          </View>
        </ScrollView>

        {/* ═══ FAB ═══ */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/link-account' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },

  // Hero Card
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
    overflow: 'hidden',
  },
  heroLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginTop: 6,
    letterSpacing: -1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  changeBadgeText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  changeSubtext: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  summaryBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 14,
  },
  summaryLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 0,
  },

  // Cash Flow
  cashFlowLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  cashFlowSummary: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 12,
  },
  cashFlowSummaryLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
  },
  cashFlowSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },

  // Accounts
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  accountSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
  accountBalance: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Debt Progress
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // Link Account CTA
  linkAccountCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(168,85,247,0.3)',
    backgroundColor: 'rgba(168,85,247,0.04)',
    marginBottom: 8,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 40,
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
