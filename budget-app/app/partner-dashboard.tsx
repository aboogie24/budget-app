import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  commonStyles,
  getValueColor,
} from '@/utils/design-system';

type HouseholdSummary = {
  household_id: string;
  household_name: string;
  member_count: number;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  total_debt: number;
  total_savings_target: number;
  total_savings_current: number;
  savings_progress: number;
};

type Member = { user_id: string; full_name: string; role?: string };

// Fixed cross-screen partner glyph mapping (mirrors dashboard/calendar):
// first partner → ◑ / primary2, second → ◐ / info.
type PartnerChip = { glyph: string; color: string; name: string };

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

// "+$1,860.00" / "−$4,560.00" — explicit sign prefix so status never relies on color alone.
const formatSigned = (amount: number) => {
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(amount || 0))}`;
};

export default function PartnerDashboardScreen() {
  const router = useRouter();
  const [householdData, setHouseholdData] = useState<HouseholdSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHouseholdData = useCallback(async () => {
    try {
      // First load shows the skeleton; subsequent focus refetches show the
      // header spinner instead of blanking the whole screen.
      if (loadedOnce) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const user = await getCurrentUser();
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      // Fetch household info first
      const householdInfo = await api.get<any>(`/auth/households/me`, { user_id: user.id });
      const householdID = householdInfo?.household_id;

      if (!householdID) {
        setError('Failed to load household info');
        return;
      }

      // Reuse the member identities already on the household payload for the
      // partner chips (same source the home dashboard uses). Degrades silently.
      let rawMembers = householdInfo?.members;
      if (typeof rawMembers === 'string') {
        try {
          rawMembers = JSON.parse(rawMembers);
        } catch {
          rawMembers = undefined;
        }
      }
      setMembers(Array.isArray(rawMembers) ? (rawMembers as Member[]) : []);

      // Fetch household summary with the household ID
      const summary = await api.get<HouseholdSummary>(`/auth/households/summary`, {
        household_id: householdID,
      });
      setHouseholdData(summary);
    } catch (err) {
      console.error('Load household data error:', err);
      setError('Error loading household data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadedOnce(true);
    }
  }, [loadedOnce]);

  useFocusEffect(
    useCallback(() => {
      loadHouseholdData();
    }, [loadHouseholdData])
  );

  const partnerChips = useMemo<PartnerChip[]>(() => {
    const palette = [
      { glyph: '◑', color: colors.primary2 },
      { glyph: '◐', color: colors.info },
    ];
    return members.slice(0, 2).map((m, i) => ({
      glyph: palette[i].glyph,
      color: palette[i].color,
      name: (m.full_name || 'Partner').split(' ')[0],
    }));
  }, [members]);

  const isSolo = (householdData?.member_count ?? 0) < 2;

  const isEmpty =
    !!householdData &&
    householdData.total_income === 0 &&
    householdData.total_expenses === 0 &&
    householdData.total_debt === 0 &&
    householdData.total_savings_target === 0;

  // ── Header (always real — never blanks) ──
  const renderHeader = () => (
    <View style={commonStyles.header}>
      <BackButton fallback="/(tabs)/dashboard" color={colors.text} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        Partner Dashboard
      </Text>
      {refreshing ? (
        <View style={styles.headerRightSlot}>
          <ActivityIndicator size="small" color={colors.primary2} />
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.headerRightSlot}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );

  const go = (href: Href) => () => router.push(href);

  const actions: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    href: Href;
  }[] = [
    { icon: 'add-circle-outline', label: 'Add Transaction', href: '/add-transaction' },
    { icon: 'pie-chart-outline', label: 'View Budgets', href: '/(tabs)/budget' },
    { icon: 'flag-outline', label: 'Savings Goals', href: '/(tabs)/goals' },
    { icon: 'analytics-outline', label: 'My Dashboard', href: '/(tabs)/dashboard' },
  ];

  const renderQuickActions = () => (
    <>
      <Text style={styles.groupLabel}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.actionButton}
            onPress={go(a.href)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityHint="Double tap to open."
          >
            <Ionicons name={a.icon} size={28} color={colors.primary2} />
            <Text style={styles.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // ── LOADING (first load only): layout-matched skeleton ──
  if (loading && !loadedOnce) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={commonStyles.safeContainer}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {renderHeader()}

            {/* Tier 1 — headline shell */}
            <View style={[styles.headlineCard, styles.cardPad]}>
              <View style={styles.headlineTopRow}>
                <Skeleton width={160} height={22} borderRadius={radius.sm} />
                <Skeleton width={56} height={32} borderRadius={radius.md} />
              </View>
              <Skeleton width={120} height={14} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
              <Skeleton width={200} height={36} borderRadius={radius.md} style={{ marginTop: spacing.sm }} />
              <Skeleton width={160} height={14} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
            </View>

            {/* Tier 2 shell */}
            <Skeleton width={140} height={12} borderRadius={radius.sm} style={styles.groupLabelSkeleton} />
            <View style={[styles.card, styles.cardPad]}>
              <View style={styles.statRow}>
                <Skeleton width={90} height={44} borderRadius={radius.md} />
                <Skeleton width={90} height={44} borderRadius={radius.md} />
              </View>
              <View style={commonStyles.divider} />
              <Skeleton width={180} height={20} borderRadius={radius.sm} />
            </View>

            {/* Tier 3 shell */}
            <Skeleton width={120} height={12} borderRadius={radius.sm} style={styles.groupLabelSkeleton} />
            <View style={[styles.card, styles.cardPad]}>
              <View style={styles.statRow}>
                <Skeleton width={90} height={44} borderRadius={radius.md} />
                <Skeleton width={90} height={44} borderRadius={radius.md} />
              </View>
              <View style={commonStyles.divider} />
              <Skeleton width="100%" height={spacing.sm} borderRadius={radius.full} />
            </View>

            {/* Tier 4 shell */}
            <Skeleton width={120} height={12} borderRadius={radius.sm} style={styles.groupLabelSkeleton} />
            <View style={styles.actionsGrid}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="47%" height={72} borderRadius={radius.md} />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── ERROR (non-blanking; header preserved) ──
  if (error || !householdData) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={commonStyles.safeContainer}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {renderHeader()}
            <View style={[styles.card, styles.stateCard]}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
              <Text style={styles.stateTitle}>Couldn&apos;t load your household</Text>
              <Text style={styles.stateMessage}>
                {error === 'User not authenticated'
                  ? 'Please sign in again to see your household.'
                  : 'Something went wrong fetching the summary.'}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadHouseholdData}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const {
    household_name,
    member_count,
    total_income,
    total_expenses,
    net_cash_flow,
    total_debt,
    total_savings_target,
    total_savings_current,
    savings_progress,
  } = householdData;

  // ── EMPTY (new household — onboarding voice, keep Quick Actions) ──
  if (isEmpty) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={commonStyles.safeContainer}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {renderHeader()}

            {/* Tier 1 — onboarding headline */}
            <View style={[styles.headlineCard, styles.cardPad]}>
              <View style={styles.headlineTopRow}>
                <Text style={styles.householdName} numberOfLines={1}>
                  {household_name}
                </Text>
                <View style={styles.memberBadge}>
                  <Ionicons name="people" size={16} color={colors.primary2} />
                  <Text style={styles.memberBadgeText}>{Math.max(member_count, 1)}</Text>
                </View>
              </View>

              <View style={styles.setupChip}>
                <Ionicons name="information-circle-outline" size={14} color={colors.primary2} />
                <Text style={styles.setupChipText}>SET UP</Text>
              </View>
              <Text style={styles.emptyBody}>
                You&apos;re all set up together — link an account or add a transaction to see your
                household come to life.
              </Text>

              <TouchableOpacity
                style={styles.primaryCta}
                onPress={go('/add-transaction')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Link an account"
              >
                <Text style={styles.primaryCtaText}>Link an account</Text>
              </TouchableOpacity>
            </View>

            {/* Single friendly empty card */}
            <View style={[styles.card, styles.stateCard]}>
              <Ionicons name="home-outline" size={44} color={colors.textDark} />
              <Text style={styles.stateTitle}>Nothing to show yet</Text>
              <Text style={styles.stateMessage}>
                Your combined cash flow, debt, and savings fill in here as money starts moving.
              </Text>
            </View>

            {renderQuickActions()}
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const savedFraction = `${formatCurrency(total_savings_current)} / ${formatCurrency(total_savings_target)}`;
  const goalMet = savings_progress >= 100;

  // ── DEFAULT / POPULATED ──
  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={commonStyles.safeContainer}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {renderHeader()}

          {/* ───── TIER 1 — Household Headline (only floating card, only h1) ───── */}
          <View
            style={[styles.headlineCard, styles.cardPad]}
            accessible
            accessibilityLabel={`${household_name}, ${member_count} members. ${
              isSolo ? 'This month' : 'Together this month'
            }, combined cash flow ${net_cash_flow >= 0 ? 'positive' : 'negative'} ${formatCurrency(
              Math.abs(net_cash_flow)
            )}. ${formatCurrency(total_income)} in, ${formatCurrency(total_expenses)} out.`}
          >
            <View style={styles.headlineTopRow}>
              <Text style={styles.householdName} numberOfLines={1}>
                {household_name}
              </Text>
              <View style={styles.memberBadge}>
                <Ionicons name="people" size={16} color={colors.primary2} />
                <Text style={styles.memberBadgeText}>{Math.max(member_count, 1)}</Text>
              </View>
            </View>

            <Text style={styles.contextLabel}>{isSolo ? 'This month' : 'Together this month'}</Text>

            <Text
              style={[styles.hero, { color: getValueColor(net_cash_flow) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {formatSigned(net_cash_flow)}
            </Text>

            <Text style={styles.heroSub}>
              {formatCurrency(total_income)} in  −  {formatCurrency(total_expenses)} out
            </Text>

            {!isSolo && partnerChips.length > 0 && (
              <View style={styles.chipsRow}>
                {partnerChips.map((c) => (
                  <View key={c.name + c.glyph} style={styles.partnerChip}>
                    <Text style={[styles.partnerGlyph, { color: c.color }]}>{c.glyph}</Text>
                    <Text style={styles.partnerName}>{c.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ───── TIER 2 — Combined Cash Flow (proof) ───── */}
          <Text style={styles.groupLabel}>COMBINED CASH FLOW</Text>
          <View
            style={[styles.card, styles.cardPad]}
            accessible
            accessibilityLabel={`Total income ${formatCurrency(
              total_income
            )}. Total expenses ${formatCurrency(total_expenses)}. Net cash flow ${
              net_cash_flow >= 0 ? 'positive' : 'negative'
            } ${formatCurrency(Math.abs(net_cash_flow))}.`}
          >
            <View style={styles.statRow}>
              <View style={styles.statCol}>
                <View style={[styles.iconChip, { backgroundColor: `${colors.success}1a` }]}>
                  <Ionicons name="arrow-up-circle-outline" size={24} color={colors.success} />
                </View>
                <Text style={styles.statLabel}>Total Income</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {formatCurrency(total_income)}
                </Text>
              </View>
              <View style={styles.statCol}>
                <View style={[styles.iconChip, { backgroundColor: `${colors.error}1a` }]}>
                  <Ionicons name="arrow-down-circle-outline" size={24} color={colors.error} />
                </View>
                <Text style={styles.statLabel}>Total Expenses</Text>
                <Text style={[styles.statValue, { color: colors.error }]}>
                  {formatCurrency(total_expenses)}
                </Text>
              </View>
            </View>

            <View style={commonStyles.divider} />

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net Cash Flow</Text>
              <Text style={[styles.netValue, { color: getValueColor(net_cash_flow) }]}>
                {formatSigned(net_cash_flow)}
              </Text>
            </View>
          </View>

          {/* ───── TIER 3 — Debt & Savings ───── */}
          <Text style={styles.groupLabel}>DEBT &amp; SAVINGS</Text>
          <View
            style={[styles.card, styles.cardPad]}
            accessible
            accessibilityLabel={`Total debt ${formatCurrency(
              total_debt
            )}. Savings progress ${savings_progress.toFixed(1)} percent. Saved ${formatCurrency(
              total_savings_current
            )} of ${formatCurrency(total_savings_target)}.`}
          >
            <View style={styles.statRow}>
              <View style={styles.statCol}>
                <View style={[styles.iconChip, { backgroundColor: `${colors.warning}1a` }]}>
                  <Ionicons name="document-text-outline" size={24} color={colors.warning} />
                </View>
                <Text style={styles.statLabel}>Total Debt</Text>
                <Text style={styles.statValue}>{formatCurrency(total_debt)}</Text>
              </View>
              <View style={styles.statCol}>
                <View style={[styles.iconChip, { backgroundColor: `${colors.primary2}1a` }]}>
                  <Ionicons name="wallet-outline" size={24} color={colors.primary2} />
                </View>
                <Text style={styles.statLabel}>Savings Progress</Text>
                <Text style={styles.statValue}>{savings_progress.toFixed(1)}%</Text>
              </View>
            </View>

            <View style={commonStyles.divider} />

            <View style={styles.savingsBlock}>
              <View style={styles.savingsLabelRow}>
                <Text style={styles.savingsLabel}>Saved</Text>
                <Text style={styles.savingsAmount}>
                  {formatCurrency(total_savings_current)}
                  <Text style={styles.savingsTarget}> / {formatCurrency(total_savings_target)}</Text>
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(savings_progress, 100)}%`,
                      backgroundColor: goalMet ? colors.success : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* ───── TIER 4 — Quick Actions ───── */}
          {renderQuickActions()}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  // Header
  headerTitle: {
    ...typography.h3, fontWeight: '800',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRightSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shared card padding + generic glass card
  cardPad: {
    padding: spacing.xl,
  },
  card: {
    ...glassEffects.glass,
    marginBottom: spacing.md,
  },

  // Tier 1 — headline (the only floating card)
  headlineCard: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  headlineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  householdName: {
    ...typography.h3,
    color: colors.text,
    flexShrink: 1,
  },
  memberBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1a`,
  },
  memberBadgeText: {
    ...typography.smallBold,
    color: colors.text,
  },
  contextLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  hero: {
    ...typography.h1,
    marginTop: spacing.xs,
    minHeight: 40,
  },
  heroSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  partnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  partnerGlyph: {
    fontSize: 14,
  },
  partnerName: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Group labels (matches home dashboard)
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  groupLabelSkeleton: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  // Stat columns (Tier 2 & 3)
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  statValue: {
    ...typography.bodyBold,
    color: colors.text,
  },

  // Tier 2 — net line
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  netValue: {
    ...typography.h3,
  },

  // Tier 3 — savings bar
  savingsBlock: {
    gap: spacing.sm,
  },
  savingsLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  savingsAmount: {
    ...typography.caption,
    color: colors.text,
  },
  savingsTarget: {
    color: colors.textMuted,
  },
  progressTrack: {
    height: spacing.sm,
    backgroundColor: colors.glassLight,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // Tier 4 — quick actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionButton: {
    ...glassEffects.glass,
    flexGrow: 1,
    minWidth: '47%',
    minHeight: 64,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionLabel: {
    ...typography.smallBold,
    color: colors.text,
    textAlign: 'center',
  },

  // Empty state
  setupChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: `${colors.primary2}1a`,
  },
  setupChipText: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyBody: {
    ...typography.small,
    color: colors.text,
    marginTop: spacing.md,
  },
  primaryCta: {
    marginTop: spacing.lg,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  primaryCtaText: {
    ...typography.button,
    color: colors.text,
  },

  // Shared state card (empty "nothing yet" + error)
  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  stateTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  stateMessage: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  retryButton: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary2,
    backgroundColor: `${colors.primary2}33`,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
});
