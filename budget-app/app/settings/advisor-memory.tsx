import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '@/components/GradientBackground';
import { BackButton } from '@/components/BackButton';
import { Skeleton, SkeletonStack } from '@/components/Skeleton';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';
import {
  fetchAdvisorMemories,
  deleteAdvisorMemory,
  type AdvisorMemory,
} from '../../utils/api';

// ── Types ──

type Scope = 'shared' | 'private';

type MemoryGroup = {
  title: string;
  scope: Scope;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  items: AdvisorMemory[];
};

// Semantic tint alphas appended to token colors (documented in the spec):
// ~12% for chip fills, ~8% for the destructive delete tint.
const TINT_12 = '1f';
const TINT_08 = '14';

// Scope → color-independent visual (icon + word + color).
const SCOPE_META: Record<
  Scope,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  shared: { icon: 'people-outline', color: colors.primary2 },
  private: { icon: 'lock-closed-outline', color: colors.info },
};

// ── MemoryIntroCard ──

function MemoryIntroCard({ count, loading }: { count: number; loading?: boolean }) {
  const countLabel =
    count === 0 ? 'Remembering nothing yet' : `Remembering ${count} thing${count === 1 ? '' : 's'} about you`;

  return (
    <View style={styles.introCard}>
      <View style={styles.introCountRow}>
        <Ionicons name="sparkles" size={18} color={colors.primary2} />
        {loading ? (
          <Skeleton width={140} height={14} borderRadius={radius.sm} />
        ) : (
          <Text style={styles.introCountText}>{countLabel}</Text>
        )}
      </View>
      <Text style={styles.introDescription}>
        Things your AI advisor remembers about you across conversations. It saves these as you
        chat — forget anything you don't want it to keep.
      </Text>
    </View>
  );
}

// ── MemoryGroupHeader ──

function MemoryGroupHeader({
  scope,
  title,
  subtitle,
  count,
}: {
  scope: Scope;
  title: string;
  subtitle: string;
  count: number;
}) {
  const meta = SCOPE_META[scope];
  return (
    <View
      style={styles.groupHeader}
      accessibilityRole="header"
      accessibilityLabel={`${title}, ${subtitle}, ${count} ${count === 1 ? 'memory' : 'memories'}`}
    >
      <View style={[styles.scopeChip, { backgroundColor: `${meta.color}${TINT_12}` }]}>
        <Ionicons name={meta.icon} size={14} color={meta.color} />
        <Text style={[styles.scopeChipText, { color: meta.color }]}>{title}</Text>
      </View>
      <Text style={styles.groupSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
      <View style={styles.groupCountBadge}>
        <Text style={styles.groupCountText}>{count}</Text>
      </View>
    </View>
  );
}

// ── MemoryCard ──

function MemoryCard({
  fact,
  onDelete,
  deleting = false,
}: {
  fact: string;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <View
      style={[styles.memoryCard, deleting && styles.memoryCardDeleting]}
      pointerEvents={deleting ? 'none' : 'auto'}
    >
      <Text style={styles.memoryText}>{fact}</Text>
      <TouchableOpacity
        onPress={onDelete}
        style={styles.deleteBtn}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Forget: ${fact}`}
        accessibilityHint="Removes this from what your advisor remembers"
      >
        <Ionicons name="trash-outline" size={16} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

// ── Loading skeleton (holds layout) ──

function MemorySkeletons() {
  return (
    <View>
      <View style={styles.groupHeader}>
        <Skeleton width={90} height={24} borderRadius={radius.full} />
        <View style={{ flex: 1 }} />
        <Skeleton width={28} height={20} borderRadius={radius.sm} />
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.memoryCard}>
          <View style={{ flex: 1 }}>
            <SkeletonStack count={2} height={12} gap={spacing.sm} />
          </View>
          <Skeleton width={32} height={32} borderRadius={radius.md} />
        </View>
      ))}
    </View>
  );
}

// ── Screen ──

export default function AdvisorMemoryScreen() {
  const [memories, setMemories] = useState<AdvisorMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await fetchAdvisorMemories();
      setMemories(Array.isArray(data?.memories) ? data.memories : []);
    } catch (err) {
      console.error('Error fetching advisor memories:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const performDelete = useCallback(async (mem: AdvisorMemory) => {
    // Optimistic removal, with position preserved for a truthful revert.
    let removedIndex = -1;
    setMemories((prev) => {
      removedIndex = prev.findIndex((m) => m.id === mem.id);
      return prev.filter((m) => m.id !== mem.id);
    });
    setDeletingId(mem.id);
    try {
      await deleteAdvisorMemory(mem.id);
    } catch (err) {
      console.error('Failed to delete memory:', err);
      // Revert: re-insert the removed item at its original position.
      setMemories((prev) => {
        if (prev.some((m) => m.id === mem.id)) return prev;
        const next = [...prev];
        const at = removedIndex >= 0 ? Math.min(removedIndex, next.length) : next.length;
        next.splice(at, 0, mem);
        return next;
      });
      Alert.alert('Error', 'Failed to forget this memory.');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDelete = useCallback(
    (mem: AdvisorMemory) => {
      Alert.alert('Forget this?', `The advisor will no longer remember:\n\n"${mem.fact}"`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: () => performDelete(mem),
        },
      ]);
    },
    [performDelete],
  );

  const groups: MemoryGroup[] = [
    {
      title: 'Shared',
      scope: 'shared',
      icon: SCOPE_META.shared.icon,
      subtitle: 'Both partners can see these',
      items: memories.filter((m) => m.scope === 'shared'),
    },
    {
      title: 'Private to you',
      scope: 'private',
      icon: SCOPE_META.private.icon,
      subtitle: 'Only you — never shown to your partner',
      items: memories.filter((m) => m.scope === 'private'),
    },
  ].filter((g) => g.items.length > 0);

  const isEmpty = !loading && !error && memories.length === 0;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Pinned detail header */}
        <View style={styles.headerRow}>
          <BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />
          <Text style={styles.headerTitle}>Advisor Memory</Text>
          <View style={styles.headerSpacer}>
            {refreshing && <ActivityIndicator color={colors.primary2} size="small" />}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
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
          <MemoryIntroCard count={memories.length} loading={loading || error} />

          {loading ? (
            <MemorySkeletons />
          ) : error ? (
            <View style={styles.stateCard}>
              <View style={[styles.stateIconCircle, { backgroundColor: `${colors.error}${TINT_12}` }]}>
                <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
              </View>
              <Text style={styles.stateTitle}>Couldn't load memory</Text>
              <Text style={styles.stateBody}>Check your connection and try again.</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={load}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <Ionicons name="refresh" size={18} color={colors.text} />
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : isEmpty ? (
            <View style={styles.stateCard}>
              <View style={[styles.stateIconCircle, { backgroundColor: `${colors.primary2}${TINT_12}` }]}>
                <Ionicons name="sparkles-outline" size={32} color={colors.textDark} />
              </View>
              <Text style={styles.stateTitle}>Nothing remembered yet</Text>
              <Text style={styles.stateBody}>
                As you chat with your advisor, it'll save important facts here.
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.scope} style={styles.groupSection}>
                <MemoryGroupHeader
                  scope={group.scope}
                  title={group.title}
                  subtitle={group.subtitle}
                  count={group.items.length}
                />
                {group.items.map((mem) => (
                  <MemoryCard
                    key={mem.id}
                    fact={mem.fact}
                    deleting={deletingId === mem.id}
                    onDelete={() => handleDelete(mem)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  // Pinned header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Intro card
  introCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  introCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  introCountText: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 1,
  },
  introDescription: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Group
  groupSection: {
    marginBottom: spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  scopeChipText: {
    ...typography.smallBold,
  },
  groupSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  groupCountBadge: {
    backgroundColor: colors.glassMedium,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    flexShrink: 0,
  },
  groupCountText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
  },

  // Memory card
  memoryCard: {
    ...glassEffects.glass,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  memoryCardDeleting: {
    opacity: 0.5,
  },
  memoryText: {
    flex: 1,
    ...typography.small,
    color: colors.text,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: `${colors.error}${TINT_08}`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Empty / Error shared card
  stateCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stateTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  stateBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}${TINT_12}`,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  retryBtnText: {
    ...typography.smallBold,
    color: colors.text,
  },
});
