import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';

type SharingPrefs = {
  shareBudgets: boolean;
  shareTransactions: boolean;
  shareDebts: boolean;
  shareSavings: boolean;
  sharePriorities: boolean;
  shareNotes: boolean;
  notifyPartner: boolean;
};

const PREFS_KEY = 'coupleflowSharingPrefs';

const defaultPrefs: SharingPrefs = {
  shareBudgets: true,
  shareTransactions: true,
  shareDebts: true,
  shareSavings: true,
  sharePriorities: true,
  shareNotes: true,
  notifyPartner: true,
};

const ToggleRow = ({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      thumbColor="#fff"
      trackColor={{ true: '#a855f7', false: '#cbd5e1' }}
    />
  </View>
);

export default function SharingPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<SharingPrefs>(defaultPrefs);
  const [householdId, setHouseholdId] = useState<string | undefined>(undefined);
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  useEffect(() => {
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user?.id) return;
        // load household id
        try {
          const res = await fetch(`${API_URL}/households/me?user_id=${user.id}`, {
            headers: user.token ? { Authorization: `Bearer ${user.token}` } : undefined,
            credentials: 'include',
          });
          if (res.ok) {
            const hh = await res.json();
            if (hh?.household_id) setHouseholdId(hh.household_id);
          }
        } catch (_) {}

        // fetch server prefs
        const qp = new URLSearchParams({ user_id: user.id });
        if (householdId) qp.set('household_id', householdId);
        const serverRes = await fetch(`${API_URL}/auth/sharing-preferences?${qp.toString()}`, {
          headers: user.token ? { Authorization: `Bearer ${user.token}` } : undefined,
          credentials: 'include',
        });
        if (serverRes.ok) {
          const serverPrefs = await serverRes.json();
          const mapped: SharingPrefs = {
            shareBudgets: serverPrefs.share_budgets ?? true,
            shareTransactions: serverPrefs.share_transactions ?? true,
            shareDebts: serverPrefs.share_debts ?? true,
            shareSavings: serverPrefs.share_savings ?? true,
            sharePriorities: serverPrefs.share_priorities ?? true,
            shareNotes: serverPrefs.share_notes ?? true,
            notifyPartner: serverPrefs.notify_partner ?? true,
          };
          setPrefs(mapped);
          await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(mapped));
          return;
        }

        // fallback to local storage if server missing
        const stored = await AsyncStorage.getItem(PREFS_KEY);
        if (stored) setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
      } catch (e) {
        // ignore, keep defaults
      }
    };
    load();
  }, [householdId]);

  const savePrefs = async () => {
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        Alert.alert('Session error', 'Please log in again.');
        return;
      }

      const payload: any = {
        user_id: user.id,
        household_id: householdId,
        share_budgets: prefs.shareBudgets,
        share_transactions: prefs.shareTransactions,
        share_debts: prefs.shareDebts,
        share_savings: prefs.shareSavings,
        share_priorities: prefs.sharePriorities,
        share_notes: prefs.shareNotes,
        notify_partner: prefs.notifyPartner,
      };

      const res = await fetch(`${API_URL}/auth/sharing-preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      Alert.alert('Saved', 'Sharing preferences updated.');
      router.replace('/(tabs)/settings');
    } catch (e) {
      Alert.alert('Error', 'Could not save preferences.');
    }
  };

  return (
    <LinearGradient colors={['#f6f3ff', '#f8f5ff']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Sharing Preferences</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>What to share</Text>
          <ToggleRow
            title="Budgets"
            subtitle="Allow partner to view shared budgets"
            value={prefs.shareBudgets}
            onChange={(v) => setPrefs((p) => ({ ...p, shareBudgets: v }))}
          />
          <ToggleRow
            title="Transactions"
            subtitle="Show spending & income activity"
            value={prefs.shareTransactions}
            onChange={(v) => setPrefs((p) => ({ ...p, shareTransactions: v }))}
          />
          <ToggleRow
            title="Debts"
            subtitle="Loans, credit cards, payoff progress"
            value={prefs.shareDebts}
            onChange={(v) => setPrefs((p) => ({ ...p, shareDebts: v }))}
          />
          <ToggleRow
            title="Savings"
            subtitle="Goals, balances, contributions"
            value={prefs.shareSavings}
            onChange={(v) => setPrefs((p) => ({ ...p, shareSavings: v }))}
          />
          <ToggleRow
            title="Priorities"
            subtitle="Roadmap items and rankings"
            value={prefs.sharePriorities}
            onChange={(v) => setPrefs((p) => ({ ...p, sharePriorities: v }))}
          />
          <ToggleRow
            title="Notes & categories"
            subtitle="Include labels and notes with shared items"
            value={prefs.shareNotes}
            onChange={(v) => setPrefs((p) => ({ ...p, shareNotes: v }))}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <ToggleRow
            title="Notify partner when I update things"
            subtitle="Edits to budgets, debts, savings, or priorities"
            value={prefs.notifyPartner}
            onChange={(v) => setPrefs((p) => ({ ...p, notifyPartner: v }))}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={savePrefs}>
          <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.saveBtnInner}>
            <Text style={styles.saveText}>Save preferences</Text>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerText: { fontSize: 18, fontWeight: '800', color: '#111827' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    gap: 10,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowTitle: { fontWeight: '700', color: '#111827', fontSize: 15 },
  rowSubtitle: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  saveBtn: { marginTop: 24, marginHorizontal: 16 },
  saveBtnInner: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
