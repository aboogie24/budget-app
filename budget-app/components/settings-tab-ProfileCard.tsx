import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';
import { Skeleton } from '@/components/Skeleton';

export interface ProfileCardProps {
  name: string;
  email: string;
  plan?: string;
  avatarLabel: string;
  loading?: boolean;
  onEditPress?: () => void;
}

/**
 * The one visually-richer card at the top of Settings: avatar + name + email +
 * plan badge + edit affordance. Plan tier carries a star glyph so it is not
 * color-only.
 */
export function ProfileCard({
  name,
  email,
  plan = 'Pro Plan',
  avatarLabel,
  loading,
  onEditPress,
}: ProfileCardProps) {
  if (loading) {
    return (
      <View style={styles.card}>
        <Skeleton width={56} height={56} borderRadius={radius.full} />
        <View style={styles.info}>
          <Skeleton height={14} width="60%" />
          <View style={{ height: spacing.xs }} />
          <Skeleton height={12} width="80%" />
          <View style={{ height: spacing.sm }} />
          <Skeleton height={18} width={72} borderRadius={radius.sm} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatarLabel || 'A'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
        <View style={styles.badge}>
          <Ionicons name="star" size={11} color={colors.primary2} />
          <Text style={styles.badgeText}>{plan}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.editBtn}
        onPress={onEditPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        <Ionicons name="create-outline" size={16} color={colors.primary2} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  email: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: `${colors.primary2}26`,
    borderWidth: 1,
    borderColor: `${colors.primary2}40`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '700',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProfileCard;
