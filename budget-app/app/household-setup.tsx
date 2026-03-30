import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { successHaptic, errorHaptic } from '@/utils/haptics';

type Member = { user_id: string; email: string; role?: string };
type Invite = {
  code: string;
  invitee_email: string;
  expires_at: string;
  household_id: string;
  household_name?: string;
  inviter_email?: string;
};

export default function HouseholdManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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
    try {
      const user = await getCurrentUser();
      if (!user?.id) return;
      setUserId(user.id);
      setUserEmail(user.email || '');

      // Fetch household
      try {
        const data = await api.get(`/auth/households/me`, { user_id: user.id });
        setHouseholdId(data.household_id || data.id || null);
        setHouseholdName(data.name || 'My Household');
        setMembers(Array.isArray(data.members) ? data.members : []);

        // Fetch sent invites for this household
        try {
          const invData = await api.get(`/auth/households/invites/sent`, {
            user_id: user.id,
            household_id: data.household_id || data.id,
          });
          setPendingInvites(Array.isArray(invData) ? invData : []);
        } catch (e) {
          console.error('Failed to load sent invites:', e);
        }
      } catch (e) {
        console.error('Failed to load household:', e);
        setHouseholdId(null);
        setMembers([]);

        // No household — check for pending invites so we can show them prominently
        try {
          const invData = await api.get(`/auth/households/invites`, { user_id: user.id });
          setPendingInvites(Array.isArray(invData) ? invData : []);
        } catch (e2) {
          console.error('Failed to load pending invites:', e2);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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

      const res = await fetch(`${API_URL}/auth/households`, {
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
      Alert.alert('Missing email', 'Enter your partner\'s email address.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) return;
      const headers: any = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;

      const res = await fetch(`${API_URL}/auth/households/invite`, {
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

  const handleAcceptInvite = async (code: string, householdName: string) => {
    Alert.alert(
      'Accept Invite',
      `Join "${householdName}"? You can only be in one household at a time.`,
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

              const res = await fetch(`${API_URL}/auth/households/accept`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ code, user_id: user.id }),
              });
              if (!res.ok) {
                const text = await res.text();
                throw new Error(text);
              }
              Alert.alert('Joined!', `You are now a member of "${householdName}".`);
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
    Alert.alert(
      'Leave Household',
      'Are you sure? You will need a new invite to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            // For now, just show a placeholder — backend endpoint needed
            Alert.alert('Coming soon', 'Leave household will be available in a future update.');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#c084fc" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/settings')}>
            <Ionicons name="arrow-back" size={20} color="#c084fc" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Household</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {householdId ? (
            /* ─── HAS HOUSEHOLD ─── */
            <>
              {/* Household info */}
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Ionicons name="home" size={28} color="#c084fc" />
                </View>
                <Text style={styles.heroTitle}>{householdName}</Text>
                <Text style={styles.heroSub}>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Members */}
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>MEMBERS</Text>
                {members.map((m, i) => {
                  const isYou = m.email === userEmail || m.user_id === userId;
                  return (
                    <View key={m.user_id || i} style={styles.memberRow}>
                      <View style={[styles.memberAvatar, isYou && styles.memberAvatarYou]}>
                        <Text style={styles.memberAvatarText}>
                          {(m.email || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberEmail}>
                          {m.email || 'Unknown'}{isYou ? ' (you)' : ''}
                        </Text>
                        <Text style={styles.memberRole}>{m.role || 'member'}</Text>
                      </View>
                      {m.role === 'owner' && (
                        <View style={styles.ownerBadge}>
                          <Text style={styles.ownerBadgeText}>Owner</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Pending invites */}
              {pendingInvites.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>PENDING INVITES</Text>
                  {pendingInvites.map((inv, i) => (
                    <View key={inv.code || i} style={styles.inviteRow}>
                      <Ionicons name="mail-outline" size={16} color="#fbbf24" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.inviteEmail}>{inv.invitee_email}</Text>
                        <Text style={styles.inviteExpiry}>
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.pendingChip}>
                        <Text style={styles.pendingChipText}>Pending</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Send invite */}
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>INVITE PARTNER</Text>
                <Text style={styles.fieldDesc}>
                  Send an invite link to your partner's email address.
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    placeholder="partner@email.com"
                    placeholderTextColor="#475569"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleSendInvite}
                    disabled={submitting}
                  >
                    <Ionicons name="paper-plane" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>ACTIONS</Text>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => router.push('/sharing-preferences')}
                >
                  <Ionicons name="share-social-outline" size={18} color="#c084fc" />
                  <Text style={styles.actionText}>Sharing Preferences</Text>
                  <Ionicons name="chevron-forward" size={14} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => router.push('/pending-invites')}
                >
                  <Ionicons name="mail-unread-outline" size={18} color="#60a5fa" />
                  <Text style={styles.actionText}>Your Pending Invites</Text>
                  <Ionicons name="chevron-forward" size={14} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
                  <Ionicons name="exit-outline" size={16} color="#f87171" />
                  <Text style={styles.leaveText}>Leave Household</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ─── NO HOUSEHOLD ─── */
            <>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="home-outline" size={40} color="#c084fc" />
                </View>
                <Text style={styles.emptyTitle}>No Household Yet</Text>
                <Text style={styles.emptySub}>
                  {pendingInvites.length > 0
                    ? 'You have a pending invite! Accept it to join your partner\'s household.'
                    : 'Create a household to start sharing budgets, transactions, and goals with your partner.'}
                </Text>
              </View>

              {/* Show pending invites first if any exist */}
              {pendingInvites.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>PENDING INVITES</Text>
                  <Text style={styles.fieldDesc}>
                    Your partner has invited you to join their household.
                  </Text>
                  {pendingInvites.map((inv) => {
                    const expired = new Date(inv.expires_at).getTime() < Date.now();
                    const isAccepting = acceptingCode === inv.code;
                    return (
                      <View key={inv.code} style={styles.inlineInviteCard}>
                        <View style={styles.inlineInviteHeader}>
                          <View style={styles.inlineInviteIcon}>
                            <Ionicons name="home" size={20} color="#c084fc" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inviteEmail}>
                              {inv.household_name || 'Household'}
                            </Text>
                            {inv.inviter_email && (
                              <Text style={styles.inviteExpiry}>
                                Invited by {inv.inviter_email}
                              </Text>
                            )}
                          </View>
                        </View>
                        {!expired ? (
                          <TouchableOpacity
                            onPress={() => handleAcceptInvite(inv.code, inv.household_name || 'Household')}
                            disabled={isAccepting}
                          >
                            <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.primaryBtnInner}>
                              {isAccepting ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                                  <Text style={styles.primaryBtnText}>Accept & Join</Text>
                                </>
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.inviteExpiry}>This invite has expired</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.card}>
                <Text style={styles.sectionLabel}>
                  {pendingInvites.length > 0 ? 'OR CREATE YOUR OWN' : 'CREATE HOUSEHOLD'}
                </Text>
                <Text style={styles.fieldDesc}>Give your shared space a name.</Text>
                <TextInput
                  placeholder="e.g., The Johnsons, Casa del Amor"
                  placeholderTextColor="#475569"
                  value={createName}
                  onChangeText={setCreateName}
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleCreate}
                  disabled={submitting}
                >
                  <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.primaryBtnInner}>
                    <Ionicons name="add-circle-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>
                      {submitting ? 'Creating...' : 'Create Household'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Link to full pending invites screen */}
              {pendingInvites.length === 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>GOT AN INVITE?</Text>
                  <Text style={styles.fieldDesc}>
                    If your partner already created a household and sent you an invite, check your pending invites.
                  </Text>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.push('/pending-invites')}
                  >
                    <Ionicons name="mail-unread-outline" size={16} color="#c084fc" />
                    <Text style={styles.secondaryBtnText}>Check Pending Invites</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerText: { fontSize: 18, fontWeight: '800', color: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40, gap: 14 },

  /* Hero card */
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(192,132,252,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#f8fafc' },
  heroSub: { color: '#94a3b8', fontSize: 14, marginTop: 4 },

  /* Cards */
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 2,
  },
  fieldDesc: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 4 },

  /* Members */
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarYou: { backgroundColor: 'rgba(168,85,247,0.2)' },
  memberAvatarText: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  memberEmail: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  memberRole: { color: '#64748b', fontSize: 12, marginTop: 1, textTransform: 'capitalize' },
  ownerBadge: {
    backgroundColor: 'rgba(168,85,247,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  ownerBadgeText: { color: '#c084fc', fontSize: 11, fontWeight: '700' },

  /* Invites */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  inviteEmail: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  inviteExpiry: { color: '#64748b', fontSize: 12, marginTop: 1 },
  pendingChip: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  pendingChipText: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },

  /* Input + send */
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
    marginBottom: 8,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Actions */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  actionText: { flex: 1, color: '#f8fafc', fontWeight: '600', fontSize: 15 },

  /* Buttons */
  primaryBtn: { marginTop: 4 },
  primaryBtnInner: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: { color: '#c084fc', fontWeight: '700', fontSize: 15 },

  /* Leave */
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    backgroundColor: 'rgba(248,113,113,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.15)',
  },
  leaveText: { color: '#f87171', fontWeight: '700' },

  /* Inline invite cards (no-household state) */
  inlineInviteCard: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  inlineInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineInviteIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(192,132,252,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.15)',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  emptySub: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
