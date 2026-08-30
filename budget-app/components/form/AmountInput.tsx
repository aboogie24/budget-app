import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  /** Uppercase caption above the hero row (hero variant only). */
  label?: string;
  /** Leading +/− glyph; null hides it. */
  sign?: '+' | '-' | null;
  /** Semantic color for the sign/$/digits (e.g. colors.error for expenses). */
  color?: string;
  /** Small caption under the hero row, e.g. "per month". */
  echo?: string;
  /** Row-sized variant for modal forms; label/echo are ignored — wrap in FormField instead. */
  compact?: boolean;
  onBlur?: () => void;
  error?: string | null;
  autoFocus?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
};

/**
 * Currency amount entry. Hero variant is the large floating card used by
 * add-budget/add-transaction; compact is a $-prefixed glass row for bottom
 * sheets (bills, debts, savings…).
 */
export function AmountInput({
  value,
  onChangeText,
  label = 'AMOUNT',
  sign = null,
  color = colors.text,
  echo,
  compact,
  onBlur,
  error,
  autoFocus,
  placeholder = '0.00',
  accessibilityLabel = 'Amount',
}: Props) {
  if (compact) {
    return (
      <View style={[styles.compactRow, !!error && styles.compactRowError]}>
        <Text style={[styles.compactCurrency, { color }]}>$</Text>
        <TextInput
          style={styles.compactInput}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoFocus={autoFocus}
          accessibilityLabel={accessibilityLabel}
          numberOfLines={1}
        />
      </View>
    );
  }

  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroLabel}>{label}</Text>
      <View style={styles.heroRow}>
        {sign ? <Text style={[styles.heroSign, { color }]}>{sign === '-' ? '−' : '+'}</Text> : null}
        <Text style={[styles.heroCurrency, { color }]}>$</Text>
        <TextInput
          style={[styles.heroInput, { color }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoFocus={autoFocus}
          accessibilityLabel={accessibilityLabel}
          numberOfLines={1}
        />
      </View>
      {echo ? <Text style={styles.heroEcho}>{echo}</Text> : null}
      {error ? (
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero variant
  heroCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '600',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    maxWidth: '100%',
  },
  heroSign: { ...typography.h1 },
  heroCurrency: { ...typography.h1, marginLeft: 2 },
  heroInput: {
    ...typography.h1,
    minWidth: 40,
    marginLeft: 2,
    padding: 0,
    textAlign: 'left',
  },
  heroEcho: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  hintText: { ...typography.caption, color: colors.error },

  // Compact variant
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  compactRowError: {
    borderColor: colors.error,
  },
  compactCurrency: {
    ...typography.bodyBold,
    marginRight: spacing.xs,
  },
  compactInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
    paddingVertical: spacing.md,
  },
});

export default AmountInput;
