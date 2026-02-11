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
};

type Bill = {
  id: string;
  name: string;
  amount_due: number;
  due_day: number;
  frequency: string;
  debt_account_id?: string | null;
};

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

  // Form state
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [strategy, setStrategy] = useState('');
  const [createBill, setCreateBill] = useState(false);
  const [billFrequency, setBillFrequency] = useState('monthly');

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
    } catch (e) {
      console.error('Failed to load debts:', e);
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
      is_shared: false,
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
              is_shared: false,
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

  // Build lookup: debt_account_id → bill (so we know which debts already have a bill)
  const billsByDebtId: Record<string, Bill> = {};
  bills.forEach((b) => {
    if (b.debt_account_id) billsByDebtId[b.debt_account_id] = b;
  });

  const totalBalance = debts.reduce((s, d) => s + (d.balance || 0), 0);
  const totalMinPayment = debts.reduce((s, d) => s + (d.min_payment || 0), 0);
  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Debts</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Ionicons name="add-circle" size={28} color="#c084fc" />
            </TouchableOpacity>
          </View>

          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Total Owed</Text>
                <Text style={styles.summaryValue}>{fmt(totalBalance)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Min Payments</Text>
                <Text style={styles.summaryValue}>{fmt(totalMinPayment)}/mo</Text>
              </View>
            </View>
            {debts.length > 0 && (
              <TouchableOpacity
                style={styles.calcBtn}
                onPress={() => router.push('/payoff-calculator')}
              >
                <Ionicons name="calculator-outline" size={16} color="#60a5fa" />
                <Text style={styles.calcBtnText}>Payoff Calculator</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : debts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No debts tracked yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first debt</Text>
            </View>
          ) : (
            debts.map((d) => (
              <TouchableOpacity key={d.id} style={styles.card} onPress={() => openEdit(d)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{d.name}</Text>
                  <Text style={styles.cardBalance}>{fmt(d.balance)}</Text>
                </View>
                <View style={styles.cardDetails}>
                  {d.apr > 0 && <Text style={styles.detailText}>APR {d.apr}%</Text>}
                  {d.min_payment > 0 && (
                    <Text style={styles.detailText}>Min {fmt(d.min_payment)}</Text>
                  )}
                  {d.due_day != null && (
                    <Text style={styles.detailText}>Due day {d.due_day}</Text>
                  )}
                </View>
                <View style={styles.cardActions}>
                  {d.balance > 0 && (
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setPaymentId(d.id);
                        setPaymentAmount('');
                      }}
                    >
                      <Ionicons name="cash-outline" size={14} color="#34d399" />
                      <Text style={styles.payBtnText}>Make Payment</Text>
                    </TouchableOpacity>
                  )}
                  {billsByDebtId[d.id] ? (
                    <TouchableOpacity
                      style={styles.billBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        router.push('/bills');
                      }}
                    >
                      <Ionicons name="receipt-outline" size={14} color="#60a5fa" />
                      <Text style={styles.billBtnText}>View Bill</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.billBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setBillDebt(d);
                        setBillFreq('monthly');
                      }}
                    >
                      <Ionicons name="receipt-outline" size={14} color="#60a5fa" />
                      <Text style={styles.billBtnText}>Create Bill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Edit Debt' : 'Add Debt'}
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

                <Text style={styles.label}>Strategy</Text>
                <View style={styles.strategyRow}>
                  {['avalanche', 'snowball', ''].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.strategyBtn, strategy === s && styles.strategyBtnActive]}
                      onPress={() => setStrategy(s)}
                    >
                      <Text
                        style={[
                          styles.strategyText,
                          strategy === s && styles.strategyTextActive,
                        ]}
                      >
                        {s || 'None'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Create Associated Bill toggle — only for new debts */}
                {!editing && (
                  <>
                    <View style={styles.billToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.billToggleLabel}>Create associated bill</Text>
                        <Text style={styles.billToggleDesc}>
                          Auto-create a recurring bill linked to this debt
                        </Text>
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

        {/* Payment Modal */}
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

        {/* Create Bill from Debt Modal */}
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
      </SafeAreaView>
    </LinearGradient>
  );
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
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#cbd5e1', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  cardBalance: { color: '#f472b6', fontWeight: '800', fontSize: 16 },
  cardDetails: { flexDirection: 'row', gap: 12, marginTop: 8 },
  detailText: { color: '#94a3b8', fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 10,
  },
  payBtnText: { color: '#34d399', fontWeight: '700', fontSize: 13 },
  billBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderRadius: 10,
  },
  billBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 13 },
  billPreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.15)',
  },
  billPreviewText: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  calcBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  emptySubtext: { color: '#94a3b8', fontSize: 13 },
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
  strategyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  strategyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  strategyBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.7)',
  },
  strategyText: { color: '#e5e7eb', textTransform: 'capitalize', fontSize: 13 },
  strategyTextActive: { color: '#fff', fontWeight: '700' },
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
  billToggleLabel: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  billToggleDesc: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  billOptionsCard: {
    marginTop: 10,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  billOptionsHint: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  freqBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  freqBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  freqText: { color: '#e5e7eb', fontSize: 12 },
  freqTextActive: { color: '#fff', fontWeight: '700' },
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20, marginBottom: 20 },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  paymentSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
});
