import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';

const EXTRA_PRESETS = [0, 100, 250, 500, 1000, 2000];

type Debt = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  min_payment: number;
};

type Strategy = 'avalanche' | 'snowball' | 'custom';

type PayoffResult = {
  totalMonths: number;
  totalInterest: number;
  payoffDate: string;
  perDebt: { id: string; name: string; months: number; interest: number }[];
};

const MAX_MONTHS = 600;

function computePayoff(debts: Debt[], extraPayment: number, strategy: Strategy): PayoffResult {
  if (debts.length === 0) {
    return { totalMonths: 0, totalInterest: 0, payoffDate: new Date().toISOString(), perDebt: [] };
  }

  // Clone balances
  const state = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    apr: d.apr,
    minPayment: d.min_payment,
    interest: 0,
    paidOff: false,
    paidOffMonth: 0,
  }));

  // Sort by strategy
  const sorted = [...state];
  if (strategy === 'avalanche') {
    sorted.sort((a, b) => b.apr - a.apr); // highest APR first
  } else if (strategy === 'snowball') {
    sorted.sort((a, b) => a.balance - b.balance); // lowest balance first
  }
  // 'custom' keeps original order

  let months = 0;
  let totalInterest = 0;

  while (months < MAX_MONTHS) {
    const allPaid = sorted.every((d) => d.balance <= 0);
    if (allPaid) break;

    months++;
    let extraPool = extraPayment;

    // 1. Apply monthly interest
    for (const d of sorted) {
      if (d.balance <= 0) continue;
      const monthlyInterest = d.balance * (d.apr / 100) / 12;
      d.balance += monthlyInterest;
      d.interest += monthlyInterest;
      totalInterest += monthlyInterest;
    }

    // 2. Apply min payments to all debts
    for (const d of sorted) {
      if (d.balance <= 0) continue;
      const payment = Math.min(d.minPayment, d.balance);
      d.balance -= payment;
      if (d.balance <= 0.01) {
        d.balance = 0;
        if (!d.paidOff) {
          d.paidOff = true;
          d.paidOffMonth = months;
          // Freed min payment rolls into extra pool
          extraPool += d.minPayment;
        }
      }
    }

    // 3. Apply extra payment to priority debt (first unpaid in sorted order)
    for (const d of sorted) {
      if (d.balance <= 0 || extraPool <= 0) continue;
      const payment = Math.min(extraPool, d.balance);
      d.balance -= payment;
      extraPool -= payment;
      if (d.balance <= 0.01) {
        d.balance = 0;
        if (!d.paidOff) {
          d.paidOff = true;
          d.paidOffMonth = months;
          extraPool += d.minPayment;
        }
      }
    }
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    totalMonths: months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate: payoffDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    perDebt: sorted.map((d) => ({
      id: d.id,
      name: d.name,
      months: d.paidOffMonth || months,
      interest: Math.round(d.interest * 100) / 100,
    })),
  };
}

export default function PayoffCalculatorScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);

  const loadDebts = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<Debt[]>('/auth/debts', { user_id: userId });
      const active = (Array.isArray(data) ? data : []).filter((d) => d.balance > 0);
      setDebts(active);
      setSelectedIds(new Set(active.map((d) => d.id)));
    } catch (e) {
      console.error('Failed to load debts:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const focusedDebts = useMemo(
    () => debts.filter((d) => selectedIds.has(d.id)),
    [debts, selectedIds]
  );

  const result = useMemo(
    () => computePayoff(focusedDebts, extraPayment, strategy),
    [focusedDebts, extraPayment, strategy]
  );

  const toggleDebt = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selectedIds.size === debts.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(debts.map((d) => d.id)));
  };

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const totalBalance = focusedDebts.reduce((s, d) => s + d.balance, 0);

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payoff Calculator</Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 60 }} />
          ) : debts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#34d399" />
              <Text style={styles.emptyText}>No outstanding debts!</Text>
              <Text style={styles.emptySubtext}>Add debts to run payoff scenarios</Text>
            </View>
          ) : (
            <>
              {/* Debt Selection */}
              <View style={styles.selectionHeader}>
                <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>Select Debts</Text>
                <TouchableOpacity onPress={toggleAll} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllText}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.debtChipWrap}>
                {debts.map((d) => {
                  const selected = selectedIds.has(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.debtChip, selected && styles.debtChipActive]}
                      onPress={() => toggleDebt(d.id)}
                    >
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={selected ? '#c084fc' : '#64748b'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.debtChipName, selected && styles.debtChipNameActive]}>
                          {d.name}
                        </Text>
                        <Text style={styles.debtChipBal}>
                          {fmt(d.balance)} • {d.apr}% APR
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedIds.size === 0 && (
                <Text style={styles.noSelectionText}>Select at least one debt to calculate</Text>
              )}

              {/* Strategy Picker */}
              <Text style={styles.sectionLabel}>Strategy</Text>
              <View style={styles.strategyRow}>
                {(
                  [
                    { key: 'avalanche', label: 'Avalanche', desc: 'Highest APR first' },
                    { key: 'snowball', label: 'Snowball', desc: 'Lowest balance first' },
                    { key: 'custom', label: 'Custom', desc: 'Current order' },
                  ] as const
                ).map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.strategyBtn, strategy === s.key && styles.strategyBtnActive]}
                    onPress={() => setStrategy(s.key)}
                  >
                    <Text
                      style={[
                        styles.strategyLabel,
                        strategy === s.key && styles.strategyLabelActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                    <Text style={styles.strategyDesc}>{s.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Extra Payment */}
              <Text style={styles.sectionLabel}>Extra Monthly Payment</Text>
              <View style={styles.sliderCard}>
                <TextInput
                  style={styles.extraInput}
                  value={extraPayment > 0 ? String(extraPayment) : ''}
                  placeholder="$0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setExtraPayment(Math.max(0, num));
                  }}
                />
                <View style={styles.presetRow}>
                  {EXTRA_PRESETS.map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.presetBtn,
                        extraPayment === val && styles.presetBtnActive,
                      ]}
                      onPress={() => setExtraPayment(val)}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          extraPayment === val && styles.presetTextActive,
                        ]}
                      >
                        ${val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Results Cards */}
              <Text style={styles.sectionLabel}>Results</Text>
              <View style={styles.resultsRow}>
                <View style={styles.resultCard}>
                  <Ionicons name="calendar-outline" size={20} color="#c084fc" />
                  <Text style={styles.resultValue}>
                    {result.totalMonths >= MAX_MONTHS ? '50+ yrs' : `${result.totalMonths} mo`}
                  </Text>
                  <Text style={styles.resultLabel}>To pay off</Text>
                </View>
                <View style={styles.resultCard}>
                  <Ionicons name="cash-outline" size={20} color="#f87171" />
                  <Text style={styles.resultValue}>{fmt(result.totalInterest)}</Text>
                  <Text style={styles.resultLabel}>Total interest</Text>
                </View>
                <View style={styles.resultCard}>
                  <Ionicons name="flag-outline" size={20} color="#34d399" />
                  <Text style={styles.resultValue} numberOfLines={1}>
                    {result.totalMonths >= MAX_MONTHS ? 'N/A' : result.payoffDate}
                  </Text>
                  <Text style={styles.resultLabel}>Debt-free by</Text>
                </View>
              </View>

              {/* Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total debt</Text>
                  <Text style={styles.summaryValue}>{fmt(totalBalance)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total interest</Text>
                  <Text style={[styles.summaryValue, { color: '#f87171' }]}>
                    +{fmt(result.totalInterest)}
                  </Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: '800' }]}>Total cost</Text>
                  <Text style={[styles.summaryValue, { fontWeight: '800' }]}>
                    {fmt(totalBalance + result.totalInterest)}
                  </Text>
                </View>
              </View>

              {/* Per-Debt Breakdown */}
              <Text style={styles.sectionLabel}>Payoff Order</Text>
              {result.perDebt.map((d, i) => (
                <View key={d.id} style={styles.debtRow}>
                  <View style={styles.debtRank}>
                    <Text style={styles.debtRankText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.debtName}>{d.name}</Text>
                    <Text style={styles.debtMeta}>
                      {d.months} months • {fmt(d.interest)} interest
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  emptySubtext: { color: '#94a3b8', fontSize: 13 },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 16,
  },

  // Debt selection
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  selectAllText: { color: '#c084fc', fontSize: 12, fontWeight: '700' },
  debtChipWrap: { gap: 8 },
  debtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  debtChipActive: {
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderColor: 'rgba(168,85,247,0.35)',
  },
  debtChipName: { color: '#94a3b8', fontWeight: '700', fontSize: 14 },
  debtChipNameActive: { color: '#f8fafc' },
  debtChipBal: { color: '#64748b', fontSize: 12, marginTop: 1 },
  noSelectionText: {
    color: '#f87171',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },

  // Strategy
  strategyRow: { flexDirection: 'row', gap: 8 },
  strategyBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  strategyBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  strategyLabel: { color: '#e5e7eb', fontWeight: '700', fontSize: 13 },
  strategyLabelActive: { color: '#fff' },
  strategyDesc: { color: '#94a3b8', fontSize: 10, marginTop: 2 },

  // Extra payment input
  sliderCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  extraInput: {
    color: '#c084fc',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    paddingVertical: 4,
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  presetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  presetText: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  presetTextActive: { color: '#fff', fontWeight: '800' },

  // Results
  resultsRow: { flexDirection: 'row', gap: 8 },
  resultCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 4,
  },
  resultValue: { color: '#f8fafc', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  resultLabel: { color: '#94a3b8', fontSize: 11 },

  // Summary
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 16,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#cbd5e1', fontSize: 14 },
  summaryValue: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },

  // Per-debt breakdown
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  debtRank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtRankText: { color: '#c084fc', fontWeight: '800', fontSize: 14 },
  debtName: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  debtMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
});
