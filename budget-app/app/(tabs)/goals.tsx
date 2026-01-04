import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import { SafeAreaView } from 'react-native-safe-area-context';

type Debt = { id: string; name: string; balance: number };
type Saving = { id: string; name: string; current_amount: number; target_amount: number };
type Priority = { id: string; title: string; rank: number };

export default function GoalsScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [showActions, setShowActions] = useState(false);

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user?.id) return;
      const headers = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;
      const [debtsRes, savingsRes, prioritiesRes] = await Promise.all([
        fetch(`${API_URL}/auth/debts?user_id=${user.id}`, { credentials: 'include', headers }),
        fetch(`${API_URL}/auth/savings-goals?user_id=${user.id}`, { credentials: 'include', headers }),
        fetch(`${API_URL}/auth/priorities?user_id=${user.id}`, { credentials: 'include', headers }),
      ]);
      if (debtsRes.ok) setDebts((await debtsRes.json()) || []);
      if (savingsRes.ok) setSavings((await savingsRes.json()) || []);
      if (prioritiesRes.ok) setPriorities((await prioritiesRes.json()) || []);
    };
    load();
  }, []);

  const debtTotal = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const savingsCurrent = savings.reduce((sum, s) => sum + (s.current_amount || 0), 0);
  const savingsTarget = savings.reduce((sum, s) => sum + (s.target_amount || 0), 0);

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="albums" size={16} color="#c084fc" />
              </View>
              <Text style={styles.logoText}>Goals</Text>
            </View>
            <TouchableOpacity onPress={() => setShowActions(true)}>
              <Ionicons name="add-circle" size={24} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Debts</Text>
          <Text style={styles.subText}>{debts.length} accounts • Total {formatCurrency(debtTotal)}</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            {debts.slice(0, 3).map((d) => (
              <View key={d.id} style={styles.listRow}>
                <Text style={styles.listTitle}>{d.name}</Text>
                <Text style={styles.listAmount}>{formatCurrency(d.balance || 0)}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => router.push('/debts')} style={styles.linkRow}>
              <Text style={styles.linkText}>Open debts</Text>
              <Ionicons name="arrow-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Savings</Text>
          <Text style={styles.subText}>
            {savings.length} goals • {formatCurrency(savingsCurrent)} / {formatCurrency(savingsTarget)}
          </Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            {savings.slice(0, 3).map((s) => (
              <View key={s.id} style={styles.listRow}>
                <Text style={styles.listTitle}>{s.name}</Text>
                <Text style={styles.listAmount}>{formatCurrency(s.current_amount || 0)}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => router.push('/savings')} style={styles.linkRow}>
              <Text style={styles.linkText}>Open savings</Text>
              <Ionicons name="arrow-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Priorities</Text>
          <Text style={styles.subText}>{priorities.length} items</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            {priorities
              .sort((a, b) => (a.rank || 99) - (b.rank || 99))
              .slice(0, 3)
              .map((p) => (
                <View key={p.id} style={styles.listRow}>
                  <Text style={styles.listTitle}>{p.title}</Text>
                  <Text style={styles.listAmount}>#{p.rank || '-'}</Text>
                </View>
              ))}
            <TouchableOpacity onPress={() => router.push('/priorities')} style={styles.linkRow}>
              <Text style={styles.linkText}>Open priorities</Text>
              <Ionicons name="arrow-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setShowActions(true)}>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>

        <Modal visible={showActions} transparent animationType="fade">
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowActions(false)}>
            <View style={styles.actionSheet}>
              <Text style={styles.sectionLabel}>Add new</Text>
              {[
                { label: 'Debt', route: '/debts' },
                { label: 'Saving Goal', route: '/savings' },
                { label: 'Priority', route: '/priorities' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.actionRow}
                  onPress={() => {
                    setShowActions(false);
                    router.push(item.route);
                  }}
                >
                  <Text style={styles.listTitle}>{item.label}</Text>
                  <Ionicons name="add" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 12 },
  logoText: { color: '#e5e7eb', fontWeight: '700', fontSize: 15 },
  sectionLabel: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  subText: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
  },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  listAmount: { color: '#c084fc', fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkText: { color: '#cbd5e1', fontWeight: '700' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: 'rgba(20,20,35,0.95)',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
});
