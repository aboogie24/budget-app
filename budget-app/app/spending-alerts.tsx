import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { checkBudgetThresholds, fetchSpendingAlerts, upsertSpendingAlert } from '@/utils/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

type Alert = {
  budget_id: string;
  budget_name: string;
  budget_amount: number;
  spent_amount: number;
  percent_used: number;
  threshold_percent: number;
  over_threshold: boolean;
};

type AlertConfig = {
  id: string;
  budget_id: string;
  budget_name?: string;
  budget_amount?: number;
  threshold_percent: number;
  is_enabled: boolean;
};

const THRESHOLD_OPTIONS = [50, 60, 70, 80, 90];

export default function SpendingAlertsScreen() {
  const router = useRouter();
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [updatingBudgetId, setUpdatingBudgetId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const [activeData, configData] = await Promise.all([
        checkBudgetThresholds(),
        fetchSpendingAlerts(),
      ]);
      setActiveAlerts(activeData || []);
      setAlertConfigs(configData || []);
    } catch (err) {
      setError((err as Error).message || 'Failed to load alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlerts();
  }, [loadAlerts]);

  const handleToggleAlert = async (budgetId: string, currentEnabled: boolean, threshold: number) => {
    try {
      setUpdatingBudgetId(budgetId);
      await upsertSpendingAlert(budgetId, threshold, !currentEnabled);
      await loadAlerts();
    } catch (err) {
      setError((err as Error).message || 'Failed to update alert');
    } finally {
      setUpdatingBudgetId(null);
    }
  };

  const handleThresholdChange = async (newThreshold: number) => {
    if (!selectedBudgetId) return;
    try {
      setUpdatingBudgetId(selectedBudgetId);
      const config = alertConfigs.find((c) => c.budget_id === selectedBudgetId);
      await upsertSpendingAlert(selectedBudgetId, newThreshold, config?.is_enabled ?? true);
      setThresholdModalVisible(false);
      setSelectedBudgetId(null);
      await loadAlerts();
    } catch (err) {
      setError((err as Error).message || 'Failed to update threshold');
    } finally {
      setUpdatingBudgetId(null);
    }
  };

  const getProgressBarColor = (percentUsed: number, thresholdPercent: number) => {
    if (percentUsed >= 100) return '#ef4444';
    if (percentUsed >= thresholdPercent) return '#eab308';
    if (percentUsed >= 60) return '#eab308';
    return '#22c55e';
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

  const hasActiveAlerts = activeAlerts.length > 0;
  const hasConfiguredBudgets = alertConfigs.length > 0;

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c084fc" />}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Spending Alerts</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Error State */}
          {error && !loading && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={loadAlerts}
            />
          )}

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading alerts...</Text>
            </View>
          )}

          {!loading && !hasConfiguredBudgets && (
            <EmptyState
              icon="notifications-off-outline"
              title="No alerts configured"
              description="Set up a shared budget with your partner to enable spending alerts"
            />
          )}

          {!loading && hasConfiguredBudgets && (
            <>
              {/* Budget Health Section */}
              {hasActiveAlerts && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={styles.sectionTitle}>Budget Health</Text>
                  {activeAlerts.map((alert) => (
                    <View key={alert.budget_id} style={styles.alertCard}>
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={styles.budgetName}>{alert.budget_name}</Text>
                          <Text style={[styles.percentText, { color: getProgressBarColor(alert.percent_used, alert.threshold_percent) }]}>
                            {Math.round(alert.percent_used)}%
                          </Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${Math.min(alert.percent_used, 100)}%`,
                                backgroundColor: getProgressBarColor(alert.percent_used, alert.threshold_percent),
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.amountText}>
                          {formatCurrency(alert.spent_amount)} of {formatCurrency(alert.budget_amount)}
                        </Text>
                        {alert.over_threshold && (
                          <View style={styles.warningBadge}>
                            <Ionicons name="warning" size={12} color="#fff" />
                            <Text style={styles.warningText}>Over limit</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Configure Alerts Section */}
              <View>
                <Text style={styles.sectionTitle}>Configure Alerts</Text>
                {alertConfigs.map((config) => {
                  const isEnabled = config.is_enabled ?? true;
                  return (
                    <View key={config.budget_id} style={styles.configCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.configBudgetName}>{config.budget_name || 'Budget'}</Text>
                        <Text style={styles.configAmountText}>
                          Limit: {formatCurrency(config.budget_amount || 0)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.thresholdButton}
                        onPress={() => {
                          setSelectedBudgetId(config.budget_id);
                          setThresholdModalVisible(true);
                        }}
                        disabled={updatingBudgetId === config.budget_id}
                      >
                        <Text style={styles.thresholdText}>{config.threshold_percent}%</Text>
                      </TouchableOpacity>
                      <Switch
                        value={isEnabled}
                        onValueChange={() =>
                          handleToggleAlert(config.budget_id, isEnabled, config.threshold_percent)
                        }
                        disabled={updatingBudgetId === config.budget_id}
                        trackColor={{ false: '#404854', true: '#c084fc40' }}
                        thumbColor={isEnabled ? '#c084fc' : '#6b7280'}
                      />
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

        {/* Threshold Picker Modal */}
        <Modal
          visible={thresholdModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setThresholdModalVisible(false);
            setSelectedBudgetId(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alert Threshold</Text>
                <TouchableOpacity
                  onPress={() => {
                    setThresholdModalVisible(false);
                    setSelectedBudgetId(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#e5e7eb" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Alert me when spending reaches:
              </Text>

              <View style={styles.thresholdGrid}>
                {THRESHOLD_OPTIONS.map((threshold) => (
                  <Pressable
                    key={threshold}
                    style={[
                      styles.thresholdOption,
                      alertConfigs.find((c) => c.budget_id === selectedBudgetId)?.threshold_percent === threshold &&
                        styles.thresholdOptionActive,
                    ]}
                    onPress={() => handleThresholdChange(threshold)}
                  >
                    <Text
                      style={[
                        styles.thresholdOptionText,
                        alertConfigs.find((c) => c.budget_id === selectedBudgetId)?.threshold_percent === threshold &&
                          styles.thresholdOptionTextActive,
                      ]}
                    >
                      {threshold}%
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setThresholdModalVisible(false);
                  setSelectedBudgetId(null);
                }}
              >
                <Text style={styles.modalCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  alertCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  budgetName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  percentText: {
    fontSize: 16,
    fontWeight: '800',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  amountText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ef444433',
    borderRadius: 8,
  },
  warningText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
  },
  configCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  configBudgetName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  configAmountText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  thresholdButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  thresholdText: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f87171',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  loadingText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: '80%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1b1039',
    borderRadius: 24,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  thresholdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  thresholdOption: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thresholdOptionActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
    borderColor: '#c084fc',
  },
  thresholdOptionText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700',
  },
  thresholdOptionTextActive: {
    color: '#c084fc',
  },
  modalCloseButton: {
    paddingVertical: 14,
    backgroundColor: '#c084fc',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
