import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/utils/design-system';
import { formTokens } from './formTokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'destructive' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  /** Trailing icon, e.g. "arrow-forward". Hidden while loading. */
  icon?: keyof typeof Ionicons.glyphMap;
};

/** Solid pill CTA (C033 v2) — no gradient chrome. */
export function FormButton({ label, onPress, variant = 'primary', disabled, loading, icon }: Props) {
  const blocked = disabled || loading;
  const labelColor =
    variant === 'primary'
      ? '#fff'
      : variant === 'destructive'
        ? formTokens.error
        : variant === 'ghost'
          ? formTokens.primary2
          : formTokens.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      style={[blocked && !loading ? styles.dimmed : undefined, variant === 'primary' && styles.primaryGlow]}
    >
      <View
        style={[
          styles.inner,
          variant === 'primary' && styles.primary,
          variant === 'destructive' && styles.destructive,
          variant === 'secondary' && styles.secondary,
          variant === 'ghost' && styles.ghost,
        ]}
      >
        {loading ? <ActivityIndicator color={labelColor} size="small" /> : null}
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        {icon && !loading ? <Ionicons name={icon} size={18} color={labelColor} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primaryGlow: {
    shadowColor: formTokens.primary,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: formTokens.ctaMinHeight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: formTokens.radiusPill,
  },
  primary: {
    backgroundColor: formTokens.primary,
  },
  destructive: {
    backgroundColor: 'rgba(239,68,68,0.14)',
  },
  secondary: {
    backgroundColor: formTokens.surfaceRaised,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    ...typography.button,
    fontWeight: '600',
  },
  dimmed: {
    opacity: 0.45,
  },
});

export default FormButton;
