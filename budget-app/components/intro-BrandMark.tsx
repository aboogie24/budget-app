import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/utils/design-system';

/**
 * intro-BrandMark
 *
 * The CoupleFlow brand mark for the intro (welcome) screen. Two overlapping
 * translucent glass halo circles (the "shared household" motif) behind a
 * wordmark row: Couple ♥ Flow, expressed entirely in the purple family —
 * NO pink. Purely decorative + identity, no interaction.
 */
export function IntroBrandMark() {
  return (
    <View
      style={styles.wrapper}
      accessibilityRole="image"
      accessibilityLabel="CoupleFlow"
    >
      {/* Two overlapping glass halo circles (decorative, hidden from SR) */}
      <View style={styles.halo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.circle, styles.circleLeft]} />
        <View style={[styles.circle, styles.circleRight]} />
      </View>

      {/* Wordmark row */}
      <View style={styles.logoRow}>
        <Text style={styles.wordmark}>Couple</Text>
        <Ionicons name="heart" size={28} color={colors.accent} style={styles.heart} />
        <Text style={styles.wordmark}>Flow</Text>
      </View>
    </View>
  );
}

const CIRCLE = 100;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  halo: {
    width: 160,
    height: CIRCLE,
    marginBottom: spacing.md,
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    top: 0,
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.full,
  },
  circleLeft: {
    left: 0,
    backgroundColor: `${colors.primary2}2e`,
  },
  circleRight: {
    right: 0,
    backgroundColor: `${colors.accent}2e`,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  wordmark: {
    ...typography.h1,
    color: colors.primary2,
  },
  heart: {
    marginHorizontal: spacing.xs,
  },
});

export default IntroBrandMark;
