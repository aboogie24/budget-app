import React, { forwardRef, useState } from 'react';
import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/utils/design-system';
import { fieldError, fieldFocused, fieldIdle, formTokens } from './formTokens';

type Props = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Paints the border in the error color (message rendering belongs to FormField). */
  error?: boolean;
};

/** Quiet-fill text input with soft focus glow. Pair with FormField for label + error. */
export const FormInput = forwardRef<TextInput, Props>(function FormInput(
  { icon, error, style, multiline, onFocus, onBlur, editable = true, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.row,
        multiline && styles.rowMultiline,
        focused && !error && editable && styles.rowFocused,
        error && styles.rowError,
        !editable && styles.rowDisabled,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={formTokens.quiet} style={styles.leadingIcon} />
      ) : null}
      <TextInput
        ref={ref}
        style={[styles.input, multiline && styles.inputMultiline, style]}
        placeholderTextColor={formTokens.quiet}
        multiline={multiline}
        editable={editable}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...inputProps}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...fieldIdle,
  },
  rowMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  rowFocused: {
    ...fieldFocused,
  },
  rowError: {
    ...fieldError,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: formTokens.text,
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
