import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getCurrentUser } from '@/utils/storage';
import { useTheme } from '@/utils/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/utils/apiClient';
import { getLinkedAccountStatus } from '@/utils/api';
import CurrencyPicker from '@/components/CurrencyPicker';
import { Currency, getCurrencySymbol } from '@/utils/currency';
import GradientBackground from '@/components/GradientBackground';
import { colors, spacing, radius, typography } from '@/utils/design-system';
import { SettingsRow } from '@/components/settings-tab-SettingsRow';
import { SettingsGroup } from '@/components/settings-tab-SettingsGroup';
import { ProfileCard } from '@/components/settings-tab-ProfileCard';

type Household = {
  name?: string;
  members?: { email: string; role?: string }[];
  household_id?: string;
  partner_name?: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [household, setHousehold] = useState<Household | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [sharingSummary, setSharingSummary] = useState('Configure');
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [linkedAccountErrors, setLinkedAccountErrors] = useState(0);

  // Loading / per-group error state (added for the required states)
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [householdError, setHouseholdError] = useState(false);
  const [accountsError, setAccountsError] = useState(false);

  const loadLinkedAccountStatus = useCallback(async () => {
    try {
      const accounts = await getLinkedAccountStatus();
      const errorCount = Array.isArray(accounts)
        ? accounts.filter(
            (a: any) => a.item_status === 'error' || a.item_status === 'pending_expiration'
          ).length
        : 0;
      setLinkedAccountErrors(errorCount);
      setAccountsError(false);
    } catch (e) {
      console.error('Failed to load linked account status:', e);
      setLinkedAccountErrors(0);
      setAccountsError(true);
    }
  }, []);

  const loadHousehold = useCallback(async () => {
    const user = await getCurrentUser();
    if (user) {
      setUserName(user.full_name || 'You');
      setUserEmail(user.email || '');
    }
    if (user?.id) {
      try {
        const data = await api.get(`/auth/households/me`, { user_id: user.id });
        setHousehold({
          name: data?.name,
          members: data?.members,
          household_id: data?.household_id || data?.id,
          partner_name: data?.members?.find((m: any) => m.email !== user.email)?.email,
        });
        setHouseholdError(false);
      } catch (e) {
        console.error('Failed to load household:', e);
        setHousehold(null);
        setHouseholdError(true);
      }

      // Check pending invites
      try {
        const invData = await api.get(`/auth/households/invites`, { user_id: user.id });
        setPendingInviteCount(Array.isArray(invData) ? invData.length : 0);
      } catch (e) {
        console.error('Failed to load invites:', e);
      }

      // Load linked account status
      await loadLinkedAccountStatus();
    }
  }, [loadLinkedAccountStatus]);

  const loadUserCurrency = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (userId) {
        const data = await api.get('/auth/currencies/default', { user_id: userId });
        if (data && data.currency) {
          setCurrencyCode(data.currency);
        }
      }
    } catch (e) {
      console.error('Failed to load user currency:', e);
      // Default to USD on error
      setCurrencyCode('USD');
    }
  }, []);

  const handleCurrencySelect = useCallback(async (currency: Currency) => {
    setCurrencyCode(currency.code);
    try {
      const userId = await api.getUserId();
      if (userId) {
        await api.put('/auth/currencies/default', {
          user_id: userId,
          currency: currency.code,
        });
      }
    } catch (e) {
      console.error('Failed to save currency preference:', e);
      // Revert on error
      setCurrencyCode('USD');
      Alert.alert('Error', 'Failed to save currency preference');
    }
  }, []);

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

  const loadPushPreference = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (userId) {
        const data = await api.get<{ enabled: boolean }>('/auth/push-preference', {
          user_id: userId,
        });
        setPushEnabled(data?.enabled ?? true);
      }
    } catch {
      // default to true
    }
  }, []);

  const handlePushToggle = useCallback(async (value: boolean) => {
    setPushEnabled(value);
    try {
      const userId = await api.getUserId();
      if (userId) {
        await api.put('/auth/push-preference', { user_id: userId, enabled: value });
      }
    } catch {
      setPushEnabled(!value); // revert on failure
    }
  }, []);

  // Full cold-load orchestration with a loading gate (mirrors the dashboard).
  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      loadHousehold(),
      loadSharingPrefs(),
      loadPushPreference(),
      loadUserCurrency(),
    ]);
    setLoading(false);
    setLoadedOnce(true);
  }, [loadHousehold, loadSharingPrefs, loadPushPreference, loadUserCurrency]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadSharingPrefs();
      loadHousehold();
      loadLinkedAccountStatus();
    }, [loadSharingPrefs, loadHousehold, loadLinkedAccountStatus])
  );

  const handleLogout = () => {
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

  const showSkeleton = loading && !loadedOnce;
  const hasHousehold = !!household?.household_id || !!household?.name;

  // Household empty prompt (solo user, no household set up yet).
  const householdEmpty = (
    <View style={styles.emptyPrompt}>
      <View style={styles.emptyIcon}>
        <Ionicons name="people-outline" size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>Set up your household</Text>
      <Text style={styles.emptyBody}>
        Invite your partner to share budgets, bills, and goals — or use CoupleFlow solo.
      </Text>
      <TouchableOpacity
        style={styles.emptyCta}
        activeOpacity={0.85}
        onPress={() => router.push('/household-setup')}
        accessibilityRole="button"
        accessibilityLabel="Set up household"
      >
        <Text style={styles.emptyCtaText}>Set up household</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Slim titled header (root tab — no BackButton) */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile */}
          <View style={styles.profileWrap}>
            <ProfileCard
              loading={showSkeleton}
              name={userName || 'Your Name'}
              email={userEmail}
              avatarLabel={userName?.charAt(0)?.toUpperCase() || 'A'}
              plan="Pro Plan"
            />
          </View>

          {/* Household */}
          <SettingsGroup
            label="HOUSEHOLD"
            loading={showSkeleton}
            loadingRows={3}
            error={!showSkeleton && householdError}
            errorMessage="Couldn't load your household"
            onRetry={loadHousehold}
            empty={!showSkeleton && !householdError && !hasHousehold}
            emptyContent={householdEmpty}
          >
            <SettingsRow
              icon="home-outline"
              title="Household"
              subtitle={household?.partner_name ? `with ${household.partner_name}` : undefined}
              value={household?.name || 'Set up'}
              onPress={() => router.push('/household-setup')}
            />
            <SettingsRow
              icon="mail-unread-outline"
              title="Pending Invites"
              subtitle="Household invitations for you"
              status={pendingInviteCount > 0 ? 'info' : 'default'}
              statusLabel={pendingInviteCount > 0 ? `${pendingInviteCount} new` : undefined}
              value={pendingInviteCount > 0 ? undefined : 'None'}
              onPress={() => router.push('/pending-invites')}
              showDivider
            />
            <SettingsRow
              icon="share-social-outline"
              title="Sharing Preferences"
              subtitle="Control what your partner sees"
              value={sharingSummary}
              onPress={() => router.push('/sharing-preferences')}
              showDivider
            />
          </SettingsGroup>

          {/* Accounts & Sync */}
          <SettingsGroup
            label="ACCOUNTS & SYNC"
            loading={showSkeleton}
            loadingRows={1}
            error={!showSkeleton && accountsError}
            errorMessage="Couldn't load your linked accounts"
            onRetry={loadLinkedAccountStatus}
          >
            <SettingsRow
              icon="link-outline"
              title="Linked Accounts"
              subtitle={linkedAccountErrors > 0 ? undefined : 'Bank connections & sync'}
              status={linkedAccountErrors > 0 ? 'error' : 'default'}
              statusLabel={
                linkedAccountErrors > 0
                  ? `${linkedAccountErrors} need${linkedAccountErrors !== 1 ? '' : 's'} attention`
                  : undefined
              }
              badgeCount={linkedAccountErrors > 0 ? linkedAccountErrors : undefined}
              onPress={() => router.push('/linked-accounts')}
            />
          </SettingsGroup>

          {/* Budgeting */}
          <SettingsGroup label="BUDGETING">
            <SettingsRow
              icon="pie-chart-outline"
              title="Budget Settings"
              subtitle="Categories, limits & rollovers"
              onPress={() => router.push('/settings/budget-settings')}
            />
            <SettingsRow
              icon="pricetags-outline"
              title="Categories"
              subtitle="Manage category tree & icons"
              onPress={() => router.push('/settings/categories')}
              showDivider
            />
            <SettingsRow
              icon="git-branch-outline"
              title="Category Rules"
              subtitle="Auto-categorization rules"
              onPress={() => router.push('/settings/category-rules')}
              showDivider
            />
            <SettingsRow
              icon="sparkles-outline"
              title="Advisor Memory"
              subtitle="What your AI advisor remembers"
              onPress={() => router.push('/settings/advisor-memory')}
              showDivider
            />
          </SettingsGroup>

          {/* Money & Assets */}
          <SettingsGroup label="MONEY & ASSETS">
            <SettingsRow
              icon="receipt-outline"
              title="Bills & Recurring"
              subtitle="Manage recurring payments"
              onPress={() => router.push('/bills')}
            />
            <SettingsRow
              icon="home-outline"
              title="Properties"
              subtitle="Track home values & equity"
              onPress={() => router.push('/properties')}
              showDivider
            />
          </SettingsGroup>

          {/* Preferences */}
          <SettingsGroup label="PREFERENCES">
            <SettingsRow
              icon="globe-outline"
              title="Default Currency"
              subtitle="Used for new transactions"
              value={`${getCurrencySymbol(currencyCode)} ${currencyCode}`}
              onPress={() => setCurrencyPickerVisible(true)}
            />
            <SettingsRow
              icon="notifications-outline"
              title="Push Notifications"
              subtitle="Budget alerts & reminders"
              accessory="switch"
              switchValue={pushEnabled}
              onSwitchChange={handlePushToggle}
              showDivider
            />
            <SettingsRow
              icon="mail-outline"
              title="Email Summaries"
              subtitle="Weekly reports & alerts"
              onPress={() =>
                Alert.alert(
                  'Coming soon',
                  'Email preferences will be available in a future update.'
                )
              }
              showDivider
            />
            <SettingsRow
              icon="color-palette-outline"
              title="Theme"
              value={theme === 'dark' ? 'Dark' : 'Light'}
              onPress={toggleTheme}
              showDivider
            />
          </SettingsGroup>

          {/* Security */}
          <SettingsGroup label="SECURITY">
            <SettingsRow
              icon="lock-closed-outline"
              title="App Lock"
              subtitle="Face ID / Passcode"
              accessory="switch"
              switchValue={appLockEnabled}
              onSwitchChange={setAppLockEnabled}
            />
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              accessibilityHint="Ends your session"
            >
              <Ionicons name="log-out-outline" size={16} color={colors.error} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </SettingsGroup>

          <Text style={styles.version}>CoupleFlow v1.0.0</Text>
        </ScrollView>

        <CurrencyPicker
          visible={currencyPickerVisible}
          onClose={() => setCurrencyPickerVisible(false)}
          onSelect={handleCurrencySelect}
          selectedCode={currencyCode}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  profileWrap: {
    marginBottom: spacing.lg,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: `${colors.error}1a`,
    borderWidth: 1,
    borderColor: `${colors.error}26`,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  logoutText: {
    ...typography.smallBold,
    color: colors.error,
  },
  version: {
    ...typography.caption,
    color: colors.textDark,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  /* Household empty prompt */
  emptyPrompt: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  emptyCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyCtaText: {
    ...typography.smallBold,
    color: colors.text,
  },
});
