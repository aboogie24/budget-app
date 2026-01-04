import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, useFocusEffect } from 'expo-router';
import { getCurrentUser } from '@/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

type Household = {
  name?: string;
  members?: { email: string; role?: string }[];
  household_id?: string;
  partner_name?: string;
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const Row = ({
  icon,
  title,
  subtitle,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.row}>
    <View style={styles.rowLeft}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color="#a855f7" />
      </View>
      <View>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    <View style={styles.rowRight}>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color="#94a3b8" /> : null}
    </View>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [appLockEnabled, setAppLockEnabled] = useState<boolean>(false);
  const [sharingSummary, setSharingSummary] = useState<string>('Configure');

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
      const headers = {
        'Content-Type': 'application/json',
        ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
      };
      const res = await fetch(`${API_URL}/households/me?user_id=${user.id}`, {
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
    } catch (e) {
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
    await AsyncStorage.removeItem('budgetAppSession');
    router.replace('/login');
  };

  return (
    <LinearGradient colors={['#f6f3ff', '#f8f5ff']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIcon}>
                <Ionicons name="settings" size={18} color="#fff" />
              </View>
              <Text style={styles.headerText}>Settings</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="moon-outline" size={20} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName?.charAt(0) || 'A'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName || 'Your Name'}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Pro Plan</Text>
              </View>
            </View>
            <TouchableOpacity>
              <Ionicons name="create-outline" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionTitle>Household</SectionTitle>
            <Row
              icon="home-outline"
              title="Household Name"
              value={household?.name || 'Add'}
              onPress={() => router.push('/household-setup')}
            />
            <Row
              icon="people-outline"
              title="Partner"
              value={household?.partner_name || 'Add partner'}
              onPress={() => router.push('/household-setup')}
            />
            <Row
              icon="share-social-outline"
              title="Sharing Preferences"
              subtitle="Control what your partner sees"
              value={sharingSummary}
              onPress={() => router.push('/sharing-preferences')}
            />
          </View>

          <View style={styles.card}>
            <SectionTitle>Financial</SectionTitle>
            <Row
              icon="link-outline"
              title="Linked Accounts"
              value="Add / view"
              onPress={() => router.push('/link-account')}
            />
            <Row
              icon="pie-chart-outline"
              title="Budget Settings"
              subtitle="Categories, limits & rollovers"
              onPress={() => router.push('/settings/budget-settings')}
            />
            <Row
              icon="calendar-outline"
              title="Income & Bills"
              subtitle="Recurring transactions"
              onPress={() => router.push('/(tabs)/budget')}
            />
          </View>

          <View style={styles.card}>
            <SectionTitle>Notifications</SectionTitle>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Ionicons name="notifications-outline" size={18} color="#a855f7" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Push Notifications</Text>
                </View>
              </View>
              <Switch value={pushEnabled} onValueChange={setPushEnabled} thumbColor="#fff" trackColor={{ true: '#a855f7', false: '#cbd5e1' }} />
            </View>
            <Row
              icon="mail-outline"
              title="Email Notifications"
              subtitle="Weekly summaries & alerts"
              onPress={() =>
                Alert.alert('Coming soon', 'Email notification preferences will be configurable in a later update.')
              }
            />
          </View>

          <View style={styles.card}>
            <SectionTitle>Appearance</SectionTitle>
            <Row icon="color-palette-outline" title="Theme" value="Light" onPress={() => router.push('/theme-select')} />
            <Row
              icon="sparkles-outline"
              title="App Icon"
              value="Purple"
              onPress={() => Alert.alert('Coming soon', 'Switching app icons will be available soon.')}
            />
          </View>

          <View style={styles.card}>
            <SectionTitle>Privacy & Security</SectionTitle>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color="#a855f7" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>App Lock</Text>
                  <Text style={styles.rowSubtitle}>Face ID / Passcode</Text>
                </View>
              </View>
              <Switch value={appLockEnabled} onValueChange={setAppLockEnabled} thumbColor="#fff" trackColor={{ true: '#a855f7', false: '#cbd5e1' }} />
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    backgroundColor: '#a855f7',
    padding: 8,
    borderRadius: 12,
  },
  headerText: { fontSize: 20, fontWeight: '800', color: '#111827' },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#c084fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 24 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  profileEmail: { color: '#6b7280', marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
  },
  badgeText: { color: '#8b5cf6', fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontWeight: '700', color: '#111827', fontSize: 15 },
  rowSubtitle: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { color: '#6b7280', fontWeight: '700' },
  logoutBtn: {
    marginTop: 12,
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#dc2626', fontWeight: '700' },
});
