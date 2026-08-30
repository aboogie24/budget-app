import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  commonStyles,
} from '@/utils/design-system';
import { Skeleton } from '@/components/Skeleton';

const BAR_TRACK_H = 64;

const compact = (v: number) => {
  if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(1) + 'k';
  return '$' + Math.round(v).toLocaleString('en-US');
};

type Props = {
  spentThisWeek: number;
  weeklyBudget: number;
  /** 7 values, Sunday-first (matches getWeeklySpending). */
  weeklyByDay: number[];
  /** 0-6 Sunday-first; today's bar gets a primary2 cap. */
  todayIndex: number;
  dayLabels: string[];
  budgetPercentUsed: number;
  savingsCurrent: number;
  savingsTarget: number;
  savingsProgressPercent: number;
  billsPaid: number;
  billsTotal: number;
  loading?: boolean;
  onBudgetPress?: () => void;
  onSavingsPress?: () => void;
  onBillsPress?: () => void;
};

/**
 * Tier 3 — the evidence behind the headline. ONE glass card under a single
 * "THIS WEEK" label: the weekly spend bar chart on top, an internal divider,
 * then a condensed Budget / Savings / Bills mini-row.
 */
export function ThisWeekProof({
  spentThisWeek,
  weeklyBudget,
  weeklyByDay,
  todayIndex,
  dayLabels,
  budgetPercentUsed,
  savingsCurrent,
  savingsTarget,
  savingsProgressPercent,
  billsPaid,
  billsTotal,
  loading,
  onBudgetPress,
  onSavingsPress,
  onBillsPress,
}: Props) {
  const hasBudget = weeklyBudget > 0;
  const overBudget = hasBudget && spentThisWeek > weeklyBudget;
  const deltaPct = hasBudget
    ? Math.abs(Math.round(((spentThisWeek - weeklyBudget) / weeklyBudget) * 100))
    : 0;
  const noData = !hasBudget && spentThisWeek === 0;

  const maxBar = Math.max(...weeklyByDay, 1);
  const dailyLimit = hasBudget ? weeklyBudget / 7 : 0;

  return (
    <View>
      <Text style={styles.groupLabel}>THIS WEEK</Text>
      <View style={styles.card}>
        {loading ? (
          <>
            <View style={styles.barChart}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} style={styles.barCol}>
                  <Skeleton width={20} height={20 + (i % 4) * 12} borderRadius={radius.sm} />
                </View>
              ))}
            </View>
            <View style={commonStyles.divider} />
            <View style={styles.miniRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.miniCol}>
                  <Skeleton width={54} height={12} />
                  <Skeleton width={40} height={14} style={{ marginTop: spacing.sm }} />
                </View>
              ))}
            </View>
          </>
        ) : noData ? (
          <Text style={styles.emptyText}>Nothing to show yet — this fills in as money moves.</Text>
        ) : (
          <>
            {/* ── Chart header ── */}
            <View style={styles.chartHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chartTitle}>Spent this week</Text>
                <Text style={styles.amounts}>
                  {compact(spentThisWeek)}
                  <Text style={styles.amountBudget}> / {compact(weeklyBudget)}</Text>
                </Text>
              </View>
              {hasBudget && (
                <View
                  style={[
                    styles.deltaBadge,
                    { backgroundColor: overBudget ? `${colors.error}1f` : `${colors.success}1f` },
                  ]}
                >
                  <Text
                    style={[styles.deltaText, { color: overBudget ? colors.error : colors.success }]}
                  >
                    {overBudget ? '▲' : '▼'} {deltaPct}% {overBudget ? 'over' : 'under'}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Bars ── */}
            <View
              style={styles.barChart}
              accessible
              accessibilityLabel={`Spent this week ${compact(spentThisWeek)} of ${compact(
                weeklyBudget,
              )}, ${deltaPct} percent ${overBudget ? 'over' : 'under'} budget.`}
            >
              {weeklyByDay.map((val, i) => {
                const isToday = i === todayIndex;
                const isOver = dailyLimit > 0 && val > dailyLimit;
                const fillH = val > 0 ? Math.max((val / maxBar) * BAR_TRACK_H, 5) : 0;
                const fillColor = isOver ? colors.warning : colors.primary;
                return (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      {fillH > 0 ? (
                        <>
                          <View style={[styles.bar, { height: fillH, backgroundColor: fillColor }]} />
                          {isToday && <View style={styles.todayCap} />}
                        </>
                      ) : isToday ? (
                        <View style={[styles.bar, { height: 5, backgroundColor: colors.primary2 }]} />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.dayLabel,
                        isToday && { color: colors.primary2, fontWeight: '700' },
                        i > todayIndex && { opacity: 0.45 },
                      ]}
                    >
                      {dayLabels[i]}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* ── Divider ── */}
            <View style={commonStyles.divider} />

            {/* ── Mini-row: Budget / Savings / Bills ── */}
            <View style={styles.miniRow}>
              <MiniColumn
                label="Budget"
                value={`${Math.round(budgetPercentUsed)}% used`}
                barPercent={budgetPercentUsed}
                barColor={budgetPercentUsed >= 100 ? colors.error : colors.primary}
                onPress={onBudgetPress}
                a11y={`Budget ${Math.round(budgetPercentUsed)} percent used.`}
              />
              <MiniColumn
                label="Savings"
                value={`${compact(savingsCurrent)} / ${compact(savingsTarget)}`}
                barPercent={savingsProgressPercent}
                barColor={colors.success}
                onPress={onSavingsPress}
                a11y={`Savings ${compact(savingsCurrent)} of ${compact(savingsTarget)}.`}
              />
              <MiniColumn
                label="Bills"
                value={`${billsPaid} / ${billsTotal}`}
                valueSuffix=" paid"
                onPress={onBillsPress}
                a11y={`Bills ${billsPaid} of ${billsTotal} paid.`}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function MiniColumn({
  label,
  value,
  valueSuffix,
  barPercent,
  barColor,
  onPress,
  a11y,
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  barPercent?: number;
  barColor?: string;
  onPress?: () => void;
  a11y?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.miniCol}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1}>
        {value}
        {valueSuffix ? <Text style={styles.miniSuffix}>{valueSuffix}</Text> : null}
      </Text>
      {barPercent != null && barColor ? (
        <View style={styles.miniBarTrack}>
          <View
            style={[
              styles.miniBarFill,
              { width: `${Math.max(0, Math.min(100, barPercent))}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      ) : (
        <View style={styles.miniBarSpacer} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chartTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  amounts: {
    ...typography.small,
    color: colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  amountBudget: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: '400',
  },
  deltaBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  deltaText: {
    ...typography.caption,
    fontWeight: '700',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  barTrack: {
    width: '100%',
    maxWidth: 26,
    height: BAR_TRACK_H,
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
  },
  todayCap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: colors.primary2,
  },
  dayLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  miniRow: {
    flexDirection: 'row',
  },
  miniCol: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  miniLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  miniValue: {
    ...typography.smallBold,
    color: colors.text,
  },
  miniSuffix: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '400',
  },
  miniBarTrack: {
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.glassLight,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: 3,
    borderRadius: radius.full,
  },
  miniBarSpacer: {
    height: 3,
  },
});

export default ThisWeekProof;
