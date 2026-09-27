import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { spacing, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';
import { formTokens } from './formTokens';

type Props = {
  label: string;
  /** Secondary line under the label. */
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  /** Accent color when on; defaults to brand purple. */
  tint?: string;
  /** When true, draws as a standalone quiet-fill control; inside FormGroup leave false. */
  standalone?: boolean;
};

/** Flat switch row — brand purple when on (C033 v2). */
export function FormSwitchRow({
  label,
  sublabel,
  value,
  onValueChange,
  tint = formTokens.primary,
  standalone = true,
}: Props) {
  return (
    <View style={[styles.row, standalone && styles.standalone]}>
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
        trackColor={{ false: 'rgba(255,255,255,0.12)', true: `${tint}88` }}
        thumbColor={value ? '#fff' : '#94a3b8'}
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
    minHeight: formTokens.fieldMinHeight,
    paddingHorizontal: 16,
    gap: spacing.md,
  },
  standalone: {
    backgroundColor: formTokens.surfaceRaised,
    borderRadius: formTokens.radiusField,
    marginTop: spacing.md,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    ...typography.body,
    color: formTokens.text,
  },
  sublabel: {
    ...typography.caption,
    color: formTokens.muted,
    marginTop: 2,
  },
});

export default FormSwitchRow;
