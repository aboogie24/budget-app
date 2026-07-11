// app/household-setup.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { successHaptic, errorHaptic } from '@/utils/haptics';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

// ── Types ──

type Member = { user_id: string; email: string; role?: string };
type Invite = {
  code: string;
  invitee_email: string;
  expires_at: string;
  household_id: string;
  household_name?: string;
  inviter_email?: string;
};

// ── Helpers ──

const isExpired = (iso: string) => {
  const t = new Date(iso).getTime();
  return !isNaN(t) && t < Date.now();
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

// ── Group label (lives ABOVE its card, dashboard pattern) ──

const GroupLabel = ({ children }: { children: string }) => (
  <Text style={styles.groupLabel} accessibilityRole="header">
    {children}
  </Text>
);

// ── Status chip (icon + word + color — color-independent) ──

const StatusChip = ({
  icon,
  label,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
}) => (
  <View
    style={[
      styles.chip,
      { backgroundColor: `${color}26`, borderColor: `${color}40` },
    ]}
  >
    <Ionicons name={icon} size={11} color={color} />
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);

// ── Gradient "commit" button (create / accept) ──

const PrimaryGradientButton = ({
  icon,
  label,
  onPress,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: !!disabled }}
    style={{ opacity: disabled || loading ? 0.5 : 1 }}
  >
    <LinearGradient colors={[...gradients.primaryGradient]} style={styles.primaryBtnInner}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Ionicons name={icon} size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>{label}</Text>
        </>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

// ── Main Screen ──

export default function HouseholdManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [errored, setErrored] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');

  // Create form
  const [createName, setCreateName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acceptingCode, setAcceptingCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrored(false);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        setErrored(true);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email || '');

      // Fetch household. A genuine "no household" (404) routes to Mode B;
      // any other failure is a real error and must surface as such — never
      // masquerade a network failure as "you have no household".
      try {
        const data = await api.get<any>(`/auth/households/me`, { user_id: user.id });
        setHouseholdId(data.household_id || data.id || null);
        setHouseholdName(data.name || 'My Household');
        setMembers(Array.isArray(data.members) ? data.members : []);

        // Fetch sent invites for this household.
        try {
          const invData = await api.get<Invite[]>(`/auth/households/invites/sent`, {
            user_id: user.id,
            household_id: data.household_id || data.id,
          });
          setPendingInvites(Array.isArray(invData) ? invData : []);
        } catch (e) {
          console.error('Failed to load sent invites:', e);
          setPendingInvites([]);
        }
      } catch (e: any) {
        // Distinguish "no household" (404) from a genuine load failure.
        const status = e?.status ?? e?.statusCode;
        const msg = String(e?.message || '').toLowerCase();
        const isNoHousehold =
          status === 404 ||
          msg.includes('404') ||
          msg.includes('not found') ||
          msg.includes('no household');

        setHouseholdId(null);
        setHouseholdName('');
        setMembers([]);

        if (isNoHousehold) {
          // Mode B — check for an incoming invite so we can show it prominently.
          try {
            const invData = await api.get<Invite[]>(`/auth/households/invites`, {
              user_id: user.id,
            });
            setPendingInvites(Array.isArray(invData) ? invData : []);
          } catch (e2) {
            console.error('Failed to load pending invites:', e2);
            setPendingInvites([]);
          }
        } else {
          console.error('Failed to load household:', e);
          setErrored(true);
        }
      }
    } catch (e) {
      console.error('Household setup load failed:', e);
      setErrored(true);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Actions (functionality preserved verbatim) ──

  const handleCreate = async () => {
    if (!createName.trim()) {
      Alert.alert('Add a name', 'Please enter a household name.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        Alert.alert('Session error', 'Please log in again.');
        return;
      }
      const headers: any = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;

      const res = await fetch(`${api.getBaseUrl()}/auth/households`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ user_id: user.id, name: createName.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      successHaptic();
      Alert.alert('Created', 'Your household has been created.');
      setCreateName('');
      await loadData();
    } catch (e: any) {
      errorHaptic();
      Alert.alert('Error', e.message || 'Could not create household.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Missing email', "Enter your partner's email address.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) return;
      const headers: any = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;

      const res = await fetch(`${api.getBaseUrl()}/auth/households/invite`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          household_id: householdId,
          invitee_email: inviteEmail.trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      Alert.alert('Invite sent', `An invite has been sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (code: string, name: string) => {
    Alert.alert(
      'Accept Invite',
      `Join "${name}"? You can only be in one household at a time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: async () => {
            setAcceptingCode(code);
            try {
              const user = await getCurrentUser();
              if (!user?.id) return;
              const headers: any = { 'Content-Type': 'application/json' };
              if (user.token) headers.Authorization = `Bearer ${user.token}`;

              const res = await fetch(`${api.getBaseUrl()}/auth/households/accept`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ code, user_id: user.id }),
              });
              if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
              }
              Alert.alert('Joined!', `You are now a member of "${name}".`);
              await loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not accept invite.');
            } finally {
              setAcceptingCode(null);
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert('Leave Household', 'Are you sure? You will need a new invite to rejoin.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          // For now, just show a placeholder — backend endpoint needed.
          Alert.alert('Coming soon', 'Leave household will be available in a future update.');
        },
      },
    ]);
  };

  // ── Derived render state ──

  const showSkeleton = loading && !loadedOnce;
  const backgroundRefreshing = loading && loadedOnce;
  const hasIncomingInvite = !householdId && pendingInvites.length > 0;

  // ── Sub-renders ──

  const renderMembers = () => (
    <View>
      <GroupLabel>MEMBERS</GroupLabel>
      <View style={styles.card}>
        {members.map((m, i) => {
          const isYou = m.email === userEmail || m.user_id === userId;
          const isOwner = m.role === 'owner';
          return (
            <View
              key={m.user_id || i}
              style={[styles.memberRow, i > 0 && styles.rowDivider]}
              accessibilityLabel={`${m.email || 'Unknown'}${isYou ? ', you' : ''}, ${
                m.role || 'member'
              }`}
            >
              <View style={[styles.avatar, isYou && styles.avatarYou]}>
                <Text style={styles.avatarText}>
                  {(m.email || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {m.email || 'Unknown'}
                  {isYou ? ' (you)' : ''}
                </Text>
                <Text style={styles.memberRole}>{m.role || 'member'}</Text>
              </View>
              {isOwner && (
                <View style={styles.ownerBadge}>
                  <Ionicons name="star" size={11} color={colors.primary2} />
                  <Text style={styles.ownerBadgeText}>Owner</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderInvitePartner = () => (
    <View>
      <GroupLabel>INVITE PARTNER</GroupLabel>
      <View style={styles.card}>
        <Text style={styles.fieldDesc}>Send an invite to your partner's email.</Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="partner@email.com"
            placeholderTextColor={colors.textDark}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            accessibilityLabel="Partner's email address"
          />
          <TouchableOpacity
            onPress={handleSendInvite}
            disabled={submitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send invite"
            accessibilityHint="Sends an invite to the email you entered."
            style={{ opacity: submitting ? 0.5 : 1 }}
          >
            <LinearGradient colors={[...gradients.primaryGradient]} style={styles.sendBtn}>
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="paper-plane" size={18} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSentInvites = () =>
    pendingInvites.length > 0 && (
      <View>
        <GroupLabel>PENDING INVITES</GroupLabel>
        <View style={styles.card}>
          {pendingInvites.map((inv, i) => {
            const expired = isExpired(inv.expires_at);
            return (
              <View
                key={inv.code || i}
                style={[styles.inviteRow, i > 0 && styles.rowDivider]}
                accessibilityLabel={`Invite to ${inv.invitee_email}, ${
                  expired ? 'expired' : `pending, expires ${formatDate(inv.expires_at)}`
                }`}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={expired ? colors.error : colors.warning}
                />
                <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.sm }}>
                  <Text style={styles.memberEmail} numberOfLines={1}>
                    {inv.invitee_email}
                  </Text>
                  <Text style={styles.subtle}>Expires {formatDate(inv.expires_at)}</Text>
                </View>
                {expired ? (
                  <StatusChip icon="close-circle-outline" label="Expired" color={colors.error} />
                ) : (
                  <StatusChip icon="time-outline" label="Pending" color={colors.warning} />
                )}
              </View>
            );
          })}
        </View>
      </View>
    );

  const renderManage = () => (
    <View>
      <GroupLabel>MANAGE</GroupLabel>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/sharing-preferences')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Sharing Preferences"
        >
          <Ionicons name="share-social-outline" size={18} color={colors.primary2} />
          <Text style={styles.actionText}>Sharing Preferences</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, styles.rowDivider]}
          onPress={() => router.push('/pending-invites')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Your Pending Invites"
        >
          <Ionicons name="mail-unread-outline" size={18} color={colors.info} />
          <Text style={styles.actionText}>Your Pending Invites</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleLeave}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Leave household"
        >
          <Ionicons name="exit-outline" size={16} color={colors.error} />
          <Text style={styles.leaveText}>Leave Household</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderIncomingInvite = () => (
    <View>
      <GroupLabel>YOU'RE INVITED</GroupLabel>
      {pendingInvites.map((inv) => {
        const expired = isExpired(inv.expires_at);
        const isAccepting = acceptingCode === inv.code;
        const name = inv.household_name || 'Household';
        return (
          <View key={inv.code} style={[styles.heroFloating, styles.inviteHero]}>
            <View style={styles.inviteHeaderRow}>
              <View style={styles.inviteIconChip}>
                <Ionicons name="home" size={20} color={colors.primary2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.inviteHeroName} numberOfLines={1}>
                  {name}
                </Text>
                {!!inv.inviter_email && (
                  <Text style={styles.subtle} numberOfLines={1}>
                    Invited by {inv.inviter_email}
                  </Text>
                )}
              </View>
            </View>
            {expired ? (
              <View style={styles.expiredRow}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
                <Text style={styles.expiredText}>This invite has expired</Text>
              </View>
            ) : (
              <PrimaryGradientButton
                icon="checkmark-circle-outline"
                label="Accept & Join"
                loading={isAccepting}
                onPress={() => handleAcceptInvite(inv.code, name)}
                accessibilityLabel={`Accept and join ${name}`}
                accessibilityHint="Joins this household. You can only be in one household at a time."
              />
            )}
          </View>
        );
      })}
    </View>
  );

  const renderCreateForm = (hero: boolean) => {
    const disabled = submitting || !createName.trim();
    const input = (
      <TextInput
        placeholder="e.g. The Johnsons, Casa del Amor"
        placeholderTextColor={colors.textDark}
        value={createName}
        onChangeText={setCreateName}
        style={styles.input}
        accessibilityLabel="Household name"
      />
    );

    if (hero) {
      return (
        <View style={[styles.heroFloating, styles.createHero]}>
          <View style={styles.heroIconChip}>
            <Ionicons name="home-outline" size={40} color={colors.primary2} />
          </View>
          <Text style={styles.heroTitle}>Start your household</Text>
          <Text style={styles.heroSubCentered}>
            Share budgets, transactions & goals with your partner. Give your shared space a name.
          </Text>
          <View style={{ width: '100%', marginTop: spacing.lg, gap: spacing.md }}>
            {input}
            <PrimaryGradientButton
              icon="add-circle-outline"
              label={submitting ? 'Creating…' : 'Create Household'}
              disabled={disabled}
              onPress={handleCreate}
              accessibilityLabel="Create household"
            />
          </View>
        </View>
      );
    }

    // Demoted variant (invite present) — secondary weight so it loses the fight.
    return (
      <View>
        <GroupLabel>OR CREATE YOUR OWN</GroupLabel>
        <View style={styles.card}>
          <Text style={styles.fieldDesc}>Give your shared space a name.</Text>
          {input}
          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: spacing.sm }, disabled && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Create household"
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary2} />
            <Text style={styles.secondaryBtnText}>
              {submitting ? 'Creating…' : 'Create Household'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderGotInvite = () => (
    <View>
      <GroupLabel>GOT AN INVITE?</GroupLabel>
      <View style={styles.card}>
        <Text style={styles.fieldDesc}>
          If your partner already sent you an invite, check your pending invites.
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { marginTop: spacing.sm }]}
          onPress={() => router.push('/pending-invites')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Check pending invites"
        >
          <Ionicons name="mail-unread-outline" size={16} color={colors.primary2} />
          <Text style={styles.secondaryBtnText}>Check Pending Invites</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Body ──

  let body: React.ReactNode;

  if (showSkeleton) {
    body = (
      <View style={styles.skeletonBlock}>
        <Skeleton height={120} borderRadius={radius.xl} />
        <Skeleton height={12} width={96} borderRadius={radius.sm} />
        <Skeleton height={92} borderRadius={radius.lg} />
        <Skeleton height={88} borderRadius={radius.lg} />
        <Skeleton height={64} borderRadius={radius.md} />
      </View>
    );
  } else if (errored) {
    body = (
      <View style={styles.noticeCard}>
        <Ionicons name="alert-circle-outline" size={26} color={colors.error} />
        <Text style={styles.noticeTitle}>Couldn't load your household</Text>
        <Text style={styles.noticeSub}>Check your connection and try again.</Text>
        <TouchableOpacity
          onPress={loadData}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.noticeAction}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (householdId) {
    // ── Mode A — HAS household ──
    const isOwner = members.some(
      (m) => (m.email === userEmail || m.user_id === userId) && m.role === 'owner'
    );
    body = (
      <>
        <View
          style={[styles.heroFloating, styles.hero]}
          accessibilityLabel={`${householdName}, ${members.length} member${
            members.length !== 1 ? 's' : ''
          }, you are ${isOwner ? 'owner' : 'member'}`}
        >
          <View style={styles.heroIconChip}>
            <Ionicons name="home" size={28} color={colors.primary2} />
          </View>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {householdName}
          </Text>
          <Text style={styles.heroSubCentered} numberOfLines={2}>
            {members.length} member{members.length !== 1 ? 's' : ''} ·{' '}
            {isOwner ? 'owner you' : 'member'}
          </Text>
        </View>

        {renderMembers()}
        {renderInvitePartner()}
        {renderSentInvites()}
        {renderManage()}
      </>
    );
  } else if (hasIncomingInvite) {
    // ── Mode B — invited (invite is hero, create demoted) ──
    body = (
      <>
        {renderIncomingInvite()}
        {renderCreateForm(false)}
      </>
    );
  } else {
    // ── Mode B — no invite (create is hero) = true empty state ──
    body = (
      <>
        {renderCreateForm(true)}
        {renderGotInvite()}
      </>
    );
  }

  // ── Render ──

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />
          <Text style={styles.title} accessibilityRole="header">
            Household
          </Text>
          <View style={styles.headerRight}>
            {backgroundRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary2} />
            ) : null}
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  // Header (identical rhythm to calendar)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, ...typography.h3, fontWeight: '800' },
  headerRight: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },

  // Group labels (above cards)
  groupLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },

  // Flat glass card
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
  },

  // The one floating hero per screen
  heroFloating: {
    ...glassEffects.glassFloating,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroIconChip: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: `${colors.primary2}26`,
    borderWidth: 1,
    borderColor: `${colors.primary2}33`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubCentered: {
    color: colors.textMuted,
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Create hero (onboarding voice)
  createHero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },

  // Incoming invite hero
  inviteHero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    backgroundColor: `${colors.primary2}14`,
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inviteIconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1f`,
    borderWidth: 1,
    borderColor: `${colors.primary2}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteHeroName: { color: colors.text, ...typography.bodyBold, fontWeight: '700' },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  expiredText: { color: colors.textMuted, ...typography.small },

  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderGlass,
    marginVertical: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarYou: { backgroundColor: `${colors.primary}33` },
  avatarText: { color: colors.text, ...typography.bodyBold, fontWeight: '700' },
  memberEmail: { color: colors.text, ...typography.smallBold },
  memberRole: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 1,
    textTransform: 'capitalize',
  },

  // Owner badge (icon + word)
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: `${colors.primary2}26`,
    borderWidth: 1,
    borderColor: `${colors.primary2}40`,
  },
  ownerBadgeText: { color: colors.primary2, ...typography.caption, fontWeight: '700' },

  // Field description / subtle text
  fieldDesc: {
    color: colors.textMuted,
    ...typography.small,
    marginBottom: spacing.sm,
  },
  subtle: { color: colors.textMuted, ...typography.caption, marginTop: 1 },

  // Status chip (Pending / Expired)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipText: { ...typography.caption, fontWeight: '700' },

  // Sent invite row
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  // Input + send
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    ...glassEffects.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.smallBold,
    fontWeight: '400',
    marginBottom: spacing.sm,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Manage rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  actionText: { flex: 1, color: colors.text, ...typography.smallBold },

  // Buttons
  primaryBtnInner: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryBtnText: { color: '#fff', ...typography.button, fontWeight: '800' },
  secondaryBtn: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
  },
  secondaryBtnText: { color: colors.primary2, ...typography.smallBold, fontWeight: '700' },

  // Leave (destructive)
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${colors.error}1a`,
    borderWidth: 1,
    borderColor: `${colors.error}26`,
  },
  leaveText: { color: colors.error, ...typography.smallBold, fontWeight: '700' },

  // Loading skeleton
  skeletonBlock: { gap: spacing.md },

  // Error notice (matches calendar noticeCard)
  noticeCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeTitle: { color: colors.text, ...typography.bodyBold, fontWeight: '700', textAlign: 'center' },
  noticeSub: {
    color: colors.textMuted,
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  noticeAction: { color: colors.primary2, ...typography.smallBold, fontWeight: '700', marginTop: spacing.xs },
});
