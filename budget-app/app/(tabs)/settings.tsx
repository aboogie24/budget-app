import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, useFocusEffect } from 'expo-router';
import { getCurrentUser } from '@/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Household = {
  name?: string;
  members?: { email: string; role?: string }[];
  household_id?: string;
  partner_name?: string;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const Row = ({
  icon,
  title,
  subtitle,
  value,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  accent?: string;
}) => (
  <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.row} activeOpacity={0.7}>
    <View style={styles.rowLeft}>
      <View style={[styles.rowIcon, accent ? { backgroundColor: `${accent}18` } : null]}>
        <Ionicons name={icon} size={18} color={accent || '#c084fc'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
    </View>
    <View style={styles.rowRight}>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={14} color="#64748b" /> : null}
    </View>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [sharingSummary, setSharingSummary] = useState('Configure');
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  const loadHousehold = useCallback(async () => {
    const user = await getCurrentUser();
    if (user) {
      setUserName(user.full_name || 'You');
      setUserEmail(user.email || '');
    }
    if (user?.id) {
      const headers: any = {
        'Content-Type': 'application/json',
        ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
      };
      const res = await fetch(`${API_URL}/auth/households/me?user_id=${user.id}`, {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setHousehold({
          name: data?.name,
          members: data?.members,
          household_id: data?.household_id || data?.id,
          partner_name: data?.members?.find((m: any) => m.email !== user.email)?.email,
        });
      } else {
        setHousehold(null);
      }

      // Check pending invites
      try {
        const invRes = await fetch(`${API_URL}/auth/households/invites?user_id=${user.id}`, {
          credentials: 'include',
          headers,
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          setPendingInviteCount(Array.isArray(invData) ? invData.length : 0);
        }
      } catch (_) {}
    }
  }, [API_URL]);

  const loadSharingPrefs = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('coupleflowSharingPrefs');
      if (stored) {
        const parsed = JSON.parse(stored);
        const values = [
          parsed.shareBudgets,
          parsed.shareTransactions,
          parsed.shareDebts,
          parsed.shareSavings,
          parsed.sharePriorities,
          parsed.shareNotes,
        ];
        const allOn = values.every((v: boolean) => v === true);
        setSharingSummary(allOn ? 'All on' : 'Custom');
      } else {
        setSharingSummary('All on');
      }
    } catch {
      setSharingSummary('Configure');
    }
  }, []);

  useEffect(() => {
    loadHousehold();
    loadSharingPrefs();
  }, [loadHousehold, loadSharingPrefs]);

  useFocusEffect(
    useCallback(() => {
      loadSharingPrefs();
      loadHousehold();
    }, [loadSharingPrefs, loadHousehold])
  );

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('budgetAppSession');
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIcon}>
                <Ionicons name="settings" size={18} color="#c084fc" />
              </View>
              <Text style={styles.headerText}>Settings</Text>
            </View>
          </View>

          {/* Profile */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName?.charAt(0)?.toUpperCase() || 'A'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName || 'Your Name'}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Pro Plan</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Ionicons name="create-outline" size={16} color="#c084fc" />
            </TouchableOpacity>
          </View>

          {/* Household */}
          <View style={styles.card}>
            <SectionLabel>HOUSEHOLD</SectionLabel>
            <Row
              icon="home-outline"
              title="Household"
              subtitle={household?.partner_name ? `with ${household.partner_name}` : undefined}
              value={household?.name || 'Set up'}
              onPress={() => router.push('/household-setup')}
            />
            <Row
              icon="mail-unread-outline"
              title="Pending Invites"
              subtitle="Household invitations for you"
              value={pendingInviteCount > 0 ? `${pendingInviteCount} new` : 'None'}
              accent={pendingInviteCount > 0 ? '#60a5fa' : undefined}
              onPress={() => router.push('/pending-invites')}
            />
            <Row
              icon="share-social-outline"
              title="Sharing Preferences"
              subtitle="Control what your partner sees"
              value={sharingSummary}
              onPress={() => router.push('/sharing-preferences')}
            />
          </View>

          {/* Financial */}
          <View style={styles.card}>
            <SectionLabel>FINANCIAL</SectionLabel>
            <Row
              icon="link-outline"
              title="Linked Accounts"
              subtitle="Bank connections & sync"
              value="Manage"
              onPress={() => router.push('/link-account')}
            />
            <Row
              icon="pie-chart-outline"
              title="Budget Settings"
              subtitle="Categories, limits & rollovers"
              onPress={() => router.push('/settings/budget-settings')}
            />
            <Row
              icon="receipt-outline"
              title="Bills & Recurring"
              subtitle="Manage recurring payments"
              onPress={() => router.push('/bills')}
            />
          </View>

          {/* Preferences */}
          <View style={styles.card}>
            <SectionLabel>PREFERENCES</SectionLabel>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Ionicons name="notifications-outline" size={18} color="#c084fc" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Push Notifications</Text>
                  <Text style={styles.rowSub}>Budget alerts & reminders</Text>
                </View>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                thumbColor="#fff"
                trackColor={{ true: '#a855f7', false: 'rgba(255,255,255,0.15)' }}
              />
            </View>
            <Row
              icon="mail-outline"
              title="Email Summaries"
              subtitle="Weekly reports & alerts"
              onPress={() => Alert.alert('Coming soon', 'Email preferences will be available in a future update.')}
            />
            <Row
              icon="color-palette-outline"
              title="Theme"
              value="Dark"
              onPress={() => router.push('/theme-select')}
            />
          </View>

          {/* Security */}
          <View style={styles.card}>
            <SectionLabel>SECURITY</SectionLabel>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color="#c084fc" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>App Lock</Text>
                  <Text style={styles.rowSub}>Face ID / Passcode</Text>
                </View>
              </View>
              <Switch
                value={appLockEnabled}
                onValueChange={setAppLockEnabled}
                thumbColor="#fff"
                trackColor={{ true: '#a855f7', false: 'rgba(255,255,255,0.15)' }}
              />
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={16} color="#f87171" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>CoupleFlow v1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 14 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerIcon: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  headerText: { fontSize: 22, fontWeight: '800', color: '#f8fafc' },

  /* Profile */
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  profileEmail: { color: '#94a3b8', marginTop: 2, fontSize: 13 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  badgeText: { color: '#c084fc', fontWeight: '700', fontSize: 11 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  /* Cards */
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    paddingVertical: 11,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(192,132,252,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontWeight: '700', color: '#f8fafc', fontSize: 15 },
  rowSub: { color: '#64748b', fontSize: 12, marginTop: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: 'rgba(248,113,113,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.15)',
  },
  logoutText: { color: '#f87171', fontWeight: '700' },

  version: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
