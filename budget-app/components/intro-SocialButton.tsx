import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

export type SocialProvider = 'apple' | 'google';

type IntroSocialButtonProps = {
  provider: SocialProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

const PROVIDER_META: Record<
  SocialProvider,
  { label: string; loadingLabel: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  apple: { label: 'Continue with Apple', loadingLabel: 'Connecting to Apple…', icon: 'logo-apple' },
  google: { label: 'Continue with Google', loadingLabel: 'Connecting to Google…', icon: 'logo-google' },
};

/**
 * intro-SocialButton — outlined glass fast-path auth button.
 *
 * Subordinate to the primary CTA (outlined glass, not filled). Loading shows a
 * spinner + "Connecting to {Provider}…" verb; disabled dims + blocks press.
 */
export function IntroSocialButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
}: IntroSocialButtonProps) {
  const meta = PROVIDER_META[provider];
  const isInert = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isInert}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={[styles.wrapper, disabled && !loading && styles.dimmed]}
    >
      <View style={styles.row}>
        {loading ? (
          <>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.label}>{meta.loadingLabel}</Text>
          </>
        ) : (
          <>
            <Ionicons name={meta.icon} size={18} color={colors.text} />
            <Text style={styles.label}>{meta.label}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...glassEffects.glassEnhanced,
    width: '100%',
    borderRadius: radius.lg,
    borderColor: colors.borderGlass,
  },
  dimmed: {
    opacity: 0.5,
  },
  row: {
    minHeight: 52,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.button,
    color: colors.text,
  },
});

export default IntroSocialButton;
