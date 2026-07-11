import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { BackButton } from '@/components/BackButton';
import {
  colors,
  spacing,
  radius,
  glassEffects,
  typography,
  gradients,
  commonStyles,
  getValueColor,
} from '@/utils/design-system';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// §7.1 Palette-derived category fallback colors (token-only, never off-palette).
const CATEGORY_FALLBACK_COLORS = [
  colors.primary2,
  colors.info,
  colors.success,
  colors.warning,
  colors.accent,
  colors.error,
  colors.primary,
];

// Cap the visible category list (progressive-disclosure "+N more" not built in v1).
const MAX_CATEGORY_ROWS = 8;

type CategoryBreakdown = {
  name: string;
  color: string;
  amount: number;
  percent: number;
};

type DailySpend = {
  date: string;
  amount: number;
};

type InsightsData = {
  month: number;
  year: number;
  income: number;
  expenses: number;
  net: number;
  prev_income: number;
  prev_expenses: number;
  income_change: number;
  expense_change: number;
  categories: CategoryBreakdown[];
  daily_spending: DailySpend[];
};

type TrendKind = 'expense' | 'income' | 'net';

/**
 * Color-independent "vs last month" chip (§5.2). Direction is conveyed by
 * icon + word + color together — never color alone.
 * `hasPrior === false` renders the neutral "new" state to avoid Infinity%.
 */
function TrendChip({
  pct,
  kind,
  hasPrior = true,
  compact = false,
}: {
  pct: number;
  kind: TrendKind;
  hasPrior?: boolean;
  compact?: boolean;
}) {
  let icon: React.ComponentProps<typeof Ionicons>['name'];
  let word: string;
  let color: string;

  if (!hasPrior) {
    icon = 'remove';
    word = 'new';
    color = colors.textMuted;
  } else if (pct === 0) {
    icon = 'remove';
    word = 'flat';
    color = colors.textMuted;
  } else {
    const up = pct > 0;
    icon = up ? 'trending-up' : 'trending-down';
    if (kind === 'income' || kind === 'net') {
      // more income / higher net is good
      color = up ? colors.success : colors.error;
    } else {
      // more spending is worse
      color = up ? colors.error : colors.success;
    }
    word = `${Math.abs(pct).toFixed(1)}%`;
  }

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: `${color}1f` },
      ]}
    >
      <Ionicons name={icon} size={compact ? 11 : 13} color={color} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {word}
        {!compact ? ' vs last month' : ' vs last mo'}
      </Text>
    </View>
  );
}

export default function InsightsScreen() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const userId = await api.getUserId();
      if (!userId) return;
      const result = await api.get<InsightsData>('/auth/insights', {
        user_id: userId,
        month,
        year,
      });
      setData(result);
    } catch (e) {
      console.error('Failed to load insights:', e);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const monthLongLabel = `${MONTHS_LONG[month - 1]} ${year}`;

  // ─── Derived analytics (client-side, §12) ───
  const maxDaily = useMemo(
    () => (data ? Math.max(...data.daily_spending.map((d) => d.amount), 1) : 1),
    [data],
  );

  const chartBarWidth = useMemo(() => {
    if (!data || data.daily_spending.length === 0) return 4;
    const usable = SCREEN_WIDTH - spacing.lg * 2 - spacing.lg * 2;
    return Math.max(usable / data.daily_spending.length - 2, 2);
  }, [data]);

  const highestDay = useMemo(() => {
    if (!data || data.daily_spending.length === 0) return null;
    return data.daily_spending.reduce(
      (best, d) => (d.amount > best.amount ? d : best),
      data.daily_spending[0],
    );
  }, [data]);

  const daysWithData = useMemo(
    () => (data ? data.daily_spending.filter((d) => d.amount > 0).length : 0),
    [data],
  );

  const avgPerDay = useMemo(() => {
    if (!data) return 0;
    const denom = daysWithData || data.daily_spending.length || 1;
    return data.expenses / denom;
  }, [data, daysWithData]);

  // Net trend: derive from prev income/expenses; guard divide-by-zero (§12).
  const prevNet = data ? data.prev_income - data.prev_expenses : 0;
  const hasPriorMonth = !!data && (data.prev_income !== 0 || data.prev_expenses !== 0);
  const netChangePct =
    data && hasPriorMonth && prevNet !== 0 ? ((data.net - prevNet) / Math.abs(prevNet)) * 100 : 0;
  const netHasPrior = hasPriorMonth && prevNet !== 0;

  // Empty = fetch succeeded but nothing logged this month (§12).
  const isEmptyMonth =
    !!data &&
    data.income === 0 &&
    data.expenses === 0 &&
    data.daily_spending.every((d) => d.amount === 0);

  const netColor = data ? getValueColor(data.net) : colors.textMuted;
  const netIsZero = !!data && data.net === 0;

  const formatDayLabel = (dateStr: string) => {
    // dateStr === YYYY-MM-DD
    const parts = dateStr.split('-');
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return `${MONTHS[m - 1]} ${d}`;
  };

  const visibleCategories = data ? data.categories.slice(0, MAX_CATEGORY_ROWS) : [];

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <BackButton fallback="/(tabs)/dashboard" color={colors.text} />
            <Text style={styles.headerTitle}>Spending Insights</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Month selector — stable anchor across all states (§8) */}
          <View style={styles.monthSelector}>
            <TouchableOpacity
              onPress={prevMonth}
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.monthText} accessibilityLabel={monthLongLabel}>
              {MONTHS[month - 1]} {year}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ─── DATA REGION ─── header + selector always persist above this */}
          {error ? (
            <ErrorState
              title="Couldn't load insights"
              message="We couldn't reach your spending data."
              onRetry={loadInsights}
              onDismiss={() => setError(null)}
            />
          ) : loading ? (
            <LoadingSkeleton chartBarWidth={chartBarWidth} />
          ) : !data ? (
            <LoadingSkeleton chartBarWidth={chartBarWidth} />
          ) : isEmptyMonth ? (
            <EmptyMonth
              monthLabel={monthLongLabel}
              onAdd={() => router.push('/add-transaction')}
            />
          ) : (
            <>
              {/* ─── TIER 1: Month Summary headline (glassFloating) ─── */}
              <View
                style={styles.headlineCard}
                accessibilityLabel={
                  `Net this month, ${netIsZero ? 'zero' : data.net > 0 ? 'positive' : 'negative'} ${fmt(
                    Math.abs(data.net),
                  )}. Income ${fmt(data.income)}. Expenses ${fmt(data.expenses)}.`
                }
              >
                <Text style={styles.headlineLabel}>NET THIS MONTH</Text>
                <View style={styles.heroRow}>
                  <Text
                    style={[styles.heroValue, { color: netIsZero ? colors.textMuted : netColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {!netIsZero && data.net > 0 ? '+' : ''}
                    {fmt(data.net)}
                  </Text>
                  <TrendChip pct={netChangePct} kind="net" hasPrior={netHasPrior} />
                </View>

                <View style={commonStyles.divider} />

                <View style={styles.figureRow}>
                  {/* Income column */}
                  <View style={styles.figureCol}>
                    <View style={styles.figureLabelRow}>
                      <Ionicons name="arrow-up" size={12} color={colors.textMuted} />
                      <Text style={styles.figureLabel}>Income</Text>
                    </View>
                    <Text style={[styles.figureValue, { color: colors.success }]}>
                      {fmt(data.income)}
                    </Text>
                    <TrendChip pct={data.income_change} kind="income" hasPrior={hasPriorMonth} compact />
                  </View>

                  {/* Expenses column */}
                  <View style={styles.figureCol}>
                    <View style={styles.figureLabelRow}>
                      <Ionicons name="arrow-down" size={12} color={colors.textMuted} />
                      <Text style={styles.figureLabel}>Expenses</Text>
                    </View>
                    <Text style={[styles.figureValue, { color: colors.error }]}>
                      {fmt(data.expenses)}
                    </Text>
                    <TrendChip pct={data.expense_change} kind="expense" hasPrior={hasPriorMonth} compact />
                  </View>
                </View>
              </View>

              {/* ─── TIER 2: Daily Spending (glass) ─── */}
              <Text style={styles.groupLabel}>DAILY SPENDING</Text>
              <View style={styles.card}>
                {data.expenses === 0 ? (
                  <View style={styles.chartEmpty}>
                    <Text style={styles.emptyInline}>No spending days this month</Text>
                  </View>
                ) : (
                  <>
                    <View
                      style={styles.chartContainer}
                      accessibilityLabel={
                        highestDay
                          ? `Daily spending, average ${fmt(avgPerDay)} per day, highest on ${formatDayLabel(
                              highestDay.date,
                            )} at ${fmt(highestDay.amount)}.`
                          : 'Daily spending'
                      }
                    >
                      {data.daily_spending.map((d, i) => {
                        const h = maxDaily > 0 ? (d.amount / maxDaily) * 100 : 0;
                        const isPeak = highestDay ? d.date === highestDay.date && d.amount > 0 : false;
                        const isZero = d.amount === 0;
                        return (
                          <View
                            key={d.date}
                            style={styles.barWrapper}
                            importantForAccessibility="no-hide-descendants"
                            accessibilityElementsHidden
                          >
                            {isZero ? (
                              <View
                                style={[
                                  styles.barStub,
                                  { width: chartBarWidth },
                                ]}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.bar,
                                  {
                                    height: `${Math.max(h, 4)}%`,
                                    width: chartBarWidth,
                                    backgroundColor: isPeak ? colors.primary2 : colors.primary,
                                  },
                                ]}
                              />
                            )}
                            {(i === 0 ||
                              i === Math.floor(data.daily_spending.length / 2) ||
                              i === data.daily_spending.length - 1) && (
                              <Text style={styles.barLabel}>
                                {parseInt(d.date.split('-')[2], 10)}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>

                    <View style={commonStyles.divider} />

                    <View style={styles.chartFooter}>
                      <Text style={styles.footerText}>
                        <Text style={styles.footerValue}>Avg {fmt(avgPerDay)}</Text>
                        <Text style={styles.footerMuted}>/day</Text>
                      </Text>
                      {highestDay && (
                        <Text style={styles.footerText}>
                          <Text style={styles.footerMuted}>Highest </Text>
                          <Text style={styles.footerValue}>
                            {formatDayLabel(highestDay.date)} · {fmt(highestDay.amount)}
                          </Text>
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </View>

              {/* ─── TIER 3: By Category (glass) ─── */}
              <Text style={styles.groupLabel}>BY CATEGORY</Text>
              <View style={[styles.card, styles.lastCard]}>
                {visibleCategories.length === 0 ? (
                  <Text style={styles.emptyInline}>No expenses this month</Text>
                ) : (
                  visibleCategories.map((cat, i) => {
                    const color =
                      cat.color || CATEGORY_FALLBACK_COLORS[i % CATEGORY_FALLBACK_COLORS.length];
                    return (
                      <View
                        key={cat.name}
                        style={[styles.catRow, i === visibleCategories.length - 1 && styles.catRowLast]}
                        accessibilityLabel={`${cat.name}, ${fmt(cat.amount)}, ${cat.percent.toFixed(
                          0,
                        )} percent of spending.`}
                      >
                        <View style={[styles.catDot, { backgroundColor: color }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.catHeader}>
                            <Text style={styles.catName} numberOfLines={1}>
                              {cat.name}
                            </Text>
                            <View style={styles.catAmountWrap}>
                              <Text style={styles.catAmount}>{fmt(cat.amount)}</Text>
                              <Text style={styles.catPercent}>{cat.percent.toFixed(0)}%</Text>
                            </View>
                          </View>
                          <View style={styles.catBarTrack}>
                            <View
                              style={[
                                styles.catBarFill,
                                { width: `${Math.min(cat.percent, 100)}%`, backgroundColor: color },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/** Layout-matched loading state (§4.1) — never a bare spinner. */
function LoadingSkeleton({ chartBarWidth }: { chartBarWidth: number }) {
  const barCount = 24;
  return (
    <>
      {/* Headline shell (glassFloating) */}
      <View style={styles.headlineCard}>
        <Skeleton width={120} height={12} borderRadius={radius.sm} />
        <View style={[styles.heroRow, { marginTop: spacing.sm }]}>
          <Skeleton width={180} height={32} borderRadius={radius.sm} />
          <Skeleton width={96} height={16} borderRadius={radius.full} />
        </View>
        <View style={commonStyles.divider} />
        <View style={styles.figureRow}>
          <View style={styles.figureCol}>
            <Skeleton width={70} height={12} borderRadius={radius.sm} />
            <View style={{ height: spacing.xs }} />
            <Skeleton width={100} height={20} borderRadius={radius.sm} />
          </View>
          <View style={styles.figureCol}>
            <Skeleton width={70} height={12} borderRadius={radius.sm} />
            <View style={{ height: spacing.xs }} />
            <Skeleton width={100} height={20} borderRadius={radius.sm} />
          </View>
        </View>
      </View>

      {/* Daily spending shell */}
      <Text style={styles.groupLabel}>DAILY SPENDING</Text>
      <View style={styles.card}>
        <View style={styles.chartContainer}>
          {Array.from({ length: barCount }).map((_, i) => {
            const h = 30 + ((i * 37) % 70);
            return (
              <View key={i} style={styles.barWrapper}>
                <Skeleton
                  width={chartBarWidth}
                  height={Math.round((h / 100) * 120)}
                  borderRadius={radius.sm}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* Category shell */}
      <Text style={styles.groupLabel}>BY CATEGORY</Text>
      <View style={[styles.card, styles.lastCard]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={[styles.catRow, i === 3 && styles.catRowLast]}>
            <Skeleton width={10} height={10} borderRadius={radius.full} style={{ marginTop: spacing.xs }} />
            <View style={{ flex: 1 }}>
              <View style={styles.catHeader}>
                <Skeleton width={120} height={14} borderRadius={radius.sm} />
                <Skeleton width={48} height={14} borderRadius={radius.sm} />
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <Skeleton width={'100%'} height={6} borderRadius={radius.full} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

/** Empty-month state with CTA (§4.2). Distinct from error. */
function EmptyMonth({ monthLabel, onAdd }: { monthLabel: string; onAdd: () => void }) {
  return (
    <View style={[styles.card, styles.emptyCard]}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="bar-chart-outline" size={48} color={colors.textDark} />
      </View>
      <Text style={styles.emptyTitle}>No spending in {monthLabel}</Text>
      <Text style={styles.emptySubtext}>
        Nothing was logged this month. Add a transaction or pick another month to see your insights.
      </Text>
      <TouchableOpacity
        onPress={onAdd}
        activeOpacity={0.85}
        style={styles.ctaTouch}
        accessibilityRole="button"
        accessibilityLabel="Add a transaction"
      >
        <LinearGradient
          colors={gradients.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaGradient}
        >
          <Ionicons name="add" size={18} color={colors.text} />
          <Text style={styles.ctaText}>Add a transaction</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  monthText: {
    color: colors.text,
    ...typography.bodyBold,
  },

  // ─── Group labels (match dashboard THIS WEEK / RECENT ACTIVITY) ───
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  // ─── TIER 1 headline (glassFloating) ───
  headlineCard: {
    ...glassEffects.glassFloating,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  headlineLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroValue: {
    ...typography.h1,
    flexShrink: 1,
  },
  figureRow: {
    flexDirection: 'row',
  },
  figureCol: {
    flex: 1,
    gap: spacing.xs,
  },
  figureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  figureLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  figureValue: {
    ...typography.bodyBold,
  },

  // ─── Trend chip ───
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },

  // ─── Cards ───
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  lastCard: {
    marginBottom: 0,
  },

  // ─── Chart (TIER 2) ───
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 1,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    borderRadius: radius.sm,
    minHeight: 4,
  },
  barStub: {
    height: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glassMedium,
  },
  barLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  chartEmpty: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    ...typography.small,
  },
  footerValue: {
    ...typography.smallBold,
    color: colors.text,
  },
  footerMuted: {
    ...typography.small,
    color: colors.textMuted,
  },

  // ─── Category rows (TIER 3) ───
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  catRowLast: {
    marginBottom: 0,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  catName: {
    ...typography.smallBold,
    color: colors.text,
    flexShrink: 1,
  },
  catAmountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexShrink: 0,
  },
  catAmount: {
    ...typography.smallBold,
    color: colors.text,
  },
  catPercent: {
    ...typography.caption,
    color: colors.textMuted,
  },
  catBarTrack: {
    height: 6,
    backgroundColor: colors.borderGlass,
    borderRadius: radius.full,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // ─── Inline empties ───
  emptyInline: {
    ...typography.small,
    color: colors.textMuted,
  },

  // ─── Empty-month state (§4.2) ───
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconWrap: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  ctaTouch: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
  },
});
