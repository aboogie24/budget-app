import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/utils/apiClient';
import { getLinkedAccountStatus, createUpdateLinkToken, resetLinkedAccountError } from '@/utils/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCard } from '@/components/SkeletonLoader';

const APP_SCHEME = 'budgetapp';

type LinkedAccountStatus = {
  id: string;
  institution_name: string;
  item_status: 'good' | 'pending_expiration' | 'error' | 'revoked';
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export default function LinkedAccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LinkedAccountStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reAuthLoading, setReAuthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_URL = api.getBaseUrl();

  /* ── Load linked accounts with status ───────────────────────────── */
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLinkedAccountStatus();
      setAccounts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load linked accounts:', e);
      setError(e?.message || 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAccounts();
    setRefreshing(false);
  }, [loadAccounts]);

  /* ── Get status badge color ───────────────────────────────────── */
  const getStatusBadge = (status: LinkedAccountStatus['item_status']) => {
    switch (status) {
      case 'good':
        return { color: '#10b981', label: 'Connected' };
      case 'pending_expiration':
        return { color: '#f59e0b', label: 'Needs Attention' };
      case 'error':
        return { color: '#ef4444', label: 'Error' };
      case 'revoked':
        return { color: '#6b7280', label: 'Revoked' };
      default:
        return { color: '#94a3b8', label: status };
    }
  };

  /* ── Re-authenticate account ─────────────────────────────────── */
  const handleReAuth = async (accountId: string) => {
    setReAuthLoading(accountId);
    try {
      // Get update link token
      const tokenData = await createUpdateLinkToken(accountId);
      const linkToken = tokenData?.link_token;

      if (!linkToken) {
        Alert.alert('Error', 'Failed to get link token');
        setReAuthLoading(null);
        return;
      }

      // Open Plaid Link in browser
      const url = `${API_URL}/plaid/link-page?token=${encodeURIComponent(linkToken)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, `${APP_SCHEME}://`);

      if (result.type === 'success' && result.url) {
        const safe = result.url.replace(`${APP_SCHEME}://`, 'https://app/');
        const parsed = new URL(safe);
        const path = parsed.hostname === 'app' ? parsed.pathname.replace('/', '') : parsed.hostname;

        if (path === 'plaid-success') {
          // Clear the error state after successful re-auth
          await resetLinkedAccountError(accountId);
          Alert.alert('Success', 'Account re-authenticated successfully.');
          await loadAccounts();
        }
      }
    } catch (e: any) {
      console.error('Re-auth error:', e);
      Alert.alert('Error', 'Failed to re-authenticate: ' + e.message);
    } finally {
      setReAuthLoading(null);
    }
  };

  /* ── Render: Loading state ──────────────────────────────────── */
  if (loading) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#c084fc" />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headerSection}>
              <View style={styles.headerIcon}>
                <Ionicons name="link-outline" size={40} color="#c084fc" />
              </View>
              <Text style={styles.headerTitle}>Linked Accounts</Text>
              <Text style={styles.headerSubtitle}>
                Manage your connected bank accounts and sync status
              </Text>
            </View>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  /* ── Render: Main screen ──────────────────────────────────────── */
  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#c084fc" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerIcon}>
              <Ionicons name="link-outline" size={40} color="#c084fc" />
            </View>
            <Text style={styles.headerTitle}>Linked Accounts</Text>
            <Text style={styles.headerSubtitle}>
              Manage your connected bank accounts and sync status
            </Text>
          </View>

          {/* Error state */}
          {error && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                loadAccounts();
              }}
            />
          )}

          {/* Empty state */}
          {!error && accounts.length === 0 && (
            <EmptyState
              icon="link-outline"
              title="No linked accounts"
              description="Start by linking your first bank account to get started"
              actionLabel="Link Account"
              onAction={() => router.push('/link-account')}
            />
          )}

          {/* Accounts list */}
          {accounts.length > 0 && (
            <View style={styles.accountsList}>
              {accounts.map((account) => {
                const badge = getStatusBadge(account.item_status);
                const hasError = account.item_status === 'error' || account.item_status === 'pending_expiration';

                return (
                  <View key={account.id} style={styles.accountCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardLeft}>
                        <View style={styles.bankIcon}>
                          <Ionicons name="business-outline" size={24} color="#c084fc" />
                        </View>
                        <View style={styles.cardTitle}>
                          <Text style={styles.accountName}>{account.institution_name}</Text>
                          <Text style={styles.accountDate}>
                            Linked {new Date(account.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${badge.color}18` },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: badge.color },
                          ]}
                        />
                        <Text style={[styles.statusLabel, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Error section */}
                    {hasError && account.error_code && (
                      <View style={styles.errorSection}>
                        <View style={styles.errorContent}>
                          <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.errorLabel}>
                              {account.item_status === 'pending_expiration'
                                ? 'Authentication Expired'
                                : 'Connection Issue'}
                            </Text>
                            <Text style={styles.errorDesc}>{account.error_code}</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.reAuthBtn, reAuthLoading === account.id && styles.btnDisabled]}
                          onPress={() => handleReAuth(account.id)}
                          disabled={reAuthLoading === account.id}
                          activeOpacity={0.7}
                        >
                          {reAuthLoading === account.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="refresh-outline" size={14} color="#fff" />
                              <Text style={styles.reAuthBtnText}>Re-authenticate</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Last synced info */}
                    {!hasError && (
                      <Text style={styles.syncedText}>
                        Last synced {new Date(account.updated_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Link new account button */}
          {accounts.length > 0 && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/link-account')}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.linkButtonText}>Link New Account</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  /* Back button */
  backBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header */
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(192,132,252,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  /* Error state */
  errorText: {
    color: '#f87171',
    backgroundColor: 'rgba(248,113,113,0.1)',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  /* Accounts list */
  accountsList: {
    gap: 12,
    marginBottom: 24,
  },

  accountCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.15)',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },

  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardTitle: {
    flex: 1,
  },

  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },

  accountDate: {
    fontSize: 12,
    color: '#64748b',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Error section */
  errorSection: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },

  errorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },

  errorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },

  errorDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  reAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },

  reAuthBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  btnDisabled: {
    opacity: 0.6,
  },

  syncedText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },

  /* Link button */
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },

  linkButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
