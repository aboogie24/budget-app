import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton, SkeletonStack } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

type Invite = {
  code: string;
  household_id: string;
  household_name: string;
  created_by: string;
  inviter_email?: string;
  expires_at: string;
  invitee_email?: string;
};

// ── Expiry math ──
// Returns the number of whole (ceil) days until `expires_at`. Negative/zero
// means expired. `≤ 1 && !expired` escalates the status chip to "urgent".
const daysUntil = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

type ChipCase = 'active' | 'urgent' | 'expired';

const chipFor = (
  expiresAt: string,
  expired: boolean,
): { kase: ChipCase; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string } => {
  if (expired) {
    return { kase: 'expired', icon: 'alert-circle-outline', label: 'Expired', color: colors.error };
  }
  const days = daysUntil(expiresAt);
  if (days <= 1) {
    return {
      kase: 'urgent',
      icon: 'alarm-outline',
      label: days <= 0 ? 'Today' : '1 day left',
      color: colors.error,
    };
  }
  return { kase: 'active', icon: 'time-outline', label: `${days} days left`, color: colors.warning };
};

// ── Status chip (icon + word + color; never color alone) ──
function StatusChip({ expiresAt, expired }: { expiresAt: string; expired: boolean }) {
  const { icon, label, color } = chipFor(expiresAt, expired);
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: `${color}1f`, borderColor: `${color}33` },
      ]}
    >
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Primary CTA ──
function AcceptButton({
  householdName,
  accepting,
  onPress,
}: {
  householdName: string;
  accepting: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={accepting}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Accept and join ${householdName}`}
      accessibilityHint="Double tap to join this household"
      accessibilityState={{ disabled: accepting, busy: accepting }}
    >
      <LinearGradient colors={[...gradients.primaryGradient]} style={styles.acceptInner}>
        {accepting ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
            <Text style={styles.acceptText}>Accept &amp; Join</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Invite card ──
function InviteCard({
  invite,
  accepting,
  onAccept,
}: {
  invite: Invite;
  accepting: boolean;
  onAccept: (code: string, householdName: string) => void;
}) {
  const expired = new Date(invite.expires_at).getTime() < Date.now();
  const { label: statusWord } = chipFor(invite.expires_at, expired);
  const householdName = invite.household_name || 'Household';

  const a11yLabel = invite.inviter_email
    ? `${householdName}, invited by ${invite.inviter_email}, ${statusWord}.`
    : `${householdName}, ${statusWord}.`;

  return (
    <View style={styles.card} accessible accessibilityLabel={a11yLabel}>
      <View style={styles.cardHeader}>
        <View style={styles.iconTile}>
          <Ionicons name="home" size={20} color={colors.primary2} />
        </View>
        <View style={styles.identity}>
          <Text style={styles.householdName} numberOfLines={1}>
            {householdName}
          </Text>
          {invite.inviter_email ? (
            <Text style={styles.inviterText} numberOfLines={1}>
              Invited by {invite.inviter_email}
            </Text>
          ) : null}
        </View>
        <View style={styles.chipSlot}>
          <StatusChip expiresAt={invite.expires_at} expired={expired} />
        </View>
      </View>

      {expired ? (
        <View style={styles.ghostBar} accessibilityRole="text">
          <Ionicons name="close-circle-outline" size={16} color={colors.error} />
          <Text style={styles.ghostText}>This invite has expired</Text>
        </View>
      ) : (
        <AcceptButton
          householdName={householdName}
          accepting={accepting}
          onPress={() => onAccept(invite.code, householdName)}
        />
      )}
    </View>
  );
}

// ── Loading skeleton card (layout-matched) ──
function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={44} height={44} borderRadius={radius.lg} />
        <View style={styles.identity}>
          <SkeletonStack count={2} />
        </View>
        <Skeleton width={92} height={26} borderRadius={radius.sm} />
      </View>
      <Skeleton height={48} borderRadius={radius.lg} />
    </View>
  );
}

export default function PendingInvitesScreen() {
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [errored, setErrored] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        setInvites([]);
        setErrored(false);
        return;
      }

      const data = await api.get(`/auth/households/invites`, { user_id: user.id });
      setInvites(Array.isArray(data) ? data : []);
      setErrored(false);
    } catch (e) {
      console.error('Failed to load invites:', e);
      setErrored(true);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useFocusEffect(
    useCallback(() => {
      loadInvites();
    }, [loadInvites]),
  );

  const handleAccept = (code: string, householdName: string) => {
    Alert.alert(
      'Accept Invite',
      `Join "${householdName}"? You can only be in one household at a time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: async () => {
            setAccepting(code);
            try {
              const user = await getCurrentUser();
              if (!user?.id) return;

              await api.post(`/auth/households/accept`, { code, user_id: user.id });
              Alert.alert('Joined!', `You are now a member of "${householdName}".`);
              await loadInvites();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not accept invite.');
            } finally {
              setAccepting(null);
            }
          },
        },
      ],
    );
  };

  const firstLoad = loading && !loadedOnce;
  const backgroundRefresh = loading && loadedOnce;

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />
          <Text style={styles.title}>Pending Invites</Text>
          {backgroundRefresh ? (
            <ActivityIndicator size="small" color={colors.primary2} />
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {firstLoad ? (
            // ── Loading (first load) ──
            <>
              <Skeleton width={120} height={14} borderRadius={radius.sm} style={styles.countSkeleton} />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : errored ? (
            // ── Error (distinct from empty) ──
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
              <View style={styles.errorTextCol}>
                <Text style={styles.errorTitle}>Couldn&apos;t load your invites</Text>
                <Text style={styles.errorSub}>Check your connection and try again.</Text>
              </View>
              <TouchableOpacity
                onPress={loadInvites}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading invites"
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : invites.length === 0 ? (
            // ── Empty (loaded ok, none) ──
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="mail-open-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No pending invites</Text>
              <Text style={styles.emptySub}>
                When someone invites you to their household, it&apos;ll show up here.
              </Text>
            </View>
          ) : (
            // ── Populated ──
            <>
              <Text style={styles.countText}>
                {invites.length} invite{invites.length !== 1 ? 's' : ''} waiting
              </Text>
              {invites.map((inv) => (
                <InviteCard
                  key={inv.code}
                  invite={inv}
                  accepting={accepting === inv.code}
                  onAccept={handleAccept}
                />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // ── Count ──
  countText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  countSkeleton: { marginBottom: spacing.md },

  // ── Invite card ──
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: `${colors.primary2}1f`,
    borderWidth: 1,
    borderColor: `${colors.primary2}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1 },
  householdName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  inviterText: {
    ...typography.small,
    color: colors.textMuted,
  },
  chipSlot: { flexShrink: 0 },

  // ── Status chip ──
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },

  // ── Accept CTA ──
  acceptInner: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  acceptText: {
    ...typography.button,
    color: colors.text,
  },

  // ── Expired ghost bar ──
  ghostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: `${colors.error}14`,
    borderColor: `${colors.error}29`,
  },
  ghostText: {
    ...typography.smallBold,
    color: colors.error,
  },

  // ── Error notice ──
  errorCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorTextCol: { flex: 1 },
  errorTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  errorSub: {
    ...typography.small,
    color: colors.textMuted,
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },

  // ── Empty ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    ...glassEffects.glass,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySub: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
