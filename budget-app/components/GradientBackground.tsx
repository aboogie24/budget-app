import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/utils/design-system';

interface GradientBackgroundProps {
  children: React.ReactNode;
  variant?: keyof typeof gradients;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: any;
}

/**
 * GradientBackground Component
 *
 * Applies a gradient background to a container. Uses the design system's
 * predefined gradients or allows custom color arrays.
 *
 * Usage:
 * Pass variant prop like "bgDarkPurple" or provide custom colors array.
 */
export default function GradientBackground({
  children,
  variant = 'bgDark',
  colors: customColors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
}: GradientBackgroundProps) {
  const gradientColors = customColors || gradients[variant];

  return (
    <LinearGradient
      colors={Array.isArray(gradientColors) ? [...gradientColors] : [gradientColors as string]}
      start={start}
      end={end}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}
