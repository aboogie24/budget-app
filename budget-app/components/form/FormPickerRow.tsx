import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';
import { formTokens } from './formTokens';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Selected value's display label; placeholder shows when empty. */
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** When true, draws as a standalone quiet-fill control; inside FormGroup leave false. */
  standalone?: boolean;
};

/** Flat picker row — soft panel language, trailing quiet chevron (C033 v2). */
export function FormPickerRow({
  icon,
  value,
  placeholder,
  onPress,
  accessibilityLabel,
  standalone = true,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.row, standalone && styles.standalone]}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${placeholder}${value ? `, ${value}` : ''}, opens picker`}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={formTokens.quiet} style={styles.leadingIcon} />
      ) : null}
      <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={formTokens.quiet} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: formTokens.fieldMinHeight,
    paddingHorizontal: 16,
  },
  standalone: {
    backgroundColor: formTokens.surfaceRaised,
    borderRadius: formTokens.radiusField,
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  value: {
    flex: 1,
    ...typography.body,
    color: formTokens.text,
    textAlign: 'right',
  },
  placeholder: {
    color: formTokens.quiet,
  },
  chevron: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
});

export default FormPickerRow;
