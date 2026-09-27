import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { spacing, typography } from '@/utils/design-system';
import { formTokens } from './formTokens';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  open: boolean;
  onToggle: () => void;
  /** Field name announced to screen readers, e.g. "Target date". */
  accessibilityLabel?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Quiet-fill date field with reveal-on-tap picker (C033 v2). */
export function FormDateField({
  value,
  onChange,
  open,
  onToggle,
  accessibilityLabel = 'Date',
  minimumDate,
  maximumDate,
}: Props) {
  const label = formatDate(value);

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (open) onToggle();
    }
    if (selectedDate) onChange(selectedDate);
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.field, open && styles.fieldOpen]}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, ${label}, opens date picker`}
      >
        <Ionicons name="calendar-outline" size={18} color={formTokens.quiet} style={styles.leadingIcon} />
        <Text style={styles.value} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-forward'}
          size={18}
          color={formTokens.quiet}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {open && Platform.OS === 'ios' && (
        <View style={styles.pickerInset}>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            onChange={handleChange}
            themeVariant="dark"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            style={styles.spinner}
          />
        </View>
      )}

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode="date"
          display="calendar"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: formTokens.fieldMinHeight,
    backgroundColor: formTokens.surfaceRaised,
    borderRadius: formTokens.radiusField,
    borderWidth: formTokens.focusBorderWidth,
    borderColor: 'transparent',
    paddingHorizontal: 16,
  },
  fieldOpen: {
    borderColor: formTokens.primary2,
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  value: {
    flex: 1,
    ...typography.body,
    color: formTokens.text,
  },
  chevron: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  pickerInset: {
    marginTop: spacing.sm,
    backgroundColor: formTokens.surfaceRaised,
    borderRadius: formTokens.radiusField,
    overflow: 'hidden',
  },
  spinner: {
    height: 150,
  },
});

export default FormDateField;
