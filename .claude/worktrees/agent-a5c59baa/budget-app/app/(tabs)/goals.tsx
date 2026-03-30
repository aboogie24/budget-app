import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getCurrentUser } from '@/utils/storage';
import { fetchInvestmentHoldings, fetchAccountBalances } from '@/utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';

type Holding = { id: string; security_name?: string; ticker_symbol?: string; institution_value: number };
type Debt = { id: string; name: string; balance: number };
type Saving = { id: string; name: string; current_amount: number; target_amount: number };
type Priority = { id: string; title: string; rank: number };
type Bill = { id: string; name: string; amount_due: number; status?: string };
type Account = { id: string; name: string; type?: string; subtype?: string; current_balance: number; institution_name?: string; mask?: string };

const TABS = [
  { key: 'debts', label: 'Debts', icon: 'card-outline' as const },
  { key: 'investments', label: 'Investments', icon: 'trending-up-outline' as const },
  { key: 'bills', label: 'Bills', icon: 'receipt-outline' as const },
  { key: 'savings', label: 'Savings', icon: 'wallet-outline' as const },
  { key: 'priorities', label: 'Priorities', icon: 'flag-outline' as const },
];

export default function GoalsScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [activeTab, setActiveTab] = useState('debts');
  const tabScrollRef = useRef<ScrollView>(null);

  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080';

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user?.id) return;
      const headers = user.token ? { Authorization: `Bearer ${user.token}` } : undefined;
      const [debtsRes, savingsRes, prioritiesRes, billsRes] = await Promise.all([
        fetch(`${API_URL}/auth/debts?user_id=${user.id}`, { credentials: 'include', headers }),
        fetch(`${API_URL}/auth/savings-goals?user_id=${user.id}`, { credentials: 'include', headers }),
        fetch(`${API_URL}/auth/priorities?user_id=${user.id}`, { credentials: 'include', headers }),
        fetch(`${API_URL}/auth/bills?user_id=${user.id}`, { credentials: 'include', headers }),
      ]);
      if (debtsRes.ok) setDebts((await debtsRes.json()) || []);
      if (savingsRes.ok) setSavings((await savingsRes.json()) || []);
      if (prioritiesRes.ok) setPriorities((await prioritiesRes.json()) || []);
      if (billsRes.ok) setBills((await billsRes.json()) || []);

      try {
        const [h, accts] = await Promise.all([
          fetchInvestmentHoldings(),
          fetchAccountBalances(),
        ]);
        setHoldings(Array.isArray(h) ? h as Holding[] : []);
        setAccounts(Array.isArray(accts) ? accts as Account[] : []);
      } catch {}
    };
    load();
  }, []);

  const debtTotal = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const savingsCurrent = savings.reduce((sum, s) => sum + (s.current_amount || 0), 0);
  const savingsTarget = savings.reduce((sum, s) => sum + (s.target_amount || 0), 0);
  const billsPaid = bills.filter((b) => b.status === 'paid').length;
  const billsTotalDue = bills.reduce((sum, b) => sum + (b.amount_due || 0), 0);
  const investmentTotal = holdings.reduce((sum, h) => sum + (h.institution_value || 0), 0);
  const accountsTotal = accounts.reduce((sum, a) => {
    const bal = a.current_balance || 0;
    if (a.type === 'credit' || a.type === 'loan') return sum - bal;
    return sum + bal;
  }, 0);

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'debts':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSummary}>{debts.length} accounts  {formatCurrency(debtTotal)}</Text>
            {debts.length === 0 ? (
              <Text style={styles.emptyText}>No debts tracked yet</Text>
            ) : (
              debts.map((d) => (
                <View key={d.id} style={styles.listRow}>
                  <Text style={styles.listTitle}>{d.name}</Text>
                  <Text style={styles.listAmount}>{formatCurrency(d.balance || 0)}</Text>
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => router.push('/debts')} style={styles.openButton}>
              <Text style={styles.openButtonText}>Open Debts</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        );

      case 'investments':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSummary}>{holdings.length} holdings  {formatCurrency(investmentTotal)}</Text>
            {holdings.length === 0 ? (
              <Text style={styles.emptyText}>No investments synced yet</Text>
            ) : (
              holdings.map((h) => (
                <View key={h.id} style={styles.listRow}>
                  <Text style={styles.listTitle}>{h.ticker_symbol || h.security_name || 'Unknown'}</Text>
                  <Text style={[styles.listAmount, { color: '#34d399' }]}>{formatCurrency(h.institution_value || 0)}</Text>
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => router.push('/investments')} style={styles.openButton}>
              <Text style={styles.openButtonText}>Open Investments</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        );

      case 'bills':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSummary}>{bills.length} bills  {billsPaid} paid  {formatCurrency(billsTotalDue)}/mo</Text>
            {bills.length === 0 ? (
              <Text style={styles.emptyText}>No bills added yet</Text>
            ) : (
              bills.map((b) => (
                <View key={b.id} style={styles.listRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.listTitle}>{b.name}</Text>
                    {b.status && (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          backgroundColor:
                            b.status === 'paid'
                              ? 'rgba(52,211,153,0.12)'
                              : b.status === 'overdue'
                                ? 'rgba(248,113,113,0.12)'
                                : 'rgba(251,191,36,0.12)',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color:
                              b.status === 'paid'
                                ? '#34d399'
                                : b.status === 'overdue'
                                  ? '#f87171'
                                  : '#fbbf24',
                          }}
                        >
                          {b.status === 'paid' ? 'Paid' : b.status === 'overdue' ? 'Overdue' : 'Due'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.listAmount}>{formatCurrency(b.amount_due || 0)}</Text>
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => router.push('/bills')} style={styles.openButton}>
              <Text style={styles.openButtonText}>Open Bills</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        );

      case 'savings':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSummary}>{savings.length} goals  {formatCurrency(savingsCurrent)} / {formatCurrency(savingsTarget)}</Text>
            {savings.length === 0 ? (
              <Text style={styles.emptyText}>No savings goals yet</Text>
            ) : (
              savings.map((s) => (
                <View key={s.id} style={styles.listRow}>
                  <Text style={styles.listTitle}>{s.name}</Text>
                  <Text style={styles.listAmount}>{formatCurrency(s.current_amount || 0)}</Text>
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => router.push('/savings')} style={styles.openButton}>
              <Text style={styles.openButtonText}>Open Savings</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        );

      case 'priorities':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabSummary}>{priorities.length} items</Text>
            {priorities.length === 0 ? (
              <Text style={styles.emptyText}>No priorities set yet</Text>
            ) : (
              priorities
                .sort((a, b) => (a.rank || 99) - (b.rank || 99))
                .map((p) => (
                  <View key={p.id} style={styles.listRow}>
                    <Text style={styles.listTitle}>{p.title}</Text>
                    <Text style={styles.listAmount}>#{p.rank || '-'}</Text>
                  </View>
                ))
            )}
            <TouchableOpacity onPress={() => router.push('/priorities')} style={styles.openButton}>
              <Text style={styles.openButtonText}>Open Priorities</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          <View style={styles.headerRow}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="wallet-outline" size={16} color="#c084fc" />
              </View>
              <Text style={styles.logoText}>Finances</Text>
            </View>
            <TouchableOpacity onPress={() => setShowActions(true)}>
              <Ionicons name="add-circle" size={24} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {/* Horizontal tab slider */}
          <ScrollView
            ref={tabScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tab, isActive && styles.tabActive]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={isActive ? '#fff' : '#94a3b8'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Accounts summary row */}
          {accounts.length > 0 && (
            <TouchableOpacity style={styles.accountsRow} onPress={() => router.push('/accounts')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business-outline" size={16} color="#60a5fa" />
                <Text style={styles.accountsLabel}>{accounts.length} linked account{accounts.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.accountsTotal, { color: accountsTotal >= 0 ? '#34d399' : '#f87171' }]}>
                  {accountsTotal < 0 ? '-' : ''}{formatCurrency(Math.abs(accountsTotal))}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
              </View>
            </TouchableOpacity>
          )}

          {/* Active tab content */}
          <View style={styles.card}>
            {renderTabContent()}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setShowActions(true)}>
          <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>+</Text>
        </TouchableOpacity>

        <Modal visible={showActions} transparent animationType="fade">
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowActions(false)}>
            <View style={styles.actionSheet}>
              <Text style={styles.sectionLabel}>Add new</Text>
              {[
                { label: 'Link Account', route: '/link-account' },
                { label: 'Debt', route: '/debts' },
                { label: 'Investments', route: '/investments' },
                { label: 'Bill', route: '/bills' },
                { label: 'Saving Goal', route: '/savings' },
                { label: 'Priority', route: '/priorities' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.actionRow}
                  onPress={() => {
                    setShowActions(false);
                    router.push(item.route);
                  }}
                >
                  <Text style={styles.listTitle}>{item.label}</Text>
                  <Ionicons name="add" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: 12 },
  logoText: { color: '#e5e7eb', fontWeight: '700', fontSize: 15 },
  sectionLabel: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  subText: { color: '#cbd5e1', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
  },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  listTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  listAmount: { color: '#c084fc', fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkText: { color: '#cbd5e1', fontWeight: '700' },

  /* ── Accounts summary ── */
  accountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  accountsLabel: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  accountsTotal: { fontSize: 14, fontWeight: '700' },

  /* ── Tab bar ── */
  tabBar: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(192,132,252,0.2)',
    borderColor: '#c084fc',
  },
  tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  /* ── Tab content ── */
  tabContent: { gap: 4 },
  tabSummary: { color: '#cbd5e1', fontSize: 12, marginBottom: 8 },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(192,132,252,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
  },
  openButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  fab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#b26ef8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: 'rgba(20,20,35,0.95)',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
});
