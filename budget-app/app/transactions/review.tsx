import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import CategoryPicker from '@/components/CategoryPicker';
import { successHaptic } from '@/utils/haptics';

type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category_id?: string;
  category_name?: string;
  match_confidence?: string;
  user_verified?: boolean;
  date: string;
  source?: string;
};

// Map confidence levels to visual styles
function getConfidenceBadge(confidence?: string) {
  switch (confidence) {
    case 'exact':
    case 'high':
      return { label: confidence === 'exact' ? 'Exact' : 'High', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
    case 'medium':
      return { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
    case 'low':
      return { label: 'Low', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
    default:
      return { label: 'Unknown', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  }
}

// Determine an icon based on category name heuristic
function getCategoryIcon(categoryName?: string): keyof typeof Ionicons.glyphMap {
  if (!categoryName) return 'pricetag-outline';
  const lower = categoryName.toLowerCase();
  if (lower.includes('food') || lower.includes('grocer') || lower.includes('restaurant')) return 'restaurant-outline';
  if (lower.includes('transport') || lower.includes('gas') || lower.includes('uber') || lower.includes('car')) return 'car-outline';
  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('game')) return 'film-outline';
  if (lower.includes('shopping') || lower.includes('amazon') || lower.includes('store')) return 'cart-outline';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharm')) return 'medkit-outline';
  if (lower.includes('rent') || lower.includes('home') || lower.includes('mortgage')) return 'home-outline';
  if (lower.includes('util') || lower.includes('electric') || lower.includes('water')) return 'flash-outline';
  if (lower.includes('salary') || lower.includes('income') || lower.includes('pay')) return 'cash-outline';
  if (lower.includes('subscription') || lower.includes('netflix') || lower.includes('spotify')) return 'play-outline';
  if (lower.includes('travel') || lower.includes('flight') || lower.includes('hotel')) return 'airplane-outline';
  return 'pricetag-outline';
}

// Swipeable row component
function SwipeableRow({
  children,
  onSwipeRight,
}: {
  children: React.ReactNode;
  onSwipeRight: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) {
          translateX.setValue(Math.min(gesture.dx, 100));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 80) {
          Animated.timing(translateX, {
            toValue: 400,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onSwipeRight();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, marginBottom: 8 }}>
      {/* Background revealed on swipe */}
      <View style={swipeStyles.swipeBg}>
        <Ionicons name="checkmark-circle" size={28} color="#fff" />
        <Text style={swipeStyles.swipeText}>Confirm</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  swipeBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#22c55e',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    gap: 8,
  },
  swipeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default function TransactionReviewScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [userId, setUserId] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingMerchant, setEditingMerchant] = useState<string>('');

  const unverifiedTransactions = transactions.filter(
    (t) => !t.user_verified && t.match_confidence !== 'exact'
  );

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setUserId(user.id);
    try {
      const data = await api.get<Transaction[]>('/auth/transactions', { user_id: user.id });
      const list = Array.isArray(data) ? data : [];
      setTransactions(
        list.map((t: any) => ({
          ...t,
          category_name: t.category_name ?? t.category ?? t.categoryName,
        }))
      );
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmTransaction = async (txId: string) => {
    setConfirming((prev) => new Set(prev).add(txId));
    try {
      await api.put(`/auth/transactions/${txId}`, { user_verified: true });
      successHaptic();
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, user_verified: true } : t))
      );
    } catch (e) {
      console.error('Failed to confirm transaction:', e);
      Alert.alert('Error', 'Could not confirm transaction.');
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }
  };

  const confirmAll = async () => {
    setConfirmingAll(true);
    try {
      const promises = unverifiedTransactions.map((t) =>
        api.put(`/auth/transactions/${t.id}`, { user_verified: true })
      );
      await Promise.all(promises);
      successHaptic();
      setTransactions((prev) =>
        prev.map((t) =>
          !t.user_verified && t.match_confidence !== 'exact'
            ? { ...t, user_verified: true }
            : t
        )
      );
    } catch (e) {
      console.error('Failed to confirm all:', e);
      Alert.alert('Error', 'Some transactions could not be confirmed.');
    } finally {
      setConfirmingAll(false);
    }
  };

  const openCategoryPicker = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditingMerchant(tx.note ?? '');
    setPickerVisible(true);
  };

  const handleCategorySelect = async (category: { id: string; name: string; parent_name?: string }) => {
    setPickerVisible(false);
    if (!editingTxId) return;

    try {
      await api.put(`/auth/transactions/${editingTxId}`, {
        category_id: category.id,
        user_verified: true,
      });
      successHaptic();
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTxId
            ? { ...t, category_id: category.id, category_name: category.name, user_verified: true }
            : t
        )
      );

      // Prompt to create auto-match rule
      if (editingMerchant.trim()) {
        Alert.alert(
          'Create Rule',
          `Always categorize "${editingMerchant}" as "${category.name}"?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes',
              onPress: async () => {
                try {
                  await api.post('/auth/category-rules/from-edit', {
                    merchant_name: editingMerchant,
                    category_id: category.id,
                  });
                } catch (e) {
                  console.error('Failed to create category rule:', e);
                }
              },
            },
          ]
        );
      }
    } catch (e) {
      console.error('Failed to update transaction category:', e);
      Alert.alert('Error', 'Could not update category.');
    }

    setEditingTxId(null);
    setEditingMerchant('');
  };

  // Group transactions by date
  const groupedByDate = unverifiedTransactions.reduce<Record<string, Transaction[]>>(
    (acc, tx) => {
      const dateKey = new Date(tx.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(tx);
      return acc;
    },
    {}
  );

  const sections = Object.entries(groupedByDate).sort(
    ([, a], [, b]) => new Date(b[0].date).getTime() - new Date(a[0].date).getTime()
  );

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (loading) {
    return (
      <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#a855f7" />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.navigate('/(tabs)/goals' as any)}
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={20} color="#e5e7eb" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle}>Review Transactions</Text>
            {unverifiedTransactions.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{unverifiedTransactions.length}</Text>
              </View>
            )}
          </View>
          {unverifiedTransactions.length > 0 ? (
            <TouchableOpacity
              onPress={confirmAll}
              disabled={confirmingAll}
              style={styles.confirmAllBtn}
            >
              {confirmingAll ? (
                <ActivityIndicator size="small" color="#22c55e" />
              ) : (
                <Text style={styles.confirmAllText}>Confirm All</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        {unverifiedTransactions.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-done-outline" size={48} color="#22c55e" />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              Every transaction has been reviewed and verified.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.navigate('/(tabs)/goals' as any)}
            >
              <Text style={styles.emptyBtnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={([dateKey]) => dateKey}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: [dateKey, txs] }) => (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.dateHeader}>{dateKey}</Text>
                {txs.map((tx) => {
                  const badge = getConfidenceBadge(tx.match_confidence);
                  const isConfirmingThis = confirming.has(tx.id);

                  return (
                    <SwipeableRow key={tx.id} onSwipeRight={() => confirmTransaction(tx.id)}>
                      <View style={styles.txCard}>
                        <View style={styles.txRow}>
                          {/* Category icon */}
                          <View style={[styles.txIconCircle, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
                            <Ionicons
                              name={getCategoryIcon(tx.category_name)}
                              size={18}
                              color="#a855f7"
                            />
                          </View>

                          {/* Center: merchant + category + confidence */}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.txMerchant} numberOfLines={1}>
                              {tx.note || 'Unknown Merchant'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <TouchableOpacity onPress={() => openCategoryPicker(tx)}>
                                <Text style={styles.txCategory}>
                                  {tx.category_name || 'Uncategorized'}
                                </Text>
                              </TouchableOpacity>
                              <View style={[styles.confidenceBadge, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.confidenceText, { color: badge.color }]}>
                                  {badge.label}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Right: amount + confirm button */}
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Text
                              style={[
                                styles.txAmount,
                                tx.type === 'income' ? styles.income : styles.expense,
                              ]}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                              {formatCurrency(tx.amount)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => confirmTransaction(tx.id)}
                              disabled={isConfirmingThis}
                              style={styles.confirmBtn}
                            >
                              {isConfirmingThis ? (
                                <ActivityIndicator size="small" color="#22c55e" />
                              ) : (
                                <Ionicons name="checkmark-circle-outline" size={24} color="#22c55e" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </SwipeableRow>
                  );
                })}
              </View>
            )}
          />
        )}

        {/* Category Picker Modal */}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  countBadge: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  confirmAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  confirmAllText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  dateHeader: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  txCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMerchant: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  txCategory: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  income: {
    color: '#4ade80',
  },
  expense: {
    color: '#f87171',
  },
  confirmBtn: {
    padding: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  emptyBtnText: {
    color: '#a855f7',
    fontWeight: '700',
    fontSize: 15,
  },
});
