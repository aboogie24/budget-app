import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  ActivityIndicator,
  AccessibilityInfo,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { checkBudgetThresholds, fetchSpendingAlerts, upsertSpendingAlert } from '@/utils/api';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  gradients,
  glassEffects,
  spacing,
  radius,
  typography,
} from '@/utils/design-system';

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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type HealthTier = {
  word: string;
  icon: IoniconName;
  color: string;
};

/**
 * Single source of truth for a budget's health status: color + word + icon
 * always agree, so status is never conveyed by color alone (a11y).
 * Preserves the previous getProgressBarColor breakpoints.
 */
function getHealthTier(percentUsed: number, thresholdPercent: number): HealthTier {
  if (percentUsed >= 100) return { word: 'Over', icon: 'alert-circle', color: colors.error };
  if (percentUsed >= thresholdPercent) return { word: 'Nearing', icon: 'warning', color: colors.warning };
  if (percentUsed >= 60) return { word: 'Watch', icon: 'eye-outline', color: colors.warning };
  return { word: 'On track', icon: 'checkmark-circle', color: colors.success };
}

const formatCurrency = (value: number) =>
  (value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

// ─── Health summary strip (derived headline) ───
function AlertHealthSummary({
  activeAlerts,
  totalBudgets,
}: {
  activeAlerts: Alert[];
  totalBudgets: number;
}) {
  const overCount = activeAlerts.filter((a) => a.percent_used >= 100).length;
  const nearCount = activeAlerts.length;

  let icon: IoniconName;
  let color: string;
  let text: string;

  if (nearCount === 0) {
    icon = 'checkmark-circle';
    color = colors.success;
    text = 'All budgets on track';
  } else {
    icon = 'warning';
    color = overCount > 0 ? colors.error : colors.warning;
    text = `${nearCount} of ${totalBudgets} budgets near or over limit`;
  }

  return (
    <View style={styles.summaryStrip} accessibilityRole="text" accessibilityLabel={text}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.summaryText}>{text}</Text>
    </View>
  );
}

// ─── Read-only budget health card ───
function BudgetHealthCard({
  alert,
  reduceMotion,
}: {
  alert: Alert;
  reduceMotion: boolean;
}) {
  const tier = getHealthTier(alert.percent_used, alert.threshold_percent);
  const targetWidth = Math.min(alert.percent_used, 100);
  const anim = useRef(new Animated.Value(reduceMotion ? targetWidth : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(targetWidth);
      return;
    }
    Animated.timing(anim, {
      toValue: targetWidth,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [anim, targetWidth, reduceMotion]);

  const widthInterpolate = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={styles.healthCard}
      accessibilityLabel={`${alert.budget_name}, ${tier.word}, ${Math.round(
        alert.percent_used,
      )} percent, ${formatCurrency(alert.spent_amount)} of ${formatCurrency(alert.budget_amount)}${
        alert.over_threshold ? ', over limit' : ''
      }`}
    >
      <View style={styles.healthTopRow}>
        <Text style={styles.budgetName} numberOfLines={1}>
          {alert.budget_name}
        </Text>
        <View style={styles.healthStatusGroup}>
          <View style={styles.statusChip}>
            <Ionicons name={tier.icon} size={13} color={tier.color} />
            <Text style={[styles.statusWord, { color: tier.color }]}>{tier.word}</Text>
          </View>
          <Text style={[styles.percentText, { color: tier.color }]}>
            {Math.round(alert.percent_used)}%
          </Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[styles.progressBar, { width: widthInterpolate, backgroundColor: tier.color }]}
        />
      </View>

      <View style={styles.healthBottomRow}>
        <Text style={styles.amountText}>
          {formatCurrency(alert.spent_amount)} of {formatCurrency(alert.budget_amount)}
        </Text>
        {alert.over_threshold && (
          <View style={styles.warningBadge}>
            <Ionicons name="alert-circle" size={12} color={colors.error} />
            <Text style={styles.warningText}>Over limit</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Configurable alert row (inside the shared Configure Alerts card) ───
function AlertConfigRow({
  budgetName,
  budgetAmount,
  thresholdPercent,
  isEnabled,
  isUpdating,
  showDivider,
  onPressThreshold,
  onToggle,
}: {
  budgetName: string;
  budgetAmount: number;
  thresholdPercent: number;
  isEnabled: boolean;
  isUpdating: boolean;
  showDivider: boolean;
  onPressThreshold: () => void;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.configRow, showDivider && styles.configRowDivider]}>
      <View style={styles.configTextCol}>
        <Text style={styles.configBudgetName} numberOfLines={1}>
          {budgetName}
        </Text>
        <Text style={styles.configAmountText}>Limit: {formatCurrency(budgetAmount)}</Text>
      </View>

      <TouchableOpacity
        style={styles.thresholdButton}
        onPress={onPressThreshold}
        disabled={isUpdating}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Alert threshold for ${budgetName}, currently ${thresholdPercent}%`}
      >
        {isUpdating ? (
          <ActivityIndicator size="small" color={colors.primary2} />
        ) : (
          <Text style={styles.thresholdText}>{thresholdPercent}%</Text>
        )}
      </TouchableOpacity>

      <Switch
        value={isEnabled}
        onValueChange={onToggle}
        disabled={isUpdating}
        trackColor={{ false: colors.border, true: `${colors.primary2}40` }}
        thumbColor={isEnabled ? colors.primary2 : colors.textMuted}
        accessibilityRole="switch"
        accessibilityLabel={`Spending alert for ${budgetName}`}
        accessibilityState={{ checked: isEnabled }}
      />
    </View>
  );
}

// ─── Threshold picker bottom sheet ───
function ThresholdPickerSheet({
  visible,
  budgetName,
  current,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  budgetName?: string;
  current?: number;
  options: number[];
  onSelect: (n: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              Alert threshold{budgetName ? ` — ${budgetName}` : ''}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sheetSubtitle}>Alert me when spending reaches:</Text>

          <View style={styles.thresholdGrid}>
            {options.map((n) => {
              const selected = n === current;
              return (
                <Pressable
                  key={n}
                  style={[styles.thresholdOption, selected && styles.thresholdOptionActive]}
                  onPress={() => onSelect(n)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${n} percent`}
                >
                  <Text
                    style={[
                      styles.thresholdOptionText,
                      selected && styles.thresholdOptionTextActive,
                    ]}
                  >
                    {n}%
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={onClose}>
            <LinearGradient
              colors={[...gradients.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneButton}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Section label ───
function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function SpendingAlertsScreen() {
  const router = useRouter();
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [updatingBudgetId, setUpdatingBudgetId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

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
      setLoadedOnce(true);
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

  const handleToggleAlert = async (
    budgetId: string,
    currentEnabled: boolean,
    threshold: number,
  ) => {
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

  const closeSheet = () => {
    setThresholdModalVisible(false);
    setSelectedBudgetId(null);
  };

  const hasActiveAlerts = activeAlerts.length > 0;
  const hasConfiguredBudgets = alertConfigs.length > 0;
  const showSkeleton =
    loading && activeAlerts.length === 0 && alertConfigs.length === 0;
  const backgroundRefreshing = loading && loadedOnce;

  const selectedConfig = alertConfigs.find((c) => c.budget_id === selectedBudgetId);

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/dashboard" iconName="chevron-back" size={22} />
          <Text style={styles.headerTitle}>Spending Alerts</Text>
          <View style={styles.headerRight}>
            {backgroundRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary2} />
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary2}
            />
          }
        >
          {showSkeleton ? (
            <LoadingSkeleton />
          ) : error && !hasConfiguredBudgets && !hasActiveAlerts ? (
            <View style={styles.noticeCard}>
              <Ionicons name="alert-circle-outline" size={26} color={colors.error} />
              <Text style={styles.noticeTitle}>Couldn't load your alerts</Text>
              <TouchableOpacity onPress={loadAlerts}>
                <Text style={styles.noticeAction}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !hasConfiguredBudgets ? (
            <View style={styles.noticeCard}>
              <Ionicons name="notifications-off-outline" size={26} color={colors.textDark} />
              <Text style={styles.noticeTitle}>No alerts configured</Text>
              <Text style={styles.noticeSub}>
                Create a shared budget with your partner to get alerts before you overspend.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => router.push('/(tabs)/budget' as any)}
              >
                <Text style={styles.ctaText}>Set up a budget</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Inline error strip when content already present */}
              {error && (
                <View style={styles.errorStrip}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorStripText} numberOfLines={2}>
                    {error}
                  </Text>
                  <TouchableOpacity onPress={loadAlerts}>
                    <Text style={styles.errorStripAction}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              <AlertHealthSummary
                activeAlerts={activeAlerts}
                totalBudgets={alertConfigs.length}
              />

              {/* Budget Health */}
              <View style={styles.section}>
                <SectionLabel>Budget Health</SectionLabel>
                {hasActiveAlerts ? (
                  activeAlerts.map((alert) => (
                    <BudgetHealthCard
                      key={alert.budget_id}
                      alert={alert}
                      reduceMotion={reduceMotion}
                    />
                  ))
                ) : (
                  <View style={styles.healthyCard}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.healthyTitle}>All budgets on track</Text>
                      <Text style={styles.healthySub}>
                        You're under every threshold this month.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Configure Alerts */}
              <View style={styles.section}>
                <SectionLabel>Configure Alerts</SectionLabel>
                <View style={styles.configCard}>
                  {alertConfigs.map((config, index) => {
                    const isEnabled = config.is_enabled ?? true;
                    return (
                      <AlertConfigRow
                        key={config.budget_id}
                        budgetName={config.budget_name || 'Budget'}
                        budgetAmount={config.budget_amount || 0}
                        thresholdPercent={config.threshold_percent}
                        isEnabled={isEnabled}
                        isUpdating={updatingBudgetId === config.budget_id}
                        showDivider={index > 0}
                        onPressThreshold={() => {
                          setSelectedBudgetId(config.budget_id);
                          setThresholdModalVisible(true);
                        }}
                        onToggle={() =>
                          handleToggleAlert(config.budget_id, isEnabled, config.threshold_percent)
                        }
                      />
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <ThresholdPickerSheet
          visible={thresholdModalVisible}
          budgetName={selectedConfig?.budget_name}
          current={selectedConfig?.threshold_percent}
          options={THRESHOLD_OPTIONS}
          onSelect={handleThresholdChange}
          onClose={closeSheet}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

// ─── Loading skeleton (shape-matched) ───
function LoadingSkeleton() {
  return (
    <View>
      <View style={styles.summaryStrip}>
        <Skeleton height={16} width="60%" />
      </View>

      <View style={styles.section}>
        <Skeleton width={90} height={10} style={{ marginBottom: spacing.sm }} />
        {[0, 1].map((i) => (
          <View key={i} style={styles.healthCard}>
            <View style={styles.healthTopRow}>
              <Skeleton width="40%" height={14} />
              <Skeleton width={48} height={14} />
            </View>
            <Skeleton height={8} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
            <Skeleton width="50%" height={12} style={{ marginTop: spacing.md }} />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Skeleton width={90} height={10} style={{ marginBottom: spacing.sm }} />
        <View style={styles.configCard}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.configRow, i > 0 && styles.configRowDivider]}>
              <View style={styles.configTextCol}>
                <Skeleton width="55%" height={12} />
                <Skeleton width="35%" height={10} style={{ marginTop: spacing.sm }} />
              </View>
              <Skeleton width={44} height={24} borderRadius={radius.sm} />
              <Skeleton width={44} height={26} borderRadius={radius.full} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  summaryText: {
    color: colors.text,
    ...typography.small,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },

  // Health card
  healthCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  healthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  budgetName: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
    flexShrink: 1,
  },
  healthStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusWord: {
    ...typography.caption,
    fontWeight: '700',
  },
  percentText: {
    ...typography.bodyBold,
    fontWeight: '800',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.glassMedium,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.sm,
  },
  healthBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountText: {
    color: colors.textMuted,
    ...typography.caption,
    flexShrink: 1,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.error}22`,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  warningText: {
    color: colors.error,
    ...typography.caption,
    fontWeight: '700',
  },

  // All-healthy card
  healthyCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  healthyTitle: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
  },
  healthySub: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 2,
  },

  // Configure alerts card + rows
  configCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.md,
  },
  configRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  configTextCol: {
    flex: 1,
  },
  configBudgetName: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
  },
  configAmountText: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 2,
  },
  thresholdButton: {
    minWidth: 44,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.primary2}26`,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: `${colors.primary2}4d`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thresholdText: {
    color: colors.primary2,
    ...typography.smallBold,
    fontWeight: '700',
  },

  // Notice card (empty / error) — matches calendar
  noticeCard: {
    ...glassEffects.glass,
    marginTop: spacing.md,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeTitle: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
    textAlign: 'center',
  },
  noticeSub: {
    color: colors.textMuted,
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  noticeAction: {
    color: colors.primary2,
    ...typography.smallBold,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  ctaText: {
    color: '#fff',
    ...typography.smallBold,
    fontWeight: '700',
  },

  // Inline error strip (mid-flight failures)
  errorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.error}1a`,
    borderWidth: 1,
    borderColor: `${colors.error}40`,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  errorStripText: {
    color: colors.text,
    ...typography.caption,
    flex: 1,
  },
  errorStripAction: {
    color: colors.primary2,
    ...typography.smallBold,
    fontWeight: '700',
  },

  // Bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderGlass,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
    flexShrink: 1,
  },
  sheetSubtitle: {
    color: colors.textMuted,
    ...typography.small,
    marginBottom: spacing.lg,
  },
  thresholdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  thresholdOption: {
    flexGrow: 1,
    minWidth: '30%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thresholdOptionActive: {
    backgroundColor: `${colors.primary2}33`,
    borderColor: colors.primary2,
  },
  thresholdOptionText: {
    color: colors.textMuted,
    ...typography.bodyBold,
    fontWeight: '700',
  },
  thresholdOptionTextActive: {
    color: colors.primary2,
  },
  doneButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#fff',
    ...typography.button,
    fontWeight: '700',
  },
});
