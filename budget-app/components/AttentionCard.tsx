import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttentionItem } from '@/utils/api';
import { aiCategorizeTransactions } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { colors, spacing, radius, typography } from '@/utils/design-system';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLLAPSED_KEY = 'attention_card_collapsed';
const DISMISSED_KEY = 'attention_card_dismissed';
// Deterministic alerts describe REAL unresolved problems (overdue bill, broken
// bank link) — a dismissal snoozes them for a day rather than hiding them
// forever. Nudges are dismissed permanently server-side (is_read).
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const SWIPE_DISMISS_THRESHOLD = 70;

type Props = {
  items: AttentionItem[];
  /** Called after any item completes its action so the parent can refresh. */
  onActionComplete?: () => void;
};

/** Left-swipe wrapper: reveals a "Dismiss" affordance and calls onDismiss past
 *  the threshold. Vertical scrolling is untouched (horizontal-intent guard). */
function SwipeDismissRow({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -15 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -120));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_DISMISS_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(onDismiss);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const bgOpacity = translateX.interpolate({
    inputRange: [-SWIPE_DISMISS_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={[styles.swipeBg, { opacity: bgOpacity }]}>
        <Text style={styles.swipeBgText}>Dismiss</Text>
        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Renders the prioritized "needs attention" list returned by
 * GET /auth/dashboard/attention (plus AI nudges merged in by the dashboard).
 * Collapsible (state persists), rows are left-swipe dismissable, and items
 * disappear when addressed — actions trigger a parent refresh that recomputes
 * the list from live state.
 */
export function AttentionCard({ items, onActionComplete }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, d] = await Promise.all([
          AsyncStorage.getItem(COLLAPSED_KEY),
          AsyncStorage.getItem(DISMISSED_KEY),
        ]);
        if (c === '1') setCollapsed(true);
        if (d) setDismissed(JSON.parse(d));
      } catch {}
      setHydrated(true);
    })();
  }, []);

  const toggleCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => {
      AsyncStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1').catch(() => {});
      return !prev;
    });
  }, []);

  const dismissItem = useCallback(
    (item: AttentionItem) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDismissed((prev) => {
        const next = { ...prev, [item.id]: Date.now() };
        AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      // Nudges are dismissed permanently on the server; deterministic alerts
      // only snooze locally so unresolved problems resurface tomorrow.
      if (item.id.startsWith('nudge-')) {
        api
          .post(`/auth/ai/nudges/${item.id.slice('nudge-'.length)}/dismiss`, undefined)
          .catch((e) => console.log('Nudge dismiss failed (non-blocking):', e));
      }
    },
    [],
  );

  // Hide dismissed items — snoozes expire after SNOOZE_MS.
  const now = Date.now();
  const visible = items.filter((i) => {
    const at = dismissed[i.id];
    return !at || now - at > SNOOZE_MS;
  });

  if (!hydrated || visible.length === 0) return null;

  // Open the advisor chat seeded with this alert's context — the chat screen
  // auto-sends the seed (same convention as nudge push taps).
  const askAdvisorAbout = (item: AttentionItem) => {
    const seed = String(
      item.payload?.seed ||
        `Help me with this alert: "${item.title}"${item.body ? ` — ${item.body}` : ''}. What should we do?`,
    );
    router.push({ pathname: '/(tabs)/ai-chat', params: { seed } } as any);
  };

  const dispatch = async (item: AttentionItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      switch (item.action) {
        case 'reconnect': {
          const enrollmentId = item.payload?.enrollment_id;
          const href: Href = enrollmentId
            ? (`/link-account?enrollment_id=${encodeURIComponent(String(enrollmentId))}` as Href)
            : ('/link-account' as Href);
          router.push(href);
          break;
        }
        case 'mark_paid': {
          const billID = item.payload?.bill_id;
          const amount = item.payload?.amount;
          if (!billID) break;
          await api.post(`/auth/bills/${billID}/pay`, { amount });
          break;
        }
        case 'review': {
          router.push('/transactions/review' as Href);
          break;
        }
        case 'open_budget': {
          router.push('/(tabs)/budget' as Href);
          break;
        }
        case 'ai_categorize': {
          const res = await aiCategorizeTransactions();
          const applied = res?.applied ?? 0;
          const classified = res?.classified ?? 0;
          Alert.alert(
            'AI Categorize',
            applied > 0
              ? `Classified ${classified} merchant${classified !== 1 ? 's' : ''}, applied to ${applied} transaction${applied !== 1 ? 's' : ''}.`
              : 'Nothing new to classify.',
          );
          break;
        }
        case 'ask_ai': {
          askAdvisorAbout(item);
          break;
        }
        case 'navigate': {
          if (item.payload?.href) router.push(String(item.payload.href) as Href);
          break;
        }
        default:
          // Never dead-end on an unknown action — hand it to the advisor.
          askAdvisorAbout(item);
      }
      onActionComplete?.();
    } catch (e) {
      console.error('AttentionCard dispatch error:', e);
      Alert.alert('Error', 'Could not complete that action. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Tapping the row body opens a seeded advisor chat about the alert; the CTA
  // chip stays the direct action. For chat/navigation items both do the same.
  const onRowPress = (item: AttentionItem) => {
    if (item.action === 'ask_ai' || item.action === 'navigate') {
      dispatch(item);
    } else {
      askAdvisorAbout(item);
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleCollapsed}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`Needs your attention, ${visible.length} item${visible.length !== 1 ? 's' : ''}. Double tap to ${collapsed ? 'expand' : 'collapse'}.`}
      >
        <Ionicons name="alert-circle" size={14} color={colors.warning} />
        <Text style={styles.headerText}>Needs your attention</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{visible.length}</Text>
        </View>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {!collapsed &&
        visible.map((item, i) => {
          const isBusy = busyId === item.id;
          return (
            <SwipeDismissRow key={item.id} onDismiss={() => dismissItem(item)}>
              <View style={[styles.row, i < visible.length - 1 && styles.rowDivider]}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 }}
                  onPress={() => onRowPress(item)}
                  disabled={isBusy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.body || ''} Double tap to ask the AI advisor about this. Swipe left to dismiss.`}
                >
                  <View style={[styles.iconBox, { backgroundColor: `${item.color}22` }]}>
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    {item.body ? (
                      <Text style={styles.body} numberOfLines={1}>{item.body}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cta, { borderColor: `${item.color}66`, backgroundColor: `${item.color}1f` }]}
                  onPress={() => dispatch(item)}
                  disabled={isBusy}
                  activeOpacity={0.7}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={item.color} />
                  ) : (
                    <Text style={[styles.ctaText, { color: item.color }]}>{item.cta_label}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </SwipeDismissRow>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: `${colors.warning}0d`,
    borderWidth: 1,
    borderColor: `${colors.warning}2e`,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.warning,
    textTransform: 'uppercase',
    flex: 1,
  },
  countPill: {
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: `${colors.warning}2e`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countPillText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.warning,
  },
  swipeWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeBg: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingRight: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
  },
  swipeBgText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.small,
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  ctaText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default AttentionCard;
