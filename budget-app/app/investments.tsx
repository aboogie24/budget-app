import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchInvestmentHoldings, syncPlaidInvestments } from '../utils/api';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { BackButton } from '@/components/BackButton';
import {
  colors,
  spacing,
  radius,
  glassEffects,
  typography,
  gradients,
  getValueColor,
} from '@/utils/design-system';

type Holding = {
  id: string;
  security_name?: string;
  ticker_symbol?: string;
  security_type?: string;
  quantity: number;
  institution_price: number;
  institution_value: number;
  cost_basis?: number;
  iso_currency_code: string;
  price_as_of?: string;
};

type Bucket = { label: string; value: number; color: string; order: number };

const fmt = (v: number) =>
  (v || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

const fmtQty = (q: number) => (q % 1 === 0 ? q.toFixed(0) : q.toFixed(4));

// ─── Allocation bucket normalization (§5.3) ───
// Fixed order + palette so bucket identity is stable across renders.
function bucketFor(type?: string): { label: string; color: string; order: number } {
  const t = (type || '').toLowerCase();
  if (t === 'equity' || t === 'stock' || t === 'stocks')
    return { label: 'Stocks', color: colors.primary, order: 0 };
  if (t === 'etf' || t === 'mutual fund' || t === 'mutual_fund' || t === 'fund')
    return { label: 'ETF/Fund', color: colors.primary2, order: 1 };
  if (t === 'cryptocurrency' || t === 'crypto')
    return { label: 'Crypto', color: colors.accent, order: 2 };
  if (t === 'cash' || t === 'money market' || t === 'money_market')
    return { label: 'Cash', color: colors.info, order: 3 };
  return { label: 'Other', color: colors.textMuted, order: 4 };
}

// ─── Relative "synced N ago" label (§7) ───
function relativeTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return undefined;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Spinning sync icon (respects reduced motion) ───
function SyncIcon({ syncing, reduceMotion }: { syncing: boolean; reduceMotion: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (syncing && !reduceMotion) {
      spin.setValue(0);
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    spin.stopAnimation();
    spin.setValue(0);
  }, [syncing, reduceMotion, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons
        name={syncing ? 'sync' : 'sync-outline'}
        size={24}
        color={syncing ? colors.textMuted : colors.primary2}
      />
    </Animated.View>
  );
}

// ─── TIER 1: Portfolio Hero (§5.2) ───
function InvestmentsPortfolioHero({
  totalValue,
  totalGain,
  gainPercent,
  totalCostBasis,
  lastSyncedLabel,
  estimated,
  loading,
}: {
  totalValue: number;
  totalGain: number;
  gainPercent: number | null;
  totalCostBasis: number;
  lastSyncedLabel?: string;
  estimated?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <View style={styles.hero}>
        <Skeleton width={90} height={12} borderRadius={radius.sm} />
        <Skeleton width={200} height={34} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
        <Skeleton width={170} height={14} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
        <View style={styles.divider} />
        <Skeleton width={140} height={12} borderRadius={radius.sm} />
      </View>
    );
  }

  const up = totalGain >= 0;
  const arrow = up ? '▲' : '▼';
  const sign = up ? '+' : '−';
  const gainColor = getValueColor(totalGain);
  const showReturn = totalCostBasis > 0 && gainPercent !== null;

  const a11y =
    `Total portfolio value ${fmt(totalValue)}, ${up ? 'up' : 'down'} ${fmt(Math.abs(totalGain))}` +
    (showReturn ? `, ${up ? 'up' : 'down'} ${Math.abs(gainPercent!).toFixed(1)} percent all time` : '') +
    (totalCostBasis > 0 ? `. Invested ${fmt(totalCostBasis)}` : '') +
    (lastSyncedLabel ? `. Synced ${lastSyncedLabel}` : '');

  return (
    <View style={styles.hero} accessible accessibilityLabel={a11y}>
      <Text style={styles.heroLabel}>Total value</Text>
      <Text style={styles.heroValue}>{fmt(totalValue)}</Text>

      <Text style={[styles.heroDelta, { color: gainColor }]}>
        {arrow} {sign}
        {fmt(Math.abs(totalGain))}
        {showReturn && (
          <Text style={[styles.heroDelta, { color: gainColor }]}>
            {'  ·  '}
            {sign}
            {Math.abs(gainPercent!).toFixed(1)}% all time
            {estimated ? <Text style={styles.estMark}>{' est.'}</Text> : null}
          </Text>
        )}
      </Text>

      {(totalCostBasis > 0 || lastSyncedLabel) && (
        <>
          <View style={styles.divider} />
          <View style={styles.heroFooter}>
            {totalCostBasis > 0 ? (
              <Text style={styles.heroFooterText}>Invested {fmt(totalCostBasis)}</Text>
            ) : (
              <View />
            )}
            {lastSyncedLabel && (
              <View style={styles.heroFooterRight}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                <Text style={styles.heroFooterText}>Synced {lastSyncedLabel}</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

// ─── TIER 2: Allocation strip (§5.3) ───
function InvestmentsAllocationStrip({
  buckets,
  total,
}: {
  buckets: Bucket[];
  total: number;
}) {
  if (!buckets.length || total <= 0) return null;

  const MAX_LEGEND = 6;
  const visible = buckets.slice(0, MAX_LEGEND);
  const overflow = buckets.length - visible.length;

  const a11y =
    'Allocation: ' +
    buckets
      .map((b) => `${b.label} ${Math.round((b.value / total) * 100)} percent`)
      .join(', ');

  return (
    <View style={styles.allocCard} accessible accessibilityLabel={a11y}>
      <View style={styles.allocBar}>
        {buckets.map((b, i) => (
          <View
            key={`${b.label}-${i}`}
            style={{
              flex: Math.max(b.value, 0.0001),
              backgroundColor: b.color,
            }}
          />
        ))}
      </View>
      <View style={styles.allocLegend}>
        {visible.map((b, i) => (
          <View key={`${b.label}-${i}`} style={styles.legendChip}>
            <View style={[styles.legendDot, { backgroundColor: b.color }]} />
            <Text style={styles.legendLabel}>{b.label} </Text>
            <Text style={styles.legendPct}>{Math.round((b.value / total) * 100)}%</Text>
          </View>
        ))}
        {overflow > 0 && (
          <View style={styles.legendChip}>
            <Text style={styles.legendLabel}>+{overflow} more</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── TIER 3: Holding card (§5.4) ───
function HoldingCard({
  ticker,
  name,
  type,
  value,
  quantity,
  price,
  gain,
  gainPercent,
}: {
  ticker?: string;
  name: string;
  type?: string;
  value: number;
  quantity: number;
  price: number;
  gain: number | null;
  gainPercent: number | null;
}) {
  const hasGain = gain !== null;
  const up = (gain ?? 0) >= 0;
  const gainColor = hasGain ? getValueColor(gain!) : colors.textMuted;

  const a11y =
    `${name}${type ? `, ${type}` : ''}, value ${fmt(value)}` +
    (hasGain
      ? `, ${up ? 'up' : 'down'} ${fmt(Math.abs(gain!))}${
          gainPercent !== null ? `, ${Math.abs(gainPercent).toFixed(1)} percent` : ''
        }`
      : '');

  return (
    <View style={styles.card} accessible accessibilityLabel={a11y}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.tickerRow}>
            {ticker && (
              <View style={styles.tickerBadge}>
                <Text style={styles.tickerText}>{ticker}</Text>
              </View>
            )}
            <Text style={styles.cardTitle} numberOfLines={1}>
              {name}
            </Text>
          </View>
          {type && <Text style={styles.typeText}>{type}</Text>}
        </View>
        <Text style={styles.cardValue}>{fmt(value)}</Text>
      </View>
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>
          {fmtQty(quantity)} shares @ {fmt(price)}
        </Text>
        {hasGain && (
          <Text style={[styles.detailText, { color: gainColor }]}>
            {up ? '▲' : '▼'} {up ? '+' : '−'}
            {fmt(Math.abs(gain!))}
            {gainPercent !== null && ` (${up ? '+' : '−'}${Math.abs(gainPercent).toFixed(1)}%)`}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function InvestmentsScreen() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchInvestmentHoldings();
      setHoldings(data as Holding[]);
    } catch (e) {
      console.error('Failed to load holdings:', e);
      setError('Failed to load investments');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncPlaidInvestments();
      await loadData();
    } catch (e) {
      console.error('Sync failed:', e);
      setError('Failed to sync investments');
    } finally {
      setSyncing(false);
    }
  };

  // ─── Portfolio math (kept verbatim from prior screen) ───
  const totalValue = holdings.reduce((s, h) => s + (h.institution_value || 0), 0);
  const totalCostBasis = holdings.reduce((s, h) => s + (h.cost_basis || 0), 0);
  const totalGain = totalValue - totalCostBasis;

  // Cost-basis honesty: return % over holdings that HAVE a cost basis (§7).
  const costBasisSubset = useMemo(() => {
    const withBasis = holdings.filter((h) => (h.cost_basis || 0) > 0);
    const basis = withBasis.reduce((s, h) => s + (h.cost_basis || 0), 0);
    const value = withBasis.reduce((s, h) => s + (h.institution_value || 0), 0);
    return { basis, gain: value - basis };
  }, [holdings]);

  const gainPercent =
    costBasisSubset.basis > 0 ? (costBasisSubset.gain / costBasisSubset.basis) * 100 : null;
  const estimated =
    holdings.length > 0 && holdings.some((h) => (h.cost_basis || 0) <= 0) && totalCostBasis > 0;

  const lastSyncedLabel = useMemo(() => {
    const stamps = holdings.map((h) => h.price_as_of).filter(Boolean) as string[];
    if (!stamps.length) return undefined;
    const latest = stamps.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
    return relativeTime(latest);
  }, [holdings]);

  // ─── Allocation buckets: grouped by normalized security type, sorted desc ───
  const buckets = useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    for (const h of holdings) {
      const { label, color, order } = bucketFor(h.security_type);
      const prev = map.get(label);
      if (prev) prev.value += h.institution_value || 0;
      else map.set(label, { label, color, order, value: h.institution_value || 0 });
    }
    return Array.from(map.values())
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // ─── Holdings sorted by value descending (default IA improvement, §7) ───
  const sortedHoldings = useMemo(
    () => [...holdings].sort((a, b) => (b.institution_value || 0) - (a.institution_value || 0)),
    [holdings],
  );

  const showSkeleton = loading && !loadedOnce;
  const isEmpty = loadedOnce && !error && holdings.length === 0;
  const initialError = !!error && holdings.length === 0;
  const syncError = !!error && holdings.length > 0;

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <BackButton fallback="/(tabs)/goals" color={colors.text} />
              <Text style={styles.headerTitle}>Investments</Text>
            </View>
            <View style={styles.headerRight}>
              {loadedOnce && syncing && (
                <ActivityIndicator size="small" color={colors.primary2} />
              )}
              <TouchableOpacity
                onPress={handleSync}
                disabled={syncing}
                style={styles.syncButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Sync investments"
                accessibilityState={{ disabled: syncing }}
              >
                <SyncIcon syncing={syncing} reduceMotion={reduceMotion} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Loading skeleton (first load) ── */}
          {showSkeleton && (
            <>
              <InvestmentsPortfolioHero
                loading
                totalValue={0}
                totalGain={0}
                gainPercent={null}
                totalCostBasis={0}
              />
              <Text style={styles.groupLabel}>ALLOCATION</Text>
              <View style={styles.allocCard}>
                <Skeleton height={8} borderRadius={radius.full} />
                <Skeleton
                  width="70%"
                  height={12}
                  borderRadius={radius.sm}
                  style={{ marginTop: spacing.md }}
                />
              </View>
              <Text style={styles.groupLabel}>HOLDINGS</Text>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Skeleton width={140} height={14} borderRadius={radius.sm} />
                      <Skeleton
                        width={80}
                        height={11}
                        borderRadius={radius.sm}
                        style={{ marginTop: spacing.sm }}
                      />
                    </View>
                    <Skeleton width={70} height={14} borderRadius={radius.sm} />
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Initial-load error: error card replaces body ── */}
          {!showSkeleton && initialError && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
              <Text style={styles.errorTitle}>Couldn't load your investments</Text>
              <Text style={styles.errorSub}>Check your connection and try again.</Text>
              <TouchableOpacity
                onPress={loadData}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading investments"
              >
                <Text style={styles.errorAction}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Empty: full glass card + CTA, no hero/allocation/list ── */}
          {!showSkeleton && isEmpty && (
            <View style={styles.emptyCard}>
              <Ionicons name="trending-up-outline" size={44} color={colors.textDark} />
              <Text style={styles.emptyTitle}>No investments yet</Text>
              <Text style={styles.emptySub}>
                Link a brokerage to see your holdings and portfolio value here.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/link-account' as any)}
                activeOpacity={0.85}
                style={styles.ctaWrap}
                accessibilityRole="button"
                accessibilityLabel="Link a brokerage"
              >
                <LinearGradient
                  colors={gradients.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaText}>Link a brokerage</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Populated (also stale/sync-error state keeps content) ── */}
          {!showSkeleton && !initialError && !isEmpty && (
            <>
              <InvestmentsPortfolioHero
                totalValue={totalValue}
                totalGain={totalGain}
                gainPercent={gainPercent}
                totalCostBasis={totalCostBasis}
                lastSyncedLabel={lastSyncedLabel}
                estimated={estimated}
              />

              {buckets.length > 0 && (
                <>
                  <Text style={styles.groupLabel}>ALLOCATION</Text>
                  <InvestmentsAllocationStrip buckets={buckets} total={totalValue} />
                </>
              )}

              {/* Sync-failed-with-stale-data: thin dismissible banner (§4.3) */}
              {syncError && (
                <View style={styles.banner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.bannerText} numberOfLines={1}>
                    Couldn't refresh — showing last synced data.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setError(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss error"
                  >
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.holdingsHeader}>
                <Text style={styles.groupLabel}>HOLDINGS · {holdings.length}</Text>
                <View style={styles.sortPill}>
                  <Text style={styles.sortPillText}>Value</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
                </View>
              </View>

              {sortedHoldings.map((h) => {
                const hasBasis = (h.cost_basis || 0) > 0;
                const gain = hasBasis ? h.institution_value - (h.cost_basis || 0) : null;
                const pct = hasBasis ? (gain! / (h.cost_basis || 1)) * 100 : null;
                return (
                  <HoldingCard
                    key={h.id}
                    ticker={h.ticker_symbol}
                    name={h.security_name || h.ticker_symbol || 'Unknown'}
                    type={h.security_type}
                    value={h.institution_value}
                    quantity={h.quantity}
                    price={h.institution_price}
                    gain={gain}
                    gainPercent={pct}
                  />
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  headerTitle: {
    color: colors.text,
    ...typography.h3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Group labels ──
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },

  // ── TIER 1: Hero ──
  hero: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroValue: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
  },
  heroDelta: {
    ...typography.smallBold,
    marginTop: spacing.sm,
  },
  estMark: {
    ...typography.caption,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroFooterText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // ── TIER 2: Allocation ──
  allocCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  allocBar: {
    flexDirection: 'row',
    height: spacing.sm,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.glassLight,
  },
  allocLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  legendPct: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },

  // ── Sync-error banner ──
  banner: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },

  // ── TIER 3: Holdings ──
  holdingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.glassLight,
    marginBottom: spacing.sm,
    minHeight: 28,
  },
  sortPillText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tickerBadge: {
    backgroundColor: `${colors.primary2}2e`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: `${colors.primary2}66`,
  },
  tickerText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accent,
  },
  cardTitle: {
    ...typography.smallBold,
    color: colors.text,
    flexShrink: 1,
  },
  typeText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  cardValue: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 0,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  detailText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // ── Empty ──
  emptyCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    marginTop: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyBold,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptySub: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  ctaWrap: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cta: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  ctaText: {
    ...typography.smallBold,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Error card ──
  errorCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.bodyBold,
    fontWeight: '700',
    color: colors.text,
  },
  errorSub: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorAction: {
    ...typography.smallBold,
    fontWeight: '700',
    color: colors.primary2,
    marginTop: spacing.xs,
  },
});
