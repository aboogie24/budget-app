import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/utils/design-system';
import { FormButton } from '@/components/form';
import {
  type HouseholdInvite,
  migrateHeadline,
  migrateBody,
  previewChipsFromBlockers,
} from '@/utils/householdInvites';

type Props = {
  invite: HouseholdInvite;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** BRIEF §B — migrate consent for non-empty solo. */
export function MigrateConsentPanel({ invite, busy, onConfirm, onCancel }: Props) {
  const chips = previewChipsFromBlockers(invite.accept_preview?.blockers);
  return (
    <View style={styles.wrap}>
      <Text style={styles.headline}>{migrateHeadline(invite)}</Text>
      <Text style={styles.body}>{migrateBody(invite)}</Text>
      {chips ? (
        <View style={styles.chipRow}>
          <Text style={styles.chipText}>{chips}</Text>
        </View>
      ) : null}
      <FormButton
        label="Move my data & join"
        onPress={onConfirm}
        loading={busy}
        icon="arrow-forward"
      />
      <FormButton label="Not now" onPress={onCancel} variant="ghost" disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headline: {
    color: colors.text,
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.textMuted,
    ...typography.small,
    marginBottom: spacing.sm,
  },
  chipRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  chipText: {
    color: colors.textMuted,
    ...typography.caption,
  },
});

export default MigrateConsentPanel;
