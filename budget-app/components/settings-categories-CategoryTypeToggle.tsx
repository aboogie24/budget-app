import React from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';

export type CategoryType = 'expense' | 'income';

type Props = {
  value: CategoryType;
  onChange: (type: CategoryType) => void;
};

const SEGMENTS: {
  key: CategoryType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'expense', label: 'Expenses', icon: 'cart-outline' },
  { key: 'income', label: 'Income', icon: 'cash-outline' },
];

/**
 * Expenses | Income segmented control for the Categories screen. Models the
 * shared ScopeToggle / BudgetTypeToggle style so the app keeps ONE
 * segmented-control look: glass container at radius.full, active segment fills
 * with colors.primary. Re-scopes the whole category list.
 */
export function CategoryTypeToggle({ value, onChange }: Props) {
  const handlePress = (type: CategoryType) => {
    if (type === value) return;
    onChange(type);
    AccessibilityInfo.announceForAccessibility?.(
      type === 'expense' ? 'Showing expense categories' : 'Showing income categories',
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
            accessibilityLabel={`${seg.label} tab`}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}
          >
            <Ionicons
              name={seg.icon}
              size={15}
              color={active ? colors.text : colors.textMuted}
              style={styles.icon}
            />
            <Text
              style={[
                styles.segmentText,
                active ? styles.segmentTextActive : styles.segmentTextInactive,
              ]}
            >
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
    height: 44,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  icon: {
    marginRight: spacing.sm,
  },
  segmentText: {
    ...typography.smallBold,
  },
  segmentTextActive: {
    color: colors.text,
  },
  segmentTextInactive: {
    color: colors.textMuted,
  },
});

export default CategoryTypeToggle;
