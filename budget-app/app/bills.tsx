import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton, SkeletonStack } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

type Bill = {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  amount_due: number;
  due_day: number;
  frequency: string;
  payee?: string;
  category_id?: string;
  debt_account_id?: string;
  is_autopay: boolean;
  is_shared: boolean;
  status?: string;
  category_name?: string;
  debt_name?: string;
  owner?: string;
};

type Category = { id: string; name: string; type?: string };
type Debt = { id: string; name: string; balance: number };

type BillSuggestion = {
  merchant_normalized: string;
  display_name: string;
  frequency: string;
  amount: number;
  amount_variance: 'fixed' | 'approximate';
  due_day: number;
  category_id: string | null;
  category_name: string | null;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  sample_transaction_ids: string[];
};

type BillWithMeta = Bill & { _status: string; _owner: string };

/* ── Status token map — icon + word + color (never color-only) ── */
const STATUS_CONFIG: Record<
  string,
  { color: string; tint: string; icon: string; label: string }
> = {
  paid: {
    color: colors.success,
    tint: 'rgba(34,197,94,0.12)',
    icon: 'checkmark',
    label: 'PAID',
  },
  unpaid: {
    color: colors.warning,
    tint: 'rgba(234,179,8,0.12)',
    icon: 'time-outline',
    label: 'DUE',
  },
  overdue: {
    color: colors.error,
    tint: 'rgba(239,68,68,0.12)',
    icon: 'warning-outline',
    label: 'OVERDUE',
  },
};

/* ── Owner glyph — shared couples-attribution convention ──
   Partner A → primary2, Partner B → info, shared/joint → neutral textMuted. */
const OWNER_COLORS: Record<string, string> = {
  You: colors.primary2,
  Partner: colors.info,
  Joint: colors.textMuted,
};

const FREQUENCY_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Biweekly', value: 'biweekly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

const SUGGESTIONS_VISIBLE_CAP = 5;

/* ---- Progress Ring (colocated: shared ProgressRing can't render a custom
   count/label center, only a percentage). Fed token colors so it's tokenized. ---- */
function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 5,
  color = colors.success,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circ - (clamped / 100) * circ;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={colors.borderLight}
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
        rotation={-90}
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

/* ---- Owner Dot ---- */
function OwnerDot({ owner }: { owner?: string }) {
  const color = OWNER_COLORS[owner || ''] || colors.textMuted;
  return <View style={[styles.ownerDot, { backgroundColor: color }]} />;
}

/* ---- Bill Status Helper (unchanged) ---- */
function getBillStatus(bill: Bill): string {
  if (bill.status === 'paid') return 'paid';
  const today = new Date().getDate();
  if (bill.due_day < today && bill.status !== 'paid') return 'overdue';
  return 'unpaid';
}

/* ---- Bill Owner Helper (unchanged) ---- */
function getBillOwner(bill: Bill): string {
  if (bill.owner) return bill.owner;
  if (bill.is_shared) return 'Joint';
  return 'You';
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

const fmt = (v: number) =>
  '$' +
  Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ---- Timeline (retokenized, capability unchanged) ---- */
function BillTimeline({ bills }: { bills: BillWithMeta[] }) {
  const today = new Date().getDate();
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  const sorted = [...bills].sort((a, b) => a.due_day - b.due_day);
  const progressPercent = (today / 30) * 100;

  return (
    <View style={styles.glassCard}>
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitleText}>{monthName} TIMELINE</Text>
        <Text style={styles.timelineToday}>Today: {ordinalSuffix(today)}</Text>
      </View>

      <View style={styles.timelineBarArea}>
        <View style={styles.timelineTrack} />

        <LinearGradient
          colors={gradients.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.timelineProgress, { width: `${progressPercent}%` }]}
        />

        {sorted.map((b) => {
          const statusColor = STATUS_CONFIG[b._status].color;
          const leftPercent = ((b.due_day - 1) / 30) * 100;
          return (
            <View
              key={b.id}
              style={[
                styles.timelineDot,
                { left: `${leftPercent}%`, backgroundColor: statusColor },
              ]}
            />
          );
        })}

        <View style={[styles.todayMarker, { left: `${progressPercent}%` }]} />
      </View>

      {/* Legend — icon + word (status never color-only) */}
      <View style={styles.timelineLegend}>
        {[
          { color: colors.success, icon: 'checkmark', label: 'Paid' },
          { color: colors.warning, icon: 'time-outline', label: 'Upcoming' },
          { color: colors.error, icon: 'warning-outline', label: 'Overdue' },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <Ionicons name={l.icon as any} size={11} color={l.color} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---- Bill Row (core — actual vs projected, mirrors CalendarEventRow) ---- */
function BillRow({
  bill,
  categoryName,
  onEdit,
  onMarkPaid,
  onDelete,
}: {
  bill: BillWithMeta;
  categoryName?: string;
  onEdit: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_CONFIG[bill._status];
  const isPaid = bill._status === 'paid';
  const isOverdue = bill._status === 'overdue';
  const amountColor = isPaid
    ? colors.accent
    : isOverdue
      ? colors.error
      : colors.warning;

  const a11yStatus = isPaid ? 'paid' : isOverdue ? 'overdue' : 'upcoming bill';
  const a11yLabel = `${bill.name}, ${a11yStatus}, ${fmt(bill.amount_due)}${
    bill.is_autopay ? ', autopay' : ''
  }${bill.debt_account_id ? ', linked to debt' : ''}, due ${bill.due_day}${ordinalSuffix(
    bill.due_day,
  )}`;

  return (
    <TouchableOpacity
      style={[styles.card, isPaid ? styles.cardActual : styles.cardProjected]}
      onPress={onEdit}
      activeOpacity={0.7}
      accessibilityLabel={a11yLabel}
      accessibilityHint="Double tap to edit."
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.cardNameRow}>
            <OwnerDot owner={bill._owner} />
            <Text
              style={[styles.cardTitle, !isPaid && styles.projectedText]}
              numberOfLines={1}
            >
              {bill.name}
            </Text>
            {bill.is_autopay && (
              <View style={styles.autoBadge}>
                <Ionicons name="flash" size={9} color={colors.info} />
                <Text style={styles.autoBadgeText}>AUTO</Text>
              </View>
            )}
            {bill.debt_account_id && (
              <View style={styles.debtBadge}>
                <Ionicons name="link" size={9} color={colors.primary2} />
                <Text style={styles.debtBadgeText}>DEBT</Text>
              </View>
            )}
          </View>

          <View style={styles.cardDetails}>
            <Text style={styles.detailText}>
              {isPaid ? 'Paid' : 'Due'} {bill.due_day}
              {ordinalSuffix(bill.due_day)}
            </Text>
            {bill.payee ? <Text style={styles.detailText}>{bill.payee}</Text> : null}
            {categoryName ? <Text style={styles.detailText}>{categoryName}</Text> : null}
          </View>
        </View>

        <Text style={[styles.cardAmount, { color: amountColor }]}>
          {isPaid ? '' : '~'}
          {fmt(bill.amount_due)}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.statusChip, { backgroundColor: status.tint }]}>
          <Ionicons name={status.icon as any} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>

        <View style={styles.rowActions}>
          {!isPaid && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onMarkPaid();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel={`Mark ${bill.name} paid`}
            >
              <Ionicons name="checkmark" size={12} color={colors.success} />
              <Text style={styles.payBtnText}>Mark Paid</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onDelete();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Delete ${bill.name}`}
          >
            <Ionicons name="trash-outline" size={14} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ---- Main Screen ---- */
export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [suggestions, setSuggestions] = useState<BillSuggestion[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  // Dropdown data
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDebtPicker, setShowDebtPicker] = useState(false);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [debtAccountId, setDebtAccountId] = useState('');
  const [isAutopay, setIsAutopay] = useState(false);
  const [isShared, setIsShared] = useState(true);

  const loadBills = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<Bill[]>('/auth/bills', { user_id: userId });
      setBills(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error('Failed to load bills:', e);
      setError('Failed to load bills');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  const loadDropdownData = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;

      const [cats, userDebts] = await Promise.all([
        api.get<Category[]>(`/auth/categories/user/${userId}`).catch(() => []),
        api.get<Debt[]>('/auth/debts', { user_id: userId }).catch(() => []),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setDebts(Array.isArray(userDebts) ? userDebts : []);
    } catch (e) {
      console.error('Failed to load dropdown data:', e);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<{ suggestions: BillSuggestion[] }>(
        '/auth/bills/suggestions',
        { user_id: userId },
      );
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
    } catch (e) {
      console.error('Failed to load suggestions:', e);
      // Non-fatal: hide section silently if it fails.
    }
  }, []);

  useEffect(() => {
    loadBills();
    loadDropdownData();
    loadSuggestions();
  }, [loadBills, loadDropdownData, loadSuggestions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBills(), loadDropdownData(), loadSuggestions()]);
    setRefreshing(false);
  }, [loadBills, loadDropdownData, loadSuggestions]);

  const handleAcceptSuggestion = async (s: BillSuggestion) => {
    const userId = await api.getUserId();
    if (!userId) return;
    setAcceptingId(s.merchant_normalized);
    try {
      const result = await api.post<{ bill_id: string; backfilled: number }>(
        `/auth/bills/suggestions/accept?user_id=${userId}`,
        {
          merchant_normalized: s.merchant_normalized,
          name: s.display_name,
          amount_due: s.amount,
          due_day: s.due_day,
          frequency: s.frequency,
          category_id: s.category_id,
          payee: s.display_name,
          is_shared: true,
        },
      );
      const back = result?.backfilled ?? 0;
      Alert.alert(
        'Bill added',
        back > 0
          ? `Created "${s.display_name}" and marked ${back} past period${back !== 1 ? 's' : ''} as paid.`
          : `Created "${s.display_name}".`,
      );
      setSuggestions((prev) =>
        prev.filter((x) => x.merchant_normalized !== s.merchant_normalized),
      );
      loadBills();
    } catch (e) {
      console.error('Accept suggestion error:', e);
      Alert.alert('Error', 'Could not add bill from suggestion.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDismissSuggestion = async (s: BillSuggestion) => {
    const userId = await api.getUserId();
    if (!userId) return;
    // Optimistic: drop immediately, fire-and-forget the request.
    setSuggestions((prev) =>
      prev.filter((x) => x.merchant_normalized !== s.merchant_normalized),
    );
    try {
      await api.post(`/auth/bills/suggestions/dismiss?user_id=${userId}`, {
        merchant_normalized: s.merchant_normalized,
      });
    } catch (e) {
      console.error('Dismiss suggestion error:', e);
    }
  };

  const resetForm = () => {
    setName('');
    setAmountDue('');
    setDueDay('');
    setFrequency('monthly');
    setPayee('');
    setCategoryId('');
    setDebtAccountId('');
    setIsAutopay(false);
    setIsShared(true);
    setEditing(null);
  };

  const openEdit = (b: Bill) => {
    setEditing(b);
    setName(b.name);
    setAmountDue(String(b.amount_due));
    setDueDay(String(b.due_day));
    setFrequency(b.frequency || 'monthly');
    setPayee(b.payee || '');
    setCategoryId(b.category_id || '');
    setDebtAccountId(b.debt_account_id || '');
    setIsAutopay(b.is_autopay);
    setIsShared(b.is_shared);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Bill name is required.');
      return;
    }
    if (!amountDue || isNaN(Number(amountDue)) || Number(amountDue) <= 0) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    const dueDayNum = parseInt(dueDay);
    if (!dueDay || isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      Alert.alert('Validation', 'Due day must be between 1 and 31.');
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }

    const payload: any = {
      user_id: userId,
      name: name.trim(),
      amount_due: parseFloat(amountDue),
      due_day: dueDayNum,
      frequency,
      payee: payee.trim() || null,
      category_id: categoryId || null,
      debt_account_id: debtAccountId || null,
      is_autopay: isAutopay,
      is_shared: isShared,
    };

    try {
      if (editing) {
        await api.put(`/auth/bills/${editing.id}`, payload);
      } else {
        await api.post('/auth/bills', payload);
      }
      setShowForm(false);
      resetForm();
      loadBills();
    } catch (e) {
      console.error('Save bill error:', e);
      Alert.alert('Error', 'Failed to save bill.');
    }
  };

  const handleDelete = async (billId: string) => {
    Alert.alert('Delete Bill', 'Are you sure you want to delete this bill?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = await api.getUserId();
            if (!userId) {
              Alert.alert('Error', 'No user session found.');
              return;
            }
            await api.delete(`/auth/bills/${billId}`, { user_id: userId });
            loadBills();
          } catch (e) {
            console.error('Delete bill error:', e);
            Alert.alert('Error', 'Failed to delete bill.');
          }
        },
      },
    ]);
  };

  const handleMarkPaid = async (bill: Bill) => {
    try {
      await api.post(`/auth/bills/${bill.id}/pay`, {
        amount: bill.amount_due,
      });
      loadBills();
    } catch (e) {
      console.error('Mark paid error:', e);
      Alert.alert('Error', 'Failed to mark bill as paid.');
    }
  };

  const handleAutoDetect = async () => {
    const userId = await api.getUserId();
    if (!userId) return;

    setDetecting(true);
    try {
      const result = await api.post<{ count: number; detected: any[] }>(
        `/auth/bills/auto-detect?user_id=${userId}`,
        undefined,
      );
      const count = result?.count ?? 0;
      if (count > 0) {
        Alert.alert(
          'Auto-Detect',
          `Matched ${count} bill payment(s) from your bank transactions.`,
        );
        loadBills();
      } else {
        Alert.alert('Auto-Detect', 'No matching bank transactions found for unpaid bills.');
      }
      // Refresh suggestions — newly-paid transactions are now dedupe sources.
      loadSuggestions();
    } catch (e) {
      console.error('Auto-detect error:', e);
      Alert.alert('Error', 'Failed to auto-detect payments.');
    } finally {
      setDetecting(false);
    }
  };

  // Computed values
  const billsWithStatus: BillWithMeta[] = bills.map((b) => ({
    ...b,
    _status: getBillStatus(b),
    _owner: getBillOwner(b),
  }));

  const paidCount = billsWithStatus.filter((b) => b._status === 'paid').length;
  const totalDue = billsWithStatus.reduce((s, b) => s + (b.amount_due || 0), 0);
  const paidAmount = billsWithStatus
    .filter((b) => b._status === 'paid')
    .reduce((s, b) => s + (b.amount_due || 0), 0);
  const unpaidAmount = totalDue - paidAmount;
  const overdueCount = billsWithStatus.filter((b) => b._status === 'overdue').length;
  const overdueAmount = billsWithStatus
    .filter((b) => b._status === 'overdue')
    .reduce((s, b) => s + (b.amount_due || 0), 0);
  const upcomingCount = billsWithStatus.filter((b) => b._status === 'unpaid').length;
  const paidPct = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0;

  const filteredBills =
    filter === 'all'
      ? billsWithStatus
      : billsWithStatus.filter((b) => b._status === filter);

  // Grouped view (only when filter = All): Overdue → Upcoming → Paid.
  const groupedBills: { key: string; label: string; items: BillWithMeta[] }[] =
    filter === 'all'
      ? [
          {
            key: 'overdue',
            label: 'OVERDUE',
            items: billsWithStatus.filter((b) => b._status === 'overdue'),
          },
          {
            key: 'unpaid',
            label: 'UPCOMING',
            items: billsWithStatus.filter((b) => b._status === 'unpaid'),
          },
          {
            key: 'paid',
            label: 'PAID',
            items: billsWithStatus.filter((b) => b._status === 'paid'),
          },
        ].filter((g) => g.items.length > 0)
      : [{ key: filter, label: '', items: filteredBills }];

  const getCategoryName = (id?: string) => categories.find((c) => c.id === id)?.name;
  const getBillCategory = (b: Bill) => b.category_name || getCategoryName(b.category_id);
  const getDebtName = (id?: string) => debts.find((d) => d.id === id)?.name;
  const getFrequencyLabel = (val: string) =>
    FREQUENCY_OPTIONS.find((f) => f.value === val)?.label || val;

  const filterTabs = [
    { key: 'all', label: 'All', count: bills.length },
    { key: 'unpaid', label: 'Upcoming', count: upcomingCount },
    { key: 'paid', label: 'Paid', count: paidCount },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
  ];

  const showSkeleton = loading && !loadedOnce;
  const visibleSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, SUGGESTIONS_VISIBLE_CAP);

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const renderSuggestionsCard = () => (
    <View style={styles.suggestionsSection}>
      <View style={styles.suggestionsHeader}>
        <Ionicons name="sparkles-outline" size={14} color={colors.warning} />
        <Text style={styles.suggestionsTitle}>SUGGESTED BILLS ({suggestions.length})</Text>
      </View>
      {visibleSuggestions.map((s) => {
        const isAccepting = acceptingId === s.merchant_normalized;
        const amtLabel = `${s.amount_variance === 'approximate' ? '~' : ''}${fmt(s.amount)}`;
        return (
          <View key={s.merchant_normalized} style={styles.suggestionCard}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.suggestionName} numberOfLines={1}>
                {s.display_name}
              </Text>
              <Text style={styles.suggestionMeta} numberOfLines={1}>
                {amtLabel} · {s.frequency} · {s.occurrence_count} charges
                {s.category_name ? ` · ${s.category_name}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.suggestionAddBtn, isAccepting && { opacity: 0.5 }]}
              onPress={() => handleAcceptSuggestion(s)}
              disabled={isAccepting}
              accessibilityLabel={`Add ${s.display_name} as a bill`}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <Ionicons name="add" size={16} color={colors.success} />
              )}
              <Text style={styles.suggestionAddText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.suggestionDismissBtn}
              onPress={() => handleDismissSuggestion(s)}
              disabled={isAccepting}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={`Dismiss ${s.display_name} suggestion`}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}
      {suggestions.length > SUGGESTIONS_VISIBLE_CAP && (
        <TouchableOpacity
          style={styles.showMoreBtn}
          onPress={() => setShowAllSuggestions((v) => !v)}
        >
          <Text style={styles.showMoreText}>
            {showAllSuggestions
              ? 'Show less'
              : `Show ${suggestions.length - SUGGESTIONS_VISIBLE_CAP} more`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <BackButton fallback="/(tabs)/goals" />
            <Text style={styles.headerTitle}>Bills</Text>
          </View>
          <View style={styles.headerRight}>
            {loading && loadedOnce && !refreshing && (
              <ActivityIndicator color={colors.primary2} size="small" />
            )}
            <TouchableOpacity
              onPress={openAdd}
              accessibilityLabel="Add bill"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <LinearGradient
                colors={gradients.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButton}
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary2}
            />
          }
        >
          {showSkeleton ? (
            /* ── Loading skeleton — holds layout ── */
            <View style={{ gap: spacing.lg }}>
              <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                  <Skeleton width={64} height={64} borderRadius={radius.full} />
                  <View style={{ flex: 1 }}>
                    <SkeletonStack count={2} height={14} />
                  </View>
                </View>
              </View>
              <View style={styles.skeletonTabsRow}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} width={72} height={32} borderRadius={radius.md} />
                ))}
              </View>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.card, styles.cardActual, { minHeight: 72 }]}>
                  <SkeletonStack count={2} height={12} />
                </View>
              ))}
            </View>
          ) : error ? (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                loadBills();
              }}
            />
          ) : bills.length === 0 ? (
            /* ── Empty state (suggestions still surface above if present) ── */
            <>
              {suggestions.length > 0 && renderSuggestionsCard()}
              <EmptyState
                icon="document-text-outline"
                title="No bills tracked"
                description="Add your first bill to start tracking recurring payments"
                actionLabel="Add Bill"
                onAction={openAdd}
              />
            </>
          ) : (
            <>
              {/* ── Summary hero — committed vs upcoming split ── */}
              <View style={styles.heroCard}>
                <View style={styles.heroContent}>
                  <View style={styles.ringContainer}>
                    <ProgressRing
                      percent={paidPct}
                      size={64}
                      strokeWidth={5}
                      color={overdueCount > 0 ? colors.warning : colors.success}
                    />
                    <View style={styles.ringCenter}>
                      <Text style={styles.ringCount}>{paidCount}</Text>
                      <Text style={styles.ringLabel}>of {bills.length}</Text>
                    </View>
                  </View>

                  <View
                    style={{ flex: 1 }}
                    accessibilityLabel={`${paidCount} of ${bills.length} bills paid. Total due ${fmt(
                      totalDue,
                    )} per month. Paid ${fmt(paidAmount)}. Due ${fmt(unpaidAmount)}.${
                      overdueCount > 0
                        ? ` ${overdueCount} overdue, ${fmt(overdueAmount)}.`
                        : ''
                    }`}
                  >
                    <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
                    <Text style={styles.totalDueAmount}>
                      {fmt(totalDue)}
                      <Text style={styles.totalDuePeriod}> /mo</Text>
                    </Text>

                    <View style={styles.heroSplit}>
                      <View style={styles.splitItem}>
                        <View style={styles.splitSwatchSolid} />
                        <Text style={styles.splitLabel}>Paid</Text>
                        <Text style={[styles.splitValue, { color: colors.success }]}>
                          {fmt(paidAmount)}
                        </Text>
                      </View>
                      <View style={styles.splitItem}>
                        <View style={styles.splitSwatchDashed} />
                        <Text style={styles.splitLabel}>Due</Text>
                        <Text style={[styles.splitValue, { color: colors.warning }]}>
                          {fmt(unpaidAmount)}
                        </Text>
                      </View>
                    </View>

                    {overdueCount > 0 && (
                      <View style={styles.overdueLine}>
                        <Ionicons name="warning-outline" size={13} color={colors.error} />
                        <Text style={styles.overdueText}>
                          {overdueCount} overdue · {fmt(overdueAmount)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* ── Timeline ── */}
              {bills.length > 0 && <BillTimeline bills={billsWithStatus} />}

              {/* ── Filter tabs ── */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterTabsRow}
              >
                {filterTabs.map((f) => {
                  const isActive = filter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setFilter(f.key)}
                      style={[styles.filterTab, isActive && styles.filterTabActive]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`${f.label}, ${f.count}`}
                    >
                      <Text
                        style={[styles.filterTabText, isActive && styles.filterTabTextActive]}
                      >
                        {f.label}
                      </Text>
                      <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                        <Text
                          style={[
                            styles.filterBadgeText,
                            isActive && styles.filterBadgeTextActive,
                          ]}
                        >
                          {f.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* ── Tools: auto-detect + suggestions ── */}
              <TouchableOpacity
                style={styles.autoDetectBtn}
                onPress={handleAutoDetect}
                disabled={detecting}
                accessibilityLabel="Auto-detect bills from bank"
              >
                {detecting ? (
                  <ActivityIndicator size="small" color={colors.info} />
                ) : (
                  <Ionicons name="scan-outline" size={16} color={colors.info} />
                )}
                <Text style={styles.autoDetectText}>
                  {detecting ? 'Scanning…' : 'Auto-detect from bank'}
                </Text>
              </TouchableOpacity>

              {suggestions.length > 0 && renderSuggestionsCard()}

              {/* ── Inline owner legend ── */}
              <View style={styles.ownerLegend}>
                {['You', 'Partner', 'Joint'].map((o) => (
                  <View key={o} style={styles.legendItem}>
                    <OwnerDot owner={o} />
                    <Text style={styles.ownerLegendText}>{o}</Text>
                  </View>
                ))}
              </View>

              {/* ── Bill list (grouped when All, flat otherwise) ── */}
              {filteredBills.length === 0 ? (
                <View style={styles.emptyFilter}>
                  <Ionicons name="funnel-outline" size={20} color={colors.textDark} />
                  <Text style={styles.emptyFilterText}>No bills in this filter</Text>
                </View>
              ) : (
                groupedBills.map((group) => (
                  <View key={group.key}>
                    {group.label ? (
                      <Text style={styles.groupLabel}>── {group.label}</Text>
                    ) : null}
                    {group.items.map((b) => (
                      <BillRow
                        key={b.id}
                        bill={b}
                        categoryName={getBillCategory(b)}
                        onEdit={() => openEdit(b)}
                        onMarkPaid={() => handleMarkPaid(b)}
                        onDelete={() => handleDelete(b.id)}
                      />
                    ))}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editing ? 'Edit Bill' : 'Add Bill'}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rent, Netflix, Car Payment"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.label}>Amount Due</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amountDue}
                  onChangeText={setAmountDue}
                />

                <Text style={styles.label}>Due Day (1-31)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="15"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={dueDay}
                  onChangeText={setDueDay}
                />

                <Text style={styles.label}>Frequency</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowFrequencyPicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{getFrequencyLabel(frequency)}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <Text style={styles.label}>Payee</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Landlord, Netflix Inc."
                  placeholderTextColor={colors.textMuted}
                  value={payee}
                  onChangeText={setPayee}
                />

                <Text style={styles.label}>Category</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{getCategoryName(categoryId) || 'None'}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <Text style={styles.label}>Linked Debt Account</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowDebtPicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{getDebtName(debtAccountId) || 'None'}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Autopay Enabled</Text>
                  <Switch
                    value={isAutopay}
                    onValueChange={setIsAutopay}
                    trackColor={{ false: colors.glassMedium, true: 'rgba(59,130,246,0.4)' }}
                    thumbColor={isAutopay ? colors.info : colors.textMuted}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Share with partner</Text>
                  <Switch
                    value={isShared}
                    onValueChange={setIsShared}
                    trackColor={{ false: colors.glassMedium, true: 'rgba(168,85,247,0.4)' }}
                    thumbColor={isShared ? colors.primary2 : colors.textMuted}
                  />
                </View>

                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                  <LinearGradient
                    colors={gradients.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnInner}
                  >
                    <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Bill'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>

              {/* Frequency Picker */}
              {showFrequencyPicker && (
                <TouchableOpacity
                  style={styles.pickerOverlayBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowFrequencyPicker(false)}
                >
                  <View style={styles.pickerSheet}>
                    <Text style={styles.pickerSheetTitle}>Frequency</Text>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.pickerOption,
                          frequency === opt.value && styles.pickerOptionActive,
                        ]}
                        onPress={() => {
                          setFrequency(opt.value);
                          setShowFrequencyPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            frequency === opt.value && styles.pickerOptionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              )}

              {/* Category Picker */}
              {showCategoryPicker && (
                <TouchableOpacity
                  style={styles.pickerOverlayBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowCategoryPicker(false)}
                >
                  <View style={styles.pickerSheet}>
                    <Text style={styles.pickerSheetTitle}>Category</Text>
                    <TouchableOpacity
                      style={[styles.pickerOption, !categoryId && styles.pickerOptionActive]}
                      onPress={() => {
                        setCategoryId('');
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          !categoryId && styles.pickerOptionTextActive,
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    <ScrollView style={{ maxHeight: 300 }}>
                      {categories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.pickerOption,
                            categoryId === cat.id && styles.pickerOptionActive,
                          ]}
                          onPress={() => {
                            setCategoryId(cat.id);
                            setShowCategoryPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              categoryId === cat.id && styles.pickerOptionTextActive,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              )}

              {/* Debt Account Picker */}
              {showDebtPicker && (
                <TouchableOpacity
                  style={styles.pickerOverlayBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowDebtPicker(false)}
                >
                  <View style={styles.pickerSheet}>
                    <Text style={styles.pickerSheetTitle}>Linked Debt Account</Text>
                    <TouchableOpacity
                      style={[styles.pickerOption, !debtAccountId && styles.pickerOptionActive]}
                      onPress={() => {
                        setDebtAccountId('');
                        setShowDebtPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          !debtAccountId && styles.pickerOptionTextActive,
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    {debts.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={[
                          styles.pickerOption,
                          debtAccountId === d.id && styles.pickerOptionActive,
                        ]}
                        onPress={() => {
                          setDebtAccountId(d.id);
                          setShowDebtPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            debtAccountId === d.id && styles.pickerOptionTextActive,
                          ]}
                        >
                          {d.name} ({fmt(d.balance)})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  /* ---- Scroll ---- */
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
    gap: spacing.lg,
  },

  /* ---- Header ---- */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- Glass Card (shared) ---- */
  glassCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
  },

  /* ---- Summary Hero ---- */
  heroCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    borderRadius: radius.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  ringContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    flexShrink: 0,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCount: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '800',
  },
  ringLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontSize: 10,
  },
  totalDueLabel: {
    color: colors.textMuted,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalDueAmount: {
    color: colors.text,
    ...typography.h2,
    marginTop: spacing.xs / 2,
  },
  totalDuePeriod: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
  heroSplit: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  splitSwatchSolid: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  splitSwatchDashed: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.warning,
    backgroundColor: 'transparent',
  },
  splitLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  splitValue: {
    ...typography.caption,
    fontWeight: '700',
  },
  overdueLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  overdueText: {
    color: colors.error,
    ...typography.caption,
    fontWeight: '700',
  },

  /* ---- Timeline ---- */
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timelineTitleText: {
    ...typography.smallBold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineToday: {
    ...typography.caption,
    color: colors.textMuted,
  },
  timelineBarArea: {
    position: 'relative',
    height: 32,
    marginBottom: spacing.xs,
  },
  timelineTrack: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
  },
  timelineProgress: {
    position: 'absolute',
    top: 12,
    left: 0,
    height: 3,
    borderRadius: 2,
  },
  timelineDot: {
    position: 'absolute',
    top: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.bg,
    marginLeft: -7,
  },
  todayMarker: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: 22,
    backgroundColor: colors.primary2,
    borderRadius: 1,
    marginLeft: -1,
  },
  timelineLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },

  /* ---- Auto-detect ---- */
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
    minHeight: 44,
  },
  autoDetectText: {
    color: colors.info,
    ...typography.smallBold,
    fontWeight: '700',
  },

  /* ---- Suggested Bills ---- */
  suggestionsSection: {
    ...glassEffects.glass,
    padding: spacing.md,
    borderColor: 'rgba(234,179,8,0.18)',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  suggestionsTitle: {
    color: colors.warning,
    ...typography.smallBold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.glassLight,
    marginBottom: spacing.xs,
  },
  suggestionName: {
    color: colors.text,
    ...typography.smallBold,
  },
  suggestionMeta: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 2,
  },
  suggestionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,197,94,0.12)',
    minHeight: 44,
  },
  suggestionAddText: {
    color: colors.success,
    ...typography.caption,
    fontWeight: '700',
  },
  suggestionDismissBtn: {
    padding: spacing.xs,
  },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  showMoreText: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: '700',
  },

  /* ---- Filter Tabs ---- */
  filterTabsRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    minHeight: 44,
  },
  filterTabActive: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderColor: 'rgba(124,58,237,0.4)',
  },
  filterTabText: {
    ...typography.smallBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.primary2,
  },
  filterBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 1,
    backgroundColor: colors.glassMedium,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  filterBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  filterBadgeTextActive: {
    color: colors.primary2,
  },

  /* ---- Owner Legend ---- */
  ownerLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingLeft: spacing.xs,
    marginBottom: -spacing.sm,
  },
  ownerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ownerLegendText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },

  /* ---- Group label ---- */
  groupLabel: {
    color: colors.textDark,
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  /* ---- Bill Cards ---- */
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 72,
    borderWidth: 1,
  },
  cardActual: {
    backgroundColor: colors.glassLight,
    borderColor: colors.borderGlass,
  },
  cardProjected: {
    backgroundColor: 'transparent',
    borderColor: colors.borderGlass,
    borderStyle: 'dashed',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  cardTitle: {
    color: colors.text,
    ...typography.smallBold,
    flexShrink: 1,
  },
  projectedText: {
    opacity: 0.85,
  },
  cardAmount: {
    ...typography.bodyBold,
    fontWeight: '800',
    marginLeft: spacing.sm,
    flexShrink: 0,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 2,
  },
  autoBadgeText: {
    color: colors.info,
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  debtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 2,
  },
  debtBadgeText: {
    color: colors.primary2,
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  detailText: {
    color: colors.textMuted,
    ...typography.caption,
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: radius.md,
  },
  payBtnText: {
    color: colors.success,
    ...typography.caption,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- Empty-filter notice ---- */
  emptyFilter: {
    ...glassEffects.glass,
    padding: spacing.xl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyFilterText: {
    color: colors.textMuted,
    ...typography.small,
    fontWeight: '600',
  },

  /* ---- Skeleton ---- */
  skeletonTabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  /* ---- Modal Styles ---- */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    ...typography.smallBold,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    ...typography.small,
    minHeight: 44,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    minHeight: 44,
  },
  pickerBtnText: {
    color: colors.text,
    ...typography.small,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  switchLabel: {
    color: colors.text,
    ...typography.smallBold,
  },
  saveBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveBtnText: {
    color: colors.text,
    ...typography.button,
    fontWeight: '800',
  },

  /* ---- Picker Overlay ---- */
  pickerOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  pickerSheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '60%',
  },
  pickerSheetTitle: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  pickerOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  pickerOptionText: {
    color: colors.text,
    ...typography.small,
  },
  pickerOptionTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
