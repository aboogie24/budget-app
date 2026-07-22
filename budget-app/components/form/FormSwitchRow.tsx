import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';

type Props = {
  label: string;
  /** Secondary line under the label. */
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  /** Accent color when on; defaults to the app purple. */
  tint?: string;
};

/** Label + Switch row with standardized track/thumb tinting. */
export function FormSwitchRow({ label, sublabel, value, onValueChange, tint = colors.primary2 }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          lightHaptic();
          onValueChange(v);
        }}
        trackColor={{ false: 'rgba(255,255,255,0.12)', true: `${tint}66` }}
        thumbColor={value ? tint : '#94a3b8'}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
  sublabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default FormSwitchRow;
