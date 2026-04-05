import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Switch,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../utils/apiClient';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

// ── Types ──
type Debt = {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  balance: number;
  apr: number;
  min_payment: number;
  due_day?: number | null;
  strategy: string;
  is_shared: boolean;
  debt_category: 'attack' | 'structured';
  liability_type: string;
  asset_depreciates?: boolean;
};

type Bill = {
  id: string;
  name: string;
  amount_due: number;
  due_day: number;
  frequency: string;
  debt_account_id?: string | null;
};

// ── Constants ──
const LIABILITY_TYPES = [
  { value: 'credit', label: 'Credit Card' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'student', label: 'Student Loan' },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'medical', label: 'Medical Debt' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_CATEGORIES: Record<string, string> = {
  credit: 'attack', auto: 'attack', personal: 'attack',
  medical: 'attack', student: 'attack', mortgage: 'structured', other: 'attack',
};

const DEBT_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  credit: 'card',
  mortgage: 'business',
  student: 'school',
  auto: 'car',
  personal: 'wallet',
  medical: 'heart',
  other: 'ellipsis-horizontal',
};

const C = {
  bg: '#0f0a1e',
  surface: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  accent: '#a855f7',
  accentDark: '#7c3aed',
  pink: '#ec4899',
  income: '#34d399',
  attack: '#f87171',
  structured: '#60a5fa',
  warning: '#fbbf24',
  textPrimary: '#f8fafc',
  textMuted: '#94a3b8',
  textDim: 'rgba(255,255,255,0.3)',
};

// ── Helpers ──
const fmt = (v: number) =>
  '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtShort = (n: number) => {
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return '$' + n.toLocaleString();
};

const getDebtIcon = (liabilityType: string): keyof typeof Ionicons.glyphMap => {
  return DEBT_TYPE_ICONS[liabilityType] || 'ellipsis-horizontal';
};

const getTypeLabel = (liabilityType: string): string => {
  return LIABILITY_TYPES.find(t => t.value === liabilityType)?.label || liabilityType;
};

const getPaidPercent = (balance: number): number => {
  // Estimate: without original balance, use a heuristic
  return Math.max(0, Math.round((1 - balance / (balance * 1.3)) * 100));
};

const getEstMonths = (balance: number, minPayment: number): number => {
  if (minPayment <= 0) return 999;
  return Math.ceil(balance / minPayment);
};

const getEstDate = (months: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yr = String(d.getFullYear()).slice(2);
  return `${monthNames[d.getMonth()]} '${yr}`;
};

// ── MiniRing Component ──
const MiniRing = ({ percent, size = 42, strokeWidth = 3, color }: {
  percent: number; size?: number; strokeWidth?: number; color: string;
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
      />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${circ}`} strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90} origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
};

// ── Payoff Timeline Bar ──
const PayoffTimeline = ({ debts }: { debts: { name: string; estMonths: number; estDate: string; category: string }[] }) => {
  const maxMonths = Math.max(...debts.map(d => d.estMonths), 1);
  return (
    <View style={{ gap: 8 }}>
      {debts.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, width: 70, textAlign: 'right' }} numberOfLines={1}>
            {d.name}
          </Text>
          <View style={{ flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <LinearGradient
              colors={d.category === 'attack'
                ? [C.attack, C.attack + '88']
                : [C.structured, C.structured + '88']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{
                height: 8, borderRadius: 4,
                width: `${Math.min((d.estMonths / maxMonths) * 100, 100)}%` as any,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, color: C.textMuted, width: 50 }}>{d.estDate}</Text>
        </View>
      ))}
    </View>
  );
};

// ── Debt Card Component ──
const DebtCard = ({
  debt,
  expanded,
  onToggle,
  onMakePayment,
  onEditDetails,
  billExists,
  onBillAction,
  onLinkBill,
  onToggleCategory,
}: {
  debt: Debt;
  expanded: boolean;
  onToggle: () => void;
  onMakePayment: () => void;
  onEditDetails: () => void;
  billExists: boolean;
  onBillAction: () => void;
  onLinkBill: () => void;
  onToggleCategory: () => void;
}) => {
  const catColor = (debt.debt_category || 'attack') === 'attack' ? C.attack : C.structured;
  const icon = getDebtIcon(debt.liability_type);
  const paidPercent = getPaidPercent(debt.balance);
  const estMonths = getEstMonths(debt.balance, debt.min_payment);
  const estDate = getEstDate(estMonths);
  const typeLabel = getTypeLabel(debt.liability_type);

  return (
    <View style={styles.debtCard}>
      {/* Main row - tappable */}
      <TouchableOpacity onPress={onToggle} style={styles.debtCardRow} activeOpacity={0.7}>
        {/* Icon + ring */}
        <View style={{ position: 'relative', width: 42, height: 42 }}>
          <MiniRing percent={paidPercent} size={42} strokeWidth={3} color={catColor} />
          <View style={styles.debtCardIconCenter}>
            <Ionicons name={icon} size={16} color={catColor} />
          </View>
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary }}>{debt.name}</Text>
            <View style={{
              backgroundColor: catColor + '18',
              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
            }}>
              <Text style={{
                fontSize: 8, fontWeight: '700', letterSpacing: 0.5,
                textTransform: 'uppercase', color: catColor,
              }}>
                {debt.debt_category || 'attack'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <View style={{
              width: 5, height: 5, borderRadius: 3,
              backgroundColor: debt.is_shared ? C.pink : C.accent,
            }} />
            <Text style={{ fontSize: 10, color: C.textMuted }}>
              {debt.is_shared ? 'Shared' : 'Personal'} {'\u00B7'} {debt.apr}% APR{debt.due_day ? ` \u00B7 Due ${debt.due_day}th` : ''}
            </Text>
          </View>
        </View>

        {/* Balance + chevron */}
        <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary }}>{fmt(debt.balance)}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{paidPercent}% paid</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.textDim}
        />
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <LinearGradient
            colors={[catColor, catColor + '88']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              height: 4, borderRadius: 2,
              width: `${paidPercent}%` as any,
            }}
          />
        </View>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.debtCardExpanded}>
          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Min Payment', value: fmt(debt.min_payment), iconName: 'cash-outline' as keyof typeof Ionicons.glyphMap },
              { label: 'Payoff Date', value: estDate, iconName: 'calendar-outline' as keyof typeof Ionicons.glyphMap },
              { label: 'Strategy', value: debt.strategy === 'avalanche' ? 'Avalanche' : debt.strategy === 'snowball' ? 'Snowball' : 'Standard', iconName: 'flag-outline' as keyof typeof Ionicons.glyphMap },
            ].map((s, i) => (
              <View key={i} style={styles.statBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                  <Ionicons name={s.iconName} size={11} color={C.textDim} />
                  <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '500' }}>{s.label}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPrimary, textAlign: 'center' }}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={onMakePayment} activeOpacity={0.8}>
              <LinearGradient
                colors={[C.accent, C.accentDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.actionBtnPrimary}
              >
                <Ionicons name="cash-outline" size={14} color="white" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>Make Payment</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnSecondary, { flex: 1 }]}
              onPress={onEditDetails}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, fontWeight: '500', color: C.textMuted }}>Edit Details</Text>
            </TouchableOpacity>
          </View>

          {/* Category toggle + bill actions row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
                backgroundColor: (debt.debt_category || 'attack') === 'attack'
                  ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
              }}
              onPress={onToggleCategory}
            >
              <Ionicons
                name={(debt.debt_category || 'attack') === 'attack' ? 'flash' : 'shield-checkmark'}
                size={14}
                color={(debt.debt_category || 'attack') === 'attack' ? C.attack : C.structured}
              />
              <Text style={{
                color: (debt.debt_category || 'attack') === 'attack' ? C.attack : C.structured,
                fontWeight: '700', fontSize: 12,
              }}>
                {(debt.debt_category || 'attack') === 'attack' ? 'Attack' : 'Structured'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
                backgroundColor: 'rgba(96,165,250,0.12)',
              }}
              onPress={onBillAction}
            >
              <Ionicons
                name={billExists ? 'receipt-outline' : 'add-circle-outline'}
                size={14} color={C.structured}
              />
              <Text style={{ color: C.structured, fontWeight: '700', fontSize: 12 }}>
                {billExists ? 'View Bill' : 'Create Bill'}
              </Text>
            </TouchableOpacity>

            {!billExists && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
                  backgroundColor: 'rgba(168,85,247,0.12)',
                }}
                onPress={onLinkBill}
              >
                <Ionicons name="link" size={14} color={C.accent} />
                <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12 }}>Link Bill</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ── Main Screen ──
export default function DebtsScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [billDebt, setBillDebt] = useState<Debt | null>(null);
  const [billFreq, setBillFreq] = useState('monthly');
  const [linkBillDebt, setLinkBillDebt] = useState<Debt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'attack' | 'structured'>('all');

  // Form state
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [strategy, setStrategy] = useState('');
  const [createBill, setCreateBill] = useState(false);
  const [billFrequency, setBillFrequency] = useState('monthly');
  const [isShared, setIsShared] = useState(true);
  const [liabilityType, setLiabilityType] = useState('other');
  const [debtCategory, setDebtCategory] = useState<'attack' | 'structured'>('attack');

  const loadDebts = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const [debtsData, billsData] = await Promise.all([
        api.get<Debt[]>('/auth/debts', { user_id: userId }),
        api.get<Bill[]>('/auth/bills', { user_id: userId }),
      ]);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setBills(Array.isArray(billsData) ? billsData : []);
      setError(null);
    } catch (e) {
      console.error('Failed to load debts:', e);
      setError('Failed to load debts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const resetForm = () => {
    setName('');
    setBalance('');
    setApr('');
    setMinPayment('');
    setDueDay('');
    setStrategy('');
    setCreateBill(false);
    setBillFrequency('monthly');
    setIsShared(true);
    setLiabilityType('other');
    setDebtCategory('attack');
    setEditing(null);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setName(d.name);
    setBalance(String(d.balance));
    setApr(String(d.apr));
    setMinPayment(String(d.min_payment));
    setDueDay(d.due_day != null ? String(d.due_day) : '');
    setStrategy(d.strategy || '');
    setIsShared(d.is_shared);
    setLiabilityType(d.liability_type || 'other');
    setDebtCategory(d.debt_category || 'attack');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!balance || isNaN(Number(balance))) {
      Alert.alert('Validation', 'Enter a valid balance.');
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }

    const payload = {
      user_id: userId,
      name: name.trim(),
      balance: parseFloat(balance),
      apr: parseFloat(apr) || 0,
      min_payment: parseFloat(minPayment) || 0,
      due_day: dueDay ? parseInt(dueDay) : null,
      strategy: strategy.trim(),
      is_shared: isShared,
      liability_type: liabilityType,
      debt_category: debtCategory,
    };

    try {
      if (editing) {
        await api.put(`/auth/debts/${editing.id}`, payload);
      } else {
        const newDebt = await api.post<{ id: string }>('/auth/debts', payload);

        if (createBill && newDebt?.id) {
          try {
            await api.post('/auth/bills', {
              user_id: userId,
              name: name.trim() + ' Payment',
              amount_due: parseFloat(minPayment) || 0,
              due_day: dueDay ? parseInt(dueDay) : 1,
              frequency: billFrequency,
              debt_account_id: newDebt.id,
              is_autopay: false,
              is_shared: isShared,
            });
          } catch (billErr) {
            console.error('Auto-create bill error:', billErr);
            Alert.alert('Note', 'Debt created but the associated bill could not be created.');
          }
        }
      }
      setShowForm(false);
      resetForm();
      loadDebts();
    } catch (e) {
      console.error('Save debt error:', e);
      Alert.alert('Error', 'Failed to save debt.');
    }
  };

  const handlePayment = async () => {
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      Alert.alert('Validation', 'Enter a valid payment amount.');
      return;
    }
    try {
      await api.patch(`/auth/debts/${paymentId}/payment`, {
        amount: parseFloat(paymentAmount),
      });
      setPaymentId(null);
      setPaymentAmount('');
      loadDebts();
    } catch (e) {
      console.error('Payment error:', e);
      Alert.alert('Error', 'Failed to apply payment.');
    }
  };

  const handleCreateBillFromDebt = async () => {
    if (!billDebt) return;
    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }
    try {
      await api.post('/auth/bills', {
        user_id: userId,
        name: billDebt.name + ' Payment',
        amount_due: billDebt.min_payment || 0,
        due_day: billDebt.due_day ?? 1,
        frequency: billFreq,
        debt_account_id: billDebt.id,
        is_autopay: false,
        is_shared: false,
      });
      Alert.alert('Success', `Bill created for "${billDebt.name}".`);
      setBillDebt(null);
      setBillFreq('monthly');
      loadDebts();
    } catch (e) {
      console.error('Create bill error:', e);
      Alert.alert('Error', 'Failed to create bill.');
    }
  };

  const toggleCategory = async (d: Debt) => {
    const newCat = d.debt_category === 'attack' ? 'structured' : 'attack';
    try {
      await api.put(`/auth/debts/${d.id}/category`, { debt_category: newCat });
      setDebts(prev => prev.map(x => x.id === d.id ? { ...x, debt_category: newCat } : x));
    } catch (e) {
      console.error('Toggle category error:', e);
    }
  };

  // Build lookup: debt_account_id -> bill
  const billsByDebtId: Record<string, Bill> = {};
  bills.forEach((b) => {
    if (b.debt_account_id) billsByDebtId[b.debt_account_id] = b;
  });

  // Computed values
  const attackDebts = useMemo(() => debts.filter(d => (d.debt_category || 'attack') === 'attack'), [debts]);
  const structuredDebts = useMemo(() => debts.filter(d => d.debt_category === 'structured'), [debts]);
  const totalBalance = useMemo(() => debts.reduce((s, d) => s + (d.balance || 0), 0), [debts]);
  const totalMinPayment = useMemo(() => debts.reduce((s, d) => s + (d.min_payment || 0), 0), [debts]);
  const attackTotal = useMemo(() => attackDebts.reduce((s, d) => s + (d.balance || 0), 0), [attackDebts]);
  const structuredTotal = useMemo(() => structuredDebts.reduce((s, d) => s + (d.balance || 0), 0), [structuredDebts]);
  const weightedApr = useMemo(() => {
    if (totalBalance <= 0) return 0;
    return debts.reduce((s, d) => s + d.apr * d.balance, 0) / totalBalance;
  }, [debts, totalBalance]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return debts;
    return debts.filter(d => (d.debt_category || 'attack') === activeFilter);
  }, [debts, activeFilter]);

  // AI nudges for debts
  const [nudges, setNudges] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<any[]>('/auth/ai/nudges');
        if (Array.isArray(data)) {
          // Filter for debt-related nudges
          const debtNudges = data.filter(n =>
            n.nudge_type === 'debt_progress' ||
            n.nudge_type === 'debt_category_suggestion' ||
            n.nudge_type === 'debt_reclassification' ||
            n.nudge_type === 'structured_debt_milestone'
          );
          setNudges(debtNudges);
        }
      } catch {}
    })();
  }, [debts]);

  // Payoff timeline data (exclude mortgages)
  const timelineDebts = useMemo(() => {
    return debts
      .filter(d => d.liability_type !== 'mortgage')
      .map(d => ({
        name: d.name,
        estMonths: getEstMonths(d.balance, d.min_payment),
        estDate: getEstDate(getEstMonths(d.balance, d.min_payment)),
        category: d.debt_category || 'attack',
      }))
      .sort((a, b) => a.estMonths - b.estMonths);
  }, [debts]);

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.navigate('/(tabs)/goals' as any)}
                style={styles.iconButton}
              >
                <Ionicons name="arrow-back" size={20} color={C.textMuted} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Debts</Text>
            </View>
            <TouchableOpacity
              onPress={() => { resetForm(); setShowForm(true); }}
              style={styles.addButton}
            >
              <Ionicons name="add" size={18} color={C.accent} />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={{ paddingHorizontal: 16 }}>
              <ErrorState
                title="Something went wrong"
                message={error}
                onRetry={() => {
                  setError(null);
                  setLoading(true);
                  loadDebts();
                }}
              />
            </View>
          )}

          {!error && loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : !error && debts.length === 0 ? (
            <View style={{ paddingHorizontal: 16 }}>
              <EmptyState
                icon="trending-down-outline"
                title="No debts tracked"
                description="Add your first debt to start tracking and managing them"
                actionLabel="Add Debt"
                onAction={() => { resetForm(); setShowForm(true); }}
              />
            </View>
          ) : !error ? (
            <>
              {/* ── Hero Summary Card ── */}
              <View style={styles.heroCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '500' }}>Total Debt</Text>
                    <Text style={{ fontSize: 30, fontWeight: '800', color: C.textPrimary, marginTop: 4, letterSpacing: -1 }}>
                      {fmt(totalBalance)}
                    </Text>
                  </View>
                  <View style={styles.changeBadge}>
                    <Ionicons name="arrow-down" size={12} color={C.income} />
                    <Text style={{ fontSize: 11, color: C.income, fontWeight: '600' }}>-{fmtShort(totalMinPayment)}</Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, color: C.textMuted }}>Min. Payment</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary, marginTop: 2 }}>{fmt(totalMinPayment)}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, color: C.textMuted }}>Avg. APR</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.warning, marginTop: 2 }}>{weightedApr.toFixed(1)}%</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, color: C.textMuted }}>Accounts</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary, marginTop: 2 }}>{debts.length}</Text>
                  </View>
                </View>

                {/* Attack vs Structured breakdown */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <View style={styles.attackMiniCard}>
                    <Ionicons name="flame" size={14} color={C.attack} />
                    <View>
                      <Text style={{ fontSize: 9, color: C.attack, fontWeight: '600' }}>ATTACK</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPrimary }}>{fmtShort(attackTotal)}</Text>
                    </View>
                  </View>
                  <View style={styles.structuredMiniCard}>
                    <Ionicons name="shield-checkmark" size={14} color={C.structured} />
                    <View>
                      <Text style={{ fontSize: 9, color: C.structured, fontWeight: '600' }}>STRUCTURED</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPrimary }}>{fmtShort(structuredTotal)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── AI Nudges ── */}
              {nudges.slice(0, 2).map((nudge) => (
                <TouchableOpacity
                  key={nudge.id}
                  style={styles.aiInsightCard}
                  activeOpacity={0.8}
                  onPress={async () => {
                    try { await api.post(`/auth/ai/nudges/${nudge.id}/dismiss`); } catch {}
                    setNudges(prev => prev.filter(n => n.id !== nudge.id));
                    if (nudge.action_type === 'ask_ai') {
                      router.navigate('/(tabs)/ai-chat' as any);
                    } else if (nudge.action_type === 'navigate_to' && nudge.action_data) {
                      router.push(nudge.action_data as any);
                    }
                  }}
                >
                  <LinearGradient
                    colors={[C.accentDark, C.accent]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.aiInsightIcon}
                  >
                    <Ionicons name="sparkles" size={16} color="white" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#f8fafc', marginBottom: 2 }}>{nudge.title}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 16 }}>{nudge.body}</Text>
                  </View>
                  <Ionicons name="close" size={14} color={C.textDim} />
                </TouchableOpacity>
              ))}

              {/* ── Payoff Timeline ── */}
              {timelineDebts.length > 0 && (
                <View style={styles.timelineCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="time-outline" size={14} color={C.accent} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPrimary }}>Payoff Timeline</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push('/payoff-calculator')}
                      style={styles.calcButton}
                    >
                      <Ionicons name="calculator-outline" size={11} color={C.accent} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: C.accent }}>Calculator</Text>
                    </TouchableOpacity>
                  </View>
                  <PayoffTimeline debts={timelineDebts} />
                  <Text style={{ marginTop: 10, fontSize: 10, color: C.textDim, textAlign: 'center' }}>
                    Mortgage excluded {'\u00B7'} Based on minimum payments
                  </Text>
                </View>
              )}

              {/* ── Filter Tabs ── */}
              <View style={styles.filterRow}>
                {([
                  { id: 'all' as const, label: 'All', count: debts.length, color: undefined },
                  { id: 'attack' as const, label: 'Attack', count: attackDebts.length, color: C.attack },
                  { id: 'structured' as const, label: 'Structured', count: structuredDebts.length, color: C.structured },
                ] as const).map(f => {
                  const isActive = activeFilter === f.id;
                  const tabColor = f.color || C.accent;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setActiveFilter(f.id)}
                      style={[
                        styles.filterTab,
                        {
                          backgroundColor: isActive ? tabColor + '18' : 'rgba(255,255,255,0.04)',
                          borderColor: isActive ? tabColor + '30' : C.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      {f.id === 'attack' && (
                        <Ionicons name="flame" size={11} color={isActive ? C.attack : C.textMuted} />
                      )}
                      {f.id === 'structured' && (
                        <Ionicons name="shield-checkmark" size={11} color={isActive ? C.structured : C.textMuted} />
                      )}
                      <Text style={{
                        fontSize: 12, fontWeight: '600',
                        color: isActive ? tabColor : C.textMuted,
                      }}>
                        {f.label}
                      </Text>
                      <View style={styles.filterBadge}>
                        <Text style={{
                          fontSize: 10, fontWeight: '700',
                          color: isActive ? tabColor : C.textDim,
                        }}>
                          {f.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── Debt Cards ── */}
              <View style={{ paddingHorizontal: 16 }}>
                {filtered.map(debt => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    expanded={expandedId === debt.id}
                    onToggle={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
                    onMakePayment={() => { setPaymentId(debt.id); setPaymentAmount(''); }}
                    onEditDetails={() => openEdit(debt)}
                    billExists={!!billsByDebtId[debt.id]}
                    onBillAction={() => {
                      if (billsByDebtId[debt.id]) {
                        router.push('/bills');
                      } else {
                        setBillDebt(debt);
                        setBillFreq('monthly');
                      }
                    }}
                    onLinkBill={() => setLinkBillDebt(debt)}
                    onToggleCategory={() => toggleCategory(debt)}
                  />
                ))}
              </View>

              {/* ── Add Debt CTA ── */}
              <TouchableOpacity
                style={styles.addDebtCta}
                onPress={() => { resetForm(); setShowForm(true); }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={C.accent} />
                <Text style={{ fontSize: 13, color: C.accent, fontWeight: '500' }}>Add New Debt</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>

        {/* ── Add/Edit Modal ── */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Edit Debt' : 'Add Debt'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setShowForm(false); resetForm(); }}
                  >
                    <Ionicons name="close" size={24} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Chase Credit Card"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.label}>Balance</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={balance}
                  onChangeText={setBalance}
                />

                <Text style={styles.label}>APR (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={apr}
                  onChangeText={setApr}
                />

                <Text style={styles.label}>Min Payment</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={minPayment}
                  onChangeText={setMinPayment}
                />

                <Text style={styles.label}>Due Day (1-31)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="15"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={dueDay}
                  onChangeText={setDueDay}
                />

                <Text style={styles.label}>Debt Type</Text>
                <View style={styles.freqRow}>
                  {LIABILITY_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.freqBtn, liabilityType === t.value && styles.freqBtnActive]}
                      onPress={() => {
                        setLiabilityType(t.value);
                        setDebtCategory((DEFAULT_CATEGORIES[t.value] || 'attack') as 'attack' | 'structured');
                      }}
                    >
                      <Text style={[styles.freqText, liabilityType === t.value && styles.freqTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Category</Text>
                <View style={styles.strategyRow}>
                  {(['attack', 'structured'] as const).map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.strategyBtn,
                        debtCategory === c && (c === 'attack'
                          ? { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.7)' }
                          : { backgroundColor: 'rgba(59,130,246,0.18)', borderColor: 'rgba(59,130,246,0.7)' }
                        ),
                      ]}
                      onPress={() => setDebtCategory(c)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons
                          name={c === 'attack' ? 'flash' : 'shield-checkmark'}
                          size={14}
                          color={debtCategory === c ? (c === 'attack' ? '#f87171' : '#60a5fa') : '#94a3b8'}
                        />
                        <Text style={[
                          styles.strategyText,
                          debtCategory === c && { color: '#fff', fontWeight: '700' },
                        ]}>
                          {c === 'attack' ? 'Attack' : 'Structured'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                  {debtCategory === 'attack' ? 'Pay off aggressively with extra payments' : 'Pay minimums on schedule (e.g., mortgage)'}
                </Text>

                <Text style={styles.label}>Strategy</Text>
                <View style={styles.strategyRow}>
                  {['avalanche', 'snowball', ''].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.strategyBtn, strategy === s && styles.strategyBtnActive]}
                      onPress={() => setStrategy(s)}
                    >
                      <Text style={[styles.strategyText, strategy === s && styles.strategyTextActive]}>
                        {s || 'None'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.billToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.billToggleLabel}>Share with partner</Text>
                    <Text style={styles.billToggleDesc}>Visible to your household partner</Text>
                  </View>
                  <Switch
                    value={isShared}
                    onValueChange={setIsShared}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(168,85,247,0.4)' }}
                    thumbColor={isShared ? '#c084fc' : '#64748b'}
                  />
                </View>

                {/* Create Associated Bill toggle - only for new debts */}
                {!editing && (
                  <>
                    <View style={styles.billToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.billToggleLabel}>Create associated bill</Text>
                        <Text style={styles.billToggleDesc}>Auto-create a recurring bill linked to this debt</Text>
                      </View>
                      <Switch
                        value={createBill}
                        onValueChange={setCreateBill}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(168,85,247,0.4)' }}
                        thumbColor={createBill ? '#c084fc' : '#64748b'}
                      />
                    </View>

                    {createBill && (
                      <View style={styles.billOptionsCard}>
                        <Ionicons name="receipt-outline" size={16} color="#60a5fa" style={{ marginBottom: 8 }} />
                        <Text style={styles.billOptionsHint}>
                          Bill: "{name.trim() || '...'} Payment" for {minPayment ? `$${minPayment}` : '$0'} due day {dueDay || '1'}
                        </Text>
                        <Text style={[styles.label, { marginTop: 10 }]}>Frequency</Text>
                        <View style={styles.freqRow}>
                          {(['monthly', 'biweekly', 'weekly', 'quarterly', 'yearly'] as const).map((f) => (
                            <TouchableOpacity
                              key={f}
                              style={[styles.freqBtn, billFrequency === f && styles.freqBtnActive]}
                              onPress={() => setBillFrequency(f)}
                            >
                              <Text style={[styles.freqText, billFrequency === f && styles.freqTextActive]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                  <LinearGradient
                    colors={['#a855f7', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnInner}
                  >
                    <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Debt'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── Payment Modal ── */}
        <Modal visible={paymentId !== null} animationType="fade" transparent>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPaymentId(null)}
          >
            <View style={styles.paymentSheet}>
              <Text style={styles.modalTitle}>Apply Payment</Text>
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Payment amount"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
              <TouchableOpacity onPress={handlePayment} style={styles.saveBtn}>
                <LinearGradient
                  colors={['#34d399', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnInner}
                >
                  <Text style={styles.saveBtnText}>Apply Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Create Bill from Debt Modal ── */}
        <Modal visible={billDebt !== null} animationType="fade" transparent>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setBillDebt(null)}
          >
            <View style={styles.paymentSheet}>
              <Text style={styles.modalTitle}>Create Bill</Text>
              {billDebt && (
                <View style={styles.billPreview}>
                  <Ionicons name="receipt-outline" size={16} color="#60a5fa" style={{ marginBottom: 6 }} />
                  <Text style={styles.billPreviewText}>
                    "{billDebt.name} Payment" for {fmt(billDebt.min_payment || 0)} due day {billDebt.due_day ?? 1}
                  </Text>
                </View>
              )}
              <Text style={[styles.label, { marginTop: 12 }]}>Frequency</Text>
              <View style={styles.freqRow}>
                {(['monthly', 'biweekly', 'weekly', 'quarterly', 'yearly'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.freqBtn, billFreq === f && styles.freqBtnActive]}
                    onPress={() => setBillFreq(f)}
                  >
                    <Text style={[styles.freqText, billFreq === f && styles.freqTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={handleCreateBillFromDebt} style={styles.saveBtn}>
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnInner}
                >
                  <Text style={styles.saveBtnText}>Create Bill</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── Link Existing Bill to Debt Modal ── */}
        <Modal visible={linkBillDebt !== null} animationType="fade" transparent>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setLinkBillDebt(null)}
          >
            <View style={styles.paymentSheet}>
              <Text style={styles.modalTitle}>Link Bill to Debt</Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
                Select a bill to link to "{linkBillDebt?.name}"
              </Text>
              {(() => {
                const unlinkedBills = bills.filter(b => !b.debt_account_id);
                if (unlinkedBills.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <Ionicons name="receipt-outline" size={32} color="rgba(255,255,255,0.2)" />
                      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>No unlinked bills available</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setLinkBillDebt(null);
                          if (linkBillDebt) {
                            setBillDebt(linkBillDebt);
                            setBillFreq('monthly');
                          }
                        }}
                        style={{ marginTop: 12 }}
                      >
                        <Text style={{ color: '#a855f7', fontWeight: '700', fontSize: 13 }}>Create a new bill instead</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                return (
                  <ScrollView style={{ maxHeight: 300 }}>
                    {unlinkedBills.map(bill => (
                      <TouchableOpacity
                        key={bill.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          padding: 14, borderRadius: 12, marginBottom: 6,
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
                        }}
                        onPress={async () => {
                          try {
                            await api.put(`/auth/bills/${bill.id}`, {
                              ...bill,
                              debt_account_id: linkBillDebt?.id,
                            });
                            Alert.alert('Success', `"${bill.name}" linked to "${linkBillDebt?.name}".`);
                            setLinkBillDebt(null);
                            loadDebts();
                          } catch (e) {
                            console.error('Link bill error:', e);
                            Alert.alert('Error', 'Failed to link bill.');
                          }
                        }}
                      >
                        <View>
                          <Text style={{ color: '#f8fafc', fontWeight: '600', fontSize: 14 }}>{bill.name}</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                            ${bill.amount_due?.toFixed(2)} · Due {bill.due_day}{bill.due_day === 1 ? 'st' : bill.due_day === 2 ? 'nd' : bill.due_day === 3 ? 'rd' : 'th'}
                          </Text>
                        </View>
                        <Ionicons name="link" size={16} color="#a855f7" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                );
              })()}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 16,
  },
  headerTitle: {
    color: C.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  iconButton: {
    padding: 2,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },

  // Hero Summary Card
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(248,113,113,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.12)',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  attackMiniCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.1)',
  },
  structuredMiniCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.1)',
  },

  // AI Insight
  aiInsightCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiInsightIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Payoff Timeline
  timelineCard: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  calcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },

  // Debt Card
  debtCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  debtCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  debtCardIconCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtCardExpanded: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // Add Debt CTA
  addDebtCta: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(168,85,247,0.3)',
    backgroundColor: 'rgba(168,85,247,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.textPrimary,
    borderWidth: 1,
    borderColor: C.border,
    fontSize: 15,
  },
  strategyRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  strategyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.border,
  },
  strategyBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.7)',
  },
  strategyText: {
    color: '#e5e7eb',
    textTransform: 'capitalize',
    fontSize: 13,
  },
  strategyTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  billToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.15)',
  },
  billToggleLabel: {
    color: C.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  billToggleDesc: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  billOptionsCard: {
    marginTop: 10,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  billOptionsHint: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  freqBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.border,
  },
  freqBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  freqText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  freqTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  paymentSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  billPreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.15)',
  },
  billPreviewText: {
    color: C.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
