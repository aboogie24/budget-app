import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../utils/apiClient';
import { ErrorState } from '@/components/ErrorState';

// ─── Types ──────────────────────────────────────────────────────

type Criterion = {
  name: string;
  met: boolean;
  detail: string;
};

type FrameworkLevel = {
  level: number;
  level_name: string;
  criteria: Criterion[];
  completed_pct: number;
  next_steps: string[];
};

type Milestone = {
  id: string;
  plan_id: string;
  title: string;
  description?: string;
  target_date?: string;
  target_amount?: number;
  status: 'pending' | 'reached' | 'skipped';
  reached_at?: string;
};

type Plan = {
  id: string;
  name: string;
  plan_type: 'debt_payoff' | 'savings' | 'combined';
  status: 'draft' | 'active' | 'paused' | 'completed';
  milestones?: Milestone[];
};

type PlanWithProgress = Plan & {
  milestones: Milestone[];
  milestones_reached: number;
  milestones_total: number;
};

// ─── Constants ──────────────────────────────────────────────────

const LEVEL_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#7c3aed',
};

const LEVEL_NAMES: string[] = [
  'Foundation',
  'Attack Debt',
  'Build Security',
  'Grow Wealth',
  'Dream Big',
];

const PLAN_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  debt_payoff: { label: 'Debt Payoff', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  savings: { label: 'Savings', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  combined: { label: 'Combined', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
};

// ─── Progress Ring Component ────────────────────────────────────

function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────

export default function FrameworkScreen() {
  const router = useRouter();
  const [level, setLevel] = useState<FrameworkLevel | null>(null);
  const [plans, setPlans] = useState<PlanWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [levelData, plansData] = await Promise.all([
        api.get('/auth/ai/framework-level'),
        api.get('/auth/plans'),
      ]);

      setLevel(levelData as FrameworkLevel);

      // Load milestones + progress for active plans
      const allPlans = (plansData || []) as Plan[];
      const activePlans: Plan[] = allPlans.filter(
        (p: Plan) => p.status === 'active'
      );

      const withProgress: PlanWithProgress[] = await Promise.all(
        activePlans.map(async (plan: Plan) => {
          try {
            const [detail, progress] = await Promise.all([
              api.get(`/auth/plans/${plan.id}`) as Promise<any>,
              api.get(`/auth/plans/${plan.id}/progress`) as Promise<any>,
            ]);
            return {
              ...plan,
              milestones: detail?.milestones || [],
              milestones_reached: progress?.milestones_reached || 0,
              milestones_total: progress?.milestones_total || 0,
            };
          } catch {
            return {
              ...plan,
              milestones: [],
              milestones_reached: 0,
              milestones_total: 0,
            };
          }
        })
      );

      setPlans(withProgress);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load framework data:', e);
      setError(e?.message || 'Failed to load framework data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleMilestone = async (planId: string, milestone: Milestone) => {
    const newStatus = milestone.status === 'reached' ? 'pending' : 'reached';
    setTogglingMilestone(milestone.id);
    try {
      await api.put(`/auth/plans/${planId}/milestones/${milestone.id}`, {
        status: newStatus,
      });
      // Reload data to reflect changes
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update milestone');
    } finally {
      setTogglingMilestone(null);
    }
  };

  const currentLevel = level?.level || 1;
  const levelColor = LEVEL_COLORS[currentLevel] || '#7c3aed';

  if (loading) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#c084fc" />
          <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 14 }}>
            Loading your progress...
          </Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>CoupleFlow Method</Text>
            <View style={{ width: 36 }} />
          </View>
          <ErrorState
            title="Something went wrong"
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              loadData();
            }}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CoupleFlow Method</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c084fc" />
          }
        >
          {/* ─── 1. Framework Level Hero ─── */}
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <ProgressRing
              size={160}
              strokeWidth={10}
              progress={level?.completed_pct || 0}
              color={levelColor}
            >
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: levelColor, fontSize: 42, fontWeight: '800' }}>
                  {currentLevel}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>LEVEL</Text>
              </View>
            </ProgressRing>

            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16 }}>
              {level?.level_name || LEVEL_NAMES[currentLevel - 1]}
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
              {Math.round(level?.completed_pct || 0)}% complete
            </Text>
          </View>

          {/* ─── 2. Level Progress Stepper ─── */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>Your Journey</Text>
            <View style={styles.stepper}>
              {LEVEL_NAMES.map((name, idx) => {
                const stepLevel = idx + 1;
                const isCompleted = stepLevel < currentLevel;
                const isCurrent = stepLevel === currentLevel;
                const isFuture = stepLevel > currentLevel;
                const dotColor = LEVEL_COLORS[stepLevel];

                return (
                  <View key={stepLevel} style={styles.stepContainer}>
                    {/* Connector line (skip for first) */}
                    {idx > 0 && (
                      <View
                        style={[
                          styles.connector,
                          {
                            backgroundColor: isCompleted || isCurrent
                              ? LEVEL_COLORS[stepLevel - 1]
                              : 'rgba(255,255,255,0.1)',
                          },
                        ]}
                      />
                    )}

                    {/* Dot */}
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: isCompleted || isCurrent ? dotColor : 'transparent',
                          borderColor: isFuture ? 'rgba(255,255,255,0.2)' : dotColor,
                          borderWidth: 2,
                        },
                        isCurrent && {
                          shadowColor: dotColor,
                          shadowOpacity: 0.6,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 6,
                        },
                      ]}
                    >
                      {isCompleted && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
                      {isCurrent && (
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                          {stepLevel}
                        </Text>
                      )}
                    </View>

                    {/* Label */}
                    <Text
                      style={[
                        styles.stepLabel,
                        {
                          color: isCurrent ? '#fff' : isFuture ? '#475569' : '#94a3b8',
                          fontWeight: isCurrent ? '700' : '500',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ─── 3. Current Level Criteria Checklist ─── */}
          <View style={[styles.card, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>Level {currentLevel} Criteria</Text>

            {/* Overall progress bar */}
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(level?.completed_pct || 0, 100)}%`,
                    backgroundColor: levelColor,
                  },
                ]}
              />
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 14 }}>
              {(level?.criteria || []).filter((c) => c.met).length} of{' '}
              {(level?.criteria || []).length} criteria met
            </Text>

            {(level?.criteria || []).map((criterion, idx) => (
              <View key={idx} style={styles.criterionRow}>
                <View
                  style={[
                    styles.criterionIcon,
                    {
                      backgroundColor: criterion.met
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(255,255,255,0.05)',
                    },
                  ]}
                >
                  <Ionicons
                    name={criterion.met ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={criterion.met ? '#22c55e' : '#475569'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.criterionName,
                      { color: criterion.met ? '#fff' : '#94a3b8' },
                    ]}
                  >
                    {criterion.name}
                  </Text>
                  <Text style={styles.criterionDetail}>{criterion.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── 4. Next Steps Card ─── */}
          {(level?.next_steps || []).length > 0 && (
            <View style={[styles.card, { marginTop: 14 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name="bulb-outline" size={18} color="#eab308" />
                <Text style={styles.sectionTitle}>What to Do Next</Text>
              </View>

              {level!.next_steps.map((step, idx) => (
                <View key={idx} style={styles.nextStepRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.nextStepText}>{step}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => {
                  // Navigate to AI chat tab
                  router.push('/(tabs)/ai' as any);
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#7c3aed', '#a855f7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiButtonGradient}
                >
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={styles.aiButtonText}>Ask AI for Help</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── 5. Active Plans with Milestones ─── */}
          {plans.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 10, marginLeft: 4 }]}>
                Active Plans
              </Text>

              {plans.map((plan) => {
                const typeConfig = PLAN_TYPE_CONFIG[plan.plan_type] || PLAN_TYPE_CONFIG.combined;
                const reached = plan.milestones_reached;
                const total = plan.milestones_total;

                return (
                  <View key={plan.id} style={[styles.card, { marginBottom: 12 }]}>
                    {/* Plan header */}
                    <View style={styles.planHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                          {plan.name}
                        </Text>
                      </View>
                      <View
                        style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}
                      >
                        <Text style={{ color: typeConfig.color, fontSize: 11, fontWeight: '700' }}>
                          {typeConfig.label}
                        </Text>
                      </View>
                    </View>

                    {/* Milestone progress summary */}
                    <View style={styles.milestoneProgress}>
                      <View style={styles.progressBarBg}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: total > 0 ? `${(reached / total) * 100}%` : '0%',
                              backgroundColor: '#22c55e',
                            },
                          ]}
                        />
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                        {reached} of {total} milestones reached
                      </Text>
                    </View>

                    {/* Milestone list */}
                    {plan.milestones.map((ms) => {
                      const isToggling = togglingMilestone === ms.id;
                      const isReached = ms.status === 'reached';

                      return (
                        <TouchableOpacity
                          key={ms.id}
                          style={styles.milestoneRow}
                          onPress={() => handleToggleMilestone(plan.id, ms)}
                          disabled={isToggling}
                          activeOpacity={0.6}
                        >
                          {isToggling ? (
                            <ActivityIndicator size="small" color="#c084fc" style={{ width: 24 }} />
                          ) : (
                            <Ionicons
                              name={isReached ? 'checkmark-circle' : 'ellipse-outline'}
                              size={22}
                              color={isReached ? '#22c55e' : '#475569'}
                            />
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text
                              style={[
                                styles.milestoneTitle,
                                isReached && { color: '#94a3b8', textDecorationLine: 'line-through' },
                              ]}
                            >
                              {ms.title}
                            </Text>
                            {ms.target_date && (
                              <Text style={styles.milestoneDate}>
                                Target: {new Date(ms.target_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}

          {/* Empty state for plans */}
          {plans.length === 0 && (
            <View style={[styles.card, { marginTop: 14, alignItems: 'center', paddingVertical: 24 }]}>
              <Ionicons name="map-outline" size={32} color="#475569" />
              <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                No active plans yet
              </Text>
              <TouchableOpacity
                style={[styles.aiButton, { marginTop: 14 }]}
                onPress={() => router.push('/plans')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#7c3aed', '#a855f7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiButtonGradient}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={styles.aiButtonText}>Create a Plan</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 12,
    right: '50%',
    left: '-50%',
    height: 2,
    zIndex: 0,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Progress bar
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Criteria
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  criterionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criterionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  criterionDetail: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },

  // Next steps
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c084fc',
    marginTop: 6,
  },
  nextStepText: {
    color: '#cbd5e1',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },

  // AI button
  aiButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  aiButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Plans
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  milestoneProgress: {
    marginBottom: 12,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  milestoneTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  milestoneDate: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
});
