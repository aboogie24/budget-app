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
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';

type Invite = {
  code: string;
  household_id: string;
  household_name: string;
  created_by: string;
  inviter_email?: string;
  expires_at: string;
  invitee_email?: string;
};

export default function PendingInvitesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user?.id) return;

      const data = await api.get(`/auth/households/invites`, { user_id: user.id });
      setInvites(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load invites:', e);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  useFocusEffect(
    useCallback(() => {
      loadInvites();
    }, [loadInvites])
  );

  const handleAccept = async (code: string, householdName: string) => {
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
      ]
    );
  };

  const daysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day left';
    return `${days} days left`;
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
          <Text style={styles.headerText}>Pending Invites</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {invites.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="mail-open-outline" size={40} color="#64748b" />
              </View>
              <Text style={styles.emptyTitle}>No Pending Invites</Text>
              <Text style={styles.emptySub}>
                When someone invites you to their household, it will appear here.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.countText}>
                {invites.length} invite{invites.length !== 1 ? 's' : ''} waiting
              </Text>
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at).getTime() < Date.now();
                const isAccepting = accepting === inv.code;

                return (
                  <View key={inv.code} style={styles.inviteCard}>
                    <View style={styles.inviteHeader}>
                      <View style={styles.inviteIcon}>
                        <Ionicons name="home" size={20} color="#c084fc" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inviteName}>{inv.household_name || 'Household'}</Text>
                        {inv.inviter_email && (
                          <Text style={styles.inviterText}>
                            Invited by {inv.inviter_email}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.inviteMeta}>
                      <View style={[styles.expiryChip, expired && styles.expiryChipExpired]}>
                        <Ionicons
                          name={expired ? 'alert-circle-outline' : 'time-outline'}
                          size={12}
                          color={expired ? '#f87171' : '#fbbf24'}
                        />
                        <Text style={[styles.expiryText, expired && styles.expiryTextExpired]}>
                          {daysUntil(inv.expires_at)}
                        </Text>
                      </View>
                    </View>

                    {!expired && (
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAccept(inv.code, inv.household_name)}
                        disabled={isAccepting}
                      >
                        <LinearGradient
                          colors={['#a855f7', '#7c3aed']}
                          style={styles.acceptBtnInner}
                        >
                          {isAccepting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                              <Text style={styles.acceptBtnText}>Accept & Join</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {expired && (
                      <View style={styles.expiredBar}>
                        <Ionicons name="close-circle-outline" size={16} color="#f87171" />
                        <Text style={styles.expiredText}>This invite has expired</Text>
                      </View>
                    )}
                  </View>
                );
              })}
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

  /* Count */
  countText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },

  /* Invite card */
  inviteCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  inviteName: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  inviterText: { color: '#94a3b8', fontSize: 13, marginTop: 2 },

  /* Meta */
  inviteMeta: { flexDirection: 'row', gap: 8 },
  expiryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  expiryChipExpired: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.15)',
  },
  expiryText: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  expiryTextExpired: { color: '#f87171' },

  /* Accept */
  acceptBtn: {},
  acceptBtnInner: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  /* Expired */
  expiredBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.12)',
  },
  expiredText: { color: '#f87171', fontWeight: '600', fontSize: 14 },

  /* Empty */
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginBottom: 8 },
  emptySub: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
