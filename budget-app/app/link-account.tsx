import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { getCurrentUser } from '@/utils/storage';
import { fetchLinkedAccounts, deleteLinkedAccount, syncPlaidTransactions, syncPlaidInvestments, syncPlaidLiabilities, syncPlaidBalances } from '@/utils/api';

/* Try to load native Plaid SDK — will be undefined in Expo Go */
let PlaidLink: any = null;
try {
  PlaidLink = require('react-native-plaid-link-sdk');
} catch {
  /* native module not available */
}

const APP_SCHEME = 'budgetapp';

type LinkedAccount = {
  id: string;
  institution_name: string;
  item_id: string;
  created_at: string;
};

export default function LinkAccountScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    (Constants as any).manifest?.extra?.API_URL ??
    'http://localhost:8080';

  /* ── Check native SDK availability ────────────────────────── */
  const plaidModule: any = PlaidLink;
  const nativeHook =
    plaidModule?.usePlaidLink ??
    plaidModule?.default?.usePlaidLink ??
    undefined;
  const nativeAvailable = typeof nativeHook === 'function';

  /* ── Load linked accounts ───────────────────────────────────── */
  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchLinkedAccounts();
      setAccounts(data);
    } catch {
      // ignore — user may not have any
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  /* ── Fetch link token ─────────────────────────────────────── */
  const fetchLinkToken = async () => {
    const user = await getCurrentUser();
    if (!user?.id) {
      Alert.alert('Session missing', 'Please log in again.');
      router.replace('/login');
      return;
    }
    setUserId(user.id);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/link_token?user_id=${user.id}`, {
        credentials: 'include',
        headers: user.token
          ? { Authorization: `Bearer ${user.token}` }
          : undefined,
      } as any);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Link token failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      setLinkToken(data.link_token);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    fetchLinkToken();
  }, []);

  /* ── Exchange public token with backend ───────────────────── */
  const exchangeToken = async (
    publicToken: string,
    institutionName?: string,
  ) => {
    try {
      const res = await fetch(`${API_URL}/exchange_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          user_id: userId,
          institution_name: institutionName ?? '',
        }),
      });
      if (!res.ok) throw new Error(`Exchange failed: ${res.status}`);

      // Sync transactions, investments, and liabilities from the newly linked account
      try {
        const [txSync, invSync, liabSync, balSync] = await Promise.allSettled([
          syncPlaidTransactions(),
          syncPlaidInvestments(),
          syncPlaidLiabilities(),
          syncPlaidBalances(),
        ]);
        const txCount = txSync.status === 'fulfilled' ? (txSync.value as any)?.synced ?? 0 : 0;
        const invCount = invSync.status === 'fulfilled' ? (invSync.value as any)?.synced ?? 0 : 0;
        const liabCount = liabSync.status === 'fulfilled' ? (liabSync.value as any)?.synced ?? 0 : 0;
        const balCount = balSync.status === 'fulfilled' ? (balSync.value as any)?.synced ?? 0 : 0;
        const parts: string[] = [];
        if (txCount > 0) parts.push(`${txCount} transaction${txCount !== 1 ? 's' : ''}`);
        if (invCount > 0) parts.push(`${invCount} holding${invCount !== 1 ? 's' : ''}`);
        if (liabCount > 0) parts.push(`${liabCount} liabilit${liabCount !== 1 ? 'ies' : 'y'}`);
        if (balCount > 0) parts.push(`${balCount} account balance${balCount !== 1 ? 's' : ''}`);
        const summary = parts.length > 0 ? parts.join(', ') + ' synced.' : 'Data will sync shortly.';
        Alert.alert('Linked!', `Account linked successfully. ${summary}`);
      } catch {
        Alert.alert('Linked!', 'Account linked. Data will sync shortly.');
      }
      // Refresh the accounts list
      loadAccounts();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not complete account linking.');
    }
  };

  /* ── Open Plaid Link via system browser ─────────────────────── */
  const openPlaidBrowser = async () => {
    if (!linkToken) return;
    setLinking(true);
    try {
      const url = `${API_URL}/plaid/link-page?token=${encodeURIComponent(linkToken)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, `${APP_SCHEME}://`);

      if (result.type === 'success' && result.url) {
        const safe = result.url.replace(`${APP_SCHEME}://`, 'https://app/');
        const parsed = new URL(safe);
        const path = parsed.hostname === 'app' ? parsed.pathname.replace('/', '') : parsed.hostname;

        if (path === 'plaid-success') {
          const publicToken = parsed.searchParams.get('public_token');
          const institution = parsed.searchParams.get('institution_name');
          if (publicToken) {
            await exchangeToken(publicToken, institution ?? undefined);
          } else {
            Alert.alert('Error', 'No public token received from Plaid.');
          }
        }
      }
    } catch (e: any) {
      console.error('Plaid browser error:', e);
      Alert.alert('Error', 'Failed to open Plaid Link: ' + e.message);
    } finally {
      setLinking(false);
      fetchLinkToken();
    }
  };

  /* ── Unlink an account ──────────────────────────────────────── */
  const handleUnlink = (acct: LinkedAccount) => {
    Alert.alert(
      'Unlink Account',
      `Remove ${acct.institution_name || 'this account'}? This won't delete synced transactions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLinkedAccount(acct.id);
              setAccounts((prev) => prev.filter((a) => a.id !== acct.id));
            } catch {
              Alert.alert('Error', 'Could not unlink account.');
            }
          },
        },
      ],
    );
  };

  /* ── Sync all data ──────────────────────────────────────────── */
  const handleSync = async () => {
    setSyncing(true);
    try {
      const [txSync, invSync, liabSync, balSync] = await Promise.allSettled([
        syncPlaidTransactions(),
        syncPlaidInvestments(),
        syncPlaidLiabilities(),
        syncPlaidBalances(),
      ]);
      const txCount = txSync.status === 'fulfilled' ? (txSync.value as any)?.synced ?? 0 : 0;
      const invCount = invSync.status === 'fulfilled' ? (invSync.value as any)?.synced ?? 0 : 0;
      const liabCount = liabSync.status === 'fulfilled' ? (liabSync.value as any)?.synced ?? 0 : 0;
      const balCount = balSync.status === 'fulfilled' ? (balSync.value as any)?.synced ?? 0 : 0;
      const parts: string[] = [];
      if (txCount > 0) parts.push(`${txCount} transaction${txCount !== 1 ? 's' : ''}`);
      if (invCount > 0) parts.push(`${invCount} holding${invCount !== 1 ? 's' : ''}`);
      if (liabCount > 0) parts.push(`${liabCount} liabilit${liabCount !== 1 ? 'ies' : 'y'}`);
      if (balCount > 0) parts.push(`${balCount} account balance${balCount !== 1 ? 's' : ''}`);
      Alert.alert('Sync Complete', parts.length > 0 ? parts.join(', ') + ' synced.' : 'Everything is up to date.');
    } catch {
      Alert.alert('Error', 'Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  /* ── Render: loading state ──────────────────────────────────── */
  if (loadingAccounts) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/settings')}>
            <Ionicons name="arrow-back" size={22} color="#c084fc" />
          </TouchableOpacity>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#c084fc" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ── Render: native SDK path (no linked accounts yet) ───────── */
  if (nativeAvailable && linkToken && accounts.length === 0) {
    return <NativePlaidFlow linkToken={linkToken} exchangeToken={exchangeToken} />;
  }

  /* ── Render: accounts list + add button ─────────────────────── */
  return (
    <LinearGradient
      colors={['#0b1021', '#2b0f50', '#1b1039']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/settings')}>
          <Ionicons name="arrow-back" size={22} color="#c084fc" />
        </TouchableOpacity>

        <View style={styles.centerContent}>
          <View style={styles.heroWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="link-outline" size={40} color="#c084fc" />
            </View>
            <Text style={styles.title}>
              {accounts.length > 0 ? 'Linked Accounts' : 'Link your bank'}
            </Text>
            <Text style={styles.subtitle}>
              {accounts.length > 0
                ? 'Manage your connected bank accounts.'
                : 'Securely connect your account to automatically sync transactions.'}
            </Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* ── Linked accounts list ── */}
          {accounts.length > 0 && (
            <FlatList
              data={accounts}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <View style={styles.accountCard}>
                  <View style={styles.accountIcon}>
                    <Ionicons name="business-outline" size={22} color="#c084fc" />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>
                      {item.institution_name || 'Bank Account'}
                    </Text>
                    <Text style={styles.accountMeta}>
                      Linked {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unlinkBtn}
                    onPress={() => handleUnlink(item)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#f87171" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          {/* ── Sync button ── */}
          {accounts.length > 0 && (
            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.buttonDisabled]}
              onPress={handleSync}
              disabled={syncing}
              activeOpacity={0.8}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#c084fc" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons name="sync-outline" size={18} color="#c084fc" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.syncButtonText}>
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Add account button ── */}
          {loading || !linkToken ? (
            <ActivityIndicator size="large" color="#c084fc" style={{ marginTop: 24 }} />
          ) : (
            <TouchableOpacity
              style={[styles.button, linking && styles.buttonDisabled]}
              onPress={openPlaidBrowser}
              disabled={linking}
              activeOpacity={0.8}
            >
              {linking ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              ) : (
                <Ionicons
                  name={accounts.length > 0 ? 'add-circle-outline' : 'shield-checkmark-outline'}
                  size={20}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.buttonText}>
                {linking
                  ? 'Opening Plaid…'
                  : accounts.length > 0
                  ? 'Link Another Account'
                  : 'Connect with Plaid'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.trustRow}>
            <Ionicons name="lock-closed-outline" size={14} color="#94a3b8" />
            <Text style={styles.trustText}>
              Bank-level encryption · Read-only access
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ── Native Plaid Link wrapper (only rendered when SDK is available) ── */
function NativePlaidFlow({
  linkToken,
  exchangeToken,
}: {
  linkToken: string;
  exchangeToken: (token: string, institution?: string) => Promise<void>;
}) {
  const router = useRouter();
  const plaidModule: any = PlaidLink;
  const usePlaidLink =
    plaidModule?.usePlaidLink ?? plaidModule?.default?.usePlaidLink;

  const { open, ready } = usePlaidLink({
    tokenConfig: { token: linkToken },
    noLoadingState: false,
    onSuccess: async (success: any) => {
      const publicToken =
        typeof success === 'string' ? success : success?.publicToken;
      if (publicToken) {
        await exchangeToken(publicToken, success?.metadata?.institution?.name);
      }
    },
    onExit: (err: any) => {
      if (err) console.log('Plaid exit', err);
    },
  });

  return (
    <LinearGradient
      colors={['#0b1021', '#2b0f50', '#1b1039']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/settings')}>
          <Ionicons name="arrow-back" size={22} color="#c084fc" />
        </TouchableOpacity>

        <View style={styles.centerContent}>
          <View style={styles.heroWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="link-outline" size={40} color="#c084fc" />
            </View>
            <Text style={styles.title}>Link your bank</Text>
            <Text style={styles.subtitle}>
              Securely connect your account to automatically sync transactions.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, !ready && styles.buttonDisabled]}
            onPress={() => open()}
            disabled={!ready}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>
              {ready ? 'Connect with Plaid' : 'Preparing…'}
            </Text>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <Ionicons name="lock-closed-outline" size={14} color="#94a3b8" />
            <Text style={styles.trustText}>
              Bank-level encryption · Read-only access
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    marginTop: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: { flex: 1, justifyContent: 'center' },
  heroWrap: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(192,132,252,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  list: {
    maxHeight: 280,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.15)',
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountInfo: { flex: 1 },
  accountName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  unlinkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(248,113,113,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  syncButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(192,132,252,0.12)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
  },
  syncButtonText: { color: '#c084fc', fontWeight: '600', fontSize: 15 },
  error: { color: '#f87171', textAlign: 'center', marginBottom: 12 },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  trustText: { color: '#94a3b8', fontSize: 12 },
});
