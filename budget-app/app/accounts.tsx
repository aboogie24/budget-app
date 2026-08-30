import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchAccountBalances,
  syncPlaidBalances,
  recordNetWorthSnapshot,
  type NetWorthSnapshotPoint,
} from '@/utils/api';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius, typography, glassEffects, gradients } from '@/utils/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { AccountsHero } from '@/components/accounts-Hero';
import { AccountRow, type AccountType } from '@/components/accounts-AccountRow';

type Account = {
  id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  current_balance: number;
  available_balance?: number;
  iso_currency_code?: string;
  institution_name?: string;
  mask?: string;
  updated_at?: string;
};

// Type metadata: labels + icons kept from the original; colors now derive from
// design-system tokens instead of a private palette.
const TYPE_META: Record<
  string,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  depository: { label: 'Cash', color: colors.info, icon: 'wallet-outline' },
  credit: { label: 'Credit', color: colors.error, icon: 'card-outline' },
  loan: { label: 'Loans', color: colors.warning, icon: 'document-text-outline' },
  investment: { label: 'Investments', color: colors.success, icon: 'trending-up-outline' },
  other: { label: 'Other', color: colors.textMuted, icon: 'ellipsis-horizontal-outline' },
};

const metaFor = (type: string) => TYPE_META[type] || TYPE_META.other;

function formatCurrency(v: number): string {
  const abs = Math.abs(v);
  const prefix = v < 0 ? '-' : '';
  return prefix + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  const prefix = v < 0 ? '-' : '';
  if (abs >= 1000) {
    return prefix + '$' + (abs / 1000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  }
  return prefix + '$' + abs.toLocaleString();
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Asset allocation card (retokenized AllocationBar) ───
const AllocationCard = ({
  segments,
}: {
  segments: { label: string; pct: number; color: string }[];
}) => {
  const a11y =
    'Asset allocation: ' +
    segments.map((s) => `${s.label} ${s.pct} percent`).join(', ') +
    '.';
  return (
    <View style={styles.card}>
      <Text style={styles.groupLabel}>ASSET ALLOCATION</Text>
      <View style={styles.allocationBody}>
        <View style={styles.allocationTrack} accessible accessibilityLabel={a11y}>
          {segments.map((seg, i) => (
            <View
              key={i}
              style={{
                height: '100%',
                width: `${seg.pct}%` as any,
                backgroundColor: seg.color,
                borderTopLeftRadius: i === 0 ? radius.sm : 0,
                borderBottomLeftRadius: i === 0 ? radius.sm : 0,
                borderTopRightRadius: i === segments.length - 1 ? radius.sm : 0,
                borderBottomRightRadius: i === segments.length - 1 ? radius.sm : 0,
              }}
            />
          ))}
        </View>
        <View style={styles.allocationLegend}>
          {segments.map((seg, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendLabel}>{seg.label}</Text>
              <Text style={styles.legendPct}>{seg.pct}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── Collapsible Assets / Debts section card ───
const AccountSectionCard = ({
  title,
  count,
  total,
  isDebt,
  expanded,
  onToggle,
  balanceVisible,
  children,
}: {
  title: string;
  count: number;
  total: number;
  isDebt: boolean;
  expanded: boolean;
  onToggle: () => void;
  balanceVisible: boolean;
  children: React.ReactNode;
}) => {
  const totalColor = isDebt ? colors.error : colors.success;
  const totalText = balanceVisible ? formatCurrency(total) : '••••••';
  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${count} accounts, total ${totalText}, ${
          expanded ? 'expanded' : 'collapsed'
        }. Double tap to toggle.`}
      >
        <View style={styles.sectionHeaderLeft}>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.groupLabel}>{title}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        </View>
        <Text style={[styles.sectionTotal, { color: totalColor }]}>{totalText}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
};

export default function AccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [errored, setErrored] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [assetsExpanded, setAssetsExpanded] = useState(true);
  const [debtsExpanded, setDebtsExpanded] = useState(true);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotPoint[]>([]);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const data = await fetchAccountBalances();
      setAccounts(Array.isArray(data) ? (data as Account[]) : []);
      setErrored(false);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  // Read the trailing net-worth window for the hero sparkline. Non-blocking:
  // degrades to "Collecting…" with <2 points.
  const loadNetWorth = useCallback(async (list: Account[]) => {
    try {
      const cash = list
        .filter((a) => a.type === 'depository')
        .reduce((s, a) => s + (a.current_balance || 0), 0);
      const investments = list
        .filter((a) => a.type === 'investment')
        .reduce((s, a) => s + (a.current_balance || 0), 0);
      const other = list
        .filter((a) => a.type !== 'depository' && a.type !== 'investment' && a.type !== 'credit' && a.type !== 'loan')
        .reduce((s, a) => s + (a.current_balance || 0), 0);
      const debt = list
        .filter((a) => a.type === 'credit' || a.type === 'loan')
        .reduce((s, a) => s + (a.current_balance || 0), 0);
      const total = cash + investments + other - debt;
      const res = await recordNetWorthSnapshot(
        { cash, investments, properties: other, debt, total },
        30,
      );
      setNetWorthHistory(Array.isArray(res?.snapshots) ? res.snapshots : []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the sparkline window whenever balances change.
  useEffect(() => {
    if (loadedOnce && accounts.length > 0) {
      loadNetWorth(accounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, loadedOnce]);

  const handleSync = async () => {
    setSyncing(true);
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ).start();
    try {
      await syncPlaidBalances();
      await load();
    } catch {
      // silent — freshness chip / error state surfaces failure
    } finally {
      setSyncing(false);
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ── Derived data ──
  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.type || 'other';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  const assetAccounts = accounts.filter((a) => a.type !== 'credit' && a.type !== 'loan');
  const debtAccounts = accounts.filter((a) => a.type === 'credit' || a.type === 'loan');

  const totalAssets = assetAccounts.reduce((s, a) => s + (a.current_balance || 0), 0);
  const totalDebts = debtAccounts.reduce((s, a) => s + (a.current_balance || 0), 0);
  const netWorth = totalAssets - totalDebts;

  const assetTypes = ['depository', 'investment', 'other'].filter((t) => grouped[t]?.length);
  const allocationSegments = assetTypes.map((type) => {
    const meta = metaFor(type);
    const typeTotal = (grouped[type] || []).reduce((s, a) => s + (a.current_balance || 0), 0);
    const pct = totalAssets > 0 ? Math.round((typeTotal / totalAssets) * 100) : 0;
    return { label: meta.label, pct, color: meta.color };
  });

  const historyValues = netWorthHistory.map((p) => p.total);
  const deltaPercent = (() => {
    if (netWorthHistory.length < 2) return null;
    const first = netWorthHistory[0].total;
    const last = netWorthHistory[netWorthHistory.length - 1].total;
    if (!first) return null;
    return Math.round(((last - first) / Math.abs(first)) * 1000) / 10;
  })();

  const lastSynced = accounts.reduce<string | undefined>((latest, a) => {
    if (!a.updated_at) return latest;
    if (!latest || new Date(a.updated_at) > new Date(latest)) return a.updated_at;
    return latest;
  }, undefined);

  const renderRow = (account: Account, isDebt: boolean) => {
    const meta = metaFor(account.type);
    return (
      <AccountRow
        key={account.id}
        name={account.name}
        institutionName={account.institution_name}
        mask={account.mask}
        subtype={account.subtype}
        typeColor={meta.color}
        icon={meta.icon}
        currentBalance={account.current_balance || 0}
        availableBalance={account.available_balance}
        isDebt={isDebt}
        balanceVisible={balanceVisible}
        formatCurrency={formatCurrency}
      />
    );
  };

  const showSkeleton = loading && !loadedOnce;
  const isEmpty = loadedOnce && !loading && !errored && accounts.length === 0;
  const isError = loadedOnce && !loading && errored && accounts.length === 0;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/dashboard" color={colors.primary2} />
          <Text style={styles.headerTitle}>Accounts</Text>
          <View style={styles.headerActions}>
            {refreshing && <ActivityIndicator color={colors.primary2} size="small" />}
            <TouchableOpacity
              onPress={() => setBalanceVisible(!balanceVisible)}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={balanceVisible ? 'Hide balances' : 'Show balances'}
            >
              <Ionicons
                name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={balanceVisible ? colors.textMuted : colors.primary2}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSync}
              disabled={syncing}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Sync accounts"
            >
              <Animated.View style={syncing ? { transform: [{ rotate: spin }] } : undefined}>
                <Ionicons
                  name="sync-outline"
                  size={20}
                  color={syncing ? colors.primary2 : colors.textMuted}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {isEmpty ? (
          /* ── Empty state ── */
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="business-outline" size={40} color={colors.primary2} />
            </View>
            <Text style={styles.emptyTitle}>No accounts linked</Text>
            <Text style={styles.emptyText}>
              Connect your bank accounts to track balances, spending, and net worth together as a couple.
            </Text>
            <TouchableOpacity onPress={() => router.push('/link-account')} activeOpacity={0.85}>
              <LinearGradient
                colors={[...gradients.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.text} />
                <Text style={styles.primaryBtnText}>Link Bank Account</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
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
            {showSkeleton ? (
              <View style={{ gap: spacing.lg }}>
                <AccountsHero
                  loading
                  netWorth={0}
                  history={[]}
                  deltaPercent={null}
                  totalAssets={0}
                  assetCount={0}
                  totalDebts={0}
                  debtCount={0}
                  balanceVisible={balanceVisible}
                  formatCurrency={formatCurrency}
                  formatCompact={formatCompact}
                />
                <View style={styles.card}>
                  <Skeleton width={120} height={12} />
                  <Skeleton width="100%" height={8} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
                </View>
                <View style={styles.card}>
                  <View style={styles.sectionHeader}>
                    <Skeleton width={90} height={12} />
                    <Skeleton width={70} height={14} />
                  </View>
                  <View style={styles.sectionBody}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={styles.skelRow}>
                        <Skeleton width={36} height={36} borderRadius={radius.md} />
                        <View style={{ flex: 1, gap: spacing.sm }}>
                          <Skeleton width="60%" height={12} />
                          <Skeleton width="40%" height={10} />
                        </View>
                        <Skeleton width={60} height={14} />
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : isError ? (
              /* ── Error state ── */
              <View style={styles.card}>
                <View style={styles.errorInner}>
                  <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
                  <Text style={styles.errorTitle}>Couldn't load your accounts</Text>
                  <Text style={styles.errorText}>Check your connection and try again.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setLoading(true);
                      load();
                    }}
                    style={styles.retryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading accounts"
                  >
                    <Ionicons name="refresh-outline" size={16} color={colors.primary2} />
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* ── Hero ── */}
                <AccountsHero
                  netWorth={netWorth}
                  history={historyValues}
                  deltaPercent={deltaPercent}
                  deltaDays={30}
                  totalAssets={totalAssets}
                  assetCount={assetAccounts.length}
                  totalDebts={totalDebts}
                  debtCount={debtAccounts.length}
                  balanceVisible={balanceVisible}
                  formatCurrency={formatCurrency}
                  formatCompact={formatCompact}
                />

                {/* ── Freshness chip ── */}
                <View style={styles.freshness}>
                  {lastSynced ? (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                      <Text style={styles.freshnessText}>Synced {relativeTime(lastSynced)}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.freshnessText}>Not synced yet</Text>
                    </>
                  )}
                </View>

                {/* ── Asset allocation ── */}
                {allocationSegments.length > 1 && (
                  <View style={{ marginTop: spacing.lg }}>
                    <AllocationCard segments={allocationSegments} />
                  </View>
                )}

                {/* ── Assets ── */}
                {assetAccounts.length > 0 && (
                  <View style={{ marginTop: spacing.lg }}>
                    <AccountSectionCard
                      title="ASSETS"
                      count={assetAccounts.length}
                      total={totalAssets}
                      isDebt={false}
                      expanded={assetsExpanded}
                      onToggle={() => setAssetsExpanded((v) => !v)}
                      balanceVisible={balanceVisible}
                    >
                      {assetAccounts.map((a, i) => (
                        <View key={a.id}>
                          {i > 0 && <View style={styles.rowDivider} />}
                          {renderRow(a, false)}
                        </View>
                      ))}
                    </AccountSectionCard>
                  </View>
                )}

                {/* ── Debts ── */}
                {debtAccounts.length > 0 && (
                  <View style={{ marginTop: spacing.lg }}>
                    <AccountSectionCard
                      title="DEBTS"
                      count={debtAccounts.length}
                      total={totalDebts}
                      isDebt
                      expanded={debtsExpanded}
                      onToggle={() => setDebtsExpanded((v) => !v)}
                      balanceVisible={balanceVisible}
                    >
                      {debtAccounts.map((a, i) => (
                        <View key={a.id}>
                          {i > 0 && <View style={styles.rowDivider} />}
                          {renderRow(a, true)}
                        </View>
                      ))}
                    </AccountSectionCard>
                  </View>
                )}

                {/* ── Link CTA ── */}
                <TouchableOpacity
                  style={styles.linkCta}
                  activeOpacity={0.7}
                  onPress={() => router.push('/link-account')}
                  accessibilityRole="button"
                  accessibilityLabel="Link new account"
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary2} />
                  <Text style={styles.linkCtaText}>Link New Account</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3, fontWeight: '800',
    color: colors.text,
    flex: 1,
    marginLeft: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Scroll */
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },

  /* Cards */
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },

  /* Freshness chip */
  freshness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  freshnessText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  /* Allocation */
  allocationBody: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  allocationTrack: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.glassMedium,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  allocationLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  legendPct: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },

  /* Section card */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    backgroundColor: colors.glassMedium,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  countText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sectionTotal: {
    ...typography.bodyBold,
    flexShrink: 0,
  },
  sectionBody: {
    marginTop: spacing.xs,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },

  /* Skeleton row */
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },

  /* Link CTA */
  linkCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary2,
    backgroundColor: `${colors.primary2}0a`,
    marginTop: spacing.lg,
  },
  linkCtaText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  /* Empty state */
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIconCircle: {
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
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.text,
  },

  /* Error state */
  errorInner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  errorTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  errorText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
});
