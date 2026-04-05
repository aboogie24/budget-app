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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { ErrorState } from '@/components/ErrorState';
import { colors, spacing, glassEffects, typography } from '@/utils/design-system';

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
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
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
      setError('Failed to load insights');
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
    if (pct === 0) return colors.textMuted;
    if (isExpense) return pct > 0 ? colors.error : colors.success;
    return pct > 0 ? colors.success : colors.error;
  };

  // Simple bar chart: find max daily spend to scale bars.
  const maxDaily = data ? Math.max(...data.daily_spending.map((d) => d.amount), 1) : 1;
  const chartBarWidth = data ? Math.max((SCREEN_WIDTH - 64) / Math.max(data.daily_spending.length, 1) - 2, 2) : 4;

  // Default colors for categories if the backend doesn't supply one.
  const defaultColors = [colors.accent, '#f472b6', colors.success, '#fbbf24', colors.info, '#fb923c', colors.primary2, colors.error];

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Spending Insights</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Month selector */}
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={prevMonth}>
              <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {MONTHS[month - 1]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Error state */}
          {error && (
            <ErrorState
              title="Error"
              message={error}
              onRetry={loadInsights}
              onDismiss={() => setError(null)}
            />
          )}

          {!error && loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
          ) : !error && !data ? (
            <Text style={styles.emptyText}>No data available</Text>
          ) : !error && data ? (
            <>
              {/* Summary cards */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, { flex: 1 }]}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={[styles.summaryValue, { color: colors.success }]}>{fmt(data.income)}</Text>
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
                  style={[styles.netValue, { color: data.net >= 0 ? colors.success : colors.error }]}
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
                              backgroundColor: d.amount > 0 ? colors.accent : colors.glassLight,
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
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassLight,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: spacing.lg,
  },
  monthText: {
    color: colors.text,
    ...typography.bodyBold,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
  },
  summaryLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  changeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  netCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  netValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 1,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    borderRadius: 2,
    minHeight: 2,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: spacing.xs,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  catAmount: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  catBarTrack: {
    height: 6,
    backgroundColor: colors.borderGlass,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  catPercent: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  emptyText: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
