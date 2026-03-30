import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type CategoryBreakdown = {
  name: string;
  color: string;
  amount: number;
  percent: number;
};

type DailySpend = {
  date: string;
  amount: number;
};

type InsightsData = {
  month: number;
  year: number;
  income: number;
  expenses: number;
  net: number;
  prev_income: number;
  prev_expenses: number;
  income_change: number;
  expense_change: number;
  categories: CategoryBreakdown[];
  daily_spending: DailySpend[];
};

export default function InsightsScreen() {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const result = await api.get<InsightsData>('/auth/insights', {
        user_id: userId,
        month,
        year,
      });
      setData(result);
    } catch (e) {
      console.error('Failed to load insights:', e);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const changeArrow = (pct: number) => (pct > 0 ? 'trending-up' : pct < 0 ? 'trending-down' : 'remove');
  const changeColor = (pct: number, isExpense: boolean) => {
    if (pct === 0) return '#94a3b8';
    // For expenses, up is bad (red), down is good (green). For income, opposite.
    if (isExpense) return pct > 0 ? '#f87171' : '#34d399';
    return pct > 0 ? '#34d399' : '#f87171';
  };

  // Simple bar chart: find max daily spend to scale bars.
  const maxDaily = data ? Math.max(...data.daily_spending.map((d) => d.amount), 1) : 1;
  const chartBarWidth = data ? Math.max((SCREEN_WIDTH - 64) / Math.max(data.daily_spending.length, 1) - 2, 2) : 4;

  // Default colors for categories if the backend doesn't supply one.
  const defaultColors = ['#c084fc', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#a78bfa', '#f87171'];

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Spending Insights</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Month selector */}
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={prevMonth}>
              <Ionicons name="chevron-back" size={22} color="#cbd5e1" />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {MONTHS[month - 1]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={22} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 60 }} />
          ) : !data ? (
            <Text style={styles.emptyText}>No data available</Text>
          ) : (
            <>
              {/* Summary cards */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { flex: 1 }]}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={[styles.summaryValue, { color: '#34d399' }]}>{fmt(data.income)}</Text>
                  <View style={styles.changeRow}>
                    <Ionicons
                      name={changeArrow(data.income_change) as any}
                      size={14}
                      color={changeColor(data.income_change, false)}
                    />
                    <Text style={[styles.changeText, { color: changeColor(data.income_change, false) }]}>
                      {Math.abs(data.income_change).toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <View style={[styles.summaryCard, { flex: 1 }]}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={[styles.summaryValue, { color: '#f472b6' }]}>{fmt(data.expenses)}</Text>
                  <View style={styles.changeRow}>
                    <Ionicons
                      name={changeArrow(data.expense_change) as any}
                      size={14}
                      color={changeColor(data.expense_change, true)}
                    />
                    <Text style={[styles.changeText, { color: changeColor(data.expense_change, true) }]}>
                      {Math.abs(data.expense_change).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              {/* Net */}
              <View style={styles.netCard}>
                <Text style={styles.summaryLabel}>Net</Text>
                <Text
                  style={[styles.netValue, { color: data.net >= 0 ? '#34d399' : '#f87171' }]}
                >
                  {data.net >= 0 ? '+' : ''}{fmt(data.net)}
                </Text>
              </View>

              {/* Daily spending chart */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Daily Spending</Text>
                <View style={styles.chartContainer}>
                  {data.daily_spending.map((d, i) => {
                    const h = maxDaily > 0 ? (d.amount / maxDaily) * 100 : 0;
                    return (
                      <View key={d.date} style={styles.barWrapper}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: `${Math.max(h, 2)}%`,
                              width: chartBarWidth,
                              backgroundColor: d.amount > 0 ? '#c084fc' : 'rgba(255,255,255,0.06)',
                            },
                          ]}
                        />
                        {(i === 0 || i === Math.floor(data.daily_spending.length / 2) || i === data.daily_spending.length - 1) && (
                          <Text style={styles.barLabel}>{parseInt(d.date.split('-')[2])}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Category breakdown */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>By Category</Text>
                {data.categories.length === 0 ? (
                  <Text style={styles.emptySubtext}>No expenses this month</Text>
                ) : (
                  data.categories.map((cat, i) => {
                    const color = cat.color || defaultColors[i % defaultColors.length];
                    return (
                      <View key={cat.name} style={styles.catRow}>
                        <View style={[styles.catDot, { backgroundColor: color }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.catHeader}>
                            <Text style={styles.catName}>{cat.name}</Text>
                            <Text style={styles.catAmount}>{fmt(cat.amount)}</Text>
                          </View>
                          <View style={styles.catBarTrack}>
                            <View
                              style={[
                                styles.catBarFill,
                                { width: `${cat.percent}%`, backgroundColor: color },
                              ]}
                            />
                          </View>
                          <Text style={styles.catPercent}>{cat.percent.toFixed(1)}%</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  monthText: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryLabel: { color: '#cbd5e1', fontSize: 12 },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  changeText: { fontSize: 12, fontWeight: '700' },
  netCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    alignItems: 'center',
  },
  netValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  sectionTitle: { color: '#e5e7eb', fontWeight: '700', fontSize: 14, marginBottom: 12 },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 1,
  },
  barWrapper: { alignItems: 'center', flex: 1 },
  bar: { borderRadius: 2, minHeight: 2 },
  barLabel: { color: '#94a3b8', fontSize: 9, marginTop: 4 },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  catName: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  catAmount: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  catBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPercent: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  emptyText: { color: '#e5e7eb', textAlign: 'center', marginTop: 60, fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: '#94a3b8', fontSize: 13 },
});
