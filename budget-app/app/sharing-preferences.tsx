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
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color="#c084fc" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      thumbColor="#fff"
      trackColor={{ true: '#a855f7', false: 'rgba(255,255,255,0.15)' }}
    />
  </View>
);

export default function SharingPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<SharingPrefs>(defaultPrefs);
  const [householdId, setHouseholdId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const allOn = Object.entries(prefs).every(([, v]) => v === true);

  const toggleAll = (on: boolean) => {
    setPrefs({
      shareBudgets: on,
      shareTransactions: on,
      shareDebts: on,
      shareSavings: on,
      sharePriorities: on,
      shareNotes: on,
      notifyPartner: on,
    });
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/settings')}>
            <Ionicons name="arrow-back" size={20} color="#c084fc" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Sharing Preferences</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Quick toggle */}
        <View style={styles.quickToggle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickLabel}>{allOn ? 'Sharing everything' : 'Custom sharing'}</Text>
            <Text style={styles.quickSub}>Toggle all at once</Text>
          </View>
          <TouchableOpacity
            style={[styles.quickBtn, allOn && styles.quickBtnActive]}
            onPress={() => toggleAll(!allOn)}
          >
            <Text style={[styles.quickBtnText, allOn && styles.quickBtnTextActive]}>
              {allOn ? 'All On' : 'Turn All On'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* What to share */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>WHAT TO SHARE</Text>
          <ToggleRow
            icon="wallet-outline"
            title="Budgets"
            subtitle="Allow partner to view shared budgets"
            value={prefs.shareBudgets}
            onChange={(v) => setPrefs((p) => ({ ...p, shareBudgets: v }))}
          />
          <ToggleRow
            icon="swap-horizontal-outline"
            title="Transactions"
            subtitle="Show spending & income activity"
            value={prefs.shareTransactions}
            onChange={(v) => setPrefs((p) => ({ ...p, shareTransactions: v }))}
          />
          <ToggleRow
            icon="card-outline"
            title="Debts"
            subtitle="Loans, credit cards, payoff progress"
            value={prefs.shareDebts}
            onChange={(v) => setPrefs((p) => ({ ...p, shareDebts: v }))}
          />
          <ToggleRow
            icon="trending-up-outline"
            title="Savings"
            subtitle="Goals, balances, contributions"
            value={prefs.shareSavings}
            onChange={(v) => setPrefs((p) => ({ ...p, shareSavings: v }))}
          />
          <ToggleRow
            icon="flag-outline"
            title="Priorities"
            subtitle="Roadmap items and rankings"
            value={prefs.sharePriorities}
            onChange={(v) => setPrefs((p) => ({ ...p, sharePriorities: v }))}
          />
          <ToggleRow
            icon="pricetag-outline"
            title="Notes & Categories"
            subtitle="Include labels and notes with shared items"
            value={prefs.shareNotes}
            onChange={(v) => setPrefs((p) => ({ ...p, shareNotes: v }))}
          />
        </View>

        {/* Activity */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ACTIVITY</Text>
          <ToggleRow
            icon="notifications-outline"
            title="Notify Partner"
            subtitle="When I update budgets, debts, savings, or priorities"
            value={prefs.notifyPartner}
            onChange={(v) => setPrefs((p) => ({ ...p, notifyPartner: v }))}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={savePrefs} disabled={saving}>
          <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.saveBtnInner}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Preferences'}</Text>
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
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerText: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },

  /* Quick toggle */
  quickToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quickLabel: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  quickSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  quickBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderColor: 'rgba(168,85,247,0.3)',
  },
  quickBtnText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  quickBtnTextActive: { color: '#c084fc' },

  /* Cards */
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
  },

  /* Rows */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(192,132,252,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontWeight: '700', color: '#f8fafc', fontSize: 15 },
  rowSubtitle: { color: '#64748b', fontSize: 12, marginTop: 1 },

  /* Save */
  saveBtn: { marginTop: 8, marginHorizontal: 16 },
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
