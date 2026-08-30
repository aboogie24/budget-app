import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';
import { Sparkline } from '@/components/Sparkline';
import { Skeleton } from '@/components/Skeleton';

type AccountsHeroProps = {
  netWorth: number;
  history: number[];
  deltaPercent: number | null;
  deltaDays?: number;
  totalAssets: number;
  assetCount: number;
  totalDebts: number;
  debtCount: number;
  balanceVisible: boolean;
  formatCurrency: (v: number) => string;
  formatCompact: (v: number) => string;
  loading?: boolean;
};

const MASK = '••••••';

/**
 * The single floating hero card (glassFloating) — the canonical net-worth
 * headline for the accounts screen. Amount + trend sparkline + delta chip, with
 * a nested Assets / Debts split summary below.
 */
export function AccountsHero({
  netWorth,
  history,
  deltaPercent,
  deltaDays = 30,
  totalAssets,
  assetCount,
  totalDebts,
  debtCount,
  balanceVisible,
  formatCurrency,
  formatCompact,
  loading = false,
}: AccountsHeroProps) {
  if (loading) {
    return (
      <View style={styles.card}>
        <Skeleton width={80} height={12} />
        <View style={styles.rowTop}>
          <View style={{ gap: spacing.sm }}>
            <Skeleton width={180} height={32} />
            <Skeleton width={100} height={16} />
          </View>
          <Skeleton width={100} height={44} borderRadius={radius.sm} />
        </View>
        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <Skeleton width={48} height={10} />
            <Skeleton width={72} height={16} style={{ marginTop: spacing.xs }} />
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.splitCol}>
            <Skeleton width={48} height={10} />
            <Skeleton width={72} height={16} style={{ marginTop: spacing.xs }} />
          </View>
        </View>
      </View>
    );
  }

  const negative = netWorth < 0;
  const amountText = balanceVisible ? formatCurrency(netWorth) : MASK;

  const deltaUp = (deltaPercent ?? 0) >= 0;
  const showDelta = deltaPercent !== null && history.length >= 2;
  const deltaColor = deltaUp ? colors.success : colors.error;
  const deltaPctText = balanceVisible ? `${Math.abs(deltaPercent ?? 0)}%` : '••%';

  const a11y = `Net worth ${amountText}${
    showDelta ? `, ${deltaUp ? 'up' : 'down'} ${Math.abs(deltaPercent ?? 0)} percent over ${deltaDays} days` : ''
  }. Assets ${balanceVisible ? formatCurrency(totalAssets) : 'hidden'}, debts ${
    balanceVisible ? formatCurrency(totalDebts) : 'hidden'
  }.`;

  return (
    <View style={styles.card} accessible accessibilityLabel={a11y}>
      <Text style={styles.label}>NET WORTH</Text>

      <View style={styles.rowTop}>
        <View style={styles.amountCol}>
          <Text
            style={[styles.amount, { color: negative ? colors.error : colors.text }]}
            numberOfLines={1}
            accessibilityLabel={balanceVisible ? undefined : 'balance hidden'}
          >
            {amountText}
          </Text>
          {showDelta && (
            <View style={[styles.deltaChip, { backgroundColor: `${deltaColor}1f` }]}>
              <Ionicons
                name={deltaUp ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={deltaColor}
              />
              <Text style={[styles.deltaText, { color: deltaColor }]}>
                {deltaPctText} · {deltaDays}d
              </Text>
            </View>
          )}
        </View>
        <Sparkline values={history} width={100} height={44} autoColor />
      </View>

      <View style={styles.splitRow}>
        <View style={styles.splitCol}>
          <Text style={styles.splitLabel}>Assets</Text>
          <Text
            style={[styles.splitValue, { color: colors.success }]}
            accessibilityLabel={balanceVisible ? undefined : 'balance hidden'}
          >
            {balanceVisible ? formatCompact(totalAssets) : MASK}
          </Text>
          <Text style={styles.splitCount}>
            {assetCount} account{assetCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.splitDivider} />
        <View style={styles.splitCol}>
          <Text style={styles.splitLabel}>Debts</Text>
          <Text
            style={[styles.splitValue, { color: colors.error }]}
            accessibilityLabel={balanceVisible ? undefined : 'balance hidden'}
          >
            {balanceVisible ? formatCompact(totalDebts) : MASK}
          </Text>
          <Text style={styles.splitCount}>
            {debtCount} account{debtCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  amountCol: {
    flex: 1,
    minWidth: 0,
  },
  amount: {
    ...typography.h1,
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  deltaText: {
    ...typography.caption,
    fontWeight: '700',
  },
  splitRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  splitCol: {
    flex: 1,
  },
  splitDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  splitLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  splitValue: {
    ...typography.bodyBold,
    marginTop: spacing.xs,
  },
  splitCount: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});

export default AccountsHero;
