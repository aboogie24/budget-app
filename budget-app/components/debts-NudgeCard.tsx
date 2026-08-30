import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, spacing, radius, typography } from '@/utils/design-system';

export type DebtNudge = {
  id: string;
  title: string;
  body?: string;
  nudge_type?: string;
  action_type?: string;
  action_data?: string;
};

type Props = {
  nudges: DebtNudge[];
  /** Fires when the card body is tapped (open the nudge's action). */
  onPress: (nudge: DebtNudge) => void;
  /** Fires when the dismiss (×) is tapped. */
  onDismiss: (nudge: DebtNudge) => void;
};

/**
 * Debt-specific AI nudge card. Mirrors the shared AttentionCard's tokens
 * (primary gradient icon chip, glass surface, radius.lg, dismiss × in textDark)
 * but carries the debt nudge action contract (ask_ai / navigate_to), which the
 * shared AttentionCard's fixed `action` union does not model.
 *
 * Renders nothing when there are no nudges — the caller shows no fallback.
 */
export function DebtNudgeCard({ nudges, onPress, onDismiss }: Props) {
  if (!nudges || nudges.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {nudges.map((nudge) => (
        <TouchableOpacity
          key={nudge.id}
          style={styles.card}
          activeOpacity={0.8}
          onPress={() => onPress(nudge)}
          accessibilityRole="button"
          accessibilityLabel={nudge.title}
          accessibilityHint={nudge.body}
        >
          <LinearGradient
            colors={[...gradients.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconChip}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={2}>{nudge.title}</Text>
            {nudge.body ? (
              <Text style={styles.body} numberOfLines={2}>{nudge.body}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => onDismiss(nudge)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss nudge"
          >
            <Ionicons name="close" size={16} color={colors.textDark} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.small,
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
});

export default DebtNudgeCard;
