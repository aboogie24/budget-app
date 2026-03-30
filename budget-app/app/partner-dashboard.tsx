import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';

type HouseholdSummary = {
  household_id: string;
  household_name: string;
  member_count: number;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  total_debt: number;
  total_savings_target: number;
  total_savings_current: number;
  savings_progress: number;
};

export default function PartnerDashboardScreen() {
  const router = useRouter();
  const [householdData, setHouseholdData] = useState<HouseholdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHouseholdData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();
      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      // Fetch household info first
      const householdInfo = await api.get(`/auth/households/me`, { user_id: user.id });
      const householdID = householdInfo?.household_id;

      if (!householdID) {
        setError('Failed to load household info');
        return;
      }

      // Fetch household summary with the household ID
      const summary = await api.get(`/auth/households/summary`, { household_id: householdID });
      setHouseholdData(summary);
    } catch (err) {
      console.error('Load household data error:', err);
      setError('Error loading household data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHouseholdData();
    }, [loadHouseholdData])
  );

  if (loading) {
    return (
      <LinearGradient colors={['#0f172a', '#1a1040', '#0f172a']} style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#a855f7" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error || !householdData) {
    return (
      <LinearGradient colors={['#0f172a', '#1a1040', '#0f172a']} style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color="#f8fafc" />
              </TouchableOpacity>
              <Text style={styles.title}>Partner Dashboard</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.errorState}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>{error || 'Unable to load data'}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadHouseholdData}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <LinearGradient colors={['#0f172a', '#1a1040', '#0f172a']} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#f8fafc" />
            </TouchableOpacity>
            <Text style={styles.title}>Partner Dashboard</Text>
            <TouchableOpacity onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={24} color="#f8fafc" />
            </TouchableOpacity>
          </View>

          {/* Household Header Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>{householdData.household_name}</Text>
                <Text style={styles.cardSubtitle}>{householdData.member_count} members</Text>
              </View>
              <View style={styles.memberBadge}>
                <Ionicons name="people" size={20} color="#a855f7" />
              </View>
            </View>
          </View>

          {/* Cash Flow Section */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Combined Cash Flow</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={[styles.stat, styles.incomeIcon]}>
                  <Ionicons name="arrow-down-circle-outline" size={24} color="#22c55e" />
                </View>
                <Text style={styles.statLabel}>Total Income</Text>
                <Text style={[styles.statValue, { color: '#22c55e' }]}>
                  {formatCurrency(householdData.total_income)}
                </Text>
              </View>
              <View style={styles.col}>
                <View style={[styles.stat, styles.expenseIcon]}>
                  <Ionicons name="arrow-up-circle-outline" size={24} color="#ef4444" />
                </View>
                <Text style={styles.statLabel}>Total Expenses</Text>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>
                  {formatCurrency(householdData.total_expenses)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.netCashFlow}>
              <Text style={styles.netLabel}>Net Cash Flow</Text>
              <Text style={[styles.netValue, householdData.net_cash_flow >= 0 ? { color: '#22c55e' } : { color: '#ef4444' }]}>
                {formatCurrency(householdData.net_cash_flow)}
              </Text>
            </View>
          </View>

          {/* Debt Section */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Debt & Savings</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.col}>
                <View style={[styles.stat, styles.debtIcon]}>
                  <Ionicons name="document-text-outline" size={24} color="#f59e0b" />
                </View>
                <Text style={styles.statLabel}>Total Debt</Text>
                <Text style={styles.statValue}>{formatCurrency(householdData.total_debt)}</Text>
              </View>
              <View style={styles.col}>
                <View style={[styles.stat, styles.savingsIcon]}>
                  <Ionicons name="wallet-outline" size={24} color="#8b5cf6" />
                </View>
                <Text style={styles.statLabel}>Savings Progress</Text>
                <Text style={styles.statValue}>{householdData.savings_progress.toFixed(1)}%</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.savingsBar}>
              <View style={styles.savingsBarLabel}>
                <Text style={styles.savingsLabel}>Saved</Text>
                <Text style={styles.savingsAmount}>
                  {formatCurrency(householdData.total_savings_current)} / {formatCurrency(householdData.total_savings_target)}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${Math.min(householdData.savings_progress, 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/add-transaction')}
            >
              <Ionicons name="add-circle-outline" size={28} color="#a855f7" />
              <Text style={styles.actionLabel}>Add Transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/budget')}
            >
              <Ionicons name="pie-chart-outline" size={28} color="#a855f7" />
              <Text style={styles.actionLabel}>View Budgets</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/goals')}
            >
              <Ionicons name="flag-outline" size={28} color="#a855f7" />
              <Text style={styles.actionLabel}>Savings Goals</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/dashboard')}
            >
              <Ionicons name="analytics-outline" size={28} color="#a855f7" />
              <Text style={styles.actionLabel}>My Dashboard</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: 20 },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  memberBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  stat: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  incomeIcon: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  expenseIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  debtIcon: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  savingsIcon: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 16,
  },
  netCashFlow: {
    alignItems: 'center',
  },
  netLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  netValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  savingsBar: {
    gap: 12,
  },
  savingsBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  savingsLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  savingsAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(168, 85, 247, 0.8)',
    borderRadius: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
    textAlign: 'center',
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#a855f7',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#a855f7',
    fontWeight: '600',
    fontSize: 14,
  },
});
