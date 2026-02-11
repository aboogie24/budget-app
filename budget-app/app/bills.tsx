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
import { api } from '../utils/apiClient';

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
};

type Category = { id: string; name: string; type?: string };
type Debt = { id: string; name: string; balance: number };

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  paid: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: 'checkmark-circle', label: 'Paid' },
  unpaid: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: 'time', label: 'Upcoming' },
  overdue: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: 'alert-circle', label: 'Overdue' },
};

const FREQUENCY_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Biweekly', value: 'biweekly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

export default function BillsScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [detecting, setDetecting] = useState(false);

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

  const loadBills = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<Bill[]>('/auth/bills', { user_id: userId });
      setBills(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load bills:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdownData = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;

      const [cats, userDebts] = await Promise.all([
        api.get<Category[]>(`/categories/user/${userId}`).catch(() => []),
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
      is_shared: false,
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

  const paidCount = bills.filter((b) => b.status === 'paid').length;
  const totalDue = bills.reduce((s, b) => s + (b.amount_due || 0), 0);
  const unpaidBills = bills.filter((b) => b.status !== 'paid');
  const nextUpcoming = unpaidBills.sort((a, b) => a.due_day - b.due_day)[0];

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const getCategoryName = (id?: string) => categories.find((c) => c.id === id)?.name;
  const getDebtName = (id?: string) => debts.find((d) => d.id === id)?.name;
  const getFrequencyLabel = (val: string) =>
    FREQUENCY_OPTIONS.find((f) => f.value === val)?.label || val;

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bills</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Ionicons name="add-circle" size={28} color="#c084fc" />
            </TouchableOpacity>
          </View>

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Bills Paid</Text>
                <Text style={styles.summaryValue}>
                  {paidCount} / {bills.length}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Total Due</Text>
                <Text style={styles.summaryValue}>{fmt(totalDue)}/mo</Text>
              </View>
            </View>
            {nextUpcoming && (
              <View style={styles.nextUpcoming}>
                <Ionicons name="time-outline" size={14} color="#fbbf24" />
                <Text style={styles.nextUpcomingText}>
                  Next: {nextUpcoming.name} — {fmt(nextUpcoming.amount_due)} due on the{' '}
                  {nextUpcoming.due_day}
                  {ordinalSuffix(nextUpcoming.due_day)}
                </Text>
              </View>
            )}
          </View>

          {/* Auto-detect button */}
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

          {/* Bill List */}
          {loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : bills.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No bills tracked yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first bill</Text>
            </View>
          ) : (
            bills.map((b) => {
              const status = STATUS_CONFIG[b.status || 'unpaid'];
              return (
                <TouchableOpacity key={b.id} style={styles.card} onPress={() => openEdit(b)}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {b.name}
                      </Text>
                      {b.is_autopay && (
                        <View style={styles.badge}>
                          <Ionicons name="flash" size={10} color="#60a5fa" />
                          <Text style={styles.badgeText}>Auto</Text>
                        </View>
                      )}
                      {b.debt_account_id && (
                        <View style={[styles.badge, { backgroundColor: 'rgba(244,114,182,0.12)' }]}>
                          <Ionicons name="link" size={10} color="#f472b6" />
                          <Text style={[styles.badgeText, { color: '#f472b6' }]}>Debt</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardAmount}>{fmt(b.amount_due)}</Text>
                  </View>

                  <View style={styles.cardDetails}>
                    <Text style={styles.detailText}>
                      Due {b.due_day}
                      {ordinalSuffix(b.due_day)}
                    </Text>
                    {b.payee && <Text style={styles.detailText}>{b.payee}</Text>}
                    {(b.category_name || getCategoryName(b.category_id)) && (
                      <Text style={styles.detailText}>
                        {b.category_name || getCategoryName(b.category_id)}
                      </Text>
                    )}
                    {(b.debt_name || getDebtName(b.debt_account_id)) && (
                      <Text style={[styles.detailText, { color: '#f472b6' }]}>
                        {b.debt_name || getDebtName(b.debt_account_id)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    {/* Status chip */}
                    <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
                      <Ionicons name={status.icon as any} size={12} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {b.status !== 'paid' && (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleMarkPaid(b);
                          }}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" />
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
                        <Ionicons name="trash-outline" size={14} color="#f87171" />
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

              {/* Frequency Picker — inline overlay inside form modal */}
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

              {/* Category Picker — inline overlay inside form modal */}
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

              {/* Debt Account Picker — inline overlay inside form modal */}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#cbd5e1', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 4 },
  nextUpcoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  nextUpcomingText: { color: '#fbbf24', fontSize: 13 },
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  autoDetectText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  cardAmount: { color: '#c084fc', fontWeight: '800', fontSize: 16, marginLeft: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#60a5fa', fontSize: 10, fontWeight: '700' },
  cardDetails: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  detailText: { color: '#94a3b8', fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 10,
  },
  payBtnText: { color: '#34d399', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 10,
  },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  emptySubtext: { color: '#94a3b8', fontSize: 13 },

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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  label: { color: '#e5e7eb', fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 12 },
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
  pickerBtnText: { color: '#f8fafc', fontSize: 15 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switchLabel: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20, marginBottom: 20 },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Picker overlay styles (rendered inside the form modal)
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
  pickerSheetTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  pickerOptionText: { color: '#e5e7eb', fontSize: 15 },
  pickerOptionTextActive: { color: '#fff', fontWeight: '700' },
});
