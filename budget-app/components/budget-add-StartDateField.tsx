import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius, typography } from '@/utils/design-system';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  open: boolean;
  onToggle: () => void;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Reveal-on-tap start-date field. Collapsed it reads like a category row: a
 * glass inset with a calendar glyph, the formatted date, and a chevron that
 * rotates up while open. On iOS the spinner mounts only while open, inside a
 * glass inset beneath the field; on Android tapping opens the native calendar
 * dialog with no inline spinner.
 */
export function BudgetAddStartDateField({ value, onChange, open, onToggle }: Props) {
  const label = formatDate(value);

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      // Android dismisses itself; collapse the reveal flag too.
      if (open) onToggle();
    }
    if (selectedDate) onChange(selectedDate);
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.field}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Start date, ${label}, opens date picker`}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} style={styles.leadingIcon} />
        <Text style={styles.value} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-forward'}
          size={18}
          color={colors.textDark}
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
            style={styles.spinner}
          />
        </View>
      )}

      {open && Platform.OS === 'android' && (
        <DateTimePicker value={value} mode="date" display="calendar" onChange={handleChange} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  leadingIcon: {
    marginRight: spacing.sm,
  },
  value: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  chevron: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  pickerInset: {
    marginTop: spacing.sm,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  spinner: {
    height: 150,
  },
});

export default BudgetAddStartDateField;
