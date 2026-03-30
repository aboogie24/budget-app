import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { glassEffects, spacing } from '@/utils/design-system';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: 'light' | 'medium' | 'strong';
  padding?: number;
  marginBottom?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

/**
 * GlassCard Component
 *
 * A reusable glassmorphic card component that applies the design system's
 * glass effect styling. Use this for all card-like UI elements to maintain
 * consistency with the coupleflow prototype.
 *
 * @example
 * ```tsx
 * <GlassCard intensity="medium" padding={16}>
 *   <Text>Card content here</Text>
 * </GlassCard>
 * ```
 */
export default function GlassCard({
  children,
  intensity = 'light',
  padding = spacing.lg,
  marginBottom = spacing.md,
  style,
  onPress,
}: GlassCardProps) {
  const glassStyle = {
    light: glassEffects.glass,
    medium: glassEffects.glassEnhanced,
    strong: glassEffects.glassStrong,
  }[intensity];

  return (
    <View
      style={[
        glassStyle,
        {
          padding,
          marginBottom,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
