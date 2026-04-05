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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../utils/apiClient';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

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

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  paid: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: 'checkmark', label: 'Paid' },
  unpaid: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: 'time-outline', label: 'Upcoming' },
  overdue: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: 'warning-outline', label: 'Overdue' },
};

const OWNER_COLORS: Record<string, string> = {
  You: '#a855f7',
  Partner: '#ec4899',
  Joint: '#06b6d4',
};

const FREQUENCY_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Biweekly', value: 'biweekly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

/* ---- Progress Ring Component ---- */
function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 5,
  color = '#34d399',
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
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
        rotation={-90}
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

/* ---- Owner Dot Component ---- */
function OwnerDot({ owner }: { owner?: string }) {
  const color = OWNER_COLORS[owner || ''] || 'rgba(255,255,255,0.35)';
  return <View style={[styles.ownerDot, { backgroundColor: color }]} />;
}

/* ---- Bill Status Helper ---- */
function getBillStatus(bill: Bill): string {
  if (bill.status === 'paid') return 'paid';
  const today = new Date().getDate();
  if (bill.due_day < today && bill.status !== 'paid') return 'overdue';
  return 'unpaid';
}

/* ---- Bill Owner Helper ---- */
function getBillOwner(bill: Bill): string {
  if (bill.owner) return bill.owner;
  if (bill.is_shared) return 'Joint';
  return 'You';
}

/* ---- Timeline Component ---- */
function BillTimeline({ bills }: { bills: Bill[] }) {
  const today = new Date().getDate();
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  const sorted = [...bills].sort((a, b) => a.due_day - b.due_day);
  const progressPercent = (today / 30) * 100;

  return (
    <View style={styles.glassCard}>
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitleText}>
          {monthName} Timeline
        </Text>
        <Text style={styles.timelineToday}>
          Today: {ordinalSuffix(today)}
        </Text>
      </View>

      {/* Timeline bar area */}
      <View style={styles.timelineBarArea}>
        {/* Track background */}
        <View style={styles.timelineTrack} />

        {/* Progress fill */}
        <LinearGradient
          colors={['#7c3aed', '#a855f7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.timelineProgress, { width: `${progressPercent}%` }]}
        />

        {/* Bill dots */}
        {sorted.map((b) => {
          const status = getBillStatus(b);
          const statusColor = STATUS_CONFIG[status].color;
          const leftPercent = ((b.due_day - 1) / 30) * 100;
          return (
            <View
              key={b.id}
              style={[
                styles.timelineDot,
                {
                  left: `${leftPercent}%`,
                  backgroundColor: statusColor,
                },
              ]}
            />
          );
        })}

        {/* Today marker */}
        <View
          style={[
            styles.todayMarker,
            { left: `${progressPercent}%` },
          ]}
        />
      </View>

      {/* Legend */}
      <View style={styles.timelineLegend}>
        {[
          { color: '#34d399', label: 'Paid' },
          { color: '#fbbf24', label: 'Upcoming' },
          { color: '#f87171', label: 'Overdue' },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---- Main Screen ---- */
export default function BillsScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [detecting, setDetecting] = useState(false);
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

  useEffect(() => {
    loadBills();
    loadDropdownData();
  }, [loadBills, loadDropdownData]);

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
            await api.delete(`/auth/bills/${billId}`);
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
        undefined
      );
      const count = result?.count ?? 0;
      if (count > 0) {
        Alert.alert('Auto-Detect', `Matched ${count} bill payment(s) from your bank transactions.`);
        loadBills();
      } else {
        Alert.alert('Auto-Detect', 'No matching bank transactions found for unpaid bills.');
      }
    } catch (e) {
      console.error('Auto-detect error:', e);
      Alert.alert('Error', 'Failed to auto-detect payments.');
    } finally {
      setDetecting(false);
    }
  };

  // Computed values
  const billsWithStatus = bills.map((b) => ({
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
  const upcomingCount = billsWithStatus.filter((b) => b._status === 'unpaid').length;
  const paidPct = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0;

  const filteredBills =
    filter === 'all'
      ? billsWithStatus
      : billsWithStatus.filter((b) => b._status === filter);

  const fmt = (v: number) =>
    '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getCategoryName = (id?: string) => categories.find((c) => c.id === id)?.name;
  const getDebtName = (id?: string) => debts.find((d) => d.id === id)?.name;
  const getFrequencyLabel = (val: string) =>
    FREQUENCY_OPTIONS.find((f) => f.value === val)?.label || val;

  const filterTabs = [
    { key: 'all', label: 'All', count: bills.length },
    { key: 'unpaid', label: 'Upcoming', count: upcomingCount },
    { key: 'paid', label: 'Paid', count: paidCount },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
  ];

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.navigate('/(tabs)/goals' as any)}
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={18} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bills</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <LinearGradient
              colors={['#7c3aed', '#a855f7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButton}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
          {/* Summary Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroContent}>
              {/* Progress Ring */}
              <View style={styles.ringContainer}>
                <ProgressRing percent={paidPct} size={64} strokeWidth={5} color="#34d399" />
                <View style={styles.ringCenter}>
                  <Text style={styles.ringCount}>{paidCount}</Text>
                  <Text style={styles.ringLabel}>of {bills.length}</Text>
                </View>
              </View>

              {/* Right side: Total Due + breakdown */}
              <View style={{ flex: 1 }}>
                <Text style={styles.totalDueLabel}>Total Due</Text>
                <Text style={styles.totalDueAmount}>
                  {fmt(totalDue)}
                  <Text style={styles.totalDuePeriod}>/mo</Text>
                </Text>

                <View style={styles.heroBreakdown}>
                  <View>
                    <Text style={styles.breakdownLabel}>Paid</Text>
                    <Text style={[styles.breakdownValue, { color: '#34d399' }]}>
                      {fmt(paidAmount)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.breakdownLabel}>Remaining</Text>
                    <Text style={[styles.breakdownValue, { color: '#fbbf24' }]}>
                      {fmt(unpaidAmount)}
                    </Text>
                  </View>
                  {overdueCount > 0 && (
                    <View>
                      <Text style={styles.breakdownLabel}>Overdue</Text>
                      <Text style={[styles.breakdownValue, { color: '#f87171' }]}>
                        {overdueCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Timeline */}
          {bills.length > 0 && <BillTimeline bills={billsWithStatus} />}

          {/* Auto-detect Button */}
          <TouchableOpacity style={styles.autoDetectBtn} onPress={handleAutoDetect} disabled={detecting}>
            {detecting ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : (
              <Ionicons name="scan-outline" size={16} color="#60a5fa" />
            )}
            <Text style={styles.autoDetectText}>
              {detecting ? 'Scanning...' : 'Auto-detect from bank'}
            </Text>
          </TouchableOpacity>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {filterTabs.map((f) => {
              const isActive = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.filterTab,
                    isActive && styles.filterTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      isActive && styles.filterTabTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                  <View
                    style={[
                      styles.filterBadge,
                      isActive && styles.filterBadgeActive,
                    ]}
                  >
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

          {/* Owner Legend */}
          <View style={styles.ownerLegend}>
            {['You', 'Partner', 'Joint'].map((o) => (
              <View key={o} style={styles.legendItem}>
                <OwnerDot owner={o} />
                <Text style={styles.ownerLegendText}>{o}</Text>
              </View>
            ))}
          </View>

          {/* Bill List */}
          {error && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                loadBills();
              }}
            />
          )}

          {!error && loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : !error && bills.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No bills tracked"
              description="Add your first bill to start tracking recurring payments"
              actionLabel="Add Bill"
              onAction={() => {
                resetForm();
                setShowForm(true);
              }}
            />
          ) : (
            filteredBills.map((b) => {
              const status = STATUS_CONFIG[b._status];
              const owner = b._owner;
              return (
                <TouchableOpacity key={b.id} style={styles.card} onPress={() => openEdit(b)}>
                  {/* Top row: owner dot + name + badges + amount */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.cardNameRow}>
                        <OwnerDot owner={owner} />
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {b.name}
                        </Text>
                        {b.is_autopay && (
                          <View style={styles.badge}>
                            <Ionicons name="flash" size={9} color="#60a5fa" />
                            <Text style={styles.badgeText}>Auto</Text>
                          </View>
                        )}
                        {b.debt_account_id && (
                          <View style={[styles.badge, { backgroundColor: 'rgba(236,72,153,0.12)' }]}>
                            <Ionicons name="link" size={9} color="#f472b6" />
                            <Text style={[styles.badgeText, { color: '#f472b6' }]}>Debt</Text>
                          </View>
                        )}
                      </View>

                      {/* Details row */}
                      <View style={styles.cardDetails}>
                        <Text style={styles.detailText}>
                          Due {b.due_day}
                          {ordinalSuffix(b.due_day)}
                        </Text>
                        {b.payee ? <Text style={styles.detailText}>{b.payee}</Text> : null}
                        {(b.category_name || getCategoryName(b.category_id)) ? (
                          <Text style={styles.detailText}>
                            {b.category_name || getCategoryName(b.category_id)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.cardAmount}>{fmt(b.amount_due)}</Text>
                  </View>

                  {/* Footer: status chip + actions */}
                  <View style={styles.cardFooter}>
                    <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
                      <Ionicons name={status.icon as any} size={12} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {b._status !== 'paid' && (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleMarkPaid(b);
                          }}
                        >
                          <Ionicons name="checkmark" size={12} color="#34d399" />
                          <Text style={styles.payBtnText}>Mark Paid</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDelete(b.id);
                        }}
                      >
                        <Ionicons name="trash-outline" size={12} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Edit Bill' : 'Add Bill'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    <Ionicons name="close" size={24} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rent, Netflix, Car Payment"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.label}>Amount Due</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={amountDue}
                  onChangeText={setAmountDue}
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

                <Text style={styles.label}>Frequency</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowFrequencyPicker(true)}
                >
                  <Text style={styles.pickerBtnText}>{getFrequencyLabel(frequency)}</Text>
                  <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <Text style={styles.label}>Payee</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Landlord, Netflix Inc."
                  placeholderTextColor="#94a3b8"
                  value={payee}
                  onChangeText={setPayee}
                />

                <Text style={styles.label}>Category</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={styles.pickerBtnText}>
                    {getCategoryName(categoryId) || 'None'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <Text style={styles.label}>Linked Debt Account</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowDebtPicker(true)}
                >
                  <Text style={styles.pickerBtnText}>
                    {getDebtName(debtAccountId) || 'None'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                </TouchableOpacity>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Autopay Enabled</Text>
                  <Switch
                    value={isAutopay}
                    onValueChange={setIsAutopay}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(96,165,250,0.4)' }}
                    thumbColor={isAutopay ? '#60a5fa' : '#94a3b8'}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Share with partner</Text>
                  <Switch
                    value={isShared}
                    onValueChange={setIsShared}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(168,85,247,0.4)' }}
                    thumbColor={isShared ? '#c084fc' : '#64748b'}
                  />
                </View>

                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                  <LinearGradient
                    colors={['#a855f7', '#7c3aed']}
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
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
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

const styles = StyleSheet.create({
  /* ---- Header ---- */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- Glass Card (shared) ---- */
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 16,
  },

  /* ---- Summary Hero ---- */
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
    backgroundColor: 'rgba(124,58,237,0.12)',
    padding: 20,
    marginBottom: 16,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  ringLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
  },
  totalDueLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  totalDueAmount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  totalDuePeriod: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  heroBreakdown: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  breakdownLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---- Timeline ---- */
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timelineTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineToday: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  timelineBarArea: {
    position: 'relative',
    height: 32,
    marginBottom: 6,
  },
  timelineTrack: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    borderColor: '#0f0a1e',
    marginLeft: -7,
  },
  todayMarker: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: 22,
    backgroundColor: '#a855f7',
    borderRadius: 1,
    marginLeft: -1,
  },
  timelineLegend: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },

  /* ---- Auto-detect ---- */
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.15)',
  },
  autoDetectText: {
    color: '#60a5fa',
    fontWeight: '700',
    fontSize: 13,
  },

  /* ---- Filter Tabs ---- */
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderColor: 'rgba(168,85,247,0.4)',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  filterTabTextActive: {
    color: '#a855f7',
  },
  filterBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
  },
  filterBadgeTextActive: {
    color: '#a855f7',
  },

  /* ---- Owner Legend ---- */
  ownerLegend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
    paddingLeft: 4,
  },
  ownerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ownerLegendText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },

  /* ---- Bill Cards ---- */
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },
  cardAmount: {
    color: '#c084fc',
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 8,
    flexShrink: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  detailText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 10,
  },
  payBtnText: {
    color: '#34d399',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- Modal Styles ---- */
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#f8fafc',
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
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 15,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerBtnText: {
    color: '#f8fafc',
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switchLabel: {
    color: '#e5e7eb',
    fontSize: 14,
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

  /* ---- Picker Overlay ---- */
  pickerOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  pickerSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  pickerSheetTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  pickerOptionText: {
    color: '#e5e7eb',
    fontSize: 15,
  },
  pickerOptionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
