// Theme configuration for CoupleFlow glassmorphic design system

export type Theme = 'light' | 'dark';

export const themes = {
  light: {
    // Background gradients
    bgGradient: ['#f3e8ff', '#ffffff', '#f0e7ff'] as const,
    // Glass morphism
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      borderColor: 'rgba(255, 255, 255, 0.4)',
      borderWidth: 1,
    },
    glassLight: {
      backgroundColor: 'rgba(255, 255, 255, 0.4)',
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 1,
    },
    glassDarker: {
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      borderColor: 'rgba(255, 255, 255, 0.5)',
      borderWidth: 1,
    },
    // Text colors
    textPrimary: '#1f2937',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    // Accent colors
    accent: '#a855f7',
    accentLight: '#d8b4fe',
    accentDark: '#7c3aed',
    // Component colors
    successColor: '#10b981',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#3b82f6',
  },
  dark: {
    // Background gradients
    bgGradient: ['#0f172a', '#1e1b4b', '#2d1b69'] as const,
    // Glass morphism
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
    },
    glassLight: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
    },
    glassDarker: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
    },
    // Text colors
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    // Accent colors
    accent: '#a855f7',
    accentLight: '#d8b4fe',
    accentDark: '#7c3aed',
    // Component colors
    successColor: '#10b981',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    infoColor: '#3b82f6',
  },
};

export const getTheme = (theme: Theme) => themes[theme];

export const glassStyles = {
  blur: 16,
  shadowColor: '#000',
  shadowOpacity: { light: 0.1, dark: 0.3 },
  shadowRadius: { light: 8, dark: 12 },
  shadowOffset: { width: 0, height: 4 },
  elevation: { light: 3, dark: 6 },
};

// Shared component style values
export const componentDefaults = {
  borderRadius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
  fontWeight: {
    normal: '400',
    medium: '600',
    semibold: '700',
    bold: '800',
  },
};
