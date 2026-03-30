import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchInvestmentHoldings, syncPlaidInvestments } from '../utils/api';

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

  const loadData = useCallback(async () => {
    try {
      const data = await fetchInvestmentHoldings();
      setHoldings(data as Holding[]);
    } catch (e) {
      console.error('Failed to load holdings:', e);
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
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Investments</Text>
            <TouchableOpacity onPress={handleSync} disabled={syncing}>
              <Ionicons
                name={syncing ? 'sync' : 'sync-outline'}
                size={24}
                color={syncing ? '#94a3b8' : '#c084fc'}
              />
            </TouchableOpacity>
          </View>

          {/* Summary card */}
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
                    { color: totalGain >= 0 ? '#34d399' : '#f87171' },
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
                  { color: totalGain >= 0 ? '#34d399' : '#f87171' },
                ]}
              >
                {totalGain >= 0 ? '+' : ''}
                {gainPercent.toFixed(2)}% overall return
              </Text>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : holdings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trending-up-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No investment holdings</Text>
              <Text style={styles.emptySubtext}>
                Link a brokerage account to see your investments
              </Text>
            </View>
          ) : (
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
                          { color: gain >= 0 ? '#34d399' : '#f87171' },
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
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#cbd5e1', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 18, fontWeight: '800', marginTop: 4 },
  summaryPct: { fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'right' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  cardValue: { color: '#f8fafc', fontWeight: '800', fontSize: 16, marginLeft: 12 },
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  detailText: { color: '#94a3b8', fontSize: 12 },
  tickerBadge: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
  },
  tickerText: { color: '#c084fc', fontWeight: '800', fontSize: 12 },
  typeText: { color: '#94a3b8', fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: '#e5e7eb', fontWeight: '700', fontSize: 16 },
  emptySubtext: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
