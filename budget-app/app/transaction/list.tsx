import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import CategoryPicker from '@/components/CategoryPicker';

type Tx = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category_id?: string;
  category_name?: string;
  category?: string;
  date: string;
  source?: string;
};

function getSourceBadge(source?: string): { label: string; color: string } {
  switch (source) {
    case 'teller':
      return { label: 'Teller', color: '#f59e0b' };
    case 'plaid':
      return { label: 'Plaid', color: '#60a5fa' };
    case 'flinks':
      return { label: 'Flinks', color: '#34d399' };
    case 'bank':
      return { label: 'Bank', color: '#38bdf8' };
    default:
      return { label: 'Manual', color: '#facc15' };
  }
}

export default function TransactionList() {
  const router = useRouter();
  // Optional filter — when navigated to from a budget category.
  const params = useLocalSearchParams<{ category_id?: string; category_name?: string }>();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const headerTitle = params.category_name || 'All Transactions';
  const visible = (
    params.category_id
      ? transactions.filter((t) => t.category_id === params.category_id)
      : transactions
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setUserId(user.id);
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

  /* Open the category picker for a transaction. */
  const openPicker = (txId: string) => {
    setEditingTxId(txId);
    setPickerVisible(true);
  };

  /* Assign the chosen category to the transaction being edited. */
  const handleCategorySelect = async (category: { id: string; name: string }) => {
    setPickerVisible(false);
    const txId = editingTxId;
    setEditingTxId(null);
    if (!txId) return;
    try {
      await api.patch(`/auth/transactions/${txId}/category`, {
        user_id: userId,
        category_id: category.id,
      });
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId ? { ...t, category_id: category.id, category_name: category.name } : t
        )
      );
    } catch (e) {
      console.error('Failed to update transaction category:', e);
      Alert.alert('Error', 'Could not update category.');
    }
  };

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
            <Text style={styles.header}>{headerTitle}</Text>
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
          <Text style={styles.header}>{headerTitle}</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={visible}
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
                  <TouchableOpacity
                    style={styles.categoryChip}
                    onPress={() => openPicker(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pricetag" size={11} color="#c084fc" />
                    <Text style={styles.categoryChipText} numberOfLines={1}>
                      {item.category_name || 'Set category'}
                    </Text>
                    <Ionicons name="chevron-down" size={10} color="#a855f7" />
                  </TouchableOpacity>
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
                {(() => {
                  const badge = getSourceBadge(item.source);
                  return (
                    <View style={[styles.sourceBadge, { backgroundColor: `${badge.color}33` }]}>
                      <Text style={[styles.sourceText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  );
                })()}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
              <EmptyState
                icon="receipt-outline"
                title={params.category_id ? 'No transactions in this category' : 'No transactions yet'}
                description={
                  params.category_id
                    ? 'Transactions assigned to this category will appear here'
                    : 'Your transactions will appear here once you add them'
                }
                actionLabel="Add Transaction"
                onAction={() => router.push('/transaction/add')}
              />
            </View>
          }
        />

        <CategoryPicker
          visible={pickerVisible}
          onClose={() => {
            setPickerVisible(false);
            setEditingTxId(null);
          }}
          onSelect={handleCategorySelect}
          userId={userId}
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
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    maxWidth: 200,
  },
  categoryChipText: { color: '#e2e8f0', fontSize: 11, fontWeight: '600', flexShrink: 1 },
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
  sourceText: { fontWeight: '700', fontSize: 12 },
});

