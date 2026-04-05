import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import CategoryPicker from '@/components/CategoryPicker';

type SplitRow = {
  key: string;
  category_id: string;
  category_name: string;
  amount: string;
  note: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    amount: number;
    note?: string;
    category_name?: string;
  } | null;
  userId: string;
  onSplitSaved: () => void;
};

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `split-${keyCounter}`;
}

function makeEmptyRow(): SplitRow {
  return { key: nextKey(), category_id: '', category_name: '', amount: '', note: '' };
}

export default function SplitTransactionModal({
  visible,
  onClose,
  transaction,
  userId,
  onSplitSaved,
}: Props) {
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [existingSplits, setExistingSplits] = useState<any[] | null>(null);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);

  // Load existing splits when modal opens
  useEffect(() => {
    if (!visible || !transaction) return;
    setRows([makeEmptyRow(), makeEmptyRow()]);
    setExistingSplits(null);
    loadExistingSplits();
  }, [visible, transaction?.id]);

  const loadExistingSplits = async () => {
    if (!transaction) return;
    setLoadingSplits(true);
    try {
      const data = await api.get<any[]>(`/auth/transactions/${transaction.id}/split`);
      if (Array.isArray(data) && data.length > 0) {
        setExistingSplits(data);
        setRows(
          data.map((s: any) => ({
            key: nextKey(),
            category_id: s.category_id || '',
            category_name: s.category_name || '',
            amount: s.amount != null ? String(s.amount) : '',
            note: s.note || '',
          }))
        );
      }
    } catch {
      // No existing splits, start fresh
    } finally {
      setLoadingSplits(false);
    }
  };

  const totalAmount = transaction?.amount ?? 0;
  const absTotal = Math.abs(totalAmount);

  const splitSum = rows.reduce((sum, r) => {
    const val = parseFloat(r.amount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const isBalanced = Math.abs(splitSum - absTotal) < 0.01;
  const allCategoriesSet = rows.every((r) => r.category_id !== '');
  const canSave = isBalanced && allCategoriesSet && rows.length >= 2 && !saving;

  const updateRow = useCallback(
    (key: string, field: keyof SplitRow, value: string) => {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const removeRow = useCallback((key: string) => {
    setRows((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((r) => r.key !== key);
    });
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, makeEmptyRow()]);
  }, []);

  const openCategoryPicker = (rowKey: string) => {
    setActiveRowKey(rowKey);
    setPickerVisible(true);
  };

  const handleCategorySelected = (cat: { id: string; name: string; parent_name?: string }) => {
    if (activeRowKey) {
      setRows((prev) =>
        prev.map((r) =>
          r.key === activeRowKey
            ? {
                ...r,
                category_id: cat.id,
                category_name: cat.parent_name ? `${cat.parent_name} > ${cat.name}` : cat.name,
              }
            : r
        )
      );
    }
    setPickerVisible(false);
    setActiveRowKey(null);
  };

  const handleSave = async () => {
    if (!transaction || !canSave) return;
    setSaving(true);
    try {
      const splits = rows.map((r) => ({
        category_id: r.category_id,
        amount: parseFloat(r.amount),
        note: r.note || undefined,
      }));
      await api.post(`/auth/transactions/${transaction.id}/split`, { splits });
      onSplitSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save splits:', err);
      Alert.alert('Error', 'Failed to save transaction splits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSplits = async () => {
    if (!transaction) return;
    Alert.alert(
      'Remove Splits',
      'This will remove all splits and revert the transaction to a single category. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await api.delete(`/auth/transactions/${transaction.id}/split`);
              onSplitSaved();
              onClose();
            } catch (err) {
              console.error('Failed to remove splits:', err);
              Alert.alert('Error', 'Failed to remove splits.');
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  if (!transaction) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Split Transaction</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#e5e7eb" />
              </TouchableOpacity>
            </View>

            {/* Transaction info */}
            <View style={styles.txInfo}>
              <View style={styles.txInfoLeft}>
                <Ionicons name="receipt-outline" size={20} color="#a855f7" />
                <Text style={styles.txName} numberOfLines={1}>
                  {transaction.note || transaction.category_name || 'Transaction'}
                </Text>
              </View>
              <Text style={styles.txAmount}>{formatCurrency(absTotal)}</Text>
            </View>

            {loadingSplits ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.loadingText}>Loading splits...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {rows.map((row, index) => (
                  <View key={row.key} style={styles.splitRow}>
                    <View style={styles.splitRowHeader}>
                      <Text style={styles.splitLabel}>Split {index + 1}</Text>
                      {rows.length > 2 && (
                        <TouchableOpacity
                          onPress={() => removeRow(row.key)}
                          style={styles.removeRowBtn}
                        >
                          <Ionicons name="close-circle" size={20} color="#f87171" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Category selector */}
                    <TouchableOpacity
                      style={styles.categorySelector}
                      onPress={() => openCategoryPicker(row.key)}
                    >
                      <Ionicons
                        name={row.category_id ? 'pricetag' : 'pricetag-outline'}
                        size={16}
                        color={row.category_id ? '#a855f7' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.categorySelectorText,
                          !row.category_id && styles.categorySelectorPlaceholder,
                        ]}
                        numberOfLines={1}
                      >
                        {row.category_name || 'Select category'}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {/* Amount input */}
                    <View style={styles.inputRow}>
                      <Text style={styles.dollarSign}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        placeholder="0.00"
                        placeholderTextColor="#475569"
                        keyboardType="decimal-pad"
                        value={row.amount}
                        onChangeText={(val) => updateRow(row.key, 'amount', val)}
                      />
                    </View>

                    {/* Note input */}
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Note (optional)"
                      placeholderTextColor="#475569"
                      value={row.note}
                      onChangeText={(val) => updateRow(row.key, 'note', val)}
                    />
                  </View>
                ))}

                {/* Add split row button */}
                <TouchableOpacity style={styles.addRowBtn} onPress={addRow}>
                  <Ionicons name="add-circle-outline" size={20} color="#a855f7" />
                  <Text style={styles.addRowText}>Add Split</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Running total */}
            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Split Total</Text>
                <View style={styles.totalRight}>
                  <Text
                    style={[styles.totalValue, isBalanced ? styles.totalBalanced : styles.totalUnbalanced]}
                  >
                    {formatCurrency(splitSum)}
                  </Text>
                  {isBalanced ? (
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  ) : (
                    <Ionicons name="warning" size={20} color="#ef4444" />
                  )}
                </View>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Transaction Total</Text>
                <Text style={styles.totalOriginal}>{formatCurrency(absTotal)}</Text>
              </View>
              {!isBalanced && (
                <View style={styles.differenceRow}>
                  <Text style={styles.differenceLabel}>Remaining</Text>
                  <Text style={styles.differenceValue}>
                    {formatCurrency(Math.abs(absTotal - splitSum))}
                  </Text>
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!canSave}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Splits</Text>
                  </>
                )}
              </TouchableOpacity>

              {existingSplits && existingSplits.length > 0 && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={handleRemoveSplits}
                  disabled={removing}
                >
                  {removing ? (
                    <ActivityIndicator size="small" color="#f87171" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color="#f87171" />
                      <Text style={styles.removeBtnText}>Remove Splits</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Category picker modal */}
      <CategoryPicker
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setActiveRowKey(null);
        }}
        onSelect={handleCategorySelected}
        type="expense"
        userId={userId}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0f0a1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  txInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  txAmount: {
    color: '#a855f7',
    fontSize: 18,
    fontWeight: '800',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  scrollArea: {
    maxHeight: 340,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  splitRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 10,
  },
  splitRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  splitLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  removeRowBtn: {
    padding: 2,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  categorySelectorText: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  categorySelectorPlaceholder: {
    color: '#64748b',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  dollarSign: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addRowText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '700',
  },
  totalSection: {
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  totalRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalBalanced: {
    color: '#22c55e',
  },
  totalUnbalanced: {
    color: '#ef4444',
  },
  totalOriginal: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  differenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  differenceLabel: {
    color: '#eab308',
    fontSize: 13,
    fontWeight: '600',
  },
  differenceValue: {
    color: '#eab308',
    fontSize: 15,
    fontWeight: '700',
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 10,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  removeBtnText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '700',
  },
});
