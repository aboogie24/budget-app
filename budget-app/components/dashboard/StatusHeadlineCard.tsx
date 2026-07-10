import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
  getValueColor,
} from '@/utils/design-system';
import { Skeleton } from '@/components/Skeleton';

export type HeadlineStatus = 'good' | 'watch' | 'alert' | 'setup';

type StatusVisual = { color: string; icon: keyof typeof Ionicons.glyphMap; word: string };

const STATUS_VISUALS: Record<HeadlineStatus, StatusVisual> = {
  good: { color: colors.success, icon: 'checkmark-circle', word: 'GOOD' },
  watch: { color: colors.warning, icon: 'alert-circle', word: 'WATCH' },
  alert: { color: colors.error, icon: 'warning', word: 'ALERT' },
  setup: { color: colors.info, icon: 'information-circle', word: 'SET UP' },
};

const money = (v: number) =>
  '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type Props = {
  status: HeadlineStatus;
  headline: string;
  cashFlow: number;
  moneyIn?: number;
  moneyOut?: number;
  period?: string;
  /** Loading state — floating skeleton. */
  loading?: boolean;
  /** Status endpoint errored. Renders neutral (non-floating) but still shows the number. */
  errored?: boolean;
  onRetry?: () => void;
  /** Only used in 'setup' state — the Link-an-account CTA. */
  onCtaPress?: () => void;
};

/**
 * Tier 1 — the dashboard centerpiece. The ONLY card that floats and the ONLY
 * one that uses typography.h1. Renders a worst-signal-wins status chip, a warm
 * AI sentence, and one hero number (this-month cash flow, sign-colored).
 */
export function StatusHeadlineCard({
  status,
  headline,
  cashFlow,
  moneyIn,
  moneyOut,
  period = 'this month',
  loading,
  errored,
  onRetry,
  onCtaPress,
}: Props) {
  if (loading) {
    return (
      <View style={[styles.card, styles.floating]}>
        <Skeleton width={90} height={22} borderRadius={radius.full} />
        <Skeleton width="90%" height={14} style={{ marginTop: spacing.lg }} />
        <Skeleton width="70%" height={14} style={{ marginTop: spacing.sm }} />
        <Skeleton width={160} height={34} style={{ marginTop: spacing.xl }} />
        <Skeleton width={200} height={12} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  // ── Error state: neutral glass (NOT floating), still shows the number ──
  if (errored) {
    const heroColor = getValueColor(cashFlow);
    const sign = cashFlow >= 0 ? '+' : '−';
    return (
      <View style={styles.card}>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: `${colors.error}1f` }]}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={[styles.chipWord, { color: colors.error }]}>OFFLINE</Text>
          </View>
        </View>
        <Text style={styles.sentence} numberOfLines={3}>
          Couldn't load your status right now.
        </Text>
        <View style={styles.heroBlock}>
          <Text style={[styles.hero, { color: heroColor }]}>
            {sign}{money(cashFlow)}
          </Text>
          <Text style={styles.heroCaption}>Cash flow {period}</Text>
        </View>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const visual = STATUS_VISUALS[status];
  const isSetup = status === 'setup';
  const heroColor = getValueColor(cashFlow);
  const sign = cashFlow >= 0 ? '+' : '−';
  const a11yLabel = `Status: ${visual.word}. ${headline}. ${
    isSetup
      ? ''
      : `Cash flow ${period}, ${cashFlow >= 0 ? 'positive' : 'negative'} ${money(cashFlow)}.`
  }`;

  return (
    <View
      style={[styles.card, styles.floating, { borderLeftWidth: spacing.xs, borderLeftColor: visual.color }]}
      accessible
      accessibilityLabel={a11yLabel}
    >
      {/* status color wash across the top edge (~8%) */}
      <LinearGradient
        colors={[`${visual.color}14`, 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: `${visual.color}1f` }]}>
          <Ionicons name={visual.icon} size={14} color={visual.color} />
          <Text style={[styles.chipWord, { color: visual.color }]}>{visual.word}</Text>
        </View>
        {/* forward-compat period control — disabled-styled for v1 */}
        <View style={styles.periodControl}>
          <Text style={styles.periodText}>{period}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.textDark} />
        </View>
      </View>

      <Text style={styles.sentence} numberOfLines={3}>
        {headline}
      </Text>

      {isSetup ? (
        <TouchableOpacity activeOpacity={0.85} onPress={onCtaPress} style={styles.ctaWrap}>
          <LinearGradient
            colors={gradients.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Ionicons name="link-outline" size={16} color={colors.text} />
            <Text style={styles.ctaText}>Link an account</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.heroBlock}>
          <Text style={[styles.hero, { color: heroColor }]}>
            {sign}{money(cashFlow)}
          </Text>
          <Text style={styles.heroCaption}>
            Cash flow
            {moneyIn != null && moneyOut != null
              ? ` · ${money(moneyIn)} in − ${money(moneyOut)} out`
              : ` ${period}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassEffects.glass,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  floating: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  chipWord: {
    ...typography.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  periodControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    opacity: 0.5,
  },
  periodText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  sentence: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.lg,
  },
  heroBlock: {
    marginTop: spacing.xl,
    minHeight: 56,
  },
  hero: {
    ...typography.h1,
  },
  heroCaption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  ctaWrap: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
  },
  retry: {
    ...typography.smallBold,
    color: colors.primary2,
    marginTop: spacing.md,
  },
});

export default StatusHeadlineCard;
