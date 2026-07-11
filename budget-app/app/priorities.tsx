import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import {
  colors,
  spacing,
  radius,
  typography,
  commonStyles,
} from '@/utils/design-system';

// ─── Model ──────────────────────────────────────────────────────
// Priorities is now a RANKING over the couple's real targets — their
// savings goals and debts. Each entry mirrors a live target; there is
// nothing to "add" here (targets come from Savings and Debts).
type TargetType = 'savings_goal' | 'debt';

type PriorityTarget = {
  target_id: string;
  target_type: TargetType;
  name: string;
  rank: number; // 0 = unranked
  current: number; // savings: current_amount
  target: number; // savings: target_amount
  target_date: string; // savings, may be ''
  balance: number; // debt: balance
  apr: number; // debt
  min_payment: number; // debt
  effective_monthly: number; // $/month flowing to this target from active plans
};

// Type-indicator metadata. Color is a *supporting* accent — the icon + label
// carry the meaning, so the distinction survives without color.
const TYPE_META: Record<
  TargetType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; accent: string; tint: string }
> = {
  savings_goal: {
    label: 'Savings goal',
    icon: 'flag',
    accent: colors.success,
    tint: 'rgba(34,197,94,0.12)', // colors.success @ 12%
  },
  debt: {
    label: 'Debt',
    icon: 'card',
    accent: colors.info,
    tint: 'rgba(59,130,246,0.12)', // colors.info @ 12%
  },
};

const DISABLED_OPACITY = 0.35;

const targetKey = (t: PriorityTarget) => `${t.target_type}:${t.target_id}`;

const formatCurrency = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`;

const formatDate = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export default function PrioritiesScreen() {
  const router = useRouter();
  const [targets, setTargets] = useState<PriorityTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPriorities = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) {
        setError('No user session found');
        return;
      }
      // Backend returns the list already sorted (ranked first, unranked last).
      const data = await api.get<PriorityTarget[]>('/auth/priorities', {
        user_id: userId,
      });
      setTargets(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error('Failed to load priorities:', e);
      setError('Failed to load priorities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPriorities();
  }, [loadPriorities]);

  useFocusEffect(
    useCallback(() => {
      loadPriorities();
    }, [loadPriorities]),
  );

  // Optimistically reorder locally, then persist the full new order.
  // The backend writes ranks 1..N in array order.
  const persistOrder = useCallback(async (ordered: PriorityTarget[]) => {
    try {
      const userId = await api.getUserId();
      if (!userId) throw new Error('No user session');
      await api.patch('/auth/priorities/reorder', {
        user_id: userId,
        order: ordered.map((t) => ({
          target_id: t.target_id,
          target_type: t.target_type,
        })),
      });
    } catch (e) {
      console.error('Reorder error:', e);
      // Re-sync from source of truth on failure.
      loadPriorities();
    }
  }, [loadPriorities]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= targets.length) return;

    const reordered = [...targets];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    // Reflect the new 1..N ranks locally so badges update immediately.
    const withRanks = reordered.map((t, i) => ({ ...t, rank: i + 1 }));
    setTargets(withRanks);
    persistOrder(withRanks);
  };

  // ── Header (static — renders in every state) ──
  const renderHeader = () => (
    <>
      <View style={styles.headerRow}>
        <BackButton fallback="/(tabs)/goals" />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Financial Priorities
        </Text>
        {/* Spacer to keep the title balanced with the back button. */}
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.contextStrip}>
        Rank your savings goals and debts so your money flows to what matters most first. Reorder
        with the arrows.
      </Text>
    </>
  );

  // ── Loading skeleton card (layout-matched to a real target card) ──
  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardRow}>
        <Skeleton width={40} height={40} borderRadius={radius.md} />
        <View style={styles.cardBody}>
          <Skeleton height={16} width="70%" />
          <View style={{ height: spacing.sm }} />
          <Skeleton height={12} width="45%" />
        </View>
      </View>
      <View style={commonStyles.divider} />
      <Skeleton height={12} width="40%" />
    </View>
  );

  const renderTargetCard = (t: PriorityTarget, index: number) => {
    const meta = TYPE_META[t.target_type];
    const isTop = index === 0;
    const upDisabled = index === 0;
    const downDisabled = index === targets.length - 1;
    const rank = index + 1;

    // Context line — goal shows progress (+ date); debt shows balance + APR.
    let contextText: string;
    if (t.target_type === 'savings_goal') {
      const dateLabel = formatDate(t.target_date);
      contextText =
        `${formatCurrency(t.current)} of ${formatCurrency(t.target)}` +
        (dateLabel ? ` · by ${dateLabel}` : '');
    } else {
      contextText = `${formatCurrency(t.balance)} balance · ${t.apr}% APR`;
    }

    // Effective monthly funding from active plans.
    const funded = t.effective_monthly > 0;
    const fundingText = funded
      ? `${formatCurrency(t.effective_monthly)}/mo from plans`
      : 'Not funded yet';

    const a11yLabel =
      `Priority ${rank}${isTop ? ', top priority' : ''}: ${t.name}, ${meta.label}. ` +
      `${contextText}. ${fundingText}.`;

    return (
      <View
        key={targetKey(t)}
        style={styles.card}
        accessible
        accessibilityLabel={a11yLabel}
      >
        <View style={styles.cardRow}>
          {/* Rank badge — number carries order; color is a supporting accent. */}
          <View style={[styles.rankBadge, { borderColor: meta.accent, backgroundColor: meta.tint }]}>
            <Text style={[styles.rankText, { color: meta.accent }]}>{rank}</Text>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {t.name}
              </Text>
              {isTop && (
                <View style={styles.topPill}>
                  <Ionicons name="star" size={11} color={colors.warning} />
                  <Text style={styles.topPillText}>TOP</Text>
                </View>
              )}
            </View>

            {/* Type indicator: icon + label + color (color-independent). */}
            <View style={styles.typeRow}>
              <View style={[styles.typeChip, { backgroundColor: meta.tint }]}>
                <Ionicons name={meta.icon} size={11} color={meta.accent} />
                <Text style={[styles.typeChipText, { color: meta.accent }]}>{meta.label}</Text>
              </View>
            </View>

            {/* Context — goal progress / debt balance. */}
            <Text style={styles.contextText} numberOfLines={2}>
              {contextText}
            </Text>
          </View>

          {/* Reorder control column */}
          <View style={styles.reorderCol}>
            <TouchableOpacity
              onPress={() => moveItem(index, 'up')}
              disabled={upDisabled}
              style={styles.reorderBtn}
              accessibilityRole="button"
              accessibilityLabel={`Move ${t.name} up`}
              accessibilityState={{ disabled: upDisabled }}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={upDisabled ? colors.textMuted : colors.text}
                style={upDisabled ? { opacity: DISABLED_OPACITY } : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveItem(index, 'down')}
              disabled={downDisabled}
              style={styles.reorderBtn}
              accessibilityRole="button"
              accessibilityLabel={`Move ${t.name} down`}
              accessibilityState={{ disabled: downDisabled }}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={downDisabled ? colors.textMuted : colors.text}
                style={downDisabled ? { opacity: DISABLED_OPACITY } : undefined}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={commonStyles.divider} />

        {/* Funding row — effective monthly $ flowing from active plans. */}
        <View style={styles.fundingRow}>
          <Ionicons
            name={funded ? 'trending-up' : 'remove-circle-outline'}
            size={14}
            color={funded ? colors.success : colors.textMuted}
          />
          <Text style={[styles.fundingText, !funded && styles.fundingMuted]}>{fundingText}</Text>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <ErrorState
          title="Couldn't load your priorities"
          message="Check your connection and try again."
          retryLabel="Retry"
          onRetry={() => {
            setError(null);
            setLoading(true);
            loadPriorities();
          }}
        />
      );
    }

    if (loading) {
      return (
        <View>
          {renderSkeletonCard(0)}
          {renderSkeletonCard(1)}
          {renderSkeletonCard(2)}
        </View>
      );
    }

    if (targets.length === 0) {
      return (
        <EmptyState
          icon="flag-outline"
          title="Nothing to rank yet"
          description="Add savings goals or debts to rank them. Your targets show up here automatically."
          actionLabel="Go to Goals"
          onAction={() => router.push('/(tabs)/goals')}
        />
      );
    }

    return <View>{targets.map((t, index) => renderTargetCard(t, index))}</View>;
  };

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {renderHeader()}
          <View style={styles.listWrap}>{renderContent()}</View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  contextStrip: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  listWrap: {
    marginTop: spacing.xl,
  },

  // Card
  card: {
    ...commonStyles.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    ...typography.smallBold,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 1,
  },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(234,179,8,0.12)', // colors.warning @ 12%
  },
  topPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.warning,
  },

  // Type indicator
  typeRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  typeChipText: {
    ...typography.caption,
    fontWeight: '700',
  },

  contextText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Reorder column
  reorderCol: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  reorderBtn: {
    width: 44,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Funding row
  fundingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  fundingText: {
    ...typography.smallBold,
    color: colors.success,
  },
  fundingMuted: {
    color: colors.textMuted,
    fontWeight: '400',
  },
});
