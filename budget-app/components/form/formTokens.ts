/**
 * C033 v2 / C034 — shared form chrome tokens.
 * Quiet fills, soft focus glow, pill CTAs. Not bordered glass boxes.
 */
import { colors, radius } from '@/utils/design-system';
import type { TextStyle, ViewStyle } from 'react-native';

export const formTokens = {
  surfaceRaised: 'rgba(255,255,255,0.04)',
  surface: '#1e293b',
  quiet: '#64748b',
  muted: colors.textMuted,
  primary: colors.primary,
  primary2: colors.primary2,
  error: colors.error,
  text: colors.text,
  radiusField: 14,
  radiusPill: radius.full,
  radiusSheet: 28,
  fieldMinHeight: 52,
  ctaMinHeight: 52,
  focusBorderWidth: 1.5,
  focusGlow: 'rgba(168,85,247,0.28)',
  errorGlow: 'rgba(239,68,68,0.22)',
  hairline: colors.borderLight,
  fieldGap: 18,
} as const;

export const labelStyle: TextStyle = {
  fontSize: 13,
  fontWeight: '500',
  lineHeight: 18,
  color: formTokens.muted,
  marginBottom: 6,
};

export const optionalLabelStyle: TextStyle = {
  fontSize: 13,
  fontWeight: '400',
  color: formTokens.quiet,
};

export const helperStyle: TextStyle = {
  fontSize: 12,
  fontWeight: '400',
  lineHeight: 16,
  color: formTokens.muted,
  marginTop: 6,
};

export const errorHelperStyle: TextStyle = {
  ...helperStyle,
  color: formTokens.error,
};

/** Idle field chrome: soft fill, no border. */
export const fieldIdle: ViewStyle = {
  backgroundColor: formTokens.surfaceRaised,
  borderWidth: formTokens.focusBorderWidth,
  borderColor: 'transparent',
  borderRadius: formTokens.radiusField,
  minHeight: formTokens.fieldMinHeight,
  paddingHorizontal: 16,
};

export const fieldFocused: ViewStyle = {
  borderColor: formTokens.primary2,
  // RN shadow approximates the soft focus halo on iOS; Android uses elevation lightly.
  shadowColor: formTokens.primary2,
  shadowOpacity: 0.35,
  shadowOffset: { width: 0, height: 0 },
  shadowRadius: 6,
  elevation: 2,
};

export const fieldError: ViewStyle = {
  borderColor: formTokens.error,
  shadowColor: formTokens.error,
  shadowOpacity: 0.25,
  shadowOffset: { width: 0, height: 0 },
  shadowRadius: 5,
  elevation: 1,
};
