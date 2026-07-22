import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../utils/apiClient';
import { fetchAccountBalances } from '../utils/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import { Skeleton, SkeletonStack } from '@/components/Skeleton';
import GradientBackground from '@/components/GradientBackground';
import { DebtNudgeCard, type DebtNudge } from '@/components/debts-NudgeCard';
import {
  colors,
  gradients,
  glassEffects,
  spacing,
  radius,
  typography,
} from '@/utils/design-system';
import {
  FormSheet,
  FormField,
  FormInput,
  AmountInput,
  FormChips,
  FormSwitchRow,
  FormButton,
} from '@/components/form';
import { successHaptic, errorHaptic } from '@/utils/haptics';

// ── Types ──
type Debt = {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  balance: number;
  original_balance?: number;
  apr: number;
  min_payment: number;
  due_day?: number | null;
  strategy: string;
  is_shared: boolean;
  debt_category: 'attack' | 'structured';
  liability_type: string;
  asset_depreciates?: boolean;
  /** When set, this debt's balance mirrors the linked bank account on every sync. */
  linked_balance_id?: string | null;
  linked_account_name?: string;
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

// Attack maps to error (urgency/heat), Structured to info (steady/managed).
const bucketColor = (cat: string): string =>
  (cat || 'attack') === 'attack' ? colors.error : colors.info;

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

// Real payoff progress against the recorded opening balance. A debt with no
// history yet (original == balance) honestly reads 0% instead of the old
// fabricated ~23% heuristic.
const getPaidPercent = (balance: number, originalBalance?: number): number => {
  if (balance <= 0) return 100;
  const original = originalBalance && originalBalance > 0 ? originalBalance : 0;
  if (original <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((1 - balance / original) * 100)));
};

const getEstMonths = (balance: number, minPayment: number): number => {
  if (minPayment <= 0) return 999;
  return Math.ceil(balance / minPayment);
};

const getEstDate = (months: number): string => {
  if (months >= 999) return '—';
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yr = String(d.getFullYear()).slice(2);
  return `${monthNames[d.getMonth()]} '${yr}`;
};

// ── MiniRing Component ──
const MiniRing = ({ percent, size = 42, strokeWidth = 3, color }: {
  percent: number; size?: number; strokeWidth?: number; color: string;
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circ - (clamped / 100) * circ;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={colors.glassMedium} strokeWidth={strokeWidth}
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
    <View style={{ gap: spacing.sm }}>
      {debts.map((d, i) => {
        const bc = bucketColor(d.category);
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.textMuted, width: 70, textAlign: 'right' }} numberOfLines={1}>
              {d.name}
            </Text>
            <View style={{ flex: 1, height: 8, backgroundColor: colors.glassMedium, borderRadius: radius.sm, overflow: 'hidden' }}>
              <LinearGradient
                colors={[bc, bc + '88']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{
                  height: 8, borderRadius: radius.sm,
                  width: `${Math.min((d.estMonths / maxMonths) * 100, 100)}%` as any,
                }}
              />
            </View>
            <Text style={{ ...typography.caption, color: colors.textMuted, width: 50 }}>{d.estDate}</Text>
          </View>
        );
      })}
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
  const cat = debt.debt_category || 'attack';
  const catColor = bucketColor(cat);
  const icon = getDebtIcon(debt.liability_type);
  const paidPercent = getPaidPercent(debt.balance, debt.original_balance);
  const estMonths = getEstMonths(debt.balance, debt.min_payment);
  const estDate = getEstDate(estMonths);

  return (
    <View style={styles.debtCard}>
      {/* Main row - tappable */}
      <TouchableOpacity
        onPress={onToggle}
        style={styles.debtCardRow}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${debt.name}, ${cat === 'attack' ? 'Attack' : 'Structured'}, balance ${fmt(debt.balance)}, ${paidPercent} percent paid, ${debt.is_shared ? 'Shared' : 'Personal'}`}
        accessibilityHint="Double tap to expand details"
      >
        {/* Icon + ring */}
        <View style={{ position: 'relative', width: 42, height: 42 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MiniRing percent={paidPercent} size={42} strokeWidth={3} color={catColor} />
          <View style={styles.debtCardIconCenter}>
            <Ionicons name={icon} size={16} color={catColor} />
          </View>
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={{ ...typography.smallBold, color: colors.text, flexShrink: 1 }} numberOfLines={1}>{debt.name}</Text>
            <View style={{
              backgroundColor: catColor + '2e',
              paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm,
              flexShrink: 0,
            }}>
              <Text style={{
                ...typography.caption, fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
                textTransform: 'uppercase', color: catColor,
              }}>
                {cat}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 }}>
            <View style={{
              width: 5, height: 5, borderRadius: radius.full,
              backgroundColor: debt.is_shared ? colors.primary2 : colors.textMuted,
            }} />
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {debt.is_shared ? 'Shared' : 'Personal'} {'·'} {debt.apr}% APR{debt.due_day ? ` · Due ${debt.due_day}th` : ''}
            </Text>
          </View>
        </View>

        {/* Balance + chevron */}
        <View style={{ alignItems: 'flex-end', marginRight: spacing.xs, flexShrink: 0 }}>
          <Text style={{ ...typography.bodyBold, color: colors.text }}>{fmt(debt.balance)}</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: 1 }}>{paidPercent}% paid</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textDark}
        />
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View
          style={{ height: 4, backgroundColor: colors.glassMedium, borderRadius: radius.sm }}
          accessibilityLabel={`${paidPercent} percent paid off`}
        >
          <LinearGradient
            colors={[catColor, catColor + '88']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{
              height: 4, borderRadius: radius.sm,
              width: `${paidPercent}%` as any,
            }}
          />
        </View>
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.debtCardExpanded}>
          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {[
              { label: 'Min Payment', value: debt.min_payment > 0 ? fmt(debt.min_payment) : 'No min. pmt', iconName: 'cash-outline' as keyof typeof Ionicons.glyphMap },
              { label: 'Payoff Date', value: estDate, iconName: 'calendar-outline' as keyof typeof Ionicons.glyphMap },
              { label: 'Strategy', value: debt.strategy === 'avalanche' ? 'Avalanche' : debt.strategy === 'snowball' ? 'Snowball' : 'Standard', iconName: 'flag-outline' as keyof typeof Ionicons.glyphMap },
            ].map((s, i) => (
              <View key={i} style={styles.statBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                  <Ionicons name={s.iconName} size={11} color={colors.textDark} />
                  <Text style={{ ...typography.caption, color: colors.textMuted }}>{s.label}</Text>
                </View>
                <Text style={{ ...typography.smallBold, color: colors.text, textAlign: 'center' }}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons — linked debts mirror their account, so manual
              payments are replaced by a synced indicator. */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {debt.linked_balance_id ? (
              <View style={[styles.actionBtnSecondary, { flex: 1, flexDirection: 'row', gap: spacing.xs }]}>
                <Ionicons name="link" size={14} color={colors.primary2} />
                <Text
                  style={{ ...typography.smallBold, fontWeight: '600', color: colors.primary2, fontSize: 13 }}
                  numberOfLines={1}
                >
                  Synced · {debt.linked_account_name || 'linked account'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={{ flex: 1 }} onPress={onMakePayment} activeOpacity={0.8}>
                <LinearGradient
                  colors={[...gradients.primaryGradient]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.actionBtnPrimary}
                >
                  <Ionicons name="cash-outline" size={14} color="white" />
                  <Text style={{ ...typography.button, fontSize: 13, color: 'white' }}>Make Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtnSecondary, { flex: 1 }]}
              onPress={onEditDetails}
              activeOpacity={0.7}
            >
              <Text style={{ ...typography.smallBold, fontWeight: '500', color: colors.textMuted, fontSize: 13 }}>Edit Details</Text>
            </TouchableOpacity>
          </View>

          {/* Category toggle + bill actions row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: catColor + '1f' }]}
              onPress={onToggleCategory}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat === 'attack' ? 'flame' : 'shield-checkmark'}
                size={14}
                color={catColor}
              />
              <Text style={{ ...typography.caption, color: catColor, fontWeight: '700' }}>
                {cat === 'attack' ? 'Attack' : 'Structured'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, { backgroundColor: colors.info + '1f' }]}
              onPress={onBillAction}
              activeOpacity={0.7}
            >
              <Ionicons
                name={billExists ? 'receipt-outline' : 'add-circle-outline'}
                size={14} color={colors.info}
              />
              <Text style={{ ...typography.caption, color: colors.info, fontWeight: '700' }}>
                {billExists ? 'View Bill' : 'Create Bill'}
              </Text>
            </TouchableOpacity>

            {!billExists && (
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: colors.primary2 + '1f' }]}
                onPress={onLinkBill}
                activeOpacity={0.7}
              >
                <Ionicons name="link" size={14} color={colors.primary2} />
                <Text style={{ ...typography.caption, color: colors.primary2, fontWeight: '700' }}>Link Bill</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ── Loading Skeleton ──
const DebtsSkeleton = () => (
  <View style={{ paddingHorizontal: spacing.lg }}>
    {/* Hero shell */}
    <View style={[styles.heroCard, { marginHorizontal: 0 }]}>
      <Skeleton width={120} height={12} />
      <Skeleton width={180} height={34} style={{ marginTop: spacing.sm }} />
      <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg }}>
        <Skeleton width={56} height={12} />
        <Skeleton width={56} height={12} />
        <Skeleton width={56} height={12} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Skeleton width={'48%' as any} height={48} borderRadius={radius.md} />
        <Skeleton width={'48%' as any} height={48} borderRadius={radius.md} />
      </View>
    </View>

    {/* Row skeletons */}
    {[0, 1, 2].map((i) => (
      <View key={i} style={[styles.debtCard, { padding: spacing.lg, marginBottom: spacing.sm }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Skeleton width={42} height={42} borderRadius={radius.full} />
          <View style={{ flex: 1 }}>
            <SkeletonStack count={2} height={12} />
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Skeleton width={'100%' as any} height={4} borderRadius={radius.sm} />
        </View>
      </View>
    ))}
  </View>
);

// ── Main Screen ──
export default function DebtsScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [linkedBalanceId, setLinkedBalanceId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Synced credit/loan accounts for the "linked account" picker — loaded once, lazily.
  const accountsLoaded = useRef(false);
  const ensureAccounts = useCallback(async () => {
    if (accountsLoaded.current) return;
    accountsLoaded.current = true;
    try {
      const accts = await fetchAccountBalances();
      setBankAccounts(
        (Array.isArray(accts) ? accts : []).filter(
          (a: any) => a.type === 'credit' || a.type === 'loan',
        ),
      );
    } catch (e) {
      console.log('Account list load failed (link picker hidden):', e);
    }
  }, []);

  // Inline validation state (hints on blur, CTA gates on validity)
  const [nameTouched, setNameTouched] = useState(false);
  const [balanceTouched, setBalanceTouched] = useState(false);
  const [dueDayTouched, setDueDayTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [billCreating, setBillCreating] = useState(false);

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
      setError("We couldn't load your debts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
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
    setLinkedBalanceId(null);
    setEditing(null);
    setNameTouched(false);
    setBalanceTouched(false);
    setDueDayTouched(false);
    setSaveError(null);
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
    setLinkedBalanceId(d.linked_balance_id || null);
    ensureAccounts();
    setShowForm(true);
  };

  // Derived validity — single source of truth for the save CTA. A linked
  // debt's balance comes from the account, so the manual field doesn't gate.
  const parsedBalance = Number(balance);
  const debtNameValid = name.trim().length > 0;
  const balanceValid = linkedBalanceId != null || (!!balance && Number.isFinite(parsedBalance));
  const debtDueDayNum = parseInt(dueDay, 10);
  const debtDueDayValid =
    !dueDay || (Number.isInteger(debtDueDayNum) && debtDueDayNum >= 1 && debtDueDayNum <= 31);
  const isDebtFormValid = debtNameValid && balanceValid && debtDueDayValid;

  const handleSave = async () => {
    if (!isDebtFormValid || saving) {
      setNameTouched(true);
      setBalanceTouched(true);
      setDueDayTouched(true);
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      setSaveError('No user session found.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      user_id: userId,
      name: name.trim(),
      // Linked debts mirror the account; the backend snaps the real number.
      balance: linkedBalanceId ? 0 : parseFloat(balance),
      apr: parseFloat(apr) || 0,
      min_payment: parseFloat(minPayment) || 0,
      due_day: dueDay ? parseInt(dueDay) : null,
      strategy: strategy.trim(),
      is_shared: isShared,
      liability_type: liabilityType,
      debt_category: debtCategory,
      linked_balance_id: linkedBalanceId,
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
      successHaptic();
      setShowForm(false);
      resetForm();
      loadDebts();
    } catch (e: any) {
      console.error('Save debt error:', e);
      errorHaptic();
      setSaveError(
        e?.status === 409
          ? 'That account is already linked to another debt.'
          : 'Failed to save debt. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const parsedPayment = Number(paymentAmount);
  const paymentValid =
    !!paymentAmount && Number.isFinite(parsedPayment) && parsedPayment > 0;

  const handlePayment = async () => {
    if (!paymentValid || paymentSaving) {
      setPaymentTouched(true);
      return;
    }
    setPaymentSaving(true);
    setPaymentError(null);
    try {
      await api.patch(`/auth/debts/${paymentId}/payment`, {
        amount: parsedPayment,
      });
      successHaptic();
      setPaymentId(null);
      setPaymentAmount('');
      setPaymentTouched(false);
      loadDebts();
    } catch (e) {
      console.error('Payment error:', e);
      errorHaptic();
      setPaymentError('Failed to apply payment. Try again.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleCreateBillFromDebt = async () => {
    if (!billDebt || billCreating) return;
    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }
    setBillCreating(true);
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
      successHaptic();
      Alert.alert('Success', `Bill created for "${billDebt.name}".`);
      setBillDebt(null);
      setBillFreq('monthly');
      loadDebts();
    } catch (e) {
      console.error('Create bill error:', e);
      errorHaptic();
      Alert.alert('Error', 'Failed to create bill.');
    } finally {
      setBillCreating(false);
    }
  };

  const toggleCategory = async (d: Debt) => {
    const newCat = d.debt_category === 'attack' ? 'structured' : 'attack';
    // Optimistic re-tint; revert on error.
    setDebts(prev => prev.map(x => x.id === d.id ? { ...x, debt_category: newCat } : x));
    try {
      await api.put(`/auth/debts/${d.id}/category`, { debt_category: newCat });
    } catch (e) {
      console.error('Toggle category error:', e);
      setDebts(prev => prev.map(x => x.id === d.id ? { ...x, debt_category: d.debt_category } : x));
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
  const [nudges, setNudges] = useState<DebtNudge[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<any[]>('/auth/ai/nudges');
        if (Array.isArray(data)) {
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

  const handleNudgePress = useCallback(async (nudge: DebtNudge) => {
    try { await api.post(`/auth/ai/nudges/${nudge.id}/dismiss`); } catch {}
    setNudges(prev => prev.filter(n => n.id !== nudge.id));
    if (nudge.action_type === 'ask_ai') {
      router.navigate('/(tabs)/ai-chat' as any);
    } else if (nudge.action_type === 'navigate_to' && nudge.action_data) {
      router.push(nudge.action_data as any);
    }
  }, [router]);

  const handleNudgeDismiss = useCallback(async (nudge: DebtNudge) => {
    try { await api.post(`/auth/ai/nudges/${nudge.id}/dismiss`); } catch {}
    setNudges(prev => prev.filter(n => n.id !== nudge.id));
  }, []);

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

  const openAddForm = () => { resetForm(); ensureAccounts(); setShowForm(true); };

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary2} />
          }
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <BackButton fallback="/(tabs)/goals" color={colors.textMuted} size={20} />
              <Text style={styles.headerTitle}>Debts</Text>
            </View>
            <TouchableOpacity
              onPress={openAddForm}
              style={styles.addButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Add debt"
            >
              <Ionicons name="add" size={18} color={colors.primary2} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
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
          ) : loading ? (
            <DebtsSkeleton />
          ) : debts.length === 0 ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <EmptyState
                icon="trending-down-outline"
                title="No debts tracked"
                description="Add your first debt to start tracking and managing them"
                actionLabel="Add Debt"
                onAction={openAddForm}
              />
            </View>
          ) : (
            <>
              {/* ── Hero Summary Card ── */}
              <View
                style={styles.heroCard}
                accessibilityLabel={`Total debt ${fmt(totalBalance)}, minimum payment ${fmt(totalMinPayment)}, average APR ${weightedApr.toFixed(1)} percent, ${debts.length} accounts. Attack ${fmtShort(attackTotal)}, Structured ${fmtShort(structuredTotal)}.`}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>Total debt</Text>
                    <Text style={{ ...typography.h1, color: colors.text, marginTop: spacing.xs }}>
                      {fmt(totalBalance)}
                    </Text>
                  </View>
                  <View style={styles.changeBadge}>
                    <Ionicons name="arrow-down" size={12} color={colors.success} />
                    <Text style={{ ...typography.caption, color: colors.success, fontWeight: '600' }}>-{fmtShort(totalMinPayment)}/mo</Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>Min. payment</Text>
                    <Text style={{ ...typography.smallBold, color: colors.text, marginTop: 2 }}>{fmt(totalMinPayment)}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>Avg. APR</Text>
                    <Text style={{ ...typography.smallBold, color: colors.warning, marginTop: 2 }}>{weightedApr.toFixed(1)}%</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...typography.caption, color: colors.textMuted }}>Accounts</Text>
                    <Text style={{ ...typography.smallBold, color: colors.text, marginTop: 2 }}>{debts.length}</Text>
                  </View>
                </View>

                {/* Attack vs Structured split tiles */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <TouchableOpacity
                    style={styles.splitTile}
                    activeOpacity={0.7}
                    onPress={() => setActiveFilter('attack')}
                    accessibilityRole="button"
                    accessibilityLabel={`Attack ${fmtShort(attackTotal)}`}
                  >
                    <Ionicons name="flame" size={14} color={colors.error} />
                    <View>
                      <Text style={{ ...typography.caption, fontSize: 10, color: colors.error, fontWeight: '600', letterSpacing: 0.5 }}>ATTACK</Text>
                      <Text style={{ ...typography.smallBold, color: colors.text }}>{fmtShort(attackTotal)}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.splitTile}
                    activeOpacity={0.7}
                    onPress={() => setActiveFilter('structured')}
                    accessibilityRole="button"
                    accessibilityLabel={`Structured ${fmtShort(structuredTotal)}`}
                  >
                    <Ionicons name="shield-checkmark" size={14} color={colors.info} />
                    <View>
                      <Text style={{ ...typography.caption, fontSize: 10, color: colors.info, fontWeight: '600', letterSpacing: 0.5 }}>STRUCTURED</Text>
                      <Text style={{ ...typography.smallBold, color: colors.text }}>{fmtShort(structuredTotal)}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── AI Nudges (Attention slot) ── */}
              <View style={{ paddingHorizontal: spacing.lg }}>
                <DebtNudgeCard
                  nudges={nudges.slice(0, 2)}
                  onPress={handleNudgePress}
                  onDismiss={handleNudgeDismiss}
                />
              </View>

              {/* ── Payoff Timeline ── */}
              {timelineDebts.length > 0 && (
                <View style={styles.timelineCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons name="time-outline" size={14} color={colors.primary2} />
                      <Text style={{ ...typography.smallBold, color: colors.text }}>Payoff Timeline</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push('/payoff-calculator')}
                      style={styles.calcButton}
                      accessibilityRole="button"
                      accessibilityLabel="Open payoff calculator"
                    >
                      <Ionicons name="calculator-outline" size={11} color={colors.primary2} />
                      <Text style={{ ...typography.caption, fontWeight: '600', color: colors.primary2 }}>Calculator</Text>
                    </TouchableOpacity>
                  </View>
                  <PayoffTimeline debts={timelineDebts} />
                  <Text style={{ ...typography.caption, marginTop: spacing.sm, color: colors.textDark, textAlign: 'center' }}>
                    Mortgage excluded {'·'} Based on minimum payments
                  </Text>
                </View>
              )}

              {/* ── Filter Tabs ── */}
              <View style={styles.filterRow}>
                {([
                  { id: 'all' as const, label: 'All', count: debts.length, color: colors.primary2 },
                  { id: 'attack' as const, label: 'Attack', count: attackDebts.length, color: colors.error },
                  { id: 'structured' as const, label: 'Structured', count: structuredDebts.length, color: colors.info },
                ]).map(f => {
                  const isActive = activeFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setActiveFilter(f.id)}
                      style={[
                        styles.filterTab,
                        {
                          backgroundColor: isActive ? f.color + '2e' : colors.glassLight,
                          borderColor: isActive ? f.color + '4d' : colors.borderGlass,
                        },
                      ]}
                      activeOpacity={0.7}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`${f.label}, ${f.count} debts`}
                    >
                      {f.id === 'attack' && (
                        <Ionicons name="flame" size={11} color={isActive ? colors.error : colors.textMuted} />
                      )}
                      {f.id === 'structured' && (
                        <Ionicons name="shield-checkmark" size={11} color={isActive ? colors.info : colors.textMuted} />
                      )}
                      <Text style={{
                        ...typography.caption, fontWeight: '600',
                        color: isActive ? f.color : colors.textMuted,
                      }}>
                        {f.label}
                      </Text>
                      <View style={styles.filterBadge}>
                        <Text style={{
                          ...typography.caption, fontSize: 10, fontWeight: '700',
                          color: isActive ? f.color : colors.textDark,
                        }}>
                          {f.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── Debt Cards ── */}
              <View style={{ paddingHorizontal: spacing.lg }}>
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
                onPress={openAddForm}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Add new debt"
              >
                <Ionicons name="add" size={16} color={colors.primary2} />
                <Text style={{ ...typography.small, color: colors.primary2, fontWeight: '500' }}>Add New Debt</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* ── Add/Edit Debt Sheet ── */}
        <FormSheet
          visible={showForm}
          title={editing ? 'Edit Debt' : 'Add Debt'}
          onClose={() => {
            setShowForm(false);
            resetForm();
          }}
          footer={
            <>
              {saveError ? (
                <View style={styles.formErrorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.formErrorText}>{saveError}</Text>
                </View>
              ) : null}
              <FormButton
                label={editing ? 'Update Debt' : 'Add Debt'}
                onPress={handleSave}
                disabled={!isDebtFormValid}
                loading={saving}
              />
            </>
          }
        >
          <FormField label="Name" error={nameTouched && !debtNameValid ? 'Name is required' : null}>
            <FormInput
              icon="text-outline"
              placeholder="e.g. Chase Credit Card"
              value={name}
              onChangeText={setName}
              onBlur={() => setNameTouched(true)}
              error={nameTouched && !debtNameValid}
            />
          </FormField>

          {bankAccounts.length > 0 && (
            <FormField label="Linked Account" optional>
              <Text style={styles.linkedHint}>
                Link a synced credit card or loan account and this debt's balance will mirror it
                automatically on every sync.
              </Text>
              <TouchableOpacity
                style={[styles.accountOption, linkedBalanceId == null && styles.accountOptionActive]}
                onPress={() => setLinkedBalanceId(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: linkedBalanceId == null }}
              >
                <Ionicons
                  name={linkedBalanceId == null ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={linkedBalanceId == null ? colors.primary2 : colors.textMuted}
                />
                <Text style={styles.accountOptionText}>Track manually</Text>
              </TouchableOpacity>
              {bankAccounts.map((a) => {
                const selected = linkedBalanceId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.accountOption, selected && styles.accountOptionActive]}
                    onPress={() => setLinkedBalanceId(a.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={selected ? colors.primary2 : colors.textMuted}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.accountOptionText} numberOfLines={1}>
                        {a.name || 'Account'}
                        {a.institution_name ? ` · ${a.institution_name}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.accountOptionBalance}>
                      {fmt(Math.abs(a.current_balance || 0))}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </FormField>
          )}

          {linkedBalanceId == null ? (
            <FormField
              label="Balance"
              error={balanceTouched && !balanceValid ? 'Enter a valid balance' : null}
            >
              <AmountInput
                compact
                value={balance}
                onChangeText={setBalance}
                onBlur={() => setBalanceTouched(true)}
                error={balanceTouched && !balanceValid ? 'Enter a valid balance' : null}
                accessibilityLabel="Balance"
              />
            </FormField>
          ) : (
            <FormField label="Balance">
              <Text style={styles.linkedHint}>
                Mirrors the linked account — updates automatically on every sync.
              </Text>
            </FormField>
          )}

          <FormField label="APR (%)" optional>
            <FormInput
              icon="trending-up-outline"
              placeholder="0"
              keyboardType="decimal-pad"
              value={apr}
              onChangeText={setApr}
            />
          </FormField>

          <FormField label="Min Payment" optional>
            <AmountInput
              compact
              value={minPayment}
              onChangeText={setMinPayment}
              accessibilityLabel="Minimum payment"
            />
          </FormField>

          <FormField
            label="Due Day"
            optional
            error={dueDayTouched && !debtDueDayValid ? 'Due day must be between 1 and 31' : null}
          >
            <FormInput
              icon="calendar-number-outline"
              placeholder="15"
              keyboardType="number-pad"
              value={dueDay}
              onChangeText={setDueDay}
              onBlur={() => setDueDayTouched(true)}
              error={dueDayTouched && !debtDueDayValid}
            />
          </FormField>

          <FormField label="Debt Type">
            <FormChips
              options={LIABILITY_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={liabilityType}
              onChange={(v) => {
                setLiabilityType(v);
                setDebtCategory((DEFAULT_CATEGORIES[v] || 'attack') as 'attack' | 'structured');
              }}
            />
          </FormField>

          <FormField label="Category">
            <FormChips
              options={[
                { value: 'attack' as const, label: 'Attack', icon: 'flame' as const },
                { value: 'structured' as const, label: 'Structured', icon: 'shield-checkmark' as const },
              ]}
              value={debtCategory}
              onChange={setDebtCategory}
            />
            <Text style={styles.categoryHint}>
              {debtCategory === 'attack'
                ? 'Pay off aggressively with extra payments'
                : 'Pay minimums on schedule (e.g., mortgage)'}
            </Text>
          </FormField>

          <FormField label="Strategy" optional>
            <FormChips
              options={[
                { value: 'avalanche', label: 'Avalanche' },
                { value: 'snowball', label: 'Snowball' },
                { value: 'none', label: 'None' },
              ]}
              value={strategy || 'none'}
              onChange={(v) => setStrategy(v === 'none' ? '' : v)}
            />
          </FormField>

          <FormSwitchRow
            label="Share with partner"
            sublabel="Visible to your household partner"
            value={isShared}
            onValueChange={setIsShared}
          />

          {/* Create Associated Bill toggle - only for new debts */}
          {!editing && (
            <>
              <FormSwitchRow
                label="Create associated bill"
                sublabel="Auto-create a recurring bill linked to this debt"
                value={createBill}
                onValueChange={setCreateBill}
              />

              {createBill && (
                <View style={styles.billOptionsCard}>
                  <Ionicons
                    name="receipt-outline"
                    size={16}
                    color={colors.info}
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Text style={styles.billOptionsHint}>
                    Bill: "{name.trim() || '...'} Payment" for {minPayment ? `$${minPayment}` : '$0'}{' '}
                    due day {dueDay || '1'}
                  </Text>
                  <FormField label="Frequency">
                    <FormChips
                      options={(['monthly', 'biweekly', 'weekly', 'quarterly', 'yearly'] as const).map(
                        (f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }),
                      )}
                      value={billFrequency}
                      onChange={setBillFrequency}
                    />
                  </FormField>
                </View>
              )}
            </>
          )}
        </FormSheet>

        {/* ── Payment Sheet ── */}
        <FormSheet
          visible={paymentId !== null}
          title="Apply Payment"
          onClose={() => {
            setPaymentId(null);
            setPaymentAmount('');
            setPaymentTouched(false);
            setPaymentError(null);
          }}
          maxHeightPct={0.5}
          footer={
            <>
              {paymentError ? (
                <View style={styles.formErrorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.formErrorText}>{paymentError}</Text>
                </View>
              ) : null}
              <FormButton
                label="Apply Payment"
                onPress={handlePayment}
                disabled={!paymentValid}
                loading={paymentSaving}
              />
            </>
          }
        >
          <FormField
            label="Payment Amount"
            error={paymentTouched && !paymentValid ? 'Enter a valid payment amount' : null}
          >
            <AmountInput
              compact
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              onBlur={() => setPaymentTouched(true)}
              error={paymentTouched && !paymentValid ? 'Enter a valid payment amount' : null}
              accessibilityLabel="Payment amount"
              autoFocus
            />
          </FormField>
        </FormSheet>

        {/* ── Create Bill from Debt Sheet ── */}
        <FormSheet
          visible={billDebt !== null}
          title="Create Bill"
          onClose={() => setBillDebt(null)}
          maxHeightPct={0.6}
          footer={
            <FormButton label="Create Bill" onPress={handleCreateBillFromDebt} loading={billCreating} />
          }
        >
          {billDebt && (
            <View style={styles.billPreview}>
              <Ionicons
                name="receipt-outline"
                size={16}
                color={colors.info}
                style={{ marginBottom: spacing.xs }}
              />
              <Text style={styles.billPreviewText}>
                "{billDebt.name} Payment" for {fmt(billDebt.min_payment || 0)} due day{' '}
                {billDebt.due_day ?? 1}
              </Text>
            </View>
          )}
          <FormField label="Frequency">
            <FormChips
              options={(['monthly', 'biweekly', 'weekly', 'quarterly', 'yearly'] as const).map(
                (f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }),
              )}
              value={billFreq}
              onChange={setBillFreq}
            />
          </FormField>
        </FormSheet>

        {/* ── Link Existing Bill to Debt Sheet ── */}
        <FormSheet
          visible={linkBillDebt !== null}
          title="Link Bill to Debt"
          onClose={() => setLinkBillDebt(null)}
          maxHeightPct={0.6}
        >
          <Text style={{ color: colors.textMuted, ...typography.small, marginBottom: spacing.md }}>
            Select a bill to link to "{linkBillDebt?.name}"
          </Text>
          {(() => {
            const unlinkedBills = bills.filter((b) => !b.debt_account_id);
            if (unlinkedBills.length === 0) {
              return (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <Ionicons name="receipt-outline" size={32} color={colors.textDark} />
                  <Text style={{ color: colors.textMuted, ...typography.small, marginTop: spacing.sm }}>
                    No unlinked bills available
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setLinkBillDebt(null);
                      if (linkBillDebt) {
                        setBillDebt(linkBillDebt);
                        setBillFreq('monthly');
                      }
                    }}
                    style={{ marginTop: spacing.md }}
                  >
                    <Text style={{ color: colors.primary2, fontWeight: '700', ...typography.small }}>
                      Create a new bill instead
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return unlinkedBills.map((bill) => (
              <TouchableOpacity
                key={bill.id}
                style={styles.linkBillRow}
                onPress={async () => {
                  try {
                    await api.put(`/auth/bills/${bill.id}`, {
                      ...bill,
                      debt_account_id: linkBillDebt?.id,
                    });
                    successHaptic();
                    Alert.alert('Success', `"${bill.name}" linked to "${linkBillDebt?.name}".`);
                    setLinkBillDebt(null);
                    loadDebts();
                  } catch (e) {
                    console.error('Link bill error:', e);
                    errorHaptic();
                    Alert.alert('Error', 'Failed to link bill.');
                  }
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontWeight: '600', ...typography.smallBold }}>
                    {bill.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, ...typography.caption, marginTop: 2 }}>
                    ${bill.amount_due?.toFixed(2)} · Due {bill.due_day}
                    {bill.due_day === 1 ? 'st' : bill.due_day === 2 ? 'nd' : bill.due_day === 3 ? 'rd' : 'th'}
                  </Text>
                </View>
                <Ionicons name="link" size={16} color={colors.primary2} />
              </TouchableOpacity>
            ));
          })()}
        </FormSheet>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },

  // Hero Summary Card
  heroCard: {
    ...glassEffects.glassFloating,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success + '1f',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  splitTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },

  // Payoff Timeline
  timelineCard: {
    ...glassEffects.glass,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  calcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '1a',
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '26',
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  filterBadge: {
    backgroundColor: colors.glassMedium,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },

  // Debt Card
  debtCard: {
    ...glassEffects.glass,
    marginBottom: spacing.sm,
  },
  debtCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  statBox: {
    flex: 1,
    ...glassEffects.glass,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
    minHeight: 44,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minHeight: 36,
  },

  // Add Debt CTA
  addDebtCta: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary2 + '4d',
    backgroundColor: colors.primary2 + '0d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  // Form sheet extras
  formErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  formErrorText: {
    flex: 1,
    ...typography.caption,
    color: colors.error,
  },
  categoryHint: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  linkedHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xs,
  },
  accountOptionActive: {
    borderColor: colors.primary2,
    backgroundColor: `${colors.primary}1a`,
  },
  accountOptionText: {
    ...typography.small,
    color: colors.text,
  },
  accountOptionBalance: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  billOptionsCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.glassLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  billOptionsHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  billPreview: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.info + '14',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.info + '2e',
  },
  billPreviewText: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 18,
  },
  linkBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
});
