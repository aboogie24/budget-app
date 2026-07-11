import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/utils/apiClient';
import { getLinkedAccountStatus, createUpdateLinkToken, resetLinkedAccountError } from '@/utils/api';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

const APP_SCHEME = 'budgetapp';

type ItemStatus = 'good' | 'pending_expiration' | 'error' | 'revoked' | string;

type LinkedAccountStatus = {
  id: string;
  institution_name: string;
  item_status: ItemStatus;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

/* ── Status → token/icon/label map (icon + word + color, never color alone) ─ */
type StatusMeta = {
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
};

const getStatusMeta = (status: ItemStatus): StatusMeta => {
  switch (status) {
    case 'good':
      return { color: colors.success, icon: 'checkmark-circle', label: 'Connected' };
    case 'pending_expiration':
      return { color: colors.warning, icon: 'alert-circle-outline', label: 'Needs Attention' };
    case 'error':
      return { color: colors.error, icon: 'warning-outline', label: 'Error' };
    case 'revoked':
      return { color: colors.textMuted, icon: 'close-circle-outline', label: 'Revoked' };
    default:
      return { color: colors.textMuted, icon: 'help-circle-outline', label: String(status) };
  }
};

const isAttention = (status: ItemStatus) =>
  status === 'error' || status === 'pending_expiration' || status === 'revoked';

/* ── Small relative date helper: "today" / "Jul 4" / "Jul 4, 2026" ───────── */
const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSynced = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) return 'today';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/* ── Status badge (icon + word + color) ──────────────────────────────────── */
function LinkedStatusBadge({ status }: { status: ItemStatus }) {
  const meta = getStatusMeta(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${meta.color}1f` }]}>
      <Ionicons name={meta.icon} size={12} color={meta.color} />
      <Text style={[styles.badgeLabel, { color: meta.color }]} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
}

/* ── One account row (both group variants) ───────────────────────────────── */
function LinkedAccountRow({
  account,
  isReAuthLoading,
  onReAuth,
  onRelink,
  showDivider,
}: {
  account: LinkedAccountStatus;
  isReAuthLoading: boolean;
  onReAuth: () => void;
  onRelink: () => void;
  showDivider: boolean;
}) {
  const status = account.item_status;
  const attention = isAttention(status);
  const isError = status === 'error';
  const isRevoked = status === 'revoked';
  const accentColor = isError ? colors.error : isRevoked ? colors.textMuted : colors.warning;

  const noticeLabel =
    status === 'pending_expiration'
      ? 'Authentication Expired'
      : status === 'error'
      ? 'Connection Issue'
      : 'Access Revoked';

  const subtitle = attention
    ? `Linked ${formatDate(account.created_at)}`
    : `Synced ${formatSynced(account.updated_at)}`;

  const statusWord = getStatusMeta(status).label;
  const rowA11y = `${account.institution_name}, ${statusWord}, ${
    attention ? `linked ${formatDate(account.created_at)}` : `synced ${formatSynced(account.updated_at)}`
  }.`;

  return (
    <View style={[styles.row, showDivider && styles.rowDivider]}>
      <View
        style={styles.rowTop}
        accessible
        accessibilityLabel={rowA11y}
      >
        <View style={styles.iconChip}>
          <Ionicons name="business-outline" size={18} color={colors.primary2} />
        </View>

        <View style={styles.rowMiddle}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.institution_name}
          </Text>
          <Text style={styles.accountSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <LinkedStatusBadge status={status} />
        </View>
      </View>

      {attention && (
        <View
          style={[
            styles.notice,
            { backgroundColor: `${accentColor}14`, borderLeftColor: accentColor },
          ]}
        >
          <View style={styles.noticeHead}>
            <Ionicons
              name={isRevoked ? 'close-circle-outline' : 'warning-outline'}
              size={16}
              color={accentColor}
            />
            <Text style={[styles.noticeLabel, { color: accentColor }]}>{noticeLabel}</Text>
          </View>

          {isRevoked ? (
            <Text style={styles.noticeCode} numberOfLines={2}>
              Access revoked — relink to reconnect
            </Text>
          ) : account.error_code ? (
            <Text style={styles.noticeCode} numberOfLines={2}>
              {account.error_code}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.actionBtn, isReAuthLoading && styles.actionBtnDisabled]}
            onPress={isRevoked ? onRelink : onReAuth}
            disabled={isReAuthLoading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${isRevoked ? 'Link account' : 'Re-authenticate'} ${account.institution_name}`}
            accessibilityState={{ busy: isReAuthLoading, disabled: isReAuthLoading }}
          >
            {isReAuthLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <Ionicons
                  name={isRevoked ? 'link-outline' : 'refresh-outline'}
                  size={14}
                  color={colors.text}
                />
                <Text style={styles.actionBtnText}>
                  {isRevoked ? 'Link Account' : 'Re-authenticate'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function LinkedAccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LinkedAccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reAuthLoading, setReAuthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_URL = api.getBaseUrl();

  /* ── Load linked accounts with status ───────────────────────────── */
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLinkedAccountStatus();
      setAccounts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load linked accounts:', e);
      setError(e?.message || 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAccounts();
    setRefreshing(false);
  }, [loadAccounts]);

  /* ── Re-authenticate account (flow unchanged) ────────────────────── */
  const handleReAuth = async (accountId: string) => {
    setReAuthLoading(accountId);
    try {
      const tokenData = await createUpdateLinkToken(accountId);
      const linkToken = tokenData?.link_token;

      if (!linkToken) {
        Alert.alert('Error', 'Failed to get link token');
        setReAuthLoading(null);
        return;
      }

      const url = `${API_URL}/plaid/link-page?token=${encodeURIComponent(linkToken)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, `${APP_SCHEME}://`);

      if (result.type === 'success' && result.url) {
        const safe = result.url.replace(`${APP_SCHEME}://`, 'https://app/');
        const parsed = new URL(safe);
        const path = parsed.hostname === 'app' ? parsed.pathname.replace('/', '') : parsed.hostname;

        if (path === 'plaid-success') {
          await resetLinkedAccountError(accountId);
          Alert.alert('Success', 'Account re-authenticated successfully.');
          await loadAccounts();
        }
      }
    } catch (e: any) {
      console.error('Re-auth error:', e);
      Alert.alert('Error', 'Failed to re-authenticate: ' + e.message);
    } finally {
      setReAuthLoading(null);
    }
  };

  /* ── Derived groups (§3) ─────────────────────────────────────────── */
  const attentionAccounts = accounts.filter((a) => isAttention(a.item_status));
  const goodAccounts = accounts.filter((a) => !isAttention(a.item_status));
  const showSkeleton = loading && !loadedOnce;
  const silentRefreshing = loading && loadedOnce;

  /* ── Header (static, always rendered) ────────────────────────────── */
  const Header = (
    <View style={styles.header}>
      <BackButton fallback="/(tabs)/settings" color={colors.primary2} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        Linked Accounts
      </Text>
      <View style={styles.headerRight}>
        {silentRefreshing ? <ActivityIndicator color={colors.primary2} size="small" /> : null}
      </View>
    </View>
  );

  /* ── Summary line (§6.2) ─────────────────────────────────────────── */
  const Summary = () => {
    if (accounts.length === 0) return null;
    const connectedCount = goodAccounts.length;
    const attentionCount = attentionAccounts.length;
    return (
      <View
        style={styles.summary}
        accessible
        accessibilityLabel={`${connectedCount} connected${
          attentionCount > 0 ? `, ${attentionCount} needs attention` : ''
        }.`}
      >
        {attentionCount > 0 && (
          <>
            <View style={styles.summaryChip}>
              <Ionicons name="alert-circle" size={13} color={colors.warning} />
              <Text style={[styles.summaryText, { color: colors.warning }]}>
                {attentionCount} needs attention
              </Text>
            </View>
            <Text style={styles.summaryDivider}>·</Text>
          </>
        )}
        <View style={styles.summaryChip}>
          <Ionicons name="checkmark-circle" size={13} color={colors.success} />
          <Text style={[styles.summaryText, { color: colors.success }]}>
            {connectedCount} connected
          </Text>
        </View>
      </View>
    );
  };

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {Header}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary2}
              colors={[colors.primary2]}
            />
          }
        >
          {/* Loading skeleton (first load only, layout-matched) */}
          {showSkeleton ? (
            <>
              <View style={styles.summary}>
                <Skeleton width={96} height={16} borderRadius={radius.full} />
                <Text style={styles.summaryDivider}>·</Text>
                <Skeleton width={96} height={16} borderRadius={radius.full} />
              </View>
              <Skeleton width={96} height={12} style={{ marginBottom: spacing.sm }} />
              <View style={styles.groupCard}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                    <View style={styles.rowTop}>
                      <Skeleton width={36} height={36} borderRadius={radius.md} />
                      <View style={styles.rowMiddle}>
                        <Skeleton width="55%" height={12} style={{ marginBottom: spacing.xs }} />
                        <Skeleton width="30%" height={10} />
                      </View>
                      <Skeleton width={72} height={20} borderRadius={radius.full} />
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : error ? (
            /* Error state — inline glass card, screen not blanked */
            <View style={styles.stateCard}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
              <Text style={styles.stateTitle}>Couldn't load your accounts</Text>
              <Text style={styles.stateBody}>{error || 'Check your connection and try again.'}</Text>
              <TouchableOpacity
                style={styles.textBtn}
                onPress={() => {
                  setError(null);
                  loadAccounts();
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Retry loading accounts"
              >
                <Text style={styles.textBtnLabel}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : accounts.length === 0 ? (
            /* Empty state — friendly, one primary CTA */
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="link-outline" size={40} color={colors.primary2} />
              </View>
              <Text style={styles.emptyTitle}>No accounts linked yet</Text>
              <Text style={styles.emptyBody}>
                Link your first bank account to sync balances and transactions automatically.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push('/link-account')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Link Account"
              >
                <Text style={styles.primaryBtnText}>Link Account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Summary />

              {/* NEEDS ATTENTION group */}
              {attentionAccounts.length > 0 && (
                <View style={styles.group}>
                  <Text style={styles.groupLabel}>NEEDS ATTENTION</Text>
                  <View style={styles.groupCard}>
                    {attentionAccounts.map((account, i) => (
                      <LinkedAccountRow
                        key={account.id}
                        account={account}
                        isReAuthLoading={reAuthLoading === account.id}
                        onReAuth={() => handleReAuth(account.id)}
                        onRelink={() => router.push('/link-account')}
                        showDivider={i > 0}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* CONNECTED group */}
              {goodAccounts.length > 0 && (
                <View style={styles.group}>
                  <Text style={styles.groupLabel}>CONNECTED</Text>
                  <View style={styles.groupCard}>
                    {goodAccounts.map((account, i) => (
                      <LinkedAccountRow
                        key={account.id}
                        account={account}
                        isReAuthLoading={reAuthLoading === account.id}
                        onReAuth={() => handleReAuth(account.id)}
                        onRelink={() => router.push('/link-account')}
                        showDivider={i > 0}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Link new account CTA (dashed) */}
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => router.push('/link-account')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Link New Account"
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary2} />
                <Text style={styles.ctaBtnText}>Link New Account</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  headerRight: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  /* Summary line */
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryText: {
    ...typography.caption,
    fontWeight: '600',
  },
  summaryDivider: {
    ...typography.caption,
    color: colors.borderGlass,
  },

  /* Groups */
  group: {
    marginBottom: spacing.lg,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  groupCard: {
    ...glassEffects.glass,
    paddingHorizontal: spacing.lg,
  },

  /* Rows */
  row: {
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1f`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowMiddle: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    ...typography.smallBold,
    color: colors.text,
    marginBottom: 2,
  },
  accountSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowRight: {
    flexShrink: 0,
  },

  /* Status badge */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeLabel: {
    ...typography.caption,
    fontWeight: '600',
  },

  /* Attention notice */
  notice: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
  },
  noticeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  noticeLabel: {
    ...typography.smallBold,
  },
  noticeCode: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    ...typography.smallBold,
    color: colors.text,
  },

  /* Link CTA (dashed) */
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary2,
    backgroundColor: `${colors.primary2}0a`,
  },
  ctaBtnText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  /* Empty state */
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary2}1a`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.smallBold,
    color: colors.text,
  },

  /* Error state */
  stateCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  stateTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stateBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  textBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtnLabel: {
    ...typography.smallBold,
    color: colors.primary2,
  },
});
