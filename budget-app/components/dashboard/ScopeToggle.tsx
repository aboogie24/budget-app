import React from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

export type Scope = 'household' | 'me';

type Props = {
  value: Scope;
  onChange: (scope: Scope) => void;
  /** Pass false (or omit for solo users) to render nothing. */
  visible?: boolean;
};

const SEGMENTS: { key: Scope; label: string }[] = [
  { key: 'household', label: 'Household' },
  { key: 'me', label: 'Me' },
];

/**
 * Compact segmented control that re-scopes the whole dashboard between
 * Household (default) and Me. Hidden entirely for solo users. The active
 * segment fills with colors.primary; inactive segments are transparent.
 */
export function ScopeToggle({ value, onChange, visible = true }: Props) {
  if (!visible) return null;

  const handlePress = (scope: Scope) => {
    if (scope === value) return;
    onChange(scope);
    AccessibilityInfo.announceForAccessibility?.(
      scope === 'household' ? 'Showing household' : 'Showing me',
    );
  };

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {SEGMENTS.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            onPress={() => handlePress(seg.key)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.label}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : styles.segmentTextInactive]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...glassEffects.glass,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    padding: 2,
  },
  segment: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  segmentText: {
    ...typography.smallBold,
    fontSize: 12,
  },
  segmentTextActive: {
    color: colors.text,
  },
  segmentTextInactive: {
    color: colors.textMuted,
  },
});

export default ScopeToggle;
