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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';

type SavingsGoal = {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  priority: number;
  is_shared: boolean;
};

export default function SavingsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progressAmount, setProgressAmount] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('');

  const loadGoals = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<SavingsGoal[]>('/auth/savings-goals', { user_id: userId });
      setGoals(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load savings goals:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const resetForm = () => {
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setPriority('');
    setEditing(null);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditing(g);
    setName(g.name);
    setTargetAmount(String(g.target_amount));
    setCurrentAmount(String(g.current_amount));
    setTargetDate(g.target_date || '');
    setPriority(g.priority ? String(g.priority) : '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!targetAmount || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
      Alert.alert('Validation', 'Enter a valid target amount.');
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
      target_amount: parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount) || 0,
      target_date: targetDate.trim(),
      priority: parseInt(priority) || 0,
      is_shared: false,
    };

    try {
      if (editing) {
        await api.put(`/auth/savings-goals/${editing.id}`, payload);
      } else {
        await api.post('/auth/savings-goals', payload);
      }
      setShowForm(false);
      resetForm();
      loadGoals();
    } catch (e) {
      console.error('Save savings goal error:', e);
      Alert.alert('Error', 'Failed to save savings goal.');
    }
  };

  const handleUpdateProgress = async () => {
    if (!progressAmount || isNaN(Number(progressAmount))) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    try {
      await api.patch(`/auth/savings-goals/${progressId}/progress`, {
        current_amount: parseFloat(progressAmount),
      });
      setProgressId(null);
      setProgressAmount('');
      loadGoals();
    } catch (e) {
      console.error('Update progress error:', e);
      Alert.alert('Error', 'Failed to update progress.');
    }
  };

  const totalCurrent = goals.reduce((s, g) => s + (g.current_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.target_amount || 0), 0);
  const overallPercent = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;
  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const getPercent = (g: SavingsGoal) =>
    g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0;

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Savings Goals</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Ionicons name="add-circle" size={28} color="#c084fc" />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Overall Progress</Text>
            <Text style={styles.summaryValue}>
              {fmt(totalCurrent)} / {fmt(totalTarget)}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${overallPercent}%` }]} />
            </View>
            <Text style={styles.percentText}>{overallPercent.toFixed(0)}% saved</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : goals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No savings goals yet</Text>
              <Text style={styles.emptySubtext}>Tap + to set your first goal</Text>
            </View>
          ) : (
            goals.map((g) => {
              const pct = getPercent(g);
              return (
                <TouchableOpacity key={g.id} style={styles.card} onPress={() => openEdit(g)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{g.name}</Text>
                    <Text style={styles.cardAmount}>{fmt(g.current_amount)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.detailText}>
                      {pct.toFixed(0)}% of {fmt(g.target_amount)}
                    </Text>
                    {g.target_date ? (
                      <Text style={styles.detailText}>by {g.target_date}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.updateBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setProgressId(g.id);
                      setProgressAmount(String(g.current_amount));
                    }}
                  >
                    <Ionicons name="trending-up" size={14} color="#34d399" />
                    <Text style={styles.updateBtnText}>Update Progress</Text>
                  </TouchableOpacity>
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
                    {editing ? 'Edit Goal' : 'New Savings Goal'}
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
                  placeholder="e.g. Emergency Fund"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.label}>Target Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />

                <Text style={styles.label}>Current Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={currentAmount}
                  onChangeText={setCurrentAmount}
                />

                <Text style={styles.label}>Target Date (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2025-12-31"
                  placeholderTextColor="#94a3b8"
                  value={targetDate}
                  onChangeText={setTargetDate}
                />

                <Text style={styles.label}>Priority (1 = highest)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={priority}
                  onChangeText={setPriority}
                />

                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                  <LinearGradient
                    colors={['#a855f7', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnInner}
                  >
                    <Text style={styles.saveBtnText}>
                      {editing ? 'Update' : 'Create Goal'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Progress Modal */}
        <Modal visible={progressId !== null} animationType="fade" transparent>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setProgressId(null)}
          >
            <View style={styles.progressSheet}>
              <Text style={styles.modalTitle}>Update Savings</Text>
              <Text style={[styles.detailText, { marginTop: 8 }]}>
                Enter the new total saved amount
              </Text>
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Current amount saved"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={progressAmount}
                onChangeText={setProgressAmount}
              />
              <TouchableOpacity onPress={handleUpdateProgress} style={styles.saveBtn}>
                <LinearGradient
                  colors={['#34d399', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnInner}
                >
                  <Text style={styles.saveBtnText}>Save Progress</Text>
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
  summaryLabel: { color: '#cbd5e1', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 4 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 4,
  },
  percentText: { color: '#34d399', fontSize: 12, fontWeight: '700', marginTop: 6 },
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
  cardAmount: { color: '#34d399', fontWeight: '800', fontSize: 16 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  detailText: { color: '#94a3b8', fontSize: 12 },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 10,
  },
  updateBtnText: { color: '#34d399', fontWeight: '700', fontSize: 13 },
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
  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20, marginBottom: 20 },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  progressSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
});
