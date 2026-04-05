import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';

/* ─── Types ─── */
type Transaction = {
  id: string;
  amount: number;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  parent_category_id?: string;
  parent_category_name?: string;
  parent_category_color?: string;
};

type BudgetSummaryCategory = {
  id: string;
  name: string;
};

type BudgetSummaryItem = {
  categories: BudgetSummaryCategory[];
};

type SummaryResponse = {
  budgets: BudgetSummaryItem[];
};

type UnbudgetedGroup = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  total: number;
  subcategories: {
    id: string;
    name: string;
    color: string;
    total: number;
    count: number;
  }[];
};

/* ─── Helpers ─── */
const fmt = (n: number) =>
  '$' +
  Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function UnbudgetedScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<UnbudgetedGroup[]>([]);

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const [summaryData, txData] = await Promise.all([
        api.get<SummaryResponse>(`/auth/budgets/user/${user.id}/summary`, { month, year }),
        api.get<Transaction[]>(`/auth/transactions`, {
          user_id: user.id,
          month,
          year,
        }),
      ]);

      // Collect all budgeted category IDs
      const budgetedIds = new Set<string>();
      const budgets = (summaryData as SummaryResponse)?.budgets ?? [];
      for (const b of budgets) {
        for (const c of b.categories ?? []) {
          budgetedIds.add(c.id);
        }
      }

      // Filter transactions to those whose category is NOT budgeted
      const transactions = Array.isArray(txData) ? txData : [];
      const unbudgeted = transactions.filter(
        (tx) => tx.category_id && !budgetedIds.has(tx.category_id)
      );

      // Group by parent category (or by category itself if no parent)
      const parentMap = new Map<string, UnbudgetedGroup>();

      for (const tx of unbudgeted) {
        const parentId = tx.parent_category_id || tx.category_id || 'unknown';
        const parentName = tx.parent_category_name || tx.category_name || 'Uncategorized';
        const parentColor = tx.parent_category_color || tx.category_color || '#a855f7';

        if (!parentMap.has(parentId)) {
          parentMap.set(parentId, {
            id: parentId,
            name: parentName,
            color: parentColor,
            total: 0,
            subcategories: [],
          });
        }

        const group = parentMap.get(parentId)!;
        group.total += Math.abs(tx.amount);

        // Track subcategories
        const catId = tx.category_id || 'unknown';
        const catName = tx.category_name || 'Unknown';
        const catColor = tx.category_color || parentColor;

        let sub = group.subcategories.find((s) => s.id === catId);
        if (!sub) {
          sub = { id: catId, name: catName, color: catColor, total: 0, count: 0 };
          group.subcategories.push(sub);
        }
        sub.total += Math.abs(tx.amount);
        sub.count += 1;
      }

      const sorted = Array.from(parentMap.values()).sort((a, b) => b.total - a.total);
      setGroups(sorted);
    } catch (err) {
      console.error('Failed to load unbudgeted data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.navigate('/(tabs)/budget' as any)}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color="#e5e7eb" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Unbudgeted Spending</Text>
            <Text style={styles.headerSubtitle}>
              These categories have spending but no budget
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
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
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>Analyzing spending...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#34d399" />
              <Text style={styles.emptyTitle}>All spending is budgeted</Text>
              <Text style={styles.emptySubtitle}>
                Every category with transactions has a budget assigned.
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.id} style={styles.groupCard}>
                {/* Parent row */}
                <View style={styles.parentRow}>
                  <View style={[styles.iconCircle, { backgroundColor: `${group.color}22` }]}>
                    <Ionicons name="pricetag-outline" size={18} color={group.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.parentName}>{group.name}</Text>
                    <Text style={styles.parentSub}>
                      {group.subcategories.reduce((s, c) => s + c.count, 0)} transaction
                      {group.subcategories.reduce((s, c) => s + c.count, 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.parentAmount}>{fmt(group.total)}</Text>
                </View>

                {/* Subcategory rows */}
                {group.subcategories.length > 1 &&
                  group.subcategories.map((sub, i) => {
                    const isLast = i === group.subcategories.length - 1;
                    return (
                      <View key={sub.id} style={styles.subRow}>
                        <Text style={styles.treeLine}>
                          {isLast ? '\u2514\u2500' : '\u251C\u2500'}
                        </Text>
                        <View style={[styles.subDot, { backgroundColor: sub.color }]} />
                        <Text style={styles.subName} numberOfLines={1}>
                          {sub.name}
                        </Text>
                        <Text style={styles.subAmount}>{fmt(sub.total)}</Text>
                      </View>
                    );
                  })}

                {/* Create Budget button */}
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/budget/add-budget',
                      params: {
                        prefill_category_id: group.id,
                        prefill_name: group.name,
                      },
                    } as any)
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#a855f7" />
                  <Text style={styles.createBtnText}>Create Budget</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  groupCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentName: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  parentSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  parentAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
    flexShrink: 0,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 52,
  },
  treeLine: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.15)',
    width: 20,
  },
  subDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  subAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a855f7',
  },
});
