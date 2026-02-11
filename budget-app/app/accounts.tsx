import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAccountBalances, syncPlaidBalances } from '@/utils/api';

type Account = {
  id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  current_balance: number;
  available_balance?: number;
  iso_currency_code?: string;
  institution_name?: string;
  mask?: string;
  updated_at?: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  depository: { label: 'Cash', color: '#60a5fa', icon: 'wallet-outline' },
  credit: { label: 'Credit', color: '#f87171', icon: 'card-outline' },
  loan: { label: 'Loans', color: '#fbbf24', icon: 'document-text-outline' },
  investment: { label: 'Investments', color: '#34d399', icon: 'trending-up-outline' },
  other: { label: 'Other', color: '#94a3b8', icon: 'ellipsis-horizontal-outline' },
};

export default function AccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAccountBalances();
      setAccounts(Array.isArray(data) ? data as Account[] : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPlaidBalances();
      await load();
    } catch {
    } finally {
      setSyncing(false);
    }
  };

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const totalBalance = accounts.reduce((sum, a) => {
    if (a.type === 'credit' || a.type === 'loan') return sum - (a.current_balance || 0);
    return sum + (a.current_balance || 0);
  }, 0);

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const subtypeLabel = (s?: string) => {
    if (!s) return '';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#c084fc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Accounts</Text>
          <TouchableOpacity onPress={handleSync} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator size="small" color="#c084fc" />
            ) : (
              <Ionicons name="sync-outline" size={20} color="#c084fc" />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#c084fc" />
          </View>
        ) : accounts.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Ionicons name="business-outline" size={48} color="#64748b" />
            <Text style={styles.emptyTitle}>No accounts linked</Text>
            <Text style={styles.emptyText}>Link a bank account to see your balances here.</Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/link-account')}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.linkBtnText}>Link Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            {/* Net total card */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Net Balance</Text>
              <Text style={[styles.totalAmount, { color: totalBalance >= 0 ? '#34d399' : '#f87171' }]}>
                {totalBalance < 0 ? '-' : ''}{formatCurrency(Math.abs(totalBalance))}
              </Text>
              <Text style={styles.totalSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''} across {Object.keys(grouped).length} institution{Object.keys(grouped).length !== 1 ? 's' : ''}</Text>
            </View>

            {/* Grouped by type */}
            {['depository', 'investment', 'credit', 'loan', 'other'].map((type) => {
              const group = grouped[type];
              if (!group || group.length === 0) return null;
              const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
              const groupTotal = group.reduce((sum, a) => sum + (a.current_balance || 0), 0);

              return (
                <View key={type} style={{ marginTop: 16 }}>
                  <View style={styles.groupHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name={config.icon as any} size={16} color={config.color} />
                      <Text style={[styles.groupLabel, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <Text style={[styles.groupTotal, { color: config.color }]}>{formatCurrency(groupTotal)}</Text>
                  </View>

                  {group.map((a) => (
                    <View key={a.id} style={styles.accountCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accountName}>{a.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          {a.institution_name && (
                            <Text style={styles.accountMeta}>{a.institution_name}</Text>
                          )}
                          {a.mask && (
                            <Text style={styles.accountMeta}>{"••" + a.mask}</Text>
                          )}
                          {a.subtype && (
                            <View style={styles.subtypeBadge}>
                              <Text style={styles.subtypeText}>{subtypeLabel(a.subtype)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.accountBalance, { color: config.color }]}>
                          {formatCurrency(a.current_balance || 0)}
                        </Text>
                        {a.available_balance != null && a.available_balance !== a.current_balance && (
                          <Text style={styles.availableText}>{formatCurrency(a.available_balance)} avail</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}

            {/* Link more */}
            <TouchableOpacity style={styles.addRow} onPress={() => router.push('/link-account')}>
              <Ionicons name="add-circle-outline" size={18} color="#c084fc" />
              <Text style={styles.addRowText}>Link another account</Text>
            </TouchableOpacity>

            {accounts[0]?.updated_at && (
              <Text style={styles.updatedText}>
                Last synced {new Date(accounts[0].updated_at).toLocaleString()}
              </Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },

  /* Total card */
  totalCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  totalLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  totalAmount: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  totalSub: { color: '#64748b', fontSize: 12, marginTop: 6 },

  /* Group */
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupLabel: { fontSize: 13, fontWeight: '700' },
  groupTotal: { fontSize: 14, fontWeight: '700' },

  /* Account card */
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  accountName: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  accountMeta: { color: '#94a3b8', fontSize: 11 },
  accountBalance: { fontSize: 15, fontWeight: '800' },
  availableText: { color: '#64748b', fontSize: 11, marginTop: 2 },
  subtypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  subtypeText: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },

  /* Empty */
  emptyTitle: { color: '#cbd5e1', fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyText: { color: '#64748b', fontSize: 14, marginTop: 6, textAlign: 'center' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  linkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* Add row */
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(192,132,252,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  addRowText: { color: '#c084fc', fontWeight: '700', fontSize: 14 },
  updatedText: { color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 12 },
});
