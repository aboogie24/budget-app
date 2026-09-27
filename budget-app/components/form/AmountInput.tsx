import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { spacing, typography } from '@/utils/design-system';
import {
  errorHelperStyle,
  fieldError,
  fieldFocused,
  fieldIdle,
  formTokens,
  labelStyle,
} from './formTokens';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  /** Sentence-case caption above the hero digits (hero variant only). */
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
 * Currency amount entry (C033 v2).
 * Hero = oversized tabular type + hairline (not a glass card).
 * Compact = quiet-fill row with $ prefix.
 */
export function AmountInput({
  value,
  onChangeText,
  label = 'Amount',
  sign = null,
  color = formTokens.text,
  echo,
  compact,
  onBlur,
  error,
  autoFocus,
  placeholder = '0.00',
  accessibilityLabel = 'Amount',
}: Props) {
  const [focused, setFocused] = useState(false);

  if (compact) {
    return (
      <View
        style={[
          styles.compactRow,
          focused && !error && styles.compactFocused,
          !!error && styles.compactRowError,
        ]}
      >
        <Text style={[styles.compactCurrency, { color }]}>$</Text>
        <TextInput
          style={styles.compactInput}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={formTokens.quiet}
          autoFocus={autoFocus}
          accessibilityLabel={accessibilityLabel}
          numberOfLines={1}
        />
      </View>
    );
  }

  return (
    <View style={styles.heroWrap}>
      {label ? <Text style={styles.heroLabel}>{label}</Text> : null}
      <View style={styles.heroRow}>
        {sign ? <Text style={[styles.heroSign, { color }]}>{sign === '-' ? '−' : '+'}</Text> : null}
        <Text style={[styles.heroCurrency, { color }]}>$</Text>
        <TextInput
          style={[styles.heroInput, { color }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={formTokens.quiet}
          autoFocus={autoFocus}
          accessibilityLabel={accessibilityLabel}
          numberOfLines={1}
        />
      </View>
      <View
        style={[
          styles.hairline,
          focused && !error && styles.hairlineFocused,
          !!error && styles.hairlineError,
        ]}
      />
      {echo ? <Text style={styles.heroEcho}>{echo}</Text> : null}
      {error ? <Text style={styles.hintText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  heroLabel: {
    ...labelStyle,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  heroSign: {
    fontSize: 36,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 44,
  },
  heroCurrency: {
    fontSize: 36,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 44,
    marginLeft: 2,
  },
  heroInput: {
    fontSize: 36,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 44,
    minWidth: 40,
    marginLeft: 2,
    padding: 0,
    textAlign: 'left',
  },
  hairline: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: formTokens.hairline,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xl,
  },
  hairlineFocused: {
    backgroundColor: formTokens.primary2,
    height: 2,
    shadowColor: formTokens.primary2,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
  },
  hairlineError: {
    backgroundColor: formTokens.error,
    height: 2,
  },
  heroEcho: {
    ...typography.caption,
    color: formTokens.muted,
    marginTop: spacing.xs,
  },
  hintText: { ...errorHelperStyle, textAlign: 'center' },

  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...fieldIdle,
  },
  compactFocused: {
    ...fieldFocused,
  },
  compactRowError: {
    ...fieldError,
  },
  compactCurrency: {
    ...typography.bodyBold,
    marginRight: spacing.xs,
  },
  compactInput: {
    flex: 1,
    ...typography.body,
    color: formTokens.text,
    fontVariant: ['tabular-nums'],
    padding: 0,
    paddingVertical: spacing.md,
  },
});

export default AmountInput;
