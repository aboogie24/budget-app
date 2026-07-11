import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { fetchLinkedAccounts, deleteLinkedAccount, syncAllBankAccounts, syncPlaidTransactions, syncPlaidInvestments, syncPlaidLiabilities, syncPlaidBalances } from '@/utils/api';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, gradients, glassEffects, spacing, radius, typography } from '@/utils/design-system';

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
  provider?: string;
  created_at: string;
  item_status?: string | null;
  error_code?: string | null;
};

type ProviderInfo = {
  name: string;
  label?: string;
  description?: string;
};

type ProviderKey = 'plaid' | 'flinks' | 'teller';
type SelectedProvider = ProviderKey | null;

/* ── Provider presentation map (colors from design-system, never hardcoded) ── */
const PROVIDER_META: Record<
  ProviderKey,
  {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    description: string;
    features: string[];
  }
> = {
  plaid: {
    label: 'Plaid',
    icon: 'shield-checkmark-outline',
    color: colors.info,
    description: '12,000+ US institutions',
    features: ['Instant verification', 'Real-time updates'],
  },
  flinks: {
    label: 'Flinks',
    icon: 'globe-outline',
    color: colors.success,
    description: '15,000+ North American institutions',
    features: ['Strong Canadian coverage', 'OAuth + scraping'],
  },
  teller: {
    label: 'Teller',
    icon: 'business-outline',
    color: colors.warning,
    description: 'US banks & credit unions',
    features: ['Fast US coverage', 'Read-only access'],
  },
};

const providerColor = (provider?: string): string =>
  provider && provider in PROVIDER_META
    ? PROVIDER_META[provider as ProviderKey].color
    : colors.info;

const providerLabel = (provider?: SelectedProvider | string): string =>
  provider && provider in PROVIDER_META
    ? PROVIDER_META[provider as ProviderKey].label
    : 'Plaid';

/* ══════════════════════════════════════════════════════════════════
   Sub-component: provider badge (inline label pill)
   ══════════════════════════════════════════════════════════════════ */
function LinkAccountProviderBadge({ provider }: { provider?: string }) {
  if (!provider) return null;
  const color = providerColor(provider);
  const label = providerLabel(provider);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1f` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-component: linked account row (shared list-row contract)
   ══════════════════════════════════════════════════════════════════ */
function LinkAccountLinkedRow({
  account,
  isLast,
  onReconnect,
  onUnlink,
}: {
  account: LinkedAccount;
  isLast: boolean;
  onReconnect: (item: LinkedAccount) => void;
  onUnlink: (item: LinkedAccount) => void;
}) {
  const needsReauth = account.item_status === 'login_required';
  const canReconnect = needsReauth && account.provider === 'teller';
  const chipColor = needsReauth ? colors.warning : colors.primary2;
  const name = account.institution_name || 'Bank Account';

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={[styles.rowChip, { backgroundColor: `${chipColor}1f` }]}>
        <Ionicons
          name={needsReauth ? 'warning-outline' : 'business-outline'}
          size={20}
          color={chipColor}
        />
      </View>

      <View style={styles.rowMiddle}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          <LinkAccountProviderBadge provider={account.provider} />
        </View>
        {needsReauth ? (
          <Text style={styles.rowSubtitleWarning} numberOfLines={1}>
            Reconnect needed — login expired
          </Text>
        ) : (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            Linked{' '}
            {account.created_at
              ? new Date(account.created_at).toLocaleDateString()
              : ''}
          </Text>
        )}
      </View>

      <View style={styles.rowTrailing}>
        {canReconnect && (
          <TouchableOpacity
            style={styles.reconnectPill}
            onPress={() => onReconnect(account)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Reconnect ${name}`}
          >
            <Ionicons name="refresh" size={14} color={colors.warning} />
            <Text style={styles.reconnectPillText}>Reconnect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.unlinkBtn}
          onPress={() => onUnlink(account)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Unlink ${name}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-component: provider radio row (the CHOOSE A PROVIDER option)
   ══════════════════════════════════════════════════════════════════ */
function LinkAccountProviderRow({
  provider,
  selected,
  disabled,
  isLast,
  onPress,
}: {
  provider: ProviderKey;
  selected: boolean;
  disabled: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const meta = PROVIDER_META[provider];
  return (
    <TouchableOpacity
      style={[
        styles.providerRow,
        !isLast && styles.rowDivider,
        selected && styles.providerRowSelected,
        disabled && styles.dimmed,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${meta.label}, ${meta.description}`}
    >
      <View style={styles.providerTopRow}>
        <View style={[styles.rowChip, { backgroundColor: `${meta.color}1f` }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.rowMiddle}>
          <Text style={styles.rowName} numberOfLines={1}>
            {meta.label}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {meta.description}
          </Text>
        </View>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? colors.primary2 : colors.textMuted}
        />
      </View>
      <View style={styles.featureRow}>
        {meta.features.slice(0, 2).map((f) => (
          <View key={f} style={styles.featureItem}>
            <Ionicons name="checkmark" size={14} color={colors.textMuted} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-component: connect CTA (primary gradient / secondary outline)
   ══════════════════════════════════════════════════════════════════ */
function LinkAccountConnectCTA({
  variant = 'primary',
  label,
  icon,
  busy = false,
  disabled = false,
  onPress,
}: {
  variant?: 'primary' | 'secondary';
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const isDisabled = disabled || busy;
  const inner = (
    <>
      {busy ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.text : colors.primary2}
          style={styles.ctaLeading}
        />
      ) : (
        <Ionicons
          name={icon}
          size={20}
          color={variant === 'primary' ? colors.text : colors.primary2}
          style={styles.ctaLeading}
        />
      )}
      <Text style={variant === 'primary' ? styles.ctaPrimaryText : styles.ctaSecondaryText}>
        {label}
      </Text>
    </>
  );

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        style={[styles.ctaBase, styles.ctaSecondary, isDisabled && styles.dimmed]}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={label}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={isDisabled ? styles.dimmed : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={[...gradients.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.ctaBase, styles.ctaPrimary]}
      >
        {inner}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-component: static intro card (the ONE floating card)
   ══════════════════════════════════════════════════════════════════ */
function LinkAccountIntroCard() {
  return (
    <View style={styles.introCard}>
      <View style={styles.introIconCircle}>
        <Ionicons name="link-outline" size={32} color={colors.primary2} />
      </View>
      <Text style={styles.introTitle}>Link your bank</Text>
      <Text style={styles.introBody}>
        Securely sync transactions across your household.
      </Text>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-component: group label (uppercase caption)
   ══════════════════════════════════════════════════════════════════ */
function LinkAccountGroupLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.groupLabel}>{children}</Text>;
}

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
  const [refreshing, setRefreshing] = useState(false);

  /* ── Provider selection state ────────────────────────────────── */
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>(null);
  const [showProviderSelection, setShowProviderSelection] = useState(false);

  /* ── Flinks state ────────────────────────────────────────────── */
  const [flinksWebViewVisible, setFlinksWebViewVisible] = useState(false);
  const [flinksConnectUrl, setFlinksConnectUrl] = useState<string | null>(null);
  const [flinksLoading, setFlinksLoading] = useState(false);

  /* ── Teller state ────────────────────────────────────────────── */
  const [tellerWebViewVisible, setTellerWebViewVisible] = useState(false);
  const [tellerConnectUrl, setTellerConnectUrl] = useState<string | null>(null);
  const [tellerLoading, setTellerLoading] = useState(false);

  /* ── Check native SDK availability ────────────────────────── */
  const plaidModule: any = PlaidLink;
  const nativeHook =
    plaidModule?.usePlaidLink ??
    plaidModule?.default?.usePlaidLink ??
    undefined;
  const nativeAvailable = typeof nativeHook === 'function';

  /* ── Fetch available providers ──────────────────────────────── */
  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const data = await api.get<ProviderInfo[]>('/auth/bank/providers');
      const list = Array.isArray(data) ? data : [];
      setProviders(list);

      // If only Plaid is available, skip provider selection
      const hasChoice = list.some((p) => p.name !== 'plaid');
      setShowProviderSelection(hasChoice);
    } catch {
      // If providers endpoint fails, fall back to Plaid-only
      setProviders([{ name: 'plaid' }]);
      setShowProviderSelection(false);
    } finally {
      setLoadingProviders(false);
    }
  };

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
      const data = await api.get(`/auth/link_token`, { user_id: user.id });
      setLinkToken((data as any).link_token);
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
    fetchProviders();
  }, []);

  /* ── Retry (inline error card) ─────────────────────────────── */
  const handleRetry = async () => {
    setError(null);
    setRefreshing(true);
    try {
      await Promise.all([fetchLinkToken(), fetchProviders(), loadAccounts()]);
    } finally {
      setRefreshing(false);
    }
  };

  /* ── Exchange public token with backend (Plaid) ──────────── */
  const exchangeToken = async (
    publicToken: string,
    institutionName?: string,
  ) => {
    try {
      const baseUrl = api.getBaseUrl();
      const res = await fetch(`${baseUrl}/auth/exchange_token`, {
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
      const baseUrl = api.getBaseUrl();
      const url = `${baseUrl}/plaid/link-page?token=${encodeURIComponent(linkToken)}`;
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

  /* ── Flinks Connect flow ────────────────────────────────────── */
  const openFlinksConnect = async () => {
    setFlinksLoading(true);
    try {
      const data = await api.post<{ authorize_token: string; connect_url: string }>(
        '/auth/flinks/authorize-token',
      );
      if (!data?.connect_url) {
        throw new Error('No connect URL received from server.');
      }
      // Append the authorize token as a query param if not already present
      let connectUrl = data.connect_url;
      if (data.authorize_token && !connectUrl.includes('authorizeToken=')) {
        const separator = connectUrl.includes('?') ? '&' : '?';
        connectUrl += `${separator}authorizeToken=${encodeURIComponent(data.authorize_token)}`;
      }
      setFlinksConnectUrl(connectUrl);
      setFlinksWebViewVisible(true);
    } catch (e: any) {
      console.error('Flinks authorize error:', e);
      Alert.alert('Error', 'Failed to start Flinks connection: ' + (e.message || String(e)));
    } finally {
      setFlinksLoading(false);
    }
  };

  /* ── Extract query param from URL ──────────────────────────── */
  const extractParam = (url: string, param: string): string | null => {
    try {
      // Handle both full URLs and deep-link URLs
      const safeUrl = url.startsWith('http') ? url : `https://app/${url}`;
      const parsed = new URL(safeUrl);
      return parsed.searchParams.get(param);
    } catch {
      // Fallback regex extraction
      const match = url.match(new RegExp(`[?&]${param}=([^&]+)`));
      return match ? decodeURIComponent(match[1]) : null;
    }
  };

  /* ── Handle Flinks WebView navigation ──────────────────────── */
  const handleFlinksNavigation = async (url: string): Promise<boolean> => {
    if (url.includes('loginId=') || url.includes('loginId%3D')) {
      const loginId = extractParam(url, 'loginId');
      const institution = extractParam(url, 'institution');

      if (loginId) {
        setFlinksWebViewVisible(false);
        setFlinksConnectUrl(null);
        setLinking(true);

        try {
          await api.post('/auth/flinks/connect', {
            login_id: loginId,
            institution: institution ?? '',
          });
          Alert.alert('Linked!', 'Bank account connected via Flinks. Data will sync shortly.');
          loadAccounts();
        } catch (e: any) {
          console.error('Flinks connect error:', e);
          Alert.alert('Error', 'Could not complete Flinks connection: ' + (e.message || String(e)));
        } finally {
          setLinking(false);
        }
        return false; // prevent WebView from loading this URL
      }
    }
    return true;
  };

  /* ── Teller Connect flow ────────────────────────────────────── */
  // enrollmentId is set when re-authenticating a disconnected enrollment —
  // Teller Connect skips the institution picker and goes straight to login.
  const openTellerConnect = (enrollmentId?: string) => {
    setTellerLoading(true);
    try {
      // The backend serves the Teller Connect widget; it posts the enrollment
      // back to this WebView via window.ReactNativeWebView.postMessage.
      const base = `${api.getBaseUrl()}/teller/connect-page`;
      setTellerConnectUrl(enrollmentId ? `${base}?enrollment_id=${encodeURIComponent(enrollmentId)}` : base);
      setTellerWebViewVisible(true);
    } catch (e: any) {
      console.error('Teller connect error:', e);
      Alert.alert('Error', 'Failed to start Teller connection: ' + (e.message || String(e)));
    } finally {
      setTellerLoading(false);
    }
  };

  /* ── Handle messages posted from the Teller Connect WebView ──── */
  const handleTellerMessage = async (raw: string) => {
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return; // ignore non-JSON messages
    }

    if (payload.event === 'exit') {
      setTellerWebViewVisible(false);
      setTellerConnectUrl(null);
      return;
    }
    if (payload.event === 'failure') {
      setTellerWebViewVisible(false);
      setTellerConnectUrl(null);
      Alert.alert('Connection failed', payload.message || 'Teller could not connect your bank.');
      return;
    }
    if (payload.event !== 'success' || !payload.access_token) {
      return;
    }

    setTellerWebViewVisible(false);
    setTellerConnectUrl(null);
    setLinking(true);
    try {
      await api.post('/auth/teller/connect', {
        access_token: payload.access_token,
        enrollment_id: payload.enrollment_id,
        user_id: payload.user_id,
        institution: payload.institution ?? '',
      });
      Alert.alert('Linked!', 'Bank account connected via Teller. Data will sync shortly.');
      loadAccounts();
    } catch (e: any) {
      console.error('Teller connect error:', e);
      Alert.alert('Error', 'Could not complete Teller connection: ' + (e.message || String(e)));
    } finally {
      setLinking(false);
    }
  };

  /* ── Handle Connect button press ───────────────────────────── */
  const handleConnectPress = () => {
    if (selectedProvider === 'plaid') {
      openPlaidBrowser();
    } else if (selectedProvider === 'flinks') {
      openFlinksConnect();
    } else if (selectedProvider === 'teller') {
      openTellerConnect();
    }
  };

  /* ── Reconnect a disconnected Teller enrollment ────────────── */
  const handleReconnect = (item: LinkedAccount) => {
    openTellerConnect(item.item_id);
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
      // Plaid still uses its dedicated sync endpoint (provider stub returns an
      // error). Teller / Flinks go through /auth/bank/sync-all, which skips
      // Plaid accounts to avoid noisy log errors.
      const [plaidTxSync, txSync, invSync, liabSync, balSync] = await Promise.allSettled([
        syncPlaidTransactions(),
        syncAllBankAccounts(),
        syncPlaidInvestments(),
        syncPlaidLiabilities(),
        syncPlaidBalances(),
      ]);
      const plaidTxTotal = plaidTxSync.status === 'fulfilled' ? (plaidTxSync.value as any)?.synced ?? 0 : 0;
      const bankTxTotal = txSync.status === 'fulfilled' ? (txSync.value as any)?.synced ?? 0 : 0;
      const txTotal = plaidTxTotal + bankTxTotal;
      const perProvider: Record<string, number> = {
        ...((txSync.status === 'fulfilled' ? (txSync.value as any)?.per_provider : {}) || {}),
      };
      if (plaidTxTotal > 0) perProvider.plaid = (perProvider.plaid || 0) + plaidTxTotal;
      const txAccounts: Array<{ provider: string; error?: string }> =
        txSync.status === 'fulfilled' ? (txSync.value as any)?.accounts ?? [] : [];
      const reauthNeeded = txAccounts.filter(
        (a) => a.error && a.error.includes('enrollment.disconnected'),
      ).length;
      const invCount = invSync.status === 'fulfilled' ? (invSync.value as any)?.synced ?? 0 : 0;
      const liabCount = liabSync.status === 'fulfilled' ? (liabSync.value as any)?.synced ?? 0 : 0;
      const balCount = balSync.status === 'fulfilled' ? (balSync.value as any)?.synced ?? 0 : 0;

      const parts: string[] = [];
      if (txTotal > 0) {
        const breakdown = Object.entries(perProvider)
          .filter(([, n]) => n > 0)
          .map(([p, n]) => `${n} ${p.charAt(0).toUpperCase() + p.slice(1)}`)
          .join(', ');
        parts.push(
          `${txTotal} transaction${txTotal !== 1 ? 's' : ''}${breakdown ? ` (${breakdown})` : ''}`,
        );
      }
      if (invCount > 0) parts.push(`${invCount} holding${invCount !== 1 ? 's' : ''}`);
      if (liabCount > 0) parts.push(`${liabCount} liabilit${liabCount !== 1 ? 'ies' : 'y'}`);
      if (balCount > 0) parts.push(`${balCount} account balance${balCount !== 1 ? 's' : ''}`);

      const summary = parts.length > 0 ? parts.join(', ') + ' synced.' : 'Everything is up to date.';
      const reauthLine = reauthNeeded > 0
        ? `\n\n${reauthNeeded} account${reauthNeeded !== 1 ? 's' : ''} need${reauthNeeded === 1 ? 's' : ''} to be reconnected — tap Reconnect below.`
        : '';
      Alert.alert('Sync Complete', summary + reauthLine);
    } catch {
      Alert.alert('Error', 'Sync failed. Please try again.');
    } finally {
      setSyncing(false);
      // Refetch so item_status changes (e.g. login_required) show immediately.
      loadAccounts();
    }
  };

  /* ── Derived: reauth accounts + availability gating ────────── */
  const reauthAccounts = accounts.filter((a) => a.item_status === 'login_required');
  const isFlinksAvailable = providers.some((p) => p.name === 'flinks');
  const isTellerAvailable = providers.some((p) => p.name === 'teller');
  const busy = linking || flinksLoading || tellerLoading;

  const availableProviderKeys: ProviderKey[] = [
    'plaid',
    ...(isFlinksAvailable ? (['flinks'] as ProviderKey[]) : []),
    ...(isTellerAvailable ? (['teller'] as ProviderKey[]) : []),
  ];

  /* ══════════════════════════════════════════════════════════════
     Shared header
     ══════════════════════════════════════════════════════════════ */
  const renderHeader = (showRefresh: boolean) => (
    <View style={styles.header}>
      <BackButton fallback="/accounts" color={colors.primary2} />
      <Text style={styles.headerTitle}>Link Account</Text>
      <View style={styles.headerRight}>
        {showRefresh ? (
          <ActivityIndicator size="small" color={colors.primary2} />
        ) : null}
      </View>
    </View>
  );

  /* ══════════════════════════════════════════════════════════════
     Reconnect banner (AttentionCard visual pattern)
     ══════════════════════════════════════════════════════════════ */
  const renderReconnectBanner = () => {
    if (reauthAccounts.length === 0) return null;
    return (
      <View style={styles.attentionCard}>
        <View style={styles.attentionHeader}>
          <Ionicons name="alert-circle" size={14} color={colors.warning} />
          <Text style={styles.attentionHeaderText}>Needs your attention</Text>
        </View>
        {reauthAccounts.map((item, i) => {
          const canReconnect = item.provider === 'teller';
          const name = item.institution_name || 'Bank account';
          return (
            <View
              key={item.id}
              style={[
                styles.attentionRow,
                i < reauthAccounts.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={[styles.attentionIcon, { backgroundColor: `${colors.warning}1f` }]}>
                <Ionicons name="warning-outline" size={16} color={colors.warning} />
              </View>
              <View style={styles.attentionText}>
                <Text style={styles.attentionTitle} numberOfLines={2}>
                  {name} needs reconnecting
                </Text>
              </View>
              {canReconnect && (
                <TouchableOpacity
                  style={styles.attentionCta}
                  onPress={() => handleReconnect(item)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Reconnect ${name}`}
                >
                  <Text style={styles.attentionCtaText}>Reconnect</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  /* ══════════════════════════════════════════════════════════════
     Trust footer
     ══════════════════════════════════════════════════════════════ */
  const renderTrustFooter = () => (
    <View style={styles.trustRow}>
      <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
      <Text style={styles.trustText}>Bank-level encryption · Read-only access</Text>
    </View>
  );

  /* ══════════════════════════════════════════════════════════════
     Loading skeleton body
     ══════════════════════════════════════════════════════════════ */
  const renderSkeletonRow = (last = false) => (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Skeleton width={40} height={40} borderRadius={radius.md} />
      <View style={styles.rowMiddle}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={10} style={styles.skelSub} />
      </View>
      <Skeleton width={24} height={24} borderRadius={radius.full} />
    </View>
  );

  const renderLoadingBody = () => (
    <>
      <Skeleton width={120} height={10} style={styles.skelLabel} />
      <View style={styles.glassCard}>
        {renderSkeletonRow()}
        {renderSkeletonRow(true)}
      </View>
      <Skeleton width={140} height={10} style={styles.skelLabel} />
      <View style={styles.glassCard}>
        {renderSkeletonRow()}
        {renderSkeletonRow()}
        {renderSkeletonRow(true)}
      </View>
      <Skeleton height={48} borderRadius={radius.lg} style={styles.skelCta} />
    </>
  );

  /* ══════════════════════════════════════════════════════════════
     Provider chooser + CTA
     ══════════════════════════════════════════════════════════════ */
  const renderConnectSection = () => {
    // Direct-Plaid fallback (no choice worth showing).
    if (!showProviderSelection) {
      if (loading || !linkToken) {
        return <Skeleton height={48} borderRadius={radius.lg} style={styles.skelCta} />;
      }
      return (
        <LinkAccountConnectCTA
          variant="primary"
          icon={accounts.length > 0 ? 'add-circle-outline' : 'shield-checkmark-outline'}
          busy={linking}
          label={
            linking
              ? 'Opening Plaid…'
              : accounts.length > 0
              ? 'Link Another Account'
              : 'Connect with Plaid'
          }
          onPress={openPlaidBrowser}
        />
      );
    }

    // Provider radio group.
    const primaryLabel = busy
      ? `Connecting via ${providerLabel(selectedProvider)}…`
      : selectedProvider
      ? `Connect with ${providerLabel(selectedProvider)}`
      : 'Select a provider';
    const primaryIcon: React.ComponentProps<typeof Ionicons>['name'] = selectedProvider
      ? PROVIDER_META[selectedProvider].icon
      : 'shield-checkmark-outline';

    return (
      <>
        <LinkAccountGroupLabel>CHOOSE A PROVIDER</LinkAccountGroupLabel>
        <View style={[styles.glassCard, busy && styles.dimmedGroup]}>
          {availableProviderKeys.map((key, i) => (
            <LinkAccountProviderRow
              key={key}
              provider={key}
              selected={selectedProvider === key}
              disabled={busy}
              isLast={i === availableProviderKeys.length - 1}
              onPress={() => setSelectedProvider(key)}
            />
          ))}
        </View>
        <LinkAccountConnectCTA
          variant="primary"
          icon={primaryIcon}
          busy={busy}
          disabled={!selectedProvider}
          label={primaryLabel}
          onPress={handleConnectPress}
        />
      </>
    );
  };

  /* ══════════════════════════════════════════════════════════════
     WebView modal (shared chrome for Flinks + Teller)
     ══════════════════════════════════════════════════════════════ */
  const renderWebViewModal = (opts: {
    visible: boolean;
    provider: 'Flinks' | 'Teller';
    url: string | null;
    onClose: () => void;
    webViewProps: React.ComponentProps<typeof WebView>;
  }) => (
    <Modal
      visible={opts.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={opts.onClose}
    >
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={styles.flex}>
          <View style={styles.modalHeader}>
            <BackButton
              iconName="close"
              color={colors.primary2}
              onPress={opts.onClose}
            />
            <Text style={styles.headerTitle}>Connect with {opts.provider}</Text>
            <View style={styles.headerRight} />
          </View>
          {opts.url && (
            <WebView
              {...opts.webViewProps}
              source={{ uri: opts.url }}
              style={styles.webView}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color={colors.primary2} />
                  <Text style={styles.webViewLoadingText}>
                    Loading {opts.provider} Connect…
                  </Text>
                </View>
              )}
              javaScriptEnabled
              domStorageEnabled
            />
          )}
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );

  const flinksModal = renderWebViewModal({
    visible: flinksWebViewVisible,
    provider: 'Flinks',
    url: flinksConnectUrl,
    onClose: () => {
      setFlinksWebViewVisible(false);
      setFlinksConnectUrl(null);
    },
    webViewProps: {
      onNavigationStateChange: (navState) => {
        handleFlinksNavigation(navState.url);
      },
      onShouldStartLoadWithRequest: (request) => {
        if (request.url.includes('loginId=')) {
          handleFlinksNavigation(request.url);
          return false;
        }
        return true;
      },
    },
  });

  const tellerModal = renderWebViewModal({
    visible: tellerWebViewVisible,
    provider: 'Teller',
    url: tellerConnectUrl,
    onClose: () => {
      setTellerWebViewVisible(false);
      setTellerConnectUrl(null);
    },
    webViewProps: {
      onMessage: (event) => {
        handleTellerMessage(event.nativeEvent.data);
      },
    },
  });

  /* ══════════════════════════════════════════════════════════════
     Render: loading state (header + intro static, skeleton body)
     ══════════════════════════════════════════════════════════════ */
  if (loadingAccounts || loadingProviders) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={styles.flex}>
          {renderHeader(true)}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <LinkAccountIntroCard />
            {renderLoadingBody()}
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  /* ── Render: native SDK path (no linked accounts yet) ───────── */
  if (nativeAvailable && linkToken && accounts.length === 0 && !showProviderSelection) {
    return (
      <NativePlaidFlow
        linkToken={linkToken}
        exchangeToken={exchangeToken}
        renderHeader={() => renderHeader(false)}
        renderTrustFooter={renderTrustFooter}
      />
    );
  }

  /* ── Render: link-token / providers load error ──────────────── */
  const hasLoadError = !!error && !linkToken;

  /* ══════════════════════════════════════════════════════════════
     Render: main screen
     ══════════════════════════════════════════════════════════════ */
  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.flex}>
        {renderHeader(refreshing)}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinkAccountIntroCard />

          {hasLoadError ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
              <Text style={styles.errorTitle}>Couldn't start bank linking</Text>
              <Text style={styles.errorBody}>
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={handleRetry}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Ionicons name="refresh" size={18} color={colors.primary2} />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {renderReconnectBanner()}

              {accounts.length > 0 && (
                <>
                  <LinkAccountGroupLabel>
                    LINKED ACCOUNTS · {accounts.length}
                  </LinkAccountGroupLabel>
                  <View style={styles.glassCard}>
                    {accounts.map((item, i) => (
                      <LinkAccountLinkedRow
                        key={item.id}
                        account={item}
                        isLast={i === accounts.length - 1}
                        onReconnect={handleReconnect}
                        onUnlink={handleUnlink}
                      />
                    ))}
                  </View>

                  <LinkAccountConnectCTA
                    variant="secondary"
                    icon="sync-outline"
                    busy={syncing}
                    label={syncing ? 'Syncing…' : 'Sync Now'}
                    onPress={handleSync}
                  />
                </>
              )}

              {renderConnectSection()}
            </>
          )}

          {renderTrustFooter()}
        </ScrollView>
      </SafeAreaView>

      {flinksModal}
      {tellerModal}
    </GradientBackground>
  );
}

/* ── Native Plaid Link wrapper (only rendered when SDK is available) ── */
function NativePlaidFlow({
  linkToken,
  exchangeToken,
  renderHeader,
  renderTrustFooter,
}: {
  linkToken: string;
  exchangeToken: (token: string, institution?: string) => Promise<void>;
  renderHeader: () => React.ReactNode;
  renderTrustFooter: () => React.ReactNode;
}) {
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
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.flex}>
        {renderHeader()}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinkAccountIntroCard />
          <LinkAccountConnectCTA
            variant="primary"
            icon="shield-checkmark-outline"
            disabled={!ready}
            label={ready ? 'Connect with Plaid' : 'Preparing…'}
            onPress={() => open()}
          />
          {renderTrustFooter()}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  flex: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3, fontWeight: '800',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },

  /* Intro card (the ONE floating card) */
  introCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  introIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary2}1a`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  introTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  introBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },

  /* Group label */
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  /* Glass card container for rows */
  glassCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },

  /* Shared list row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowName: {
    ...typography.smallBold,
    color: colors.text,
    flexShrink: 1,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowSubtitleWarning: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
    marginTop: 2,
  },
  rowTrailing: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  /* Reconnect pill (in-row) */
  reconnectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: `${colors.warning}26`,
    borderWidth: 1,
    borderColor: `${colors.warning}66`,
  },
  reconnectPillText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
  },

  /* Unlink icon button */
  unlinkBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: `${colors.error}1a`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Provider badge */
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Provider radio row */
  providerRow: {
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  providerRowSelected: {
    backgroundColor: `${colors.primary2}0f`,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  providerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingLeft: 40 + spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  /* CTA buttons */
  ctaBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  ctaPrimary: {
    marginBottom: spacing.lg,
  },
  ctaSecondary: {
    backgroundColor: `${colors.primary2}1f`,
    borderWidth: 1,
    borderColor: `${colors.primary2}40`,
    marginBottom: spacing.lg,
  },
  ctaLeading: {
    marginRight: spacing.sm,
  },
  ctaPrimaryText: {
    ...typography.button,
    color: colors.text,
  },
  ctaSecondaryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  /* Dim states */
  dimmed: { opacity: 0.5 },
  dimmedGroup: { opacity: 0.5 },

  /* Reconnect AttentionCard banner */
  attentionCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: `${colors.warning}0d`,
    borderWidth: 1,
    borderColor: `${colors.warning}2e`,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  attentionHeaderText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.warning,
    textTransform: 'uppercase',
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  attentionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionText: {
    flex: 1,
    minWidth: 0,
  },
  attentionTitle: {
    ...typography.small,
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  attentionCta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.warning}66`,
    backgroundColor: `${colors.warning}1f`,
  },
  attentionCtaText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },

  /* Error card */
  errorCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  /* Trust footer */
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  trustText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  /* Skeleton helpers */
  skelSub: { marginTop: spacing.xs },
  skelLabel: { marginBottom: spacing.md, marginTop: spacing.xs },
  skelCta: { marginBottom: spacing.lg },

  /* WebView modal */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
  },
  webViewLoadingText: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
