import React, { forwardRef } from 'react';
import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/utils/design-system';

type Props = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Paints the border in the error color (message rendering belongs to FormField). */
  error?: boolean;
};

/** Glass text input with optional leading icon. Pair with FormField for label + error. */
export const FormInput = forwardRef<TextInput, Props>(function FormInput(
  { icon, error, style, multiline, ...inputProps },
  ref,
) {
  return (
    <View style={[styles.row, multiline && styles.rowMultiline, error && styles.rowError]}>
      {icon ? (
        <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.leadingIcon} />
      ) : null}
      <TextInput
        ref={ref}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        {...inputProps}
      />
    </View>
  );
});

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
  rowMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  rowError: {
    borderColor: colors.error,
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    paddingVertical: 0,
    textAlignVertical: 'top',
    minHeight: 72,
  },
});

export default FormInput;
