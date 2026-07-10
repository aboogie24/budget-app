import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  getValueColor,
} from '@/utils/design-system';
import { Skeleton } from '@/components/Skeleton';
import { Sparkline } from '@/components/Sparkline';
import type { NetWorthSnapshotPoint } from '@/utils/api';

const money = (v: number) =>
  '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type Props = {
  netWorth: number;
  netWorthDeltaPercent?: number | null;
  netWorthHistory?: NetWorthSnapshotPoint[];
  level: number;
  levelName: string;
  progressPercent: number;
  loading?: boolean;
  onPress?: () => void;
};

/**
 * Tier 4 — the condensed "over time" view. Compresses net worth + framework
 * level into ONE horizontal glass row split by a center divider.
 */
export function TrajectoryStrip({
  netWorth,
  netWorthDeltaPercent,
  netWorthHistory = [],
  level,
  levelName,
  progressPercent,
  loading,
  onPress,
}: Props) {
  if (loading) {
    return (
      <View style={styles.strip}>
        <Skeleton width="100%" height={20} borderRadius={radius.sm} />
      </View>
    );
  }

  const hasDelta = netWorthDeltaPercent != null && Number.isFinite(netWorthDeltaPercent);
  const deltaColor = hasDelta ? getValueColor(netWorthDeltaPercent as number) : colors.textMuted;
  const historyValues = netWorthHistory.map((p) => p.total);
  const a11y = `Net worth ${money(netWorth)}${
    hasDelta
      ? `, ${(netWorthDeltaPercent as number) >= 0 ? 'up' : 'down'} ${Math.abs(
          netWorthDeltaPercent as number,
        )} percent`
      : ''
  }. Level ${level}, ${levelName}, ${Math.round(progressPercent)} percent.`;

  return (
    <TouchableOpacity
      style={styles.strip}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Double tap to view progress details"
    >
      {/* ── Left: Net worth ── */}
      <View style={styles.left}>
        <Text style={styles.label}>Net worth</Text>
        <View style={styles.valueRow}>
          <Text style={styles.value} numberOfLines={1}>
            {netWorth < 0 ? '−' : ''}{money(netWorth)}
          </Text>
          {hasDelta && (
            <Text style={[styles.delta, { color: deltaColor }]}>
              {(netWorthDeltaPercent as number) >= 0 ? '▲' : '▼'}
              {Math.abs(netWorthDeltaPercent as number)}%
            </Text>
          )}
          {historyValues.length >= 2 && (
            <View style={styles.spark}>
              <Sparkline values={historyValues} width={48} height={20} color={colors.primary2} autoColor={false} />
            </View>
          )}
        </View>
      </View>

      {/* ── Center divider ── */}
      <View style={styles.divider} />

      {/* ── Right: Framework level ── */}
      <View style={styles.right}>
        <Text style={styles.levelLabel} numberOfLines={1}>
          <Text style={styles.levelNumber}>L{level} </Text>
          {levelName}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(100, progressPercent))}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progressPercent)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  left: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 0,
  },
  delta: {
    ...typography.caption,
    fontWeight: '700',
    flexShrink: 0,
  },
  spark: {
    width: 48,
    height: 20,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.borderGlass,
    marginHorizontal: spacing.md,
  },
  right: {
    flex: 1,
    gap: spacing.xs,
  },
  levelLabel: {
    ...typography.smallBold,
    color: colors.text,
  },
  levelNumber: {
    ...typography.smallBold,
    color: colors.text,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.glassLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  progressText: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
  },
});

export default TrajectoryStrip;
