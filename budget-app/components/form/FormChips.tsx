import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';
import { formTokens } from './formTokens';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
};

/** Capsule segmented chips — muted track, selected thumb (C033 v2). */
export function FormChips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => {
              lightHaptic();
              onChange(opt.value);
            }}
            activeOpacity={0.85}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.label}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={14}
                color={selected ? '#fff' : formTokens.muted}
              />
            ) : null}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: formTokens.surfaceRaised,
    borderRadius: formTokens.radiusPill,
    padding: 4,
  },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: formTokens.radiusPill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: formTokens.primary,
  },
  chipText: {
    ...typography.small,
    color: formTokens.muted,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default FormChips;
