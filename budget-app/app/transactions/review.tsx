import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/utils/apiClient';
import { aiCategorizeTransactions } from '@/utils/api';
import { getCurrentUser } from '@/utils/storage';
import CategoryPicker from '@/components/CategoryPicker';
import { successHaptic } from '@/utils/haptics';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
  commonStyles,
} from '@/utils/design-system';

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category_id?: string;
  category_name?: string;
  match_confidence?: string;
  user_verified?: boolean;
  date: string;
  source?: string;
};

/** 12% semantic tint suffix — the one documented "magic" value (see spec §9). */
const TINT = '1f';

type ConfidenceBadge = {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * Map confidence levels to an icon + word + tint triple so the review status
 * reads without relying on color alone (spec §6.2).
 */
function getConfidenceBadge(confidence?: string): ConfidenceBadge {
  switch (confidence) {
    case 'exact':
      return {
        label: 'Exact',
        color: colors.success,
        bg: `${colors.success}${TINT}`,
        icon: 'checkmark-circle',
      };
    case 'high':
      return {
        label: 'High',
        color: colors.success,
        bg: `${colors.success}${TINT}`,
        icon: 'checkmark-circle-outline',
      };
    case 'ai':
      return {
        label: 'AI',
        color: colors.primary2,
        bg: `${colors.primary2}${TINT}`,
        icon: 'sparkles',
      };
    case 'medium':
      return {
        label: 'Medium',
        color: colors.warning,
        bg: `${colors.warning}${TINT}`,
        icon: 'remove-circle-outline',
      };
    case 'low':
      return {
        label: 'Low',
        color: colors.error,
        bg: `${colors.error}${TINT}`,
        icon: 'alert-circle-outline',
      };
    default:
      return {
        label: 'Needs review',
        color: colors.textMuted,
        bg: colors.glassLight,
        icon: 'help-circle-outline',
      };
  }
}

/**
 * Determine an outline icon based on a category name heuristic. Outline glyphs
 * signal "not yet verified / ghosted" (spec §6.3).
 */
function getCategoryIcon(categoryName?: string): keyof typeof Ionicons.glyphMap {
  if (!categoryName) return 'pricetag-outline';
  const lower = categoryName.toLowerCase();
  if (lower.includes('food') || lower.includes('grocer') || lower.includes('restaurant')) return 'restaurant-outline';
  if (lower.includes('transport') || lower.includes('gas') || lower.includes('uber') || lower.includes('car')) return 'car-outline';
  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('game')) return 'film-outline';
  if (lower.includes('shopping') || lower.includes('amazon') || lower.includes('store')) return 'cart-outline';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharm')) return 'medkit-outline';
  if (lower.includes('rent') || lower.includes('home') || lower.includes('mortgage')) return 'home-outline';
  if (lower.includes('util') || lower.includes('electric') || lower.includes('water')) return 'flash-outline';
  if (lower.includes('salary') || lower.includes('income') || lower.includes('pay')) return 'cash-outline';
  if (lower.includes('subscription') || lower.includes('netflix') || lower.includes('spotify')) return 'play-outline';
  if (lower.includes('travel') || lower.includes('flight') || lower.includes('hotel')) return 'airplane-outline';
  return 'pricetag-outline';
}

const SWIPE_THRESHOLD = 80;

/** Swipeable row — right-swipe reveals a success "Confirm" background (spec §6.4). */
function SwipeableRow({
  children,
  onSwipeRight,
}: {
  children: React.ReactNode;
  onSwipeRight: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) {
          translateX.setValue(Math.min(gesture.dx, 100));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: 400,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onSwipeRight();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // The confirm surface fades in with swipe progress — full opacity only as
  // the gesture approaches commitment, so the green never pops at a 2px drag.
  const bgOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0.35, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeWrap}>
      {/* Background revealed on swipe */}
      <Animated.View style={[styles.swipeBg, { opacity: bgOpacity }]}>
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        <Text style={styles.swipeText}>Confirm</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

export default function TransactionReviewScreen() {
  const router = useRouter();
  // Optional filter — when navigated to from a budget category's "unverified" badge.
  const params = useLocalSearchParams<{ category_id?: string; category_name?: string }>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [userId, setUserId] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // In-scope set = matches the category filter (when present). Used for the
  // hero's progress math (total / done / left) per spec §10.
  const scopedTransactions = transactions.filter(
    (t) => !params.category_id || t.category_id === params.category_id,
  );

  const unverifiedTransactions = scopedTransactions.filter(
    (t) => !t.user_verified && t.match_confidence !== 'exact',
  );

  const totalInScope = scopedTransactions.length;
  const leftCount = unverifiedTransactions.length;
  const doneCount = Math.max(0, totalInScope - leftCount);
  const progress = totalInScope > 0 ? doneCount / totalInScope : 0;

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) {
      setLoading(false);
      setLoadedOnce(true);
      return;
    }
    setUserId(user.id);
    try {
      const data = await api.get<Transaction[]>('/auth/transactions', { user_id: user.id });
      const list = Array.isArray(data) ? data : [];
      setTransactions(
        list.map((t: any) => ({
          ...t,
          category_name: t.category_name ?? t.category ?? t.categoryName,
        })),
      );
      setError(false);
    } catch (e) {
      console.error('Failed to load transactions:', e);
      setError(true);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmTransaction = async (txId: string) => {
    setConfirming((prev) => new Set(prev).add(txId));
    try {
      await api.patch(`/auth/transactions/${txId}/verify`, { user_id: userId });
      successHaptic();
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, user_verified: true } : t)),
      );
    } catch (e) {
      console.error('Failed to confirm transaction:', e);
      Alert.alert('Error', 'Could not confirm transaction.');
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }
  };

  const confirmAll = async () => {
    setConfirmingAll(true);
    try {
      // One batch request — firing a request per transaction tripped the
      // API rate limiter (120/min) on large review queues.
      const ids = unverifiedTransactions.map((t) => t.id);
      await api.patch(`/auth/transactions/verify-batch`, {
        user_id: userId,
        transaction_ids: ids,
      });
      successHaptic();
      const idSet = new Set(ids);
      setTransactions((prev) =>
        prev.map((t) => (idSet.has(t.id) ? { ...t, user_verified: true } : t)),
      );
    } catch (e) {
      console.error('Failed to confirm all:', e);
      Alert.alert('Error', 'Could not confirm transactions. Please try again.');
    } finally {
      setConfirmingAll(false);
    }
  };

  const runAICategorize = async () => {
    if (aiCategorizing) return;
    setAiCategorizing(true);
    try {
      const res = await aiCategorizeTransactions();
      const applied = res?.applied ?? 0;
      const classified = res?.classified ?? 0;
      if (applied > 0) {
        successHaptic();
        Alert.alert(
          'AI Categorize',
          `Classified ${classified} merchant${classified !== 1 ? 's' : ''}, applied to ${applied} transaction${applied !== 1 ? 's' : ''}.`,
        );
        load();
      } else {
        Alert.alert('AI Categorize', 'No uncategorized transactions to classify.');
      }
    } catch (e) {
      console.error('AI categorize error:', e);
      Alert.alert('Error', 'AI categorization failed. Please try again.');
    } finally {
      setAiCategorizing(false);
    }
  };

  const openCategoryPicker = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setPickerVisible(true);
  };

  const handleCategorySelect = async (category: { id: string; name: string; parent_name?: string }) => {
    setPickerVisible(false);
    const txId = editingTxId;
    setEditingTxId(null);
    if (!txId) return;

    try {
      // Setting the category also learns a merchant rule and retroactively
      // re-categorizes the user's other unverified transactions from the
      // same merchant — all server-side.
      const res = await api.patch<{ retroactive_count?: number }>(
        `/auth/transactions/${txId}/category`,
        { user_id: userId, category_id: category.id },
      );
      successHaptic();
      const extra = res?.retroactive_count ?? 0;
      if (extra > 0) {
        Alert.alert(
          'Categorized',
          `Also auto-categorized ${extra} more ${extra === 1 ? 'transaction' : 'transactions'} from this merchant.`,
        );
      }
      // Refetch so the edited + retroactively-verified transactions drop off
      // the review queue.
      load();
    } catch (e) {
      console.error('Failed to update transaction category:', e);
      Alert.alert('Error', 'Could not update category.');
    }
  };

  // Group unverified transactions by date, newest first.
  const groupedByDate = unverifiedTransactions.reduce<Record<string, Transaction[]>>(
    (acc, tx) => {
      const dateKey = new Date(tx.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(tx);
      return acc;
    },
    {},
  );

  const sections = Object.entries(groupedByDate).sort(
    ([, a], [, b]) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime(),
  );

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const headerTitle = params.category_name
    ? `Review · ${params.category_name}`
    : 'Review transactions';

  const backTarget = () =>
    params.category_id ? router.back() : router.replace('/(tabs)/goals');

  const showSkeleton = loading && !loadedOnce;

  // ── Header (fixed, outside scroll) ──
  const renderHeader = () => (
    <View style={styles.headerRow}>
      <BackButton size={20} onPress={backTarget} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {headerTitle}
      </Text>
      <View style={styles.headerRight}>
        {loading && loadedOnce && <ActivityIndicator color={colors.primary2} size="small" />}
      </View>
    </View>
  );

  // ── Review Queue hero (glass floating) ──
  const renderHero = () => (
    <View
      style={styles.hero}
      accessible
      accessibilityLabel={`${leftCount} transactions to review, ${doneCount} of ${totalInScope} done.`}
    >
      <View style={commonStyles.flexBetween}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="checkmark-done-outline" size={14} color={colors.textMuted} />
          <Text style={styles.eyebrow} numberOfLines={1}>
            {params.category_name ? `Review · ${params.category_name}` : 'Needs your review'}
          </Text>
        </View>
        <Text style={styles.progressLabel}>
          {doneCount} of {totalInScope} done
        </Text>
      </View>

      <View style={styles.heroBlock}>
        <Text style={styles.heroNumber}>{leftCount}</Text>
        <Text style={styles.heroCaption}>
          {leftCount === 1 ? 'transaction to review' : 'transactions to review'}
        </Text>
      </View>

      {/* Thin progress bar */}
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={gradients.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
        />
      </View>

      {/* Bulk actions */}
      <View style={styles.bulkRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={confirmAll}
          disabled={confirmingAll || leftCount === 0}
          style={[styles.confirmAllWrap, (confirmingAll || leftCount === 0) && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={`Confirm all ${leftCount}`}
        >
          <LinearGradient
            colors={gradients.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.confirmAllBtn}
          >
            {confirmingAll ? (
              <>
                <ActivityIndicator size="small" color={colors.text} />
                <Text style={styles.confirmAllText}>Confirming…</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={colors.text} />
                <Text style={styles.confirmAllText}>Confirm all ({leftCount})</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={runAICategorize}
          disabled={aiCategorizing}
          style={[styles.aiBtn, aiCategorizing && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="AI categorize"
        >
          {aiCategorizing ? (
            <>
              <ActivityIndicator size="small" color={colors.primary2} />
              <Text style={styles.aiText}>Categorizing…</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color={colors.primary2} />
              <Text style={styles.aiText}>AI categorize</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Transaction review row ──
  const renderRow = (tx: Transaction) => {
    const badge = getConfidenceBadge(tx.match_confidence);
    const isConfirmingThis = confirming.has(tx.id);
    const isIncome = tx.type === 'income';
    const hasCategory = !!tx.category_name;
    const iconColor = isIncome ? colors.success : colors.primary2;

    return (
      <SwipeableRow key={tx.id} onSwipeRight={() => confirmTransaction(tx.id)}>
        <View style={[styles.txCard, isConfirmingThis && styles.txCardConfirming]}>
          <View style={styles.txRow}>
            {/* Category icon chip (outline = ghosted / unverified) */}
            <View style={[styles.txIconChip, { backgroundColor: `${iconColor}${TINT}` }]}>
              <Ionicons
                name={isIncome ? 'cash-outline' : getCategoryIcon(tx.category_name)}
                size={20}
                color={iconColor}
              />
            </View>

            {/* Center: merchant + category link + confidence chip */}
            <View style={styles.txCenter}>
              <Text
                style={[styles.txMerchant, !tx.note && styles.txMerchantMuted]}
                numberOfLines={1}
              >
                {tx.note || 'Unknown merchant'}
              </Text>
              <View style={styles.subRow}>
                <TouchableOpacity
                  onPress={() => openCategoryPicker(tx)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={styles.categoryLinkWrap}
                  accessibilityRole="button"
                  accessibilityLabel={`Category ${tx.category_name || 'Uncategorized'}, tap to change`}
                >
                  <Text
                    style={[styles.txCategory, !hasCategory && styles.txCategoryUncat]}
                    numberOfLines={1}
                  >
                    {tx.category_name || 'Uncategorized'} ›
                  </Text>
                </TouchableOpacity>
                <View style={[styles.confidenceChip, { backgroundColor: badge.bg }]}>
                  <Ionicons name={badge.icon} size={12} color={badge.color} />
                  <Text style={[styles.confidenceText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
            </View>

            {/* Right: amount + confirm button */}
            <View style={styles.txRight}>
              <Text
                style={[styles.txAmount, { color: isIncome ? colors.success : colors.error }]}
                numberOfLines={1}
              >
                {isIncome ? '+' : '−'}
                {formatCurrency(tx.amount)}
              </Text>
              <TouchableOpacity
                onPress={() => confirmTransaction(tx.id)}
                disabled={isConfirmingThis}
                style={styles.confirmBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Confirm transaction"
              >
                {isConfirmingThis ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SwipeableRow>
    );
  };

  // ── Loading skeleton ──
  const renderSkeleton = () => (
    <View style={styles.scrollPad}>
      <View style={styles.hero}>
        <View style={commonStyles.flexBetween}>
          <Skeleton width={110} height={14} borderRadius={radius.sm} />
          <Skeleton width={70} height={14} borderRadius={radius.sm} />
        </View>
        <Skeleton width={90} height={34} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
        <Skeleton width={160} height={14} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
        <Skeleton height={8} borderRadius={radius.full} style={{ marginTop: spacing.md }} />
        <View style={[styles.bulkRow, { marginTop: spacing.md }]}>
          <Skeleton height={44} borderRadius={radius.md} style={{ flex: 1 }} />
          <Skeleton height={44} borderRadius={radius.md} style={{ flex: 1 }} />
        </View>
      </View>

      <Skeleton width={90} height={12} borderRadius={radius.sm} style={{ marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.txCard, { marginBottom: spacing.sm }]}>
          <View style={styles.txRow}>
            <Skeleton width={40} height={40} borderRadius={radius.md} />
            <View style={styles.txCenter}>
              <Skeleton width="70%" height={15} borderRadius={radius.sm} />
              <Skeleton width="45%" height={12} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
            </View>
            <Skeleton width={70} height={15} borderRadius={radius.sm} />
          </View>
        </View>
      ))}
    </View>
  );

  // ── Empty (all caught up) ──
  const renderEmpty = () => {
    const filtered = !!params.category_id;
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="checkmark-done-outline" size={44} color={colors.success} />
        </View>
        <Text style={styles.emptyTitle}>
          {filtered ? `${params.category_name || 'This category'} is all reviewed` : 'All caught up!'}
        </Text>
        <Text style={styles.emptyBody}>
          Every transaction has been reviewed and verified.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => (filtered ? router.back() : router.replace('/(tabs)/goals'))}
          style={styles.ctaWrap}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={gradients.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{filtered ? 'Back' : 'Back to dashboard'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Error (inline glass card) ──
  const renderError = () => (
    <View style={styles.scrollPad}>
      <View style={styles.errorCard}>
        <View style={styles.errorIconCircle}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
        </View>
        <Text style={styles.emptyTitle}>Couldn&apos;t load your queue</Text>
        <Text style={styles.emptyBody}>
          We couldn&apos;t reach your transactions. Check your connection and try again.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            setLoading(true);
            setLoadedOnce(false);
            load();
          }}
          style={styles.ctaWrap}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={gradients.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.text} />
            <Text style={styles.ctaText}>Try again</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {renderHeader()}

        {showSkeleton ? (
          renderSkeleton()
        ) : error ? (
          renderError()
        ) : leftCount === 0 ? (
          renderEmpty()
        ) : (
          <FlatList
            data={sections}
            keyExtractor={([dateKey]) => dateKey}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ marginBottom: spacing.xl }}>{renderHero()}</View>
            }
            renderItem={({ item: [dateKey, txs] }) => (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.dateHeader}>{dateKey}</Text>
                {txs.map((tx) => renderRow(tx))}
              </View>
            )}
          />
        )}

        {/* Category Picker Modal */}
        <CategoryPicker
          visible={pickerVisible}
          onClose={() => {
            setPickerVisible(false);
            setEditingTxId(null);
          }}
          onSelect={handleCategorySelect}
          userId={userId}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ── Scroll / list ──
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  scrollPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // ── Hero ──
  hero: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroBlock: {
    marginTop: spacing.md,
  },
  heroNumber: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '800',
  },
  heroCaption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.glassLight,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  bulkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  confirmAllWrap: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  confirmAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  confirmAllText: {
    ...typography.button,
    color: colors.text,
    fontWeight: '700',
  },
  aiBtn: {
    flex: 1,
    ...glassEffects.glass,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  aiText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
  disabled: {
    opacity: 0.5,
  },

  // ── Date group label ──
  dateHeader: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  // ── Swipe row ──
  swipeWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  swipeBg: {
    ...StyleSheet.absoluteFillObject,
    // Deep green surface + bright green icon: the saturated hue lives on the
    // small mark, not the whole slab (design-system successDeep note).
    backgroundColor: colors.successDeep,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xl,
    gap: spacing.sm,
  },
  swipeText: {
    color: colors.text,
    ...typography.smallBold,
    fontWeight: '700',
  },

  // ── Transaction row ──
  txCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  txCardConfirming: {
    opacity: 0.6,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  txIconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txCenter: {
    flex: 1,
  },
  txMerchant: {
    ...typography.bodyBold,
    color: colors.text,
  },
  txMerchantMuted: {
    color: colors.textMuted,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryLinkWrap: {
    flexShrink: 1,
  },
  txCategory: {
    ...typography.small,
    color: colors.primary2,
    fontWeight: '600',
  },
  txCategoryUncat: {
    color: colors.warning,
  },
  confidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexShrink: 0,
  },
  confidenceText: {
    ...typography.caption,
    fontWeight: '700',
  },
  txRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  txAmount: {
    ...typography.bodyBold,
    fontWeight: '800',
  },
  confirmBtn: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state ──
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: `${colors.success}${TINT}`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // ── Error state ──
  errorCard: {
    ...glassEffects.glass,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: `${colors.error}${TINT}`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  // ── CTA button (shared by empty + error) ──
  ctaWrap: {
    marginTop: spacing.xl,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
    fontWeight: '700',
  },
});
