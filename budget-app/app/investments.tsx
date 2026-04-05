import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchInvestmentHoldings, syncPlaidInvestments } from '../utils/api';
import GradientBackground from '@/components/GradientBackground';
import { ErrorState } from '@/components/ErrorState';
import { colors, spacing, glassEffects, typography } from '@/utils/design-system';

type Holding = {
  id: string;
  security_name?: string;
  ticker_symbol?: string;
  security_type?: string;
  quantity: number;
  institution_price: number;
  institution_value: number;
  cost_basis?: number;
  iso_currency_code: string;
  price_as_of?: string;
};

export default function InvestmentsScreen() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchInvestmentHoldings();
      setHoldings(data as Holding[]);
    } catch (e) {
      console.error('Failed to load holdings:', e);
      setError('Failed to load investments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPlaidInvestments();
      await loadData();
    } catch (e) {
      console.error('Sync failed:', e);
      setError('Failed to sync investments');
    } finally {
      setSyncing(false);
    }
  };

  const totalValue = holdings.reduce((s, h) => s + (h.institution_value || 0), 0);
  const totalCostBasis = holdings.reduce((s, h) => s + (h.cost_basis || 0), 0);
  const totalGain = totalValue - totalCostBasis;
  const gainPercent = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.navigate('/(tabs)/goals' as any)} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Investments</Text>
            <TouchableOpacity onPress={handleSync} disabled={syncing}>
              <Ionicons
                name={syncing ? 'sync' : 'sync-outline'}
                size={24}
                color={syncing ? colors.textMuted : colors.accent}
              />
            </TouchableOpacity>
          </View>

          {/* Error state */}
          {error && (
            <ErrorState
              title="Error"
              message={error}
              onRetry={loadData}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Summary card */}
          {!error && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total Value</Text>
                  <Text style={styles.summaryValue}>{fmt(totalValue)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.summaryLabel}>Gain / Loss</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: totalGain >= 0 ? colors.success : colors.error },
                    ]}
                  >
                    {totalGain >= 0 ? '+' : ''}
                    {fmt(totalGain)}
                  </Text>
                </View>
              </View>
              {totalCostBasis > 0 && (
                <Text
                  style={[
                    styles.summaryPct,
                    { color: totalGain >= 0 ? colors.success : colors.error },
                  ]}
                >
                  {totalGain >= 0 ? '+' : ''}
                  {gainPercent.toFixed(2)}% overall return
                </Text>
              )}
            </View>
          )}

          {!error && loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
          ) : !error && holdings.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="trending-up-outline" size={48} color={colors.textDark} />
              <Text style={styles.emptyText}>No investment holdings</Text>
              <Text style={styles.emptySubtext}>
                Link a brokerage account to see your investments
              </Text>
            </View>
          ) : !error ? (
            holdings.map((h) => {
              const gain = h.cost_basis ? h.institution_value - h.cost_basis : null;
              const pct =
                h.cost_basis && h.cost_basis > 0 ? (gain! / h.cost_basis) * 100 : null;
              return (
                <View key={h.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {h.ticker_symbol && (
                          <View style={styles.tickerBadge}>
                            <Text style={styles.tickerText}>{h.ticker_symbol}</Text>
                          </View>
                        )}
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {h.security_name || h.ticker_symbol || 'Unknown'}
                        </Text>
                      </View>
                      {h.security_type && (
                        <Text style={styles.typeText}>{h.security_type}</Text>
                      )}
                    </View>
                    <Text style={styles.cardValue}>{fmt(h.institution_value)}</Text>
                  </View>
                  <View style={styles.cardDetails}>
                    <Text style={styles.detailText}>
                      {h.quantity % 1 === 0
                        ? h.quantity.toFixed(0)
                        : h.quantity.toFixed(4)}{' '}
                      shares @ {fmt(h.institution_price)}
                    </Text>
                    {gain !== null && (
                      <Text
                        style={[
                          styles.detailText,
                          { color: gain >= 0 ? colors.success : colors.error },
                        ]}
                      >
                        {gain >= 0 ? '+' : ''}
                        {fmt(gain)} ({pct!.toFixed(2)}%)
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
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
  summaryCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  summaryPct: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    flexShrink: 1,
  },
  cardValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    marginLeft: spacing.md,
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  detailText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  tickerBadge: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  tickerText: {
    color: colors.accent,
    fontWeight: '800',
    ...typography.caption,
  },
  typeText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
