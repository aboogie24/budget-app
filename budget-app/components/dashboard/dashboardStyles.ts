import { StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '@/utils/design-system';

export const dashboardStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  drawerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  greetingWrap: {
    flex: 1,
  },
  greeting: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  avatarText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
