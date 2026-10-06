import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/utils/design-system';
import { FormSheet, FormButton } from '@/components/form';

type Props = {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

/** BRIEF §E — blocked / error edge sheet. */
export function InviteEdgeSheet({
  visible,
  title = 'Before you can join',
  message,
  onClose,
}: Props) {
  return (
    <FormSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={<FormButton label="Got it" onPress={onClose} />}
    >
      <Text style={styles.body}>{message}</Text>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    ...typography.body,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});

export default InviteEdgeSheet;
