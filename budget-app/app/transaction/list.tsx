import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/utils/apiClient';
import { aiCategorizeTransactions } from '@/utils/api';
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
    case 'simplefin':
      return { label: 'SimpleFIN', color: colors.primary2 };
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

// True when the stored value is a bare date or a UTC-midnight timestamp — i.e.
// a pure calendar date with no real time-of-day (Teller/manual rows).
const isDateOnly = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) || /T00:00(:00)?(\.0+)?(Z|\+00:00)?$/.test(d);

// The calendar day a transaction belongs to. Two semantics coexist in the DB:
// • date-only rows ("…T00:00:00Z") — the date PART is the day; rendering the
//   instant locally would shift it back a day (Jul 7 → "Monday, Jul 6").
// • real instants (bill payments record the payment moment) — the LOCAL day is
//   the day; taking the UTC date part would push an 11 PM Friday payment onto
//   Saturday.
const txDay = (d: string): Date => {
  if (isDateOnly(d)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)!;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? new Date(NaN) : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

// Clock time (grouped view — the day is redundant); fall back to short date.
// A UTC-midnight date must NOT be shown as a local clock time — that fabricates
// "8:00 PM" out of a dateless transaction.
const clockTime = (d: string) => {
  if (isDateOnly(d)) {
    const dt = txDay(d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// Group-header key from the transaction's calendar day (same semantics as txDay).
const dayKey = (d: string) => {
  const dt = txDay(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const dayLabel = (d: string) => {
  const dt = txDay(d);
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
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [serverTotals, setServerTotals] = useState({ income: 0, expense: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  // Toggle, not part of the type segment — combines with type and search
  // ("uncategorized expenses" is a real query).
  const [uncatOnly, setUncatOnly] = useState(false);

  // Server search fires on the debounced value so we don't hit the API per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const hasFilter = !!(params.category_id || params.date);
  const searching = debouncedQuery.length > 0 || typeFilter !== 'all' || uncatOnly;

  const headerTitle = params.category_name
    ? params.category_name
    : params.date
      ? new Date(params.date + 'T12:00:00').toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : 'All Transactions';

  // Filtering, search, and sort all happen server-side now; the loaded pages
  // arrive in final order.
  const visible = transactions;

  // ─── Headline summary — from the server's full-filtered-set aggregates, so
  // the numbers cover ALL matches, not just the pages loaded so far. ───
  const summary = useMemo(() => {
    const income = serverTotals.income;
    const expense = serverTotals.expense;
    const net = income - expense;
    const allExpense = income === 0 && expense > 0;
    let label = 'NET THIS LIST';
    if (searching) label = 'MATCHING RESULTS';
    else if (params.category_id) label = allExpense ? 'SPENT IN THIS CATEGORY' : 'IN THIS CATEGORY';
    else if (params.date) label = 'ON THIS DAY';
    return { income, expense, net, allExpense, count: total, label };
  }, [serverTotals, total, params.category_id, params.date, searching]);

  // Hero number + color. For an all-expense category filter show -total (error).
  const heroValue = summary.allExpense ? -summary.expense : summary.net;
  const heroColor =
    heroValue === 0 ? colors.textMuted : getValueColor(heroValue);

  // ─── Day-grouped sections. Suppressed group headers when a single-day filter. ───
  const sections = useMemo(() => {
    const buckets: { key: string; title: string; data: Tx[]; net: number }[] = [];
    const index = new Map<string, number>();
    for (const t of visible) {
      const k = dayKey(t.date);
      let i = index.get(k);
      if (i === undefined) {
        i = buckets.length;
        index.set(k, i);
        buckets.push({ key: k, title: dayLabel(t.date), data: [], net: 0 });
      }
      buckets[i].data.push(t);
      if (t.type === 'income') buckets[i].net += t.amount || 0;
      else if (t.type === 'expense') buckets[i].net -= t.amount || 0;
    }
    return buckets;
  }, [visible]);

  const suppressGroupHeaders = !!params.date;

  const PAGE_SIZE = 50;
  const inFlight = useRef(false);

  type PagedResponse = {
    transactions: any[];
    total: number;
    total_income: number;
    total_expense: number;
    has_more: boolean;
  };

  const load = useCallback(
    async (mode: 'reset' | 'more') => {
      if (inFlight.current) return;
      inFlight.current = true;
      const user = await getCurrentUser();
      if (!user?.id) {
        inFlight.current = false;
        return;
      }
      setUserId(user.id);
      if (mode === 'reset') setLoading(true);
      else setLoadingMore(true);
      try {
        const req: Record<string, string> = {
          user_id: user.id,
          limit: String(PAGE_SIZE),
          offset: mode === 'more' ? String(transactions.length) : '0',
        };
        if (debouncedQuery) req.q = debouncedQuery;
        if (typeFilter !== 'all') req.type = typeFilter;
        if (uncatOnly) req.uncategorized = '1';
        if (params.category_id) req.category_id = params.category_id;
        if (params.date) req.date = params.date;

        const data = (await api.get(`/auth/transactions`, req)) as PagedResponse;
        const normalized = (data.transactions || []).map((t: any) => ({
          ...t,
          category_name: t.category_name ?? t.category ?? t.categoryName,
        }));
        setTransactions((prev) => (mode === 'more' ? [...prev, ...normalized] : normalized));
        setTotal(data.total ?? normalized.length);
        setHasMore(!!data.has_more);
        setServerTotals({ income: data.total_income ?? 0, expense: data.total_expense ?? 0 });
        setError(null);
      } catch (e) {
        console.error('Failed to load transactions:', e);
        // Loading more shouldn't blank a list the user already has.
        if (mode === 'reset') setError('Failed to load transactions');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setLoadedOnce(true);
        inFlight.current = false;
      }
    },
    [transactions.length, debouncedQuery, typeFilter, uncatOnly, params.category_id, params.date]
  );

  // Keep a stable ref so focus/filter effects don't need `load` (whose identity
  // changes with transactions.length) in their deps — that would re-fire on
  // every appended page.
  const loadRef = useRef(load);
  loadRef.current = load;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRef.current('reset');
    setRefreshing(false);
  }, []);

  // Reset-load on focus and whenever a server-side filter changes.
  useFocusEffect(
    useCallback(() => {
      loadRef.current('reset');
    }, [debouncedQuery, typeFilter, uncatOnly, params.category_id, params.date])
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
                loadRef.current('reset');
              }}
            />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const TYPE_CHIPS: { key: typeof typeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'income', label: 'Income' },
    { key: 'expense', label: 'Expenses' },
    { key: 'transfer', label: 'Transfers' },
  ];

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {Header}

        {/* ── Search + type filter ── */}
        <View style={styles.searchWrap}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search note, category, amount…"
              placeholderTextColor={colors.textDark}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search transactions"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.chipRow}>
            {TYPE_CHIPS.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, typeFilter === c.key && styles.chipActive]}
                onPress={() => setTypeFilter(c.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: typeFilter === c.key }}
                accessibilityLabel={`Show ${c.label.toLowerCase()}`}
              >
                <Text style={[styles.chipText, typeFilter === c.key && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.chip,
                { flexDirection: 'row', alignItems: 'center', gap: 4 },
                uncatOnly && styles.chipActive,
              ]}
              onPress={() => setUncatOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ selected: uncatOnly }}
              accessibilityLabel="Show only uncategorized transactions"
            >
              <Ionicons
                name="pricetag-outline"
                size={11}
                color={uncatOnly ? colors.text : colors.textMuted}
              />
              <Text style={[styles.chipText, uncatOnly && styles.chipTextActive]}>
                Uncategorized
              </Text>
            </TouchableOpacity>
          </View>

          {/* One-tap AI sweep over whatever the uncategorized filter shows. */}
          {uncatOnly && total > 0 && (
            <TouchableOpacity
              style={[styles.aiSweepBtn, aiCategorizing && { opacity: 0.6 }]}
              disabled={aiCategorizing}
              onPress={async () => {
                setAiCategorizing(true);
                try {
                  const res = await aiCategorizeTransactions();
                  const applied = res?.applied ?? 0;
                  Alert.alert(
                    'AI Categorize',
                    applied > 0
                      ? `Categorized ${applied} transaction${applied !== 1 ? 's' : ''} across ${res?.classified ?? 0} merchant${(res?.classified ?? 0) !== 1 ? 's' : ''}.`
                      : 'The AI could not confidently place the remaining merchants — assign those by tapping their category chip.',
                  );
                  loadRef.current('reset');
                } catch (e: any) {
                  Alert.alert('Error', 'AI categorization failed: ' + (e?.message || String(e)));
                } finally {
                  setAiCategorizing(false);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Run AI categorization on ${total} uncategorized transactions`}
            >
              {aiCategorizing ? (
                <ActivityIndicator size="small" color={colors.primary2} />
              ) : (
                <Ionicons name="sparkles" size={14} color={colors.primary2} />
              )}
              <Text style={styles.aiSweepText}>
                {aiCategorizing ? 'Categorizing…' : `AI categorize these (${total})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
                <View style={styles.groupRow}>
                  <Text style={styles.groupLabel}>{section.title}</Text>
                  {section.net !== 0 && (
                    <Text style={styles.groupNet}>{signedMoney(section.net)}</Text>
                  )}
                </View>
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
            initialNumToRender={20}
            windowSize={10}
            onEndReached={() => {
              if (hasMore && !loadingMore && !loading) loadRef.current('more');
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color={colors.primary2} />
                </View>
              ) : hasMore ? (
                <Text style={styles.footerCount}>
                  {visible.length} of {total}
                </Text>
              ) : visible.length > 0 ? (
                <Text style={styles.footerCount}>All {total} loaded</Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.bodyPad}>
                {searching ? (
                  <EmptyState
                    icon="search-outline"
                    title="No matching transactions"
                    description="Try a different search term or filter"
                    actionLabel="Clear search"
                    onAction={() => {
                      setQuery('');
                      setTypeFilter('all');
                      setUncatOnly(false);
                    }}
                  />
                ) : (
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
                )}
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
  groupRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  groupNet: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // Search + type filter
  searchWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  searchRow: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    ...glassEffects.glass,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  chipActive: {
    backgroundColor: `${colors.primary}33`,
    borderColor: colors.primary2,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.text,
  },
  aiSweepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: `${colors.primary2}66`,
    backgroundColor: `${colors.primary}1f`,
  },
  aiSweepText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary2,
  },
  footerLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  footerCount: {
    ...typography.caption,
    color: colors.textDark,
    textAlign: 'center',
    paddingVertical: spacing.lg,
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
