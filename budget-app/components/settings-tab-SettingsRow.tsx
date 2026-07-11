import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/utils/design-system';

export type SettingsRowStatus = 'default' | 'info' | 'warning' | 'error';
type Accessory = 'chevron' | 'switch' | 'none';

export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  status?: SettingsRowStatus;
  statusLabel?: string;
  badgeCount?: number;
  accessory?: Accessory;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  onPress?: () => void;
  showDivider?: boolean;
}

const STATUS_COLOR: Record<SettingsRowStatus, string> = {
  default: colors.primary2,
  info: colors.info,
  warning: colors.warning,
  error: colors.error,
};

/**
 * The workhorse settings list row: leading icon chip, title + optional subtitle,
 * trailing value / status / switch / chevron. Status is always icon/glyph + word +
 * color (never color-alone) to stay color-independent.
 */
export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  status = 'default',
  statusLabel,
  badgeCount,
  accessory = 'chevron',
  switchValue,
  onSwitchChange,
  onPress,
  showDivider,
}: SettingsRowProps) {
  const isSwitch = accessory === 'switch';
  const tint = STATUS_COLOR[status];
  const chipFill = `${tint}1a`;

  const effectiveAccessory: Accessory =
    accessory === 'chevron' && !onPress && !isSwitch ? 'none' : accessory;

  const a11yLabel = [
    title,
    subtitle,
    value,
    statusLabel,
  ]
    .filter(Boolean)
    .join(', ');

  const body = (
    <>
      <View style={styles.left}>
        <View style={[styles.chip, { backgroundColor: chipFill }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        {/* Non-default status: glyph/dot + word + color (color-independent) */}
        {status === 'info' && statusLabel ? (
          <Text style={[styles.statusLabel, { color: colors.info }]} numberOfLines={1}>
            {`● ${statusLabel}`}
          </Text>
        ) : null}
        {(status === 'warning' || status === 'error') && statusLabel ? (
          <View style={styles.statusRow}>
            <Ionicons name="alert-circle" size={13} color={tint} />
            <Text style={[styles.statusLabel, { color: tint }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        ) : null}

        {typeof badgeCount === 'number' && badgeCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{badgeCount}</Text>
          </View>
        ) : null}

        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}

        {isSwitch ? (
          <Switch
            value={!!switchValue}
            onValueChange={onSwitchChange}
            thumbColor={colors.text}
            trackColor={{ true: colors.primary2, false: colors.glassMedium }}
          />
        ) : null}

        {effectiveAccessory === 'chevron' ? (
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        ) : null}
      </View>
    </>
  );

  const containerStyle = [styles.row, showDivider && styles.divider];

  if (isSwitch) {
    // Whole row is the switch target (>=44pt), not just the thumb.
    return (
      <TouchableOpacity
        style={containerStyle}
        activeOpacity={0.7}
        onPress={onSwitchChange ? () => onSwitchChange(!switchValue) : undefined}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!switchValue }}
        accessibilityLabel={a11yLabel}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      activeOpacity={0.7}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {body}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    ...typography.smallBold,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
    maxWidth: '52%',
    justifyContent: 'flex-end',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  statusLabel: {
    ...typography.caption,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  value: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
    flexShrink: 1,
  },
});

export default SettingsRow;
