import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/utils/design-system';
import {
  errorHelperStyle,
  formTokens,
  helperStyle,
  labelStyle,
  optionalLabelStyle,
} from './formTokens';

type Props = {
  label: string;
  optional?: boolean;
  /** Quiet helper under the control when there is no error. */
  helper?: string | null;
  /** When set, renders the inline error hint row under the field. */
  error?: string | null;
  children: React.ReactNode;
};

/** Sentence-case label + control slot + helper/error — C033 v2. */
export function FormField({ label, optional, helper, error, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      {children}
      {error ? (
        <View style={styles.hintRow}>
          <Ionicons name="alert-circle-outline" size={14} color={formTokens.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
  },
  label: {
    ...labelStyle,
  },
  optional: {
    ...optionalLabelStyle,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 6,
  },
  errorText: {
    ...errorHelperStyle,
    marginTop: 0,
    flex: 1,
  },
  helperText: {
    ...helperStyle,
  },
});

export default FormField;
