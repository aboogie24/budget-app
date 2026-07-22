import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Selected value's display label; placeholder shows when empty. */
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Tap-to-open glass row for pickers (category, account, linked debt…). */
export function FormPickerRow({ icon, value, placeholder, onPress, accessibilityLabel }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${placeholder}${value ? `, ${value}` : ''}, opens picker`}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.leadingIcon} />
      ) : null}
      <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textDark} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  value: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevron: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
});

export default FormPickerRow;
