import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import CategoryPicker from '@/components/CategoryPicker';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  getValueColor,
} from '@/utils/design-system';

type Tx = {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  note?: string;
  category_id?: string;
  category_name?: string;
  category?: string;
  date: string;
  source?: string;
};

// ─── Source badge tokens (see spec §5.4) ───
// Word + color + tint — never color alone (Bank & Plaid share colors.info).
function getSourceBadge(source?: string): { label: string; color: string } {
  switch (source) {
    case 'teller':
      return { label: 'Teller', color: colors.warning };
    case 'plaid':
      return { label: 'Plaid', color: colors.info };
    case 'flinks':
      return { label: 'Flinks', color: colors.success };
    case 'bank':
      return { label: 'Bank', color: colors.info };
    default:
      return { label: 'Manual', color: colors.textMuted };
  }
}

const money = (v: number) =>
  '$' +
  Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Signed money for the hero net: negative shows a leading "-".
const signedMoney = (v: number) => (v < 0 ? '-' : v > 0 ? '+' : '') + money(v);

// Clock time (grouped view — the day is redundant); fall back to short date.
const clockTime = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const hasTime = dt.getHours() !== 0 || dt.getMinutes() !== 0;
  return hasTime
    ? dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Group-header label from a local calendar day key.
const dayKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
};

const dayLabel = (d: string) => {
  const dt = new Date(d);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(dt, today)) return 'TODAY';
  if (same(dt, y)) return 'YESTERDAY';
  return dt
    .toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
};

// ─── Icon + a11y helpers ───
const iconFor = (t: Tx): keyof typeof Ionicons.glyphMap =>
  t.type === 'transfer' ? 'swap-horizontal' : t.type === 'income' ? 'trending-up' : 'card-outline';

const iconColorFor = (t: Tx): string =>
  t.type === 'transfer' ? colors.textMuted : t.type === 'income' ? colors.success : colors.primary2;

const amountColorFor = (t: Tx): string =>
  t.type === 'transfer'
    ? colors.textMuted
    : t.type === 'income'
      ? getValueColor(t.amount)
      : getValueColor(-t.amount);

const amountTextFor = (t: Tx): string =>
  (t.type === 'transfer' ? '' : t.type === 'income' ? '+' : '-') + money(t.amount);

export default function TransactionList() {
  const router = useRouter();
  // Optional filters — when navigated to from a budget category or a calendar day.
  const params = useLocalSearchParams<{
    category_id?: string;
    category_name?: string;
    date?: string; // YYYY-MM-DD — single-day filter (used by dashboard weekly bars)
  }>();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const hasFilter = !!(params.category_id || params.date);

  const headerTitle = params.category_name
    ? params.category_name
    : params.date
      ? new Date(params.date + 'T12:00:00').toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : 'All Transactions';

  const visible = useMemo(
    () =>
      transactions
        .filter((t) => {
          if (params.category_id && t.category_id !== params.category_id) return false;
          if (params.date) {
            // Compare local date components — transactions store timestamps but
            // we want a calendar-day match.
            const txDate = new Date(t.date);
            const [y, m, d] = params.date.split('-').map(Number);
            if (
              txDate.getFullYear() !== y ||
              txDate.getMonth() !== m - 1 ||
              txDate.getDate() !== d
            ) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions, params.category_id, params.date]
  );

  // ─── Headline summary (derive income / expense separately, net last). ───
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of visible) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount; // transfers excluded from net
    }
    const net = income - expense;
    const allExpense = income === 0 && expense > 0;
    let label = 'NET THIS LIST';
    if (params.category_id) label = allExpense ? 'SPENT IN THIS CATEGORY' : 'IN THIS CATEGORY';
    else if (params.date) label = 'ON THIS DAY';
    return { income, expense, net, allExpense, count: visible.length, label };
  }, [visible, params.category_id, params.date]);

  // Hero number + color. For an all-expense category filter show -total (error).
  const heroValue = summary.allExpense ? -summary.expense : summary.net;
  const heroColor =
    heroValue === 0 ? colors.textMuted : getValueColor(heroValue);

  // ─── Day-grouped sections. Suppressed group headers when a single-day filter. ───
  const sections = useMemo(() => {
    const buckets: { key: string; title: string; data: Tx[] }[] = [];
    const index = new Map<string, number>();
    for (const t of visible) {
      const k = dayKey(t.date);
      let i = index.get(k);
      if (i === undefined) {
        i = buckets.length;
        index.set(k, i);
        buckets.push({ key: k, title: dayLabel(t.date), data: [] });
      }
      buckets[i].data.push(t);
    }
    return buckets;
  }, [visible]);

  const suppressGroupHeaders = !!params.date;

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setUserId(user.id);
    setLoading(true);
    try {
      const data = await api.get(`/auth/transactions`, { user_id: user.id });
      const normalized = Array.isArray(data)
        ? data.map((t: any) => ({
            ...t,
            category_name: t.category_name ?? t.category ?? t.categoryName,
          }))
        : [];
      setTransactions(normalized);
      setError(null);
    } catch (e) {
      console.error('Failed to load transactions:', e);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /* Open the category picker for a transaction. */
  const openPicker = (txId: string) => {
    setEditingTxId(txId);
    setPickerVisible(true);
  };

  /* Assign the chosen category to the transaction being edited. */
  const handleCategorySelect = async (category: { id: string; name: string }) => {
    setPickerVisible(false);
    const txId = editingTxId;
    setEditingTxId(null);
    if (!txId) return;
    try {
      await api.patch(`/auth/transactions/${txId}/category`, {
        user_id: userId,
        category_id: category.id,
      });
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId ? { ...t, category_id: category.id, category_name: category.name } : t
        )
      );
    } catch (e) {
      console.error('Failed to update transaction category:', e);
      Alert.alert('Error', 'Could not update category.');
    }
  };

  const clearFilter = () => router.replace('/transaction/list');

  // ─── Header (rendered above the list in every state) ───
  const Header = (
    <View style={styles.headerRow}>
      <BackButton fallback="/(tabs)/budget" size={20} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {headerTitle}
      </Text>
      {loading && loadedOnce && !refreshing ? (
        <View style={styles.headerAction}>
          <ActivityIndicator size="small" color={colors.primary2} />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/transaction/add')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );

  const showSkeleton = !loadedOnce;

  // ─── Error (inline, header preserved) ───
  if (error && loadedOnce) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <View style={styles.bodyPad}>
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                load();
              }}
            />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {Header}

        {showSkeleton ? (
          <TransactionListSkeleton />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <TransactionListSummary
                label={summary.label}
                heroValue={heroValue}
                heroColor={heroColor}
                income={summary.income}
                expense={summary.expense}
                count={summary.count}
                filterLabel={
                  params.category_name
                    ? params.category_name
                    : params.date
                      ? headerTitle
                      : undefined
                }
                filterIsDate={!!params.date}
                onClearFilter={hasFilter ? clearFilter : undefined}
              />
            }
            renderSectionHeader={({ section }) =>
              suppressGroupHeaders ? null : (
                <Text style={styles.groupLabel}>{section.title}</Text>
              )
            }
            renderItem={({ item }) => (
              <TransactionRow
                tx={item}
                onPress={() =>
                  router.push({
                    pathname: '/transaction/[id]',
                    params: {
                      id: item.id,
                      type: item.type,
                      amount: String(item.amount),
                      note: item.note,
                      category_name: item.category_name || item.category,
                      date: item.date,
                      source: item.source,
                    },
                  })
                }
                onPressCategory={() => openPicker(item.id)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            SectionSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary2}
                colors={[colors.primary2]}
              />
            }
            ListEmptyComponent={
              <View style={styles.bodyPad}>
                <EmptyState
                  icon="receipt-outline"
                  title={
                    params.category_id
                      ? 'No transactions in this category'
                      : params.date
                        ? 'No transactions on this day'
                        : 'No transactions yet'
                  }
                  description={
                    params.category_id
                      ? 'Transactions assigned to this category will appear here'
                      : params.date
                        ? 'Transactions on this day will appear here'
                        : 'Your transactions will appear here once you add them'
                  }
                  actionLabel="Add Transaction"
                  onAction={() => router.push('/transaction/add')}
                />
              </View>
            }
          />
        )}

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

// ─── Headline summary card (§5.2) ───
function TransactionListSummary({
  label,
  heroValue,
  heroColor,
  income,
  expense,
  count,
  filterLabel,
  filterIsDate,
  onClearFilter,
}: {
  label: string;
  heroValue: number;
  heroColor: string;
  income: number;
  expense: number;
  count: number;
  filterLabel?: string;
  filterIsDate?: boolean;
  onClearFilter?: () => void;
}) {
  const a11y = `Net for this list ${signedMoney(heroValue)}. Income ${money(
    income
  )}, expenses ${money(expense)}, ${count} items.`;
  return (
    <View
      style={styles.summaryCard}
      accessibilityRole="summary"
      accessibilityLabel={a11y}
    >
      {onClearFilter && filterLabel ? (
        <TouchableOpacity
          style={styles.filterPill}
          onPress={onClearFilter}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`Filter ${filterLabel}. Double tap to clear.`}
        >
          <Ionicons
            name={filterIsDate ? 'calendar-outline' : 'pricetag'}
            size={12}
            color={colors.accent}
          />
          <Text style={styles.filterPillText} numberOfLines={1}>
            {filterLabel}
          </Text>
          <Ionicons name="close" size={14} color={colors.primary2} />
        </TouchableOpacity>
      ) : null}

      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryHero, { color: heroColor }]}>
        {signedMoney(heroValue)}
      </Text>

      <View style={styles.splitRow}>
        {income > 0 ? (
          <View style={styles.splitItem}>
            <Ionicons name="trending-up" size={12} color={colors.success} />
            <Text style={styles.splitText}>In {money(income)}</Text>
          </View>
        ) : null}
        {income > 0 && expense > 0 ? <Text style={styles.splitDot}>·</Text> : null}
        {expense > 0 ? (
          <View style={styles.splitItem}>
            <Ionicons name="trending-down" size={12} color={colors.error} />
            <Text style={styles.splitText}>Out {money(expense)}</Text>
          </View>
        ) : null}
        {(income > 0 || expense > 0) ? <Text style={styles.splitDot}>·</Text> : null}
        <Text style={[styles.splitText, { color: colors.textMuted }]}>{count} items</Text>
      </View>
    </View>
  );
}

// ─── Transaction row (§5.4) ───
function TransactionRow({
  tx,
  onPress,
  onPressCategory,
}: {
  tx: Tx;
  onPress: () => void;
  onPressCategory: () => void;
}) {
  const iconColor = iconColorFor(tx);
  const hasCategory = !!tx.category_name;
  const title = tx.note || tx.category_name || 'Transaction';
  const badge = getSourceBadge(tx.source);
  const dir = tx.type === 'transfer' ? 'transfer' : tx.type === 'income' ? 'income' : 'expense';
  const a11y = `${title}, ${dir} ${money(tx.amount)}, ${
    hasCategory ? tx.category_name : 'no category'
  }, ${clockTime(tx.date)}, via ${badge.label}.`;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      {/* Top row: icon + title + amount */}
      <View style={styles.rowTop}>
        <View style={[styles.iconChip, { backgroundColor: `${iconColor}1f` }]}>
          <Ionicons name={iconFor(tx)} size={16} color={iconColor} />
        </View>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowAmount, { color: amountColorFor(tx) }]}>
          {amountTextFor(tx)}
        </Text>
      </View>

      {/* Bottom row: category chip + time + source */}
      <View style={styles.rowBottom}>
        <TouchableOpacity
          style={[styles.categoryChip, !hasCategory && styles.categoryChipUnset]}
          onPress={onPressCategory}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={
            hasCategory
              ? `Category ${tx.category_name}, double tap to change`
              : 'No category, double tap to set.'
          }
        >
          <Ionicons name="pricetag" size={11} color={hasCategory ? colors.accent : colors.textMuted} />
          <Text
            style={[styles.categoryChipText, !hasCategory && { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {tx.category_name || 'Set category'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={10}
            color={hasCategory ? colors.primary2 : colors.textMuted}
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <View style={styles.timeWrap}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.timeText}>{clockTime(tx.date)}</Text>
        </View>

        <View style={[styles.sourceBadge, { backgroundColor: `${badge.color}1f` }]}>
          <Text style={[styles.sourceText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Loading skeleton (§5.6) — geometry mirrors the real row. ───
function TransactionListSkeleton() {
  return (
    <View style={styles.listContent}>
      {/* Headline shell */}
      <View style={[styles.summaryCard, { gap: spacing.sm }]}>
        <Skeleton width={90} height={12} />
        <Skeleton width={160} height={28} />
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
          <Skeleton width={70} height={12} />
          <Skeleton width={70} height={12} />
          <Skeleton width={50} height={12} />
        </View>
      </View>

      {/* Group label */}
      <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <Skeleton width={70} height={12} />
      </View>

      {/* 4 skeleton rows */}
      <View style={{ gap: spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.row}>
            <View style={styles.rowTop}>
              <Skeleton width={36} height={36} borderRadius={radius.md} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Skeleton width="60%" height={12} />
                <Skeleton width="40%" height={10} />
              </View>
              <Skeleton width={60} height={14} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Layout
  bodyPad: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },

  // Summary card
  summaryCard: {
    ...glassEffects.glassFloating,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary2}1f`,
    borderWidth: 1,
    borderColor: `${colors.primary2}3d`,
    marginBottom: spacing.md,
    maxWidth: '100%',
  },
  filterPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  summaryHero: {
    ...typography.h2,
    marginTop: spacing.xs,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  splitText: {
    ...typography.caption,
    color: colors.text,
  },
  splitDot: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Group label
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Row
  row: {
    ...glassEffects.glass,
    padding: spacing.md,
    borderRadius: radius.lg,
    minHeight: 64,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowTitle: {
    ...typography.smallBold,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  rowAmount: {
    ...typography.smallBold,
    flexShrink: 0,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // Category chip
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: `${colors.primary2}1f`,
    borderWidth: 1,
    borderColor: `${colors.primary2}3d`,
    maxWidth: 180,
  },
  categoryChipUnset: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
  },
  categoryChipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },

  // Time
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  timeText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Source badge
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  sourceText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
