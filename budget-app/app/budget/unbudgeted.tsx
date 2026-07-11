import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from '@/utils/design-system';

/* ─── Types ─── */
type Transaction = {
  id: string;
  amount: number;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  parent_category_id?: string;
  parent_category_name?: string;
  parent_category_color?: string;
};

type BudgetSummaryCategory = {
  id: string;
  name: string;
};

type BudgetSummaryItem = {
  categories: BudgetSummaryCategory[];
};

type SummaryResponse = {
  budgets: BudgetSummaryItem[];
};

type UnbudgetedGroup = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  total: number;
  subcategories: {
    id: string;
    name: string;
    color: string;
    total: number;
    count: number;
  }[];
};

/* ─── Helpers ─── */
const fmt = (n: number) =>
  '$' +
  Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Semantic tint helpers (12% / 20% opacity) — the one documented literal exception.
const tint12 = (hex: string) => `${hex}1f`;
const tint20 = (hex: string) => `${hex}33`;

/* ─── Sub-components (screen-local, no new files needed) ─── */

// A spinning refresh icon used ONLY in the header for background refresh.
function HeaderRefresh({ spinning, onPress }: { spinning: boolean; onPress: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (spinning) {
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => {
        loop.stop();
        spin.setValue(0);
      };
    }
    spin.setValue(0);
  }, [spinning, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.refreshBtn}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Refresh unbudgeted spending"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="refresh" size={20} color={colors.textMuted} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// "No budget" status pill — icon + word + color (never color-only).
function NoBudgetPill() {
  return (
    <View style={styles.pill}>
      <Ionicons name="alert-circle" size={12} color={colors.warning} />
      <Text style={styles.pillText}>No budget</Text>
    </View>
  );
}

export default function UnbudgetedScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [groups, setGroups] = useState<UnbudgetedGroup[]>([]);

  const loadData = useCallback(async () => {
    setError(false);
    const user = await getCurrentUser();
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const [summaryData, txData] = await Promise.all([
        api.get<SummaryResponse>(`/auth/budgets/user/${user.id}/summary`, { month, year }),
        api.get<Transaction[]>(`/auth/transactions`, {
          user_id: user.id,
          month,
          year,
        }),
      ]);

      // Collect all budgeted category IDs
      const budgetedIds = new Set<string>();
      const budgets = (summaryData as SummaryResponse)?.budgets ?? [];
      for (const b of budgets) {
        for (const c of b.categories ?? []) {
          budgetedIds.add(c.id);
        }
      }

      // Filter transactions to those whose category is NOT budgeted
      const transactions = Array.isArray(txData) ? txData : [];
      const unbudgeted = transactions.filter(
        (tx) => tx.category_id && !budgetedIds.has(tx.category_id)
      );

      // Group by parent category (or by category itself if no parent)
      const parentMap = new Map<string, UnbudgetedGroup>();

      for (const tx of unbudgeted) {
        const parentId = tx.parent_category_id || tx.category_id || 'unknown';
        const parentName = tx.parent_category_name || tx.category_name || 'Uncategorized';
        const parentColor = tx.parent_category_color || tx.category_color || colors.primary2;

        if (!parentMap.has(parentId)) {
          parentMap.set(parentId, {
            id: parentId,
            name: parentName,
            color: parentColor,
            total: 0,
            subcategories: [],
          });
        }

        const group = parentMap.get(parentId)!;
        group.total += Math.abs(tx.amount);

        // Track subcategories
        const catId = tx.category_id || 'unknown';
        const catName = tx.category_name || 'Unknown';
        const catColor = tx.category_color || parentColor;

        let sub = group.subcategories.find((s) => s.id === catId);
        if (!sub) {
          sub = { id: catId, name: catName, color: catColor, total: 0, count: 0 };
          group.subcategories.push(sub);
        }
        sub.total += Math.abs(tx.amount);
        sub.count += 1;
      }

      const sorted = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);
      setGroups(sorted);
    } catch (err) {
      console.error('Failed to load unbudgeted data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Derived headline total.
  const grandTotal = useMemo(
    () => groups.reduce((s, g) => s + g.total, 0),
    [groups],
  );

  const groupCount = groups.length;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header (fixed, outside ScrollView) */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/budget" iconName="chevron-back" size={20} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Unbudgeted Spending
          </Text>
          <HeaderRefresh spinning={refreshing} onPress={onRefresh} />
        </View>

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
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorCard onRetry={loadData} />
          ) : groups.length === 0 ? (
            <EmptyCard />
          ) : (
            <>
              {/* TIER 1 — Headline */}
              <View
                style={styles.headlineCard}
                accessible
                accessibilityLabel={`Unbudgeted this month, ${fmt(grandTotal)}. ${groupCount} categor${
                  groupCount === 1 ? 'y' : 'ies'
                } have spending but no budget.`}
              >
                <Text style={styles.heroTotal}>{fmt(grandTotal)}</Text>
                <Text style={styles.heroCaption}>unbudgeted this month</Text>
                <View style={styles.statusLine}>
                  <Ionicons name="alert-circle" size={14} color={colors.warning} />
                  <Text style={styles.statusText}>
                    {groupCount} categor{groupCount === 1 ? 'y' : 'ies'} have spending but no budget
                  </Text>
                </View>
              </View>

              {/* TIER 2 — Group label */}
              <View style={styles.groupLabelRow}>
                <Text style={styles.groupLabel}>BY CATEGORY</Text>
                <Text style={styles.groupLabel}>
                  {groupCount} group{groupCount === 1 ? '' : 's'}
                </Text>
              </View>

              {/* TIER 2 — Group cards */}
              {groups.map((group) => {
                const count = group.subcategories.reduce((s, c) => s + c.count, 0);
                const showSubs = group.subcategories.length > 1;
                return (
                  <View
                    key={group.id}
                    style={styles.groupCard}
                    accessible
                    accessibilityLabel={`${group.name}, ${fmt(group.total)}, ${count} transaction${
                      count === 1 ? '' : 's'
                    }, no budget.`}
                  >
                    {/* Header row */}
                    <View style={styles.groupHeaderRow}>
                      <View
                        style={[styles.iconChip, { backgroundColor: tint12(group.color) }]}
                      >
                        <Ionicons name="pricetag" size={18} color={group.color} />
                      </View>
                      <View style={styles.groupNameCol}>
                        <Text style={styles.groupName} numberOfLines={1}>
                          {group.name}
                        </Text>
                        <View style={styles.metaRow}>
                          <Text style={styles.metaText}>
                            {count} transaction{count === 1 ? '' : 's'}
                          </Text>
                          <NoBudgetPill />
                        </View>
                      </View>
                      <Text style={styles.groupAmount}>{fmt(group.total)}</Text>
                    </View>

                    {/* Sub-rows (only when > 1 subcategory) */}
                    {showSubs && (
                      <>
                        <View style={commonStyles.divider} />
                        {group.subcategories.map((sub) => (
                          <View key={sub.id} style={styles.subRow}>
                            <Text style={styles.subName} numberOfLines={1}>
                              {sub.name}
                            </Text>
                            <View style={styles.subRight}>
                              <Text style={styles.subCount}>{sub.count} ·</Text>
                              <Text style={styles.subAmount}>{fmt(sub.total)}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    )}

                    {/* Create Budget CTA */}
                    <TouchableOpacity
                      style={styles.cta}
                      onPress={() =>
                        router.push({
                          pathname: '/budget/add-budget',
                          params: {
                            prefill_category_id: group.id,
                            prefill_name: group.name,
                          },
                        } as any)
                      }
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityHint={`Creates a budget for ${group.name}`}
                    >
                      <Ionicons name="add-circle" size={16} color={colors.primary2} />
                      <Text style={styles.ctaText}>Create budget</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ─── State renderers ─── */

function LoadingState() {
  return (
    <>
      {/* Headline shell */}
      <View style={styles.headlineCard}>
        <Skeleton width={140} height={28} borderRadius={radius.sm} />
        <Skeleton width={180} height={12} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
        <Skeleton width={220} height={12} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
      </View>

      {/* Group label skeleton */}
      <View style={styles.groupLabelRow}>
        <Skeleton width={90} height={12} borderRadius={radius.sm} />
      </View>

      {/* Card skeletons */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.groupCard}>
          <View style={styles.groupHeaderRow}>
            <Skeleton width={40} height={40} borderRadius={radius.md} />
            <View style={styles.groupNameCol}>
              <Skeleton width={120} height={14} borderRadius={radius.sm} />
              <Skeleton
                width={80}
                height={12}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.xs }}
              />
            </View>
            <Skeleton width={64} height={16} borderRadius={radius.sm} />
          </View>
          <Skeleton
            width="100%"
            height={40}
            borderRadius={radius.md}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ))}
    </>
  );
}

function EmptyCard() {
  return (
    <View style={styles.stateCard}>
      <View style={[styles.stateIconChip, { backgroundColor: tint12(colors.success) }]}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
      </View>
      <Text style={styles.stateTitle}>All spending is budgeted</Text>
      <Text style={styles.stateBody}>
        Every category with transactions this month has a budget assigned.
      </Text>
    </View>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.stateCard}>
      <View style={[styles.stateIconChipSm, { backgroundColor: tint12(colors.error) }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
      </View>
      <Text style={styles.stateTitle}>Couldn&apos;t load unbudgeted spending</Text>
      <Text style={styles.stateBody}>Check your connection and try again.</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={onRetry}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },

  /* TIER 1 — Headline */
  headlineCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  heroTotal: {
    ...typography.h2,
    color: colors.text,
  },
  heroCaption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  statusText: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
  },

  /* Group label */
  groupLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },

  /* TIER 2 — Group card */
  groupCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameCol: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  groupAmount: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 0,
  },

  /* No budget pill */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: tint12(colors.warning),
  },
  pillText: {
    ...typography.caption,
    color: colors.warning,
  },

  /* Sub-rows */
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  subName: {
    ...typography.small,
    color: colors.textMuted,
    flex: 1,
  },
  subRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  subCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subAmount: {
    ...typography.smallBold,
    color: colors.textMuted,
  },

  /* CTA */
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: tint12(colors.primary2),
    borderWidth: 1,
    borderColor: tint20(colors.primary2),
  },
  ctaText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  /* Empty / Error state cards */
  stateCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  stateIconChip: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stateIconChipSm: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stateTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stateBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  retryBtn: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: tint12(colors.primary2),
    borderWidth: 1,
    borderColor: tint20(colors.primary2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
});
