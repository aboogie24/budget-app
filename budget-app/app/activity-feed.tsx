import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { fetchActivityFeed } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import { Skeleton } from '@/components/Skeleton';
import GradientBackground from '@/components/GradientBackground';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  getValueColor,
} from '@/utils/design-system';

type ActivityEvent = {
  id: string;
  household_id: string;
  user_id: string;
  user_name: string;
  event_type: string;
  entity_id?: string;
  entity_type?: string;
  amount?: number;
  description: string;
  metadata?: any;
  created_at: string;
};

type Member = { user_id: string; full_name: string; role?: string };

type PartnerGlyph = { glyph: string; color: string; name: string } | null;

type FeedRow =
  | { type: 'header'; group: string }
  | { type: 'event'; data: ActivityEvent };

const PAGE_SIZE = 50;

// event_type → icon + tint (single source of truth, per spec §5)
const INCOME_EVENTS = new Set(['savings_contribution', 'income']);

function tintForEvent(eventType: string): string {
  if (INCOME_EVENTS.has(eventType)) return colors.success;
  if (
    eventType === 'transaction_added' ||
    eventType === 'bill_paid' ||
    eventType === 'debt_payment'
  ) {
    return colors.error;
  }
  // budget_created / goal_created / unknown
  return colors.primary2;
}

function iconForEvent(eventType: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    transaction_added: 'cart-outline',
    bill_paid: 'checkmark-circle-outline',
    debt_payment: 'trending-down-outline',
    savings_contribution: 'trending-up-outline',
    income: 'cash-outline',
    budget_created: 'wallet-outline',
    goal_created: 'flag-outline',
  };
  return icons[eventType] || 'receipt-outline';
}

const money = (v: number) =>
  '$' +
  Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupEventsByDate(
  events: ActivityEvent[],
): Record<string, ActivityEvent[]> {
  const groups: Record<string, ActivityEvent[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  events.forEach((event) => {
    const eventDate = new Date(event.created_at);
    const eventDay = new Date(
      eventDate.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate(),
    );

    let group = 'Earlier';
    if (eventDay.getTime() === today.getTime()) {
      group = 'Today';
    } else if (eventDay.getTime() === yesterday.getTime()) {
      group = 'Yesterday';
    } else if (eventDay >= weekAgo) {
      group = 'This Week';
    }

    if (!groups[group]) groups[group] = [];
    groups[group].push(event);
  });

  return groups;
}

const GROUP_LABEL: Record<string, string> = {
  Today: 'TODAY',
  Yesterday: 'YESTERDAY',
  'This Week': 'THIS WEEK',
  Earlier: 'EARLIER',
};

// Map an event to a navigable route when the underlying entity is present.
function hrefForEvent(event: ActivityEvent): Href | null {
  if (!event.entity_id || !event.entity_type) return null;
  if (event.entity_type === 'transaction') {
    return `/transaction/${event.entity_id}` as Href;
  }
  return null;
}

export default function ActivityFeedScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Couples attribution — graceful-degrade if members aren't loaded.
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const loadActivityFeed = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshError(null);
        else setError(null);

        const currentOffset = isRefresh ? 0 : offset;
        const data = await fetchActivityFeed(PAGE_SIZE, currentOffset);

        if (Array.isArray(data)) {
          if (isRefresh) {
            setEvents(data as ActivityEvent[]);
            setOffset(data.length);
          } else {
            setEvents((prev) => [...prev, ...(data as ActivityEvent[])]);
            setOffset((prev) => prev + data.length);
          }
          setHasMore(data.length === PAGE_SIZE);
          setError(null);
        } else {
          if (isRefresh) setEvents([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error('Activity feed error:', err);
        const msg =
          err instanceof Error ? err.message : 'Failed to load activity';
        // Non-fatal refresh error when we already have events on screen.
        if (events.length > 0) {
          setRefreshError(msg);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [offset, events.length],
  );

  const loadHousehold = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user?.id) return;
      setUserId(String(user.id));
      setUserName(user.full_name || user.email || null);

      const householdData = await api.get<any>('/auth/households/me', {
        user_id: user.id,
      });
      let m = householdData?.members;
      if (typeof m === 'string') {
        try {
          m = JSON.parse(m);
        } catch {
          m = null;
        }
      }
      if (Array.isArray(m)) setMembers(m as Member[]);
    } catch (err) {
      // Attribution is progressive enhancement — never block the feed.
      console.warn('Household load failed (attribution degrades):', err);
    }
  }, []);

  useEffect(() => {
    loadActivityFeed(true);
    loadHousehold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss the refresh-error banner.
  useEffect(() => {
    if (!refreshError) return;
    const t = setTimeout(() => setRefreshError(null), 4000);
    return () => clearTimeout(t);
  }, [refreshError]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActivityFeed(true);
  }, [loadActivityFeed]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      loadActivityFeed(false);
    }
  }, [hasMore, loading, refreshing, loadActivityFeed]);

  const resolvePartner = useCallback(
    (event: ActivityEvent): PartnerGlyph => {
      const eventUser = event.user_id ? String(event.user_id) : '';
      if (!eventUser || !userId) return null;
      if (eventUser === userId) {
        const me = members.find((x) => String(x.user_id) === userId);
        const name = (me?.full_name || userName || 'You').split(' ')[0];
        return { glyph: '◑', color: colors.primary2, name };
      }
      const partner = members.find((x) => String(x.user_id) === eventUser);
      const name = (partner?.full_name || event.user_name || 'Partner').split(
        ' ',
      )[0];
      return { glyph: '◐', color: colors.info, name };
    },
    [userId, userName, members],
  );

  const partners = useMemo(
    () => members.filter((m) => userId && String(m.user_id) !== userId),
    [members, userId],
  );
  const isCouple = members.length >= 2;

  const renderHeader = () => (
    <View style={styles.header}>
      <BackButton
        fallback="/(tabs)/dashboard"
        iconName="chevron-back"
        size={22}
      />
      <Text style={styles.headerTitle}>Activity</Text>
      <View style={styles.headerRight}>
        {refreshing && events.length > 0 && (
          <ActivityIndicator size="small" color={colors.primary2} />
        )}
        {isCouple ? (
          <View style={styles.avatars}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(userName || 'Y').charAt(0).toUpperCase()}
              </Text>
            </View>
            {partners.slice(0, 1).map((p) => (
              <View
                key={p.user_id}
                style={[
                  styles.avatar,
                  styles.avatarOverlap,
                  { backgroundColor: colors.info },
                ]}
              >
                <Text style={styles.avatarText}>
                  {(p.full_name || 'P').charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    </View>
  );

  const renderEvent = (event: ActivityEvent) => {
    const tint = tintForEvent(event.event_type);
    const hasAmount = event.amount !== undefined && event.amount !== null;
    const isIncome = INCOME_EVENTS.has(event.event_type);
    const amountColor = hasAmount
      ? getValueColor(isIncome ? (event.amount as number) : -(event.amount as number))
      : colors.text;
    const partner = resolvePartner(event);
    const relTime = formatRelativeTime(event.created_at);

    const href = hrefForEvent(event);

    const a11yAmount = hasAmount
      ? `, ${isIncome ? 'income' : 'expense'} ${money(event.amount as number)}`
      : '';
    const a11yActor = partner ? `, by ${partner.name}` : '';
    const a11yLabel = `${event.description}${a11yActor}, ${relTime}${a11yAmount}.`;

    const inner = (
      <>
        <View style={[styles.iconChip, { backgroundColor: `${tint}1f` }]}>
          <Ionicons name={iconForEvent(event.event_type)} size={18} color={tint} />
        </View>

        <View style={styles.textColumn}>
          <Text style={styles.name} numberOfLines={1}>
            {event.description}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {partner ? (
              <Text>
                <Text style={{ color: partner.color }}>{partner.glyph}</Text>{' '}
                {partner.name}
                {' · '}
              </Text>
            ) : null}
            {relTime}
          </Text>
        </View>

        {hasAmount && (
          <Text style={[styles.amount, { color: amountColor }]}>
            {isIncome ? '+' : '-'}
            {money(event.amount as number)}
          </Text>
        )}
      </>
    );

    if (href) {
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => router.push(href)}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
        >
          {inner}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.row} accessibilityLabel={a11yLabel}>
        {inner}
      </View>
    );
  };

  const renderGroupLabel = (group: string) => (
    <Text
      style={styles.groupLabel}
      accessibilityRole="header"
    >
      {GROUP_LABEL[group] ?? group.toUpperCase()}
    </Text>
  );

  const feedData = useMemo<FeedRow[]>(() => {
    const grouped = groupEventsByDate(events);
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    const rows: FeedRow[] = [];
    order
      .filter((g) => grouped[g])
      .forEach((group) => {
        rows.push({ type: 'header', group });
        grouped[group].forEach((data) => rows.push({ type: 'event', data }));
      });
    return rows;
  }, [events]);

  const renderRefreshBanner = () =>
    refreshError ? (
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={16} color={colors.error} />
        <Text style={styles.bannerText} numberOfLines={1}>
          Couldn&apos;t refresh — showing older activity
        </Text>
      </View>
    ) : null;

  // ── First-load skeleton (per spec §3.2) ──
  if (loading && events.length === 0) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          {renderHeader()}
          <View style={styles.skeletonWrap}>
            <Skeleton width={60} height={12} borderRadius={radius.sm} style={styles.skeletonLabel} />
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={36} height={36} borderRadius={radius.md} />
                <View style={styles.skeletonTextCol}>
                  <Skeleton width="60%" height={12} />
                  <Skeleton width="40%" height={10} />
                </View>
                <Skeleton width={56} height={14} />
              </View>
            ))}
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Initial error (no cached events) — inline, don't blank ──
  if (error && events.length === 0) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          {renderHeader()}
          <View style={styles.centeredState}>
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setLoading(true);
                loadActivityFeed(true);
              }}
            />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        {renderRefreshBanner()}

        {events.length === 0 ? (
          <View style={styles.centeredState}>
            <EmptyState
              icon="pulse-outline"
              title="No activity yet"
              description="When you or your partner make changes, they'll show up here"
            />
          </View>
        ) : (
          <FlatList
            data={feedData}
            renderItem={({ item }) =>
              item.type === 'header'
                ? renderGroupLabel(item.group)
                : renderEvent(item.data)
            }
            keyExtractor={(item, index) =>
              item.type === 'header'
                ? `header-${item.group}`
                : `${item.data.id}-${index}`
            }
            contentContainerStyle={styles.listContent}
            scrollIndicatorInsets={{ right: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary2}
                colors={[colors.primary2]}
              />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              hasMore ? (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="small" color={colors.primary2} />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3, fontWeight: '800',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  bannerText: {
    ...typography.caption,
    color: colors.error,
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.smallBold,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  amount: {
    ...typography.smallBold,
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  skeletonWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skeletonLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  skeletonRow: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  skeletonTextCol: {
    flex: 1,
    gap: spacing.sm,
  },
  loadingFooter: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
