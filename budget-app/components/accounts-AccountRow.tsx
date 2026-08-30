import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/utils/design-system';

export type AccountType = 'depository' | 'credit' | 'loan' | 'investment' | 'other';

export type PartnerGlyph = { glyph: string; color: string; name: string } | null;

type AccountRowProps = {
  name: string;
  institutionName?: string;
  mask?: string;
  subtype?: string;
  typeColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  currentBalance: number;
  availableBalance?: number;
  isDebt: boolean;
  balanceVisible: boolean;
  partner?: PartnerGlyph;
  formatCurrency: (v: number) => string;
  onPress?: () => void;
};

const MASK = '••••••';

/**
 * A single linked-account row implementing the RecentActivity row contract:
 * 36x36 tinted icon chip · name over subtitle · right-aligned amount.
 */
export function AccountRow({
  name,
  institutionName,
  mask,
  subtype,
  typeColor,
  icon,
  currentBalance,
  availableBalance,
  isDebt,
  balanceVisible,
  partner,
  formatCurrency,
  onPress,
}: AccountRowProps) {
  const subtypePretty = subtype
    ? subtype.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : undefined;

  const subtitleParts = [
    institutionName,
    mask ? `••${mask}` : undefined,
    subtypePretty,
  ].filter(Boolean) as string[];
  const subtitleText = subtitleParts.join(' · ');

  const amountColor = isDebt ? colors.error : typeColor;
  const showAvailable =
    availableBalance != null && availableBalance !== currentBalance;

  const a11y =
    `${name}, ${subtypePretty || 'account'}${institutionName ? ` at ${institutionName}` : ''}, ` +
    `${isDebt ? 'debt' : 'balance'} ${balanceVisible ? formatCurrency(currentBalance) : 'hidden'}` +
    `${showAvailable && balanceVisible ? `, available ${formatCurrency(availableBalance as number)}` : ''}.`;

  const RowContainer: any = onPress ? TouchableOpacity : View;

  return (
    <RowContainer
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={a11y}
    >
      <View style={[styles.iconChip, { backgroundColor: `${typeColor}1f` }]}>
        <Ionicons name={icon} size={16} color={typeColor} />
      </View>

      <View style={styles.middle}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {(subtitleText || partner) && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitleText}
            {partner ? (
              <Text>
                {subtitleText ? ' · ' : ''}
                <Text style={{ color: partner.color }}>{partner.glyph}</Text> {partner.name}
              </Text>
            ) : null}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        <Text
          style={[styles.amount, { color: amountColor }]}
          accessibilityLabel={balanceVisible ? undefined : 'balance hidden'}
        >
          {balanceVisible ? formatCurrency(currentBalance) : MASK}
        </Text>
        {showAvailable && (
          <Text style={styles.available}>
            {balanceVisible ? `${formatCurrency(availableBalance as number)} avail` : ''}
          </Text>
        )}
      </View>
    </RowContainer>
  );
}

const styles = StyleSheet.create({
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
  middle: {
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
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  amount: {
    ...typography.smallBold,
  },
  available: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default AccountRow;
