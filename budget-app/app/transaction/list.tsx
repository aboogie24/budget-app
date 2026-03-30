import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type Tx = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category_name?: string;
  category?: string;
  date: string;
  source?: string;
};

export default function TransactionList() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    try {
      const data = await api.get(`/auth/transactions`, { user_id: user.id });
      const normalized = Array.isArray(data)
        ? data.map((t: any) => ({
            ...t,
            category_name: t.category_name ?? t.category ?? t.categoryName,
          }))
        : [];
      setTransactions(normalized);
      setError(null);
    } catch (e) {
      console.error('Failed to load transactions:', e);
      setError('Failed to load transactions');
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const format = (d: string) => new Date(d).toLocaleDateString();
  const formatCurrency = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (error) {
    return (
      <LinearGradient colors={['#0b1021', '#1b0d30', '#2d0c53']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={20} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.header}>All Transactions</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, padding: 16 }}>
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                load();
              }}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0b1021', '#1b0d30', '#2d0c53']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#e5e7eb" />
          </TouchableOpacity>
          <Text style={styles.header}>All Transactions</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/transaction/[id]',
                  params: {
                    id: item.id,
                    type: item.type,
                    amount: String(item.amount),
                    note: item.note,
                    category_name: item.category_name || item.category,
                    date: item.date,
                    source: item.source,
                  },
                })
              }
            >
              <View style={styles.rowTop}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={item.type === 'income' ? 'trending-up' : 'card-outline'}
                    size={16}
                    color={item.type === 'income' ? '#22c55e' : '#f472b6'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.note || item.category_name || 'Transaction'}</Text>
                  <Text style={styles.sub}>{item.category_name || 'Uncategorized'}</Text>
                </View>
                <Text style={[styles.amount, item.type === 'income' ? styles.income : styles.expense]}>
                  {item.type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount)}
                </Text>
              </View>
              <View style={styles.rowBottom}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="time-outline" size={14} color="#cbd5e1" />
                  <Text style={styles.meta}>{format(item.date)}</Text>
                </View>
                <View style={[styles.sourceBadge, item.source === 'bank' ? styles.bank : styles.manual]}>
                  <Text style={styles.sourceText}>{item.source === 'bank' ? 'Bank' : 'Manual'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
              <EmptyState
                icon="receipt-outline"
                title="No transactions yet"
                description="Your transactions will appear here once you add them"
                actionLabel="Add Transaction"
                onAction={() => router.push('/transaction/add')}
              />
            </View>
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  sub: { color: '#cbd5e1', fontSize: 12 },
  amount: { fontWeight: '800', fontSize: 15 },
  income: { color: '#4ade80' },
  expense: { color: '#f87171' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  meta: { color: '#cbd5e1', fontSize: 12 },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bank: { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
  manual: { backgroundColor: 'rgba(250, 204, 21, 0.2)' },
  sourceText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
});

