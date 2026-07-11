import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/utils/design-system';

export type BudgetFrequency = 'one-time' | 'weekly' | 'biweekly' | 'monthly' | '1st-15th';

const OPTIONS: { value: BudgetFrequency; label: string }[] = [
  { value: 'one-time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: '1st-15th', label: '1st & 15th' },
];

type Props = {
  value: BudgetFrequency;
  onChange: (value: BudgetFrequency) => void;
};

/**
 * Budget frequency chip row. Same visual language as the transaction form's
 * frequency chips, but with the extra "1st & 15th" budget option. Wraps to two
 * rows on narrow screens.
 */
export function BudgetAddFrequencyChips({ value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.7)',
  },
  chipText: {
    ...typography.small,
    color: colors.text,
  },
  chipTextSelected: {
    fontWeight: '700',
  },
});

export default BudgetAddFrequencyChips;
