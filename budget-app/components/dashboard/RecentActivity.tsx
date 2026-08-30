import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  radius,
  typography,
  getValueColor,
} from '@/utils/design-system';

export type RecentTx = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category?: string;
  category_name?: string;
  date: string;
  user_id?: string;
  source?: string;
};

export type PartnerGlyph = { glyph: string; color: string; name: string } | null;

const money = (v: number) =>
  '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const iconFor = (tx: RecentTx): keyof typeof Ionicons.glyphMap =>
  tx.type === 'income' ? 'cash-outline' : 'cart-outline';

type Props = {
  transactions: RecentTx[];
  /** Resolve a partner glyph for a given tx (returns null in Me scope / shared / solo). */
  resolvePartner: (tx: RecentTx) => PartnerGlyph;
  onSeeAll?: () => void;
  onPressTx?: (tx: RecentTx) => void;
};

/**
 * Tier 5 — the last 3 transactions. All actual (solid); no projected rows.
 * Subtitle carries a lightweight partner glyph (◑/◐) matched to tx.user_id,
 * suppressed in Me scope / for shared or unknown owners.
 */
export function RecentActivity({ transactions, resolvePartner, onSeeAll, onPressTx }: Props) {
  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.groupLabel}>RECENT ACTIVITY</Text>
        {transactions.length > 0 && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAll}>See all ›</Text>
          </TouchableOpacity>
        )}
      </View>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={22} color={colors.textDark} />
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        transactions.map((tx) => {
          const isIncome = tx.type === 'income';
          const iconColor = isIncome ? colors.success : colors.primary2;
          const amountColor = getValueColor(isIncome ? tx.amount : -tx.amount);
          const partner = resolvePartner(tx);
          const category = tx.category_name || tx.category || 'Uncategorized';
          const name = tx.category_name || tx.category || tx.note || 'Transaction';
          const a11y = `${name}, ${category}, ${isIncome ? 'income' : 'expense'} ${money(tx.amount)}${
            partner ? `, by ${partner.name}` : ''
          }.`;

          return (
            <TouchableOpacity
              key={tx.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => onPressTx?.(tx)}
              accessibilityRole="button"
              accessibilityLabel={a11y}
            >
              <View style={[styles.iconChip, { backgroundColor: `${iconColor}1f` }]}>
                <Ionicons name={iconFor(tx)} size={16} color={iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {category}
                  {partner ? (
                    <Text>
                      {' · '}
                      <Text style={{ color: partner.color }}>{partner.glyph}</Text> {partner.name}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <Text style={[styles.amount, { color: amountColor }]}>
                {isIncome ? '+' : '-'}{money(tx.amount)}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  seeAll: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '600',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
  },
});

export default RecentActivity;
