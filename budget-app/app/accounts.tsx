import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAccountBalances, syncPlaidBalances } from '@/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string; bgColor: string }> = {
  depository: { label: 'Cash', color: '#60a5fa', icon: 'wallet-outline', bgColor: 'rgba(96,165,250,0.12)' },
  credit: { label: 'Credit', color: '#f87171', icon: 'card-outline', bgColor: 'rgba(248,113,113,0.12)' },
  loan: { label: 'Loans', color: '#fbbf24', icon: 'document-text-outline', bgColor: 'rgba(251,191,36,0.12)' },
  investment: { label: 'Investments', color: '#34d399', icon: 'trending-up-outline', bgColor: 'rgba(52,211,153,0.12)' },
  other: { label: 'Other', color: '#94a3b8', icon: 'ellipsis-horizontal-outline', bgColor: 'rgba(148,163,184,0.12)' },
};

// Allocation bar component
const AllocationBar = ({ segments }: { segments: { label: string; pct: number; color: string }[] }) => (
  <View style={styles.allocationBarContainer}>
    <View style={styles.allocationBarTrack}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{
            height: '100%',
            width: `${seg.pct}%` as any,
            backgroundColor: seg.color,
            borderRadius: i === 0 ? 4 : i === segments.length - 1 ? 4 : 0,
            borderTopLeftRadius: i === 0 ? 4 : 0,
            borderBottomLeftRadius: i === 0 ? 4 : 0,
            borderTopRightRadius: i === segments.length - 1 ? 4 : 0,
            borderBottomRightRadius: i === segments.length - 1 ? 4 : 0,
          }}
        />
      ))}
    </View>
    <View style={styles.allocationLegend}>
      {segments.map((seg, i) => (
        <View key={i} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
          <Text style={styles.legendLabel}>{seg.label}</Text>
          <Text style={styles.legendPct}>{seg.pct}%</Text>
        </View>
      ))}
    </View>
  </View>
);

// Collapsible section header
const SectionHeader = ({
  title,
  count,
  total,
  expanded,
  onToggle,
  balanceVisible,
  isDebt,
}: {
  title: string;
  count: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  balanceVisible: boolean;
  isDebt: boolean;
}) => (
  <TouchableOpacity activeOpacity={0.7} onPress={onToggle} style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      <Ionicons
        name={expanded ? 'chevron-down' : 'chevron-forward'}
        size={16}
        color="rgba(255,255,255,0.4)"
      />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </View>
    <Text style={[styles.sectionTotal, { color: isDebt ? '#ef4444' : '#10b981' }]}>
      {balanceVisible ? formatCurrency(total) : '••••••'}
    </Text>
  </TouchableOpacity>
);

// Format currency helper
function formatCurrency(v: number): string {
  const abs = Math.abs(v);
  const prefix = v < 0 ? '-' : '';
  return prefix + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  const prefix = v < 0 ? '-' : '';
  if (abs >= 1000) {
    return prefix + '$' + (abs / 1000).toFixed(abs >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  }
  return prefix + '$' + abs.toLocaleString();
}

export default function AccountsScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>('assets');
  const spinAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const data = await fetchAccountBalances();
      setAccounts(Array.isArray(data) ? (data as Account[]) : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();
    try {
      await syncPlaidBalances();
      await load();
    } catch {
      // silent
    } finally {
      setSyncing(false);
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Group accounts
  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  // Calculate totals
  const totalAssets = accounts
    .filter((a) => a.type !== 'credit' && a.type !== 'loan')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0);

  const totalDebts = accounts
    .filter((a) => a.type === 'credit' || a.type === 'loan')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0);

  const netBalance = totalAssets - totalDebts;

  // Build asset allocation segments
  const assetTypes = ['depository', 'investment', 'other'].filter((t) => grouped[t]?.length);
  const allocationSegments = assetTypes.map((type) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
    const typeTotal = (grouped[type] || []).reduce((s, a) => s + (a.current_balance || 0), 0);
    const pct = totalAssets > 0 ? Math.round((typeTotal / totalAssets) * 100) : 0;
    return { label: config.label, pct, color: config.color, amount: typeTotal };
  });

  // Asset accounts and debt accounts
  const assetAccounts = accounts.filter((a) => a.type !== 'credit' && a.type !== 'loan');
  const debtAccounts = accounts.filter((a) => a.type === 'credit' || a.type === 'loan');

  const subtypeLabel = (s?: string) => {
    if (!s) return '';
    return s
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const renderAccountRow = (account: Account) => {
    const config = TYPE_CONFIG[account.type] || TYPE_CONFIG.other;
    const isDebt = account.type === 'credit' || account.type === 'loan';

    return (
      <View key={account.id} style={styles.accountCard}>
        {/* Icon badge */}
        <View style={[styles.accountIcon, { backgroundColor: config.bgColor }]}>
          <Ionicons name={config.icon as any} size={18} color={config.color} />
        </View>

        {/* Account info */}
        <View style={styles.accountInfo}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.name}
          </Text>
          <View style={styles.accountMetaRow}>
            {account.institution_name ? (
              <Text style={styles.accountMeta}>{account.institution_name}</Text>
            ) : null}
            {account.mask ? (
              <Text style={styles.accountMeta}>{'••' + account.mask}</Text>
            ) : null}
            {account.subtype ? (
              <View style={styles.subtypeBadge}>
                <Text style={styles.subtypeText}>{subtypeLabel(account.subtype)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Balance */}
        <View style={styles.accountBalanceCol}>
          <Text style={[styles.accountBalance, { color: isDebt ? '#ef4444' : config.color }]}>
            {balanceVisible ? formatCurrency(account.current_balance || 0) : '••••••'}
          </Text>
          {account.available_balance != null && account.available_balance !== account.current_balance ? (
            <Text style={styles.availableText}>
              {balanceVisible ? formatCurrency(account.available_balance) + ' avail' : ''}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.navigate('/(tabs)/goals' as any)}
          >
            <Ionicons name="arrow-back" size={22} color="#c084fc" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Accounts</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setBalanceVisible(!balanceVisible)}
              style={styles.headerIconBtn}
            >
              <Ionicons
                name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="rgba(255,255,255,0.5)"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.headerIconBtn}>
              {syncing ? (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="sync-outline" size={18} color="#c084fc" />
                </Animated.View>
              ) : (
                <Ionicons name="sync-outline" size={18} color="rgba(255,255,255,0.5)" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#c084fc" />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        ) : accounts.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="business-outline" size={40} color="#a855f7" />
            </View>
            <Text style={styles.emptyTitle}>No accounts linked</Text>
            <Text style={styles.emptyText}>
              Connect your bank accounts to track balances, spending, and net worth together as a couple.
            </Text>
            <TouchableOpacity onPress={() => router.push('/link-account')}>
              <LinearGradient
                colors={['#7c3aed', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.linkBtn}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.linkBtnText}>Link Bank Account</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#c084fc"
                colors={['#c084fc']}
              />
            }
          >
            {/* Net Balance Hero Card */}
            <LinearGradient
              colors={['rgba(124,58,237,0.15)', 'rgba(16,185,129,0.06)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroLabel}>Net Balance</Text>
              <Text
                style={[
                  styles.heroAmount,
                  { color: netBalance >= 0 ? '#f8fafc' : '#f87171' },
                ]}
              >
                {balanceVisible
                  ? (netBalance < 0 ? '-' : '') + formatCurrency(Math.abs(netBalance))
                  : '••••••••'}
              </Text>
              <Text style={styles.heroSub}>
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} linked
              </Text>

              {/* Assets / Debts summary row */}
              <View style={styles.heroSummaryRow}>
                <View style={styles.heroSummaryItem}>
                  <Text style={styles.heroSummaryLabel}>Total Assets</Text>
                  <Text style={[styles.heroSummaryValue, { color: '#10b981' }]}>
                    {balanceVisible ? formatCompact(totalAssets) : '••••••'}
                  </Text>
                </View>
                <View style={styles.heroSummaryDivider} />
                <View style={styles.heroSummaryItem}>
                  <Text style={styles.heroSummaryLabel}>Total Debts</Text>
                  <Text style={[styles.heroSummaryValue, { color: '#ef4444' }]}>
                    {balanceVisible ? formatCompact(totalDebts) : '••••••'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Asset Allocation */}
            {allocationSegments.length > 1 && (
              <View style={styles.glassCard}>
                <Text style={styles.cardTitle}>Asset Allocation</Text>
                <AllocationBar segments={allocationSegments} />
              </View>
            )}

            {/* Accounts List */}
            <View style={styles.glassCard}>
              {/* Assets section */}
              {assetAccounts.length > 0 && (
                <>
                  <SectionHeader
                    title="Assets"
                    count={assetAccounts.length}
                    total={totalAssets}
                    expanded={expandedSection === 'assets'}
                    onToggle={() =>
                      setExpandedSection(expandedSection === 'assets' ? null : 'assets')
                    }
                    balanceVisible={balanceVisible}
                    isDebt={false}
                  />
                  {expandedSection === 'assets' &&
                    assetAccounts.map((a) => renderAccountRow(a))}
                </>
              )}

              {assetAccounts.length > 0 && debtAccounts.length > 0 && (
                <View style={styles.sectionDivider} />
              )}

              {/* Debts section */}
              {debtAccounts.length > 0 && (
                <>
                  <SectionHeader
                    title="Debts"
                    count={debtAccounts.length}
                    total={totalDebts}
                    expanded={expandedSection === 'debts'}
                    onToggle={() =>
                      setExpandedSection(expandedSection === 'debts' ? null : 'debts')
                    }
                    balanceVisible={balanceVisible}
                    isDebt={true}
                  />
                  {expandedSection === 'debts' &&
                    debtAccounts.map((a) => renderAccountRow(a))}
                </>
              )}
            </View>

            {/* Link another account CTA */}
            <TouchableOpacity
              style={styles.addAccountBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/link-account')}
            >
              <Ionicons name="add-circle-outline" size={18} color="#a855f7" />
              <Text style={styles.addAccountText}>Link New Account</Text>
            </TouchableOpacity>

            {/* Last synced */}
            {accounts[0]?.updated_at && (
              <Text style={styles.syncedText}>
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
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Loading */
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  linkBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  /* Scroll content */
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },

  /* Hero card */
  heroCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 6,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 4,
  },
  heroSummaryRow: {
    flexDirection: 'row',
    marginTop: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  heroSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroSummaryLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
  heroSummaryValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  heroSummaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* Glass card */
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },

  /* Allocation bar */
  allocationBarContainer: {
    gap: 12,
  },
  allocationBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  allocationLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  legendPct: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
  },
  sectionTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },

  /* Account card */
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  accountMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  accountMeta: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  subtypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subtypeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
  },
  accountBalanceCol: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '700',
  },
  availableText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 2,
  },

  /* Add account CTA */
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(168,85,247,0.3)',
    backgroundColor: 'rgba(168,85,247,0.04)',
    marginBottom: 16,
  },
  addAccountText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Synced text */
  syncedText: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
  },
});
