import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { AttentionItem } from '@/utils/api';
import { aiCategorizeTransactions } from '@/utils/api';
import { api } from '@/utils/apiClient';
import { colors, spacing, radius, typography } from '@/utils/design-system';

type Props = {
  items: AttentionItem[];
  /** Called after any item completes its action so the parent can refresh. */
  onActionComplete?: () => void;
};

/**
 * Renders the prioritized "needs attention" list returned by
 * GET /auth/dashboard/attention. When `items` is empty, the component renders
 * nothing — the caller decides whether to show a fallback.
 */
export function AttentionCard({ items, onActionComplete }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

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
      }
      onActionComplete?.();
    } catch (e) {
      console.error('AttentionCard dispatch error:', e);
      Alert.alert('Error', 'Could not complete that action. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={14} color={colors.warning} />
        <Text style={styles.headerText}>Needs your attention</Text>
      </View>
      {items.map((item, i) => {
        const isBusy = busyId === item.id;
        return (
          <View
            key={item.id}
            style={[
              styles.row,
              i < items.length - 1 && styles.rowDivider,
            ]}
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
    marginBottom: spacing.sm,
  },
  headerText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.warning,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
