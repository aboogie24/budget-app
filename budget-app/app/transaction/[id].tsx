import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton, SkeletonStack } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import SplitTransactionModal from '@/components/SplitTransactionModal';
import { fetchUserTransactions } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { colors, spacing, radius, typography, glassEffects, getValueColor } from '@/utils/design-system';

// ── Types ──
type Tx = {
  id: string;
  user_id?: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category?: string;
  category_name?: string;
  date?: string;
  frequency?: string;
  due_day?: number;
  source?: string;
  color?: string;
  bank_name?: string;
  account_last4?: string;
  pending?: boolean;
  status?: string;
};

type Member = { user_id: string; full_name: string; role: string };

type PartnerGlyph = { glyph: string; color: string; name: string } | null;

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

// 12% semantic tint suffix (see spec §2 — `${token}1f`).
const TINT = '1f';

// ── Helpers ──
function parseDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// Shared formatter: "Tue, Jun 17 2026 · 2:14 PM" (not toLocaleString()).
function formatDate(d: Date): string {
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${weekday}, ${month} ${day} ${year} · ${h}:${m} ${ampm}`;
}

function formatCurrency(v: number): string {
  return Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Category icon by name (neutral fallback = pricetag-outline).
function categoryIcon(name: string): React.ComponentProps<typeof Ionicons>['name'] {
  const n = (name || '').toLowerCase();
  if (n.includes('grocer') || n.includes('food') || n.includes('market')) return 'cart-outline';
  if (n.includes('dining') || n.includes('restaurant') || n.includes('eat')) return 'restaurant-outline';
  if (n.includes('pay') || n.includes('salary') || n.includes('income')) return 'cash-outline';
  if (n.includes('rent') || n.includes('mortgage') || n.includes('home') || n.includes('hous')) return 'home-outline';
  if (n.includes('gas') || n.includes('fuel') || n.includes('transport') || n.includes('car')) return 'car-outline';
  if (n.includes('util') || n.includes('electric') || n.includes('water')) return 'flash-outline';
  if (n.includes('health') || n.includes('medical') || n.includes('doctor')) return 'medkit-outline';
  if (n.includes('entertain') || n.includes('fun') || n.includes('movie')) return 'game-controller-outline';
  if (n.includes('shop') || n.includes('cloth')) return 'bag-handle-outline';
  return 'pricetag-outline';
}

export default function TransactionDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const transactionId = (params.id as string) || '';

  // ── Optimistic first paint from route params ──
  const optimistic: Tx | null = useMemo(() => {
    if (!transactionId) return null;
    return {
      id: transactionId,
      type: ((params.type as string) || 'expense') as 'income' | 'expense',
      amount: Number(params.amount || 0),
      note: (params.note as string) || '',
      category_name:
        (params.category_name as string) || (params.category as string) || undefined,
      date: (params.date as string) || undefined,
      source: (params.source as string) || undefined,
    };
  }, [transactionId, params.type, params.amount, params.note, params.category_name, params.category, params.date, params.source]);

  const [tx, setTx] = useState<Tx | null>(optimistic);
  const [loadState, setLoadState] = useState<LoadState>(optimistic ? 'ready' : 'loading');
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);

  // ── Fetch the real transaction by id (drives states) ──
  const load = useCallback(async () => {
    if (!transactionId) {
      setLoadState('not-found');
      return;
    }
    // Background refresh vs first load.
    if (tx) setRefreshing(true);
    else setLoadState('loading');

    try {
      const user = await getCurrentUser();
      setUserId(user?.id || null);

      const all = await fetchUserTransactions();
      const found = (Array.isArray(all) ? all : []).find(
        (t: any) => String(t.id) === String(transactionId),
      ) as Tx | undefined;

      if (!found) {
        setLoadState('not-found');
        setRefreshing(false);
        return;
      }
      setTx(found);
      setLoadState('ready');

      // Household members for attribution — non-blocking, additive.
      if (user?.id) {
        try {
          const household = await api.get<any>(`/auth/households/me`, { user_id: user.id });
          let mem = household?.members;
          if (typeof mem === 'string') {
            try { mem = JSON.parse(mem); } catch {}
          }
          if (Array.isArray(mem)) setMembers(mem);
        } catch {
          // attribution degrades gracefully
        }
      }
    } catch (e) {
      // Only surface an error if we have nothing to show; a failed background
      // refresh of an already-rendered tx keeps the existing content.
      if (!tx) setLoadState('error');
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  // ── Derived display values ──
  const isIncome = tx?.type === 'income';
  const amount = tx?.amount ?? 0;
  const signedAmount = isIncome ? amount : -amount;
  const amountColor = getValueColor(signedAmount);
  const source = tx?.source || 'manual';
  const isBank = source === 'bank';
  const canEdit = !isBank; // preserves original gate: edit iff not a bank tx
  const isPending = isBank && (tx?.pending === true || tx?.status === 'pending');

  const categoryName = tx?.category_name || tx?.category || '';
  const hasCategory = !!categoryName;
  const displayCategory = hasCategory ? categoryName : 'Uncategorized';
  const catColor = tx?.color;
  const parsedDate = parseDate(tx?.date);

  // Recurring row (only if a real recurring frequency).
  const frequency = (tx?.frequency || '').toLowerCase();
  const isRecurring = !!frequency && frequency !== 'one-time';
  const recurringText = isRecurring
    ? `${capitalize(frequency)}${tx?.due_day ? ` · due day ${tx.due_day}` : ''}`
    : '';

  // Partner attribution (mirrors calendar/dashboard: A → primary2/◑, B → info/◐).
  const partner: PartnerGlyph = useMemo(() => {
    if (!tx?.user_id || !userId) return null;
    if (members.length < 2) return null; // solo household → omit
    if (String(tx.user_id) === String(userId)) {
      const me = members.find((m) => String(m.user_id) === String(userId));
      return { glyph: '◑', color: colors.primary2, name: (me?.full_name || 'You').split(' ')[0] };
    }
    const p = members.find((m) => String(m.user_id) === String(tx.user_id));
    if (!p) return null;
    return { glyph: '◐', color: colors.info, name: (p.full_name || 'Partner').split(' ')[0] };
  }, [tx?.user_id, userId, members]);

  const handleEdit = useCallback(() => {
    if (!canEdit || !tx) return;
    router.push({
      pathname: '/transaction/edit/[id]',
      params: {
        id: tx.id,
        amount: String(tx.amount),
        type: tx.type,
        category: categoryName,
        note: tx.note || '',
        date: tx.date || '',
      },
    });
  }, [canEdit, tx, categoryName, router]);

  // ── Header (rendered in every state so the user can always go back) ──
  const header = (
    <View style={styles.header}>
      <BackButton fallback="/(tabs)/dashboard" size={20} />
      <Text style={styles.headerTitle} numberOfLines={1}>Transaction</Text>
      {loadState === 'ready' && canEdit ? (
        <TouchableOpacity
          onPress={handleEdit}
          style={styles.headerAction}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Edit transaction"
          accessibilityHint="Opens the edit form."
        >
          <Ionicons name="pencil" size={20} color={colors.primary2} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer}>
          {refreshing && loadState === 'ready' ? (
            <ActivityIndicator color={colors.primary2} size="small" />
          ) : null}
        </View>
      )}
    </View>
  );

  // ── State: loading skeleton ──
  if (loadState === 'loading') {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {header}
          <View style={styles.body}>
            {/* Hero shell */}
            <View style={[styles.heroCard, styles.center]}>
              <Skeleton width={72} height={20} borderRadius={radius.full} />
              <View style={{ height: spacing.md }} />
              <Skeleton width={180} height={36} borderRadius={radius.md} />
              <View style={{ height: spacing.md }} />
              <Skeleton width={120} height={20} borderRadius={radius.full} />
            </View>
            {/* Details shell */}
            <View style={[styles.card, { marginTop: spacing.xl }]}>
              <SkeletonStack count={4} height={14} gap={spacing.lg} />
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── State: not found ──
  if (loadState === 'not-found') {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {header}
          <View style={styles.body}>
            <EmptyState
              icon="receipt-outline"
              title="Transaction not found"
              description="It may have been deleted or moved. Head back to your activity to find it."
              actionLabel="Back to activity"
              onAction={() => router.replace('/transaction/list')}
            />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── State: error ──
  if (loadState === 'error') {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {header}
          <View style={styles.body}>
            <ErrorState
              title="Couldn't load this transaction"
              message="Check your connection and try again."
              retryLabel="Try again"
              onRetry={load}
              dismissLabel="Go back"
              onDismiss={() => router.replace('/transaction/list')}
            />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── State: ready (default / income / pending) ──
  const typeTint = isIncome ? colors.success : colors.error;
  const a11yAmount = `${isPending ? 'Pending. about ' : ''}${isIncome ? 'income' : 'expense'}, ${formatCurrency(amount)}, ${displayCategory}`;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {header}
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Amount hero (the only glassFloating / h1 element) ── */}
          <View
            style={[styles.heroCard, isPending && styles.heroPending]}
            accessible
            accessibilityLabel={a11yAmount}
          >
            <View style={styles.pillRow}>
              {/* Type pill */}
              <View style={[styles.pill, { backgroundColor: `${typeTint}${TINT}` }]}>
                <Ionicons
                  name={isIncome ? 'caret-up' : 'caret-down'}
                  size={12}
                  color={typeTint}
                />
                <Text style={[styles.pillText, { color: typeTint }]}>
                  {isIncome ? 'INCOME' : 'EXPENSE'}
                </Text>
              </View>

              {/* Pending pill */}
              {isPending && (
                <View style={[styles.pill, { backgroundColor: `${colors.warning}${TINT}` }]}>
                  <Ionicons name="hourglass-outline" size={12} color={colors.warning} />
                  <Text style={[styles.pillText, { color: colors.warning }]}>PENDING</Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.amount,
                { color: amountColor },
                isPending && styles.amountPending,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {isPending ? '~ ' : ''}
              {isIncome ? '+' : '-'}
              {formatCurrency(amount)}
            </Text>

            {/* Category chip */}
            <View style={styles.categoryChip}>
              <View
                style={[
                  styles.categoryIconWrap,
                  { backgroundColor: hasCategory && catColor ? `${catColor}${TINT}` : colors.glassLight },
                ]}
              >
                <Ionicons
                  name={hasCategory ? categoryIcon(categoryName) : 'pricetag-outline'}
                  size={16}
                  color={hasCategory && catColor ? catColor : colors.textMuted}
                />
              </View>
              <Text
                style={[styles.categoryText, !hasCategory && { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {displayCategory}
              </Text>
            </View>
          </View>

          {isPending && (
            <Text style={styles.pendingCaption}>Amount may change until it clears.</Text>
          )}

          {/* ── Details card (flat glass, labelled rows) ── */}
          <View style={[styles.card, { marginTop: spacing.xl }]}>
            {/* Note (omitted if empty) */}
            {tx?.note ? (
              <>
                <View style={styles.noteRow} accessible accessibilityLabel={`Note, ${tx.note}`}>
                  <View style={styles.rowLabelWrap}>
                    <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                    <Text style={styles.rowLabel}>Note</Text>
                  </View>
                  <Text style={styles.noteValue}>{tx.note}</Text>
                </View>
                <View style={styles.divider} />
              </>
            ) : null}

            {/* Date */}
            <DetailRow
              icon="time-outline"
              label="Date"
              a11y={parsedDate ? `Date, ${formatDate(parsedDate)}` : 'Date unavailable'}
            >
              {parsedDate ? (
                <Text style={styles.rowValue}>{formatDate(parsedDate)}</Text>
              ) : (
                <Text style={[styles.rowValue, { color: colors.textMuted }]}>Date unavailable</Text>
              )}
            </DetailRow>

            <View style={styles.divider} />

            {/* Source */}
            <DetailRow
              icon="shield-checkmark-outline"
              label="Source"
              a11y={isBank ? 'Source, linked bank account' : 'Source, entered manually'}
            >
              <View style={styles.sourceValue}>
                <View
                  style={[
                    styles.sourceDot,
                    { backgroundColor: isBank ? colors.info : colors.textMuted },
                  ]}
                />
                {isBank ? (
                  <Text style={styles.rowValue} numberOfLines={1}>
                    From {tx?.bank_name || 'bank'}
                    {tx?.account_last4 ? ` ••${tx.account_last4}` : ''}{' '}
                    <Text style={{ color: colors.info }}>(linked)</Text>
                  </Text>
                ) : (
                  <Text style={styles.rowValue}>Entered manually</Text>
                )}
              </View>
            </DetailRow>

            {/* Added by (omitted if unknown/solo) */}
            {partner && (
              <>
                <View style={styles.divider} />
                <DetailRow
                  icon="person-outline"
                  label="Added by"
                  a11y={`Added by ${partner.name}`}
                >
                  <View style={styles.sourceValue}>
                    <Text style={[styles.glyph, { color: partner.color }]}>{partner.glyph}</Text>
                    <Text style={styles.rowValue}>{partner.name}</Text>
                  </View>
                </DetailRow>
              </>
            )}

            {/* Recurring (only if recurring) */}
            {isRecurring && (
              <>
                <View style={styles.divider} />
                <DetailRow
                  icon="repeat-outline"
                  label="Recurring"
                  a11y={`Recurring, ${recurringText}`}
                >
                  <Text style={styles.rowValue}>{recurringText}</Text>
                </DetailRow>
              </>
            )}
          </View>

          {/* ── Actions ── */}
          {canEdit ? (
            <View style={[styles.card, styles.actionsCard, { marginTop: spacing.lg }]}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleEdit}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Edit transaction"
                accessibilityHint="Opens the edit form."
              >
                <Ionicons name="pencil" size={18} color={colors.primary2} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>

              {tx?.type === 'expense' && userId && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setSplitOpen(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Split transaction"
                  accessibilityHint="Divide this expense between you."
                >
                  <Ionicons name="git-branch-outline" size={18} color={colors.primary2} />
                  <Text style={styles.actionText}>Split</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Split may still appear for shared bank expenses */}
              {tx?.type === 'expense' && userId && (
                <View style={[styles.card, styles.actionsCard, { marginTop: spacing.lg }]}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setSplitOpen(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Split transaction"
                    accessibilityHint="Divide this expense between you."
                  >
                    <Ionicons name="git-branch-outline" size={18} color={colors.primary2} />
                    <Text style={styles.actionText}>Split</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Why-no-edit note */}
              <View style={[styles.card, styles.whyNoEdit, { marginTop: spacing.md }]}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                <Text style={styles.whyNoEditText}>
                  Synced from your bank — edit in the app that owns it.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Split modal (reuses shared component) */}
      {userId && tx && (
        <SplitTransactionModal
          visible={splitOpen}
          onClose={() => setSplitOpen(false)}
          transaction={{
            id: tx.id,
            amount: tx.amount,
            note: tx.note,
            category_name: categoryName || undefined,
          }}
          userId={userId}
          onSplitSaved={() => {
            setSplitOpen(false);
            load();
          }}
        />
      )}
    </GradientBackground>
  );
}

// ── Detail row primitive (label left, value right) ──
function DetailRow({
  icon,
  label,
  a11y,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  a11y?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={a11y}>
      <View style={styles.rowLabelWrap}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.rowValueWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroCard: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroPending: {
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  amount: {
    ...typography.h1,
    textAlign: 'center',
  },
  amountPending: {
    color: colors.textMuted,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    maxWidth: '100%',
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 1,
  },
  pendingCaption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },

  // Cards
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  // Detail rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.md,
  },
  rowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowValueWrap: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  rowValue: {
    ...typography.small,
    color: colors.text,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },

  // Note (full-width value under label)
  noteRow: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  noteValue: {
    ...typography.small,
    color: colors.text,
    marginLeft: 26,
  },

  // Source
  sourceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  glyph: {
    ...typography.smallBold,
  },

  // Actions
  actionsCard: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
  },
  actionText: {
    ...typography.button,
    color: colors.primary2,
  },
  whyNoEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  whyNoEditText: {
    ...typography.small,
    color: colors.textMuted,
    flexShrink: 1,
  },
});
