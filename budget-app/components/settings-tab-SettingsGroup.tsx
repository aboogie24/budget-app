import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';
import { Skeleton } from '@/components/Skeleton';

export interface SettingsGroupProps {
  label: string;
  children?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  error?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  empty?: boolean;
  emptyContent?: ReactNode;
}

/** A single skeleton row shaped like SettingsRow (chip + title + value). */
function SkeletonRow({ showDivider }: { showDivider?: boolean }) {
  return (
    <View style={[styles.skelRow, showDivider && styles.divider]}>
      <Skeleton width={34} height={34} borderRadius={radius.md} />
      <View style={{ flex: 1 }}>
        <Skeleton height={12} width="60%" />
      </View>
      <Skeleton height={12} width={44} />
    </View>
  );
}

/**
 * A labeled group: uppercase caption + a flat glass card wrapping N rows.
 * Handles loading (skeleton rows), error (inline strip + retry), and empty
 * (custom emptyContent) treatments per the spec.
 */
export function SettingsGroup({
  label,
  children,
  loading,
  loadingRows = 1,
  error,
  errorMessage = "Couldn't load this section",
  onRetry,
  empty,
  emptyContent,
}: SettingsGroupProps) {
  let content: ReactNode;

  if (error) {
    content = (
      <View style={styles.errorStrip}>
        <View style={styles.errorLeft}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={styles.errorText} numberOfLines={2}>
            {errorMessage}
          </Text>
        </View>
        {onRetry ? (
          <TouchableOpacity
            onPress={onRetry}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  } else if (loading) {
    content = (
      <>
        {Array.from({ length: loadingRows }).map((_, i) => (
          <SkeletonRow key={i} showDivider={i > 0} />
        ))}
      </>
    );
  } else if (empty) {
    content = emptyContent;
  } else {
    content = children;
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.card}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  skelRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  errorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  errorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  errorText: {
    ...typography.small,
    color: colors.error,
    flex: 1,
  },
  retry: {
    ...typography.smallBold,
    color: colors.primary2,
  },
});

export default SettingsGroup;
