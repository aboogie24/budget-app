import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, gradients } from '@/utils/design-system';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'destructive' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  /** Trailing icon, e.g. "arrow-forward". Hidden while loading. */
  icon?: keyof typeof Ionicons.glyphMap;
};

/** Standard form CTA: gradient primary, glass destructive/secondary, spinner while saving. */
export function FormButton({ label, onPress, variant = 'primary', disabled, loading, icon }: Props) {
  const blocked = disabled || loading;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.text} size="small" />
      ) : null}
      <Text
        style={[
          styles.label,
          variant === 'destructive' && styles.labelDestructive,
          variant === 'secondary' && styles.labelSecondary,
        ]}
      >
        {label}
      </Text>
      {icon && !loading ? (
        <Ionicons name={icon} size={18} color={variant === 'primary' ? '#fff' : colors.text} />
      ) : null}
    </>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={blocked}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!blocked, busy: !!loading }}
      style={disabled && !loading ? styles.dimmed : undefined}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...gradients.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.inner}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.inner, variant === 'destructive' ? styles.destructive : styles.secondary]}>
          {content}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  destructive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  secondary: {
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  label: {
    ...typography.button,
    color: '#fff',
  },
  labelDestructive: {
    color: colors.error,
  },
  labelSecondary: {
    color: colors.text,
  },
  dimmed: {
    opacity: 0.5,
  },
});

export default FormButton;
