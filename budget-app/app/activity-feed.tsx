import React, { useCallback, useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchActivityFeed } from '@/utils/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

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

export default function ActivityFeedScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadActivityFeed = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      const currentOffset = isRefresh ? 0 : offset;
      const data = await fetchActivityFeed(50, currentOffset);

      if (Array.isArray(data)) {
        if (isRefresh) {
          setEvents(data);
          setOffset(0);
        } else {
          setEvents((prev) => [...prev, ...data]);
          setOffset((prev) => prev + data.length);
        }
        setHasMore(data.length === 50);
      } else {
        setEvents([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('Activity feed error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offset]);

  useEffect(() => {
    loadActivityFeed(true);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActivityFeed(true);
  }, [loadActivityFeed]);

  const onEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      loadActivityFeed(false);
    }
  }, [hasMore, loading, refreshing, loadActivityFeed]);

  const getEventIcon = (eventType: string): string => {
    const icons: Record<string, string> = {
      transaction_added: 'cart-outline',
      bill_paid: 'checkmark-circle-outline',
      budget_created: 'wallet-outline',
      debt_payment: 'trending-down-outline',
      savings_contribution: 'trending-up-outline',
      goal_created: 'flag-outline',
    };
    return icons[eventType] || 'receipt-outline';
  };

  const formatRelativeTime = (dateString: string): string => {
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
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupEventsByDate = (events: ActivityEvent[]): Record<string, ActivityEvent[]> => {
    const groups: Record<string, ActivityEvent[]> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    events.forEach((event) => {
      const eventDate = new Date(event.created_at);
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

      let group = 'Earlier';
      if (eventDay.getTime() === today.getTime()) {
        group = 'Today';
      } else if (eventDay.getTime() === yesterday.getTime()) {
        group = 'Yesterday';
      } else if (eventDay >= weekAgo) {
        group = 'This Week';
      }

      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(event);
    });

    return groups;
  };

  const formatCurrency = (amount?: number): string => {
    if (amount === undefined || amount === null) return '';
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  const renderEvent = ({ item }: { item: ActivityEvent }) => {
    const isIncome = item.event_type === 'savings_contribution' || item.event_type === 'income';
    const amountColor = isIncome ? '#22c55e' : '#ef4444';
    const amountPrefix = isIncome ? '+' : '';

    return (
      <View style={styles.eventCard}>
        <View
          style={[
            styles.eventIcon,
            {
              backgroundColor:
                item.event_type === 'savings_contribution'
                  ? 'rgba(34, 197, 94, 0.1)'
                  : item.event_type === 'debt_payment'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(255, 255, 255, 0.08)',
            },
          ]}
        >
          <Ionicons
            name={getEventIcon(item.event_type) as any}
            size={20}
            color={
              item.event_type === 'savings_contribution'
                ? '#22c55e'
                : item.event_type === 'debt_payment'
                  ? '#ef4444'
                  : '#a855f7'
            }
          />
        </View>

        <View style={styles.eventContent}>
          <View>
            <Text style={styles.eventDescription}>{item.description}</Text>
            <View style={styles.eventMeta}>
              <Text style={styles.eventUser}>{item.user_name}</Text>
              <Text style={styles.eventTime}>• {formatRelativeTime(item.created_at)}</Text>
            </View>
          </View>
        </View>

        {item.amount !== undefined && item.amount !== null && (
          <Text style={[styles.eventAmount, { color: amountColor }]}>
            {amountPrefix}{formatCurrency(item.amount)}
          </Text>
        )}
      </View>
    );
  };

  const renderGroupHeader = ({ group }: { group: string }) => (
    <Text style={styles.groupHeader}>{group}</Text>
  );

  if (loading && events.length === 0) {
    return (
      <LinearGradient colors={['#0f172a', '#1a1040', '#0f172a']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#a855f7" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error && events.length === 0) {
    return (
      <LinearGradient colors={['#0f172a', '#1a1040', '#0f172a']} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#f8fafc" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Activity</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
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
      </LinearGradient>
    );
  }

  const groupedEvents = groupEventsByDate(events);
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  const sortedGroups = groupOrder.filter((g) => groupedEvents[g]);

  return (
    <LinearGradient colors={['#0f172a', '#1a1040', '#0f172a']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity</Text>
          <View style={{ width: 24 }} />
        </View>

        {events.length === 0 ? (
          <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
            <EmptyState
              icon="pulse-outline"
              title="No activity yet"
              description="When you or your partner make changes, they'll show up here"
            />
          </View>
        ) : (
          <FlatList
            data={sortedGroups.flatMap((group) => [
              { type: 'header', group },
              ...groupedEvents[group].map((event) => ({ type: 'event', data: event })),
            ])}
            renderItem={({ item }: any) =>
              item.type === 'header' ? (
                renderGroupHeader({ group: item.group })
              ) : (
                renderEvent({ item: item.data })
              )
            }
            keyExtractor={(item, index) => {
              if (item.type === 'header') return `header-${item.group}`;
              return `${item.data.id}-${index}`;
            }}
            contentContainerStyle={styles.listContent}
            scrollIndicatorInsets={{ right: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" />}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              hasMore ? (
                <View style={styles.loadingFooter}>
                  <ActivityIndicator size="small" color="#a855f7" />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 32,
  },
  groupHeader: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 12,
    paddingTop: 16,
    marginTop: 8,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  eventContent: {
    flex: 1,
  },
  eventDescription: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventUser: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  eventAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
    flexShrink: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#a855f7',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
