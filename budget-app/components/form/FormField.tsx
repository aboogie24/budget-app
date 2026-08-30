import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/utils/design-system';

type Props = {
  label: string;
  optional?: boolean;
  /** When set, renders the inline error hint row under the field. */
  error?: string | null;
  children: React.ReactNode;
};

/** Label + control slot + inline error hint — the standard form row wrapper. */
export function FormField({ label, optional, error, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      {children}
      {error ? (
        <View style={styles.hintRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.hintText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
  },
  label: {
    color: colors.textMuted,
    ...typography.smallBold,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  optional: {
    color: colors.textDark,
    fontWeight: '400',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  hintText: {
    ...typography.caption,
    color: colors.error,
  },
});

export default FormField;
