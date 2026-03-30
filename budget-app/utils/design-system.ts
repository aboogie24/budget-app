import { StyleSheet, ViewStyle, TextStyle, Dimensions } from 'react-native';

/**
 * CoupleFlow Design System
 *
 * Centralized theme, colors, and glassmorphic styling utilities
 * aligned with coupleflow-prototype.jsx design vision
 */

// ─── COLOR PALETTE ───
export const colors = {
  // Primary & Gradients
  primary: '#7c3aed',        // Purple
  primary2: '#a855f7',       // Light purple/violet
  accent: '#c084fc',         // Lightest purple

  // Background & Surfaces
  bg: '#0f172a',             // Deep navy (dark mode)
  surface: '#111827',        // Card bg (dark)
  surface2: '#1e293b',       // Elevated surface (dark)
  surfaceDark: '#0f172a',    // Darkest surface

  // Text
  text: '#f8fafc',           // Primary text (white-ish)
  textMuted: '#94a3b8',      // Secondary text (gray)
  textDark: '#475569',       // Tertiary text (darker gray)

  // Status & Semantic
  success: '#22c55e',        // Green (income, positive)
  warning: '#eab308',        // Yellow (warnings)
  error: '#ef4444',          // Red (expenses, negative)
  info: '#3b82f6',           // Blue (info)

  // Borders & Dividers
  border: '#334155',         // Border color
  borderLight: 'rgba(255,255,255,0.08)',  // Light border for glass
  borderGlass: 'rgba(255,255,255,0.1)',   // Glass card border

  // Transparent Surfaces (glass effect)
  glassLight: 'rgba(255,255,255,0.05)',
  glassMedium: 'rgba(255,255,255,0.08)',
  glassStrong: 'rgba(255,255,255,0.12)',
};

// ─── GRADIENT DEFINITIONS ───
export const gradients = {
  // Background gradients
  bgDark: ['#0f172a', '#1a1040', '#0f172a'] as const,
  bgDarkPurple: ['#0f172a', '#1a0a40', '#0f172a'] as const,
  bgDeep: ['#0a0e27', '#0f172a', '#0a0e27'] as const,

  // Accent gradients (purple to violet)
  primaryGradient: [colors.primary, colors.primary2] as const,
  accentGradient: [colors.primary2, colors.accent] as const,
  vibrant: [colors.accent, colors.primary, colors.primary2] as const,

  // Card gradients (subtle)
  cardSubtle: ['rgba(124,58,237,0.03)', 'rgba(168,85,247,0.02)'] as const,

  // Semantic gradients
  successGradient: ['#15803d', '#22c55e'] as const,
  errorGradient: ['#7f1d1d', '#ef4444'] as const,
  infoGradient: ['#1e3a8a', '#3b82f6'] as const,
};

// ─── GLASS STYLES ───
export const glassEffects = {
  // Glass card base
  glass: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 16,
    overflow: 'hidden' as const,
  } as ViewStyle,

  // Enhanced glass (more visible)
  glassEnhanced: {
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    overflow: 'hidden' as const,
  } as ViewStyle,

  // Strong glass (prominent)
  glassStrong: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    overflow: 'hidden' as const,
  } as ViewStyle,

  // Floating card (elevated feel)
  glassFloating: {
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    overflow: 'hidden' as const,
    // Add shadow for elevation (React Native style)
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  } as ViewStyle,
};

// ─── SPACING SCALE ───
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// ─── BORDER RADIUS ───
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// ─── TYPOGRAPHY ───
export const typography = {
  // Heading styles
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  } as TextStyle,

  h2: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  } as TextStyle,

  h3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  } as TextStyle,

  // Body text
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  } as TextStyle,

  bodyBold: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,

  // Small text
  small: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,

  smallBold: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  } as TextStyle,

  // Tiny text (captions)
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,

  // Button text
  button: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  } as TextStyle,
};

// ─── SHARED STYLES ───
export const commonStyles = StyleSheet.create({
  // Flex utilities
  flex1: { flex: 1 },
  flexRow: { flexDirection: 'row' },
  flexCenter: { justifyContent: 'center', alignItems: 'center' },
  flexBetween: { justifyContent: 'space-between', alignItems: 'center' },
  flexStart: { justifyContent: 'flex-start', alignItems: 'flex-start' },

  // Safe area container
  safeContainer: {
    flex: 1,
  },

  // Scrollable content
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  // Cards
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  cardEnhanced: {
    ...glassEffects.glassEnhanced,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  // Headers
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  // Dividers
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },

  // Empty state container
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  // Loading spinner container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── SCREEN-LEVEL THEME HELPERS ───
export interface ScreenTheme {
  colors: typeof colors;
  gradients: typeof gradients;
  glass: typeof glassEffects;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  commonStyles: typeof commonStyles;
}

/**
 * Get the current theme (dark mode only for now, but structured for light mode expansion)
 */
export function getTheme(): ScreenTheme {
  return {
    colors,
    gradients,
    glass: glassEffects,
    spacing,
    radius,
    typography,
    commonStyles,
  };
}

// ─── UTILITY FUNCTIONS ───

/**
 * Create a glass card style with optional customizations
 */
export function createGlassCardStyle(intensity: 'light' | 'medium' | 'strong' = 'light'): ViewStyle {
  const baseStyles = {
    light: glassEffects.glass,
    medium: glassEffects.glassEnhanced,
    strong: glassEffects.glassStrong,
  };

  return {
    ...baseStyles[intensity],
    padding: spacing.lg,
    marginBottom: spacing.md,
  };
}

/**
 * Create a gradient background style
 */
export function createGradientBgStyle(gradientKey: keyof typeof gradients): any {
  return {
    colors: gradients[gradientKey],
  };
}

/**
 * Format currency with appropriate styling
 */
export function formatCurrency(amount: number, decimals = 2): string {
  return `$${(amount || 0).toFixed(decimals)}`;
}

/**
 * Get color for a value (green for positive, red for negative)
 */
export function getValueColor(value: number): string {
  return value >= 0 ? colors.success : colors.error;
}

/**
 * Get icon color based on semantic meaning
 */
export function getSemanticColor(type: 'success' | 'error' | 'warning' | 'info'): string {
  return {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
  }[type];
}

/**
 * Responsive padding based on screen width
 */
export function getResponsivePadding(): number {
  const screenWidth = Dimensions.get('window').width;
  if (screenWidth < 375) return spacing.md;
  if (screenWidth > 768) return spacing.xl;
  return spacing.lg;
}

export default {
  colors,
  gradients,
  glassEffects,
  spacing,
  radius,
  typography,
  commonStyles,
  getTheme,
  createGlassCardStyle,
  createGradientBgStyle,
  formatCurrency,
  getValueColor,
  getSemanticColor,
  getResponsivePadding,
};
