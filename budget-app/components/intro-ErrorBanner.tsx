import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

type IntroErrorBannerProps = {
  /** Bold title, e.g. "Couldn't sign in". Falsy => renders null. */
  title?: string | null;
  /** Supporting body copy. */
  message?: string;
  onDismiss: () => void;
};

/**
 * intro-ErrorBanner — dismissible inline glass banner for auth failures.
 *
 * Meaning is carried by icon (warning) + the word + color (never color alone).
 * Renders null when there is no error (like AttentionCard when empty).
 */
export function IntroErrorBanner({
  title,
  message = 'Check your connection and try again.',
  onDismiss,
}: IntroErrorBannerProps) {
  if (!title) return null;

  return (
    <View
      style={styles.banner}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Ionicons name="warning" size={20} color={colors.error} style={styles.icon} />
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss error"
        style={styles.dismiss}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderColor: `${colors.error}55`,
    gap: spacing.md,
  },
  icon: {
    marginTop: 1,
  },
  textCol: {
    flex: 1,
  },
  title: {
    ...typography.smallBold,
    color: colors.text,
  },
  message: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  dismiss: {
    padding: spacing.xs,
  },
});

export default IntroErrorBanner;
