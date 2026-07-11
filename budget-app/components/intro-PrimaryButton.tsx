import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, gradients } from '@/utils/design-system';

type IntroPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

/**
 * intro-PrimaryButton — the single dominant "Get Started" CTA.
 *
 * Gradient-filled (primaryGradient), tokenized shape/type. Supports loading
 * (spinner replaces label+arrow) and disabled (dimmed, no press) states.
 */
export function IntroPrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: IntroPrimaryButtonProps) {
  const isInert = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isInert}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Get started, create an account"
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={[styles.wrapper, disabled && !loading && styles.dimmed]}
    >
      <LinearGradient
        colors={[...gradients.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.inner}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.text} />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  dimmed: {
    opacity: 0.5,
  },
  inner: {
    minHeight: 52,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
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

export default IntroPrimaryButton;
