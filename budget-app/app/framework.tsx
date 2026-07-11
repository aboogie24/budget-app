import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import {
  fetchUserTransactions,
  fetchInvestmentHoldings,
  fetchAccountBalances,
  fetchProperties,
} from '@/utils/api';
import { getCurrentUser } from '@/utils/storage';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
  commonStyles,
} from '@/utils/design-system';

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
  user_id?: string;
};

type Plan = {
  id: string;
  name: string;
  plan_type: 'debt_payoff' | 'savings' | 'combined';
  status: 'draft' | 'active' | 'paused' | 'completed';
  milestones?: Milestone[];
  user_id?: string;
};

type PlanWithProgress = Plan & {
  milestones: Milestone[];
  milestones_reached: number;
  milestones_total: number;
};

type Member = { user_id: string; full_name: string; role: string };

type PartnerGlyph = { glyph: string; color: string; name: string } | null;

type Achievement = {
  id: string;
  emoji: string;
  label: string;
  unlocked: boolean;
  hint: string;
};

// ─── Constants ──────────────────────────────────────────────────

// Level colour scale — tokenized, accessibility-safe (danger → safe → aspirational).
// Never colour-only: always number + name + ring fill + "LEVEL" label together.
const LEVEL_TOKENS: Record<number, keyof typeof colors> = {
  1: 'error', // Foundation — most fragile
  2: 'warning', // Attack Debt — active effort, caution
  3: 'info', // Build Security — stabilising
  4: 'success', // Grow Wealth — healthy, growing
  5: 'primary2', // Dream Big — aspirational / brand peak
};

const levelColorFor = (lvl: number): string => colors[LEVEL_TOKENS[lvl] ?? 'primary2'] || colors.primary;

const LEVEL_NAMES: string[] = [
  'Foundation',
  'Attack Debt',
  'Build Security',
  'Grow Wealth',
  'Dream Big',
];

const PLAN_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  debt_payoff: { label: 'Debt Payoff', color: colors.error, bg: `${colors.error}26` },
  savings: { label: 'Savings', color: colors.success, bg: `${colors.success}26` },
  combined: { label: 'Combined', color: colors.primary2, bg: `${colors.primary2}26` },
};

const shortDate = (d?: string): string | null => {
  if (!d) return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Progress Ring Component (tokenized) ────────────────────────

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
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const strokeDashoffset =
    circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
          stroke={colors.glassLight}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusPx}
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

// ─── Progress bar (shared, tokenized) ───────────────────────────

function FrameworkProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.progressBarBg}>
      <View
        style={[
          styles.progressBarFill,
          { width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────

export default function FrameworkScreen() {
  const router = useRouter();
  const [level, setLevel] = useState<FrameworkLevel | null>(null);
  const [plans, setPlans] = useState<PlanWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);

  // Couples attribution
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Member[]>([]);

  // Achievements inputs (relocated from dashboard)
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgetsCount, setBudgetsCount] = useState(0);
  const [savingsCurrent, setSavingsCurrent] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [debtTotal, setDebtTotal] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [levelData, plansData] = await Promise.all([
        api.get('/auth/ai/framework-level'),
        api.get('/auth/plans'),
      ]);

      setLevel(levelData as FrameworkLevel);

      // Load milestones + progress for active plans
      const allPlans = (plansData || []) as Plan[];
      const activePlans: Plan[] = allPlans.filter((p: Plan) => p.status === 'active');

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

      // ── Achievements + attribution data (all non-blocking) ──
      const user = await getCurrentUser().catch(() => null);
      if (user) {
        setUserId(user.id || null);
        setUserName(user.full_name || user.email || null);
      }

      // Transactions — first-link (source) + reviewer (user_verified count).
      fetchUserTransactions()
        .then((txns) => setTransactions(Array.isArray(txns) ? txns : []))
        .catch(() => {});

      if (user?.id) {
        // Household members for the partner glyph.
        api
          .get<any>(`/auth/households/me`, { user_id: user.id })
          .then((hh) => {
            let members = hh?.members;
            if (typeof members === 'string') {
              try {
                members = JSON.parse(members);
              } catch {
                members = [];
              }
            }
            if (Array.isArray(members) && members.length > 0) setHouseholdMembers(members);
          })
          .catch(() => {});

        // Budgets count — budget-set.
        api
          .get(`/auth/budgets/user/${user.id}`)
          .then((b) => setBudgetsCount(Array.isArray(b) ? b.length : 0))
          .catch(() => {});

        // Savings goals — savings-1k (sum current).
        api
          .get(`/auth/savings-goals`, { user_id: user.id })
          .then((goals) => {
            const arr = Array.isArray(goals) ? goals : [];
            setSavingsCurrent(arr.reduce((s: number, g: any) => s + (g.current_amount || 0), 0));
          })
          .catch(() => {});

        // Debts — for net worth.
        api
          .get(`/auth/debts`, { user_id: user.id })
          .then((debts) => {
            const arr = Array.isArray(debts) ? debts : [];
            setDebtTotal(arr.reduce((s: number, d: any) => s + (d.balance || 0), 0));
          })
          .catch(() => {});
      }

      // Net-worth asset inputs — positive-nw + nw-10k.
      Promise.all([
        fetchAccountBalances('depository').catch(() => []),
        fetchInvestmentHoldings().catch(() => []),
        fetchProperties().catch(() => []),
      ])
        .then(([balances, holdings, props]) => {
          setCashTotal(
            (Array.isArray(balances) ? balances : []).reduce(
              (s: number, a: any) => s + (a.current_balance || 0),
              0
            )
          );
          setInvestmentTotal(
            (Array.isArray(holdings) ? holdings : []).reduce(
              (s: number, h: any) => s + (h.institution_value || 0),
              0
            )
          );
          setPropertyTotal(
            (Array.isArray(props) ? props : []).reduce(
              (s: number, p: any) => s + (p.manual_value || p.zestimate || 0),
              0
            )
          );
        })
        .catch(() => {});

      setError(null);
    } catch (e: any) {
      console.error('Failed to load framework data:', e);
      setError(e?.message || 'Failed to load framework data');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
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
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update milestone');
    } finally {
      setTogglingMilestone(null);
    }
  };

  const currentLevel = level?.level || 1;
  const levelColor = levelColorFor(currentLevel);
  const pct = Math.round(level?.completed_pct || 0);

  // Partner glyph: A (current user) → primary2/◑, B → info/◐, shared/unknown → none.
  const resolvePartner = useCallback(
    (ownerId?: string): PartnerGlyph => {
      if (!ownerId || !userId || householdMembers.length < 2) return null;
      if (String(ownerId) === String(userId)) {
        const me = householdMembers.find((m) => String(m.user_id) === String(userId));
        return {
          glyph: '◑',
          color: colors.primary2,
          name: (me?.full_name || userName || 'You').split(' ')[0],
        };
      }
      const partner = householdMembers.find((m) => String(m.user_id) === String(ownerId));
      if (!partner) return null;
      return {
        glyph: '◐',
        color: colors.info,
        name: (partner.full_name || 'Partner').split(' ')[0],
      };
    },
    [userId, userName, householdMembers]
  );

  // Achievements — derived from current state, memoized. Ported verbatim from
  // the pre-redesign dashboard, relocated to the framework (progress) surface.
  const achievements = useMemo<Achievement[]>(() => {
    const hasBankSyncedTx = transactions.some((t: any) =>
      ['teller', 'bank', 'flinks'].includes(String(t.source || ''))
    );
    const verifiedCount = transactions.filter((t: any) => t.user_verified).length;
    const netWorthNow = cashTotal + investmentTotal + propertyTotal - debtTotal;
    return [
      { id: 'first-link', emoji: '🔗', label: 'First link', unlocked: hasBankSyncedTx, hint: 'Link a bank account' },
      { id: 'budget-set', emoji: '📊', label: 'Budget set', unlocked: budgetsCount > 0, hint: 'Create a budget' },
      { id: 'reviewer', emoji: '✅', label: 'Reviewer', unlocked: verifiedCount >= 10, hint: 'Verify 10 transactions' },
      { id: 'savings-1k', emoji: '💸', label: '$1k saved', unlocked: savingsCurrent >= 1000, hint: 'Save your first $1k' },
      { id: 'positive-nw', emoji: '🌱', label: 'In the green', unlocked: netWorthNow > 0, hint: 'Get net worth above zero' },
      { id: 'nw-10k', emoji: '💎', label: '$10k club', unlocked: netWorthNow >= 10000, hint: 'Net worth ≥ $10k' },
    ];
  }, [transactions, cashTotal, investmentTotal, propertyTotal, debtTotal, budgetsCount, savingsCurrent]);

  const showSkeleton = loading && !loadedOnce;

  // ── Reusable header ──
  const renderHeader = () => (
    <View style={styles.header}>
      <BackButton fallback="/(tabs)/goals" color={colors.text} />
      <Text style={styles.headerTitle}>CoupleFlow Method</Text>
      <View style={styles.headerRight}>
        {loading && loadedOnce && <ActivityIndicator color={colors.primary2} size="small" />}
      </View>
    </View>
  );

  // ── Error state ──
  if (error && !loadedOnce) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {renderHeader()}
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
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {renderHeader()}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary2}
              colors={[colors.primary2]}
            />
          }
        >
          {showSkeleton ? (
            <LoadingSkeleton />
          ) : level == null ? (
            <EmptyHero onGetStarted={() => router.push('/(tabs)/dashboard' as any)} />
          ) : (
            <>
              {/* ── TIER 1: Level Hero (the only floating card) ── */}
              <View
                style={styles.hero}
                accessibilityRole="summary"
                accessibilityLabel={`Level ${currentLevel}, ${
                  level.level_name || LEVEL_NAMES[currentLevel - 1]
                }, ${pct} percent complete toward the next level.`}
              >
                <ProgressRing size={160} strokeWidth={12} progress={pct} color={levelColor}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.ringPct}>{pct}%</Text>
                    <Text style={[styles.ringNumber, { color: levelColor }]}>{currentLevel}</Text>
                    <Text style={styles.ringLabel}>LEVEL</Text>
                  </View>
                </ProgressRing>

                <Text style={styles.heroName} numberOfLines={1}>
                  {level.level_name || LEVEL_NAMES[currentLevel - 1]}
                </Text>
                <Text style={styles.heroPct}>{pct}% complete</Text>
              </View>

              {/* ── TIER 2: Journey stepper ── */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Your Journey</Text>
                <View
                  style={styles.stepper}
                  accessibilityLabel={`Journey: level ${currentLevel} of ${LEVEL_NAMES.length}, current level ${
                    level.level_name || LEVEL_NAMES[currentLevel - 1]
                  }`}
                >
                  {LEVEL_NAMES.map((name, idx) => {
                    const stepLevel = idx + 1;
                    const isCompleted = stepLevel < currentLevel;
                    const isCurrent = stepLevel === currentLevel;
                    const isFuture = stepLevel > currentLevel;
                    const dotColor = levelColorFor(stepLevel);

                    return (
                      <View key={stepLevel} style={styles.stepContainer}>
                        {idx > 0 && (
                          <View
                            style={[
                              styles.connector,
                              {
                                backgroundColor:
                                  isCompleted || isCurrent
                                    ? levelColorFor(stepLevel - 1)
                                    : colors.glassLight,
                              },
                            ]}
                          />
                        )}

                        <View
                          style={[
                            styles.stepDot,
                            {
                              backgroundColor: isCompleted || isCurrent ? dotColor : 'transparent',
                              borderColor: isFuture ? colors.borderGlass : dotColor,
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
                          {/* "You are here" ring on the current dot (colour-independent) */}
                          {isCurrent && <View style={styles.currentRing} />}
                          {isCompleted && <Ionicons name="checkmark" size={16} color={colors.text} />}
                          {isCurrent && <Text style={styles.stepDotNum}>{stepLevel}</Text>}
                        </View>

                        <Text
                          style={[
                            styles.stepLabel,
                            {
                              color: isCurrent
                                ? colors.text
                                : isFuture
                                ? colors.textDark
                                : colors.textMuted,
                              fontWeight: isCurrent ? '700' : '400',
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

              {/* ── TIER 3: Criteria checklist ── */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Level {currentLevel} Criteria</Text>

                <View style={{ marginTop: spacing.md }}>
                  <FrameworkProgressBar pct={pct} color={levelColor} />
                </View>
                <Text style={styles.criteriaSummary}>
                  {(level.criteria || []).filter((c) => c.met).length} of{' '}
                  {(level.criteria || []).length} criteria met
                </Text>

                {(level.criteria || []).length === 0 ? (
                  <>
                    <View style={commonStyles.divider} />
                    <Text style={styles.emptyInline}>No criteria for this level</Text>
                  </>
                ) : (
                  <>
                    <View style={commonStyles.divider} />
                    {(level.criteria || []).map((criterion, idx) => (
                      <View
                        key={idx}
                        style={styles.criterionRow}
                        accessibilityLabel={`${criterion.name}, ${
                          criterion.met ? 'met' : 'not yet'
                        }. ${criterion.detail}`}
                      >
                        <View
                          style={[
                            styles.criterionIcon,
                            {
                              backgroundColor: criterion.met
                                ? `${colors.success}26`
                                : colors.glassLight,
                            },
                          ]}
                        >
                          <Ionicons
                            name={criterion.met ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={criterion.met ? colors.success : colors.textDark}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.criterionName,
                              { color: criterion.met ? colors.text : colors.textMuted },
                            ]}
                          >
                            {criterion.name}
                          </Text>
                          <Text style={styles.criterionDetail}>{criterion.detail}</Text>
                        </View>
                        {!criterion.met && <Text style={styles.notYet}>Not yet</Text>}
                      </View>
                    ))}
                  </>
                )}
              </View>

              {/* ── TIER 4: What to do next ── */}
              {(level.next_steps || []).length > 0 && (
                <View style={styles.card}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="bulb-outline" size={18} color={colors.warning} />
                    <Text style={styles.sectionTitle}>What to Do Next</Text>
                  </View>

                  {level.next_steps.map((step, idx) => (
                    <View key={idx} style={styles.nextStepRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.nextStepText}>{step}</Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => router.push('/(tabs)/ai' as any)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Ask AI for help"
                  >
                    <LinearGradient
                      colors={[...gradients.primaryGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaGradient}
                    >
                      <Ionicons name="sparkles" size={16} color={colors.text} />
                      <Text style={styles.ctaText}>Ask AI for Help</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Achievements (relocated from dashboard) ── */}
              <Text style={styles.groupLabel}>ACHIEVEMENTS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.achievementsRow}
              >
                {achievements.map((a) => (
                  <View
                    key={a.id}
                    style={[
                      styles.achBadge,
                      a.unlocked ? styles.achBadgeUnlocked : styles.achBadgeLocked,
                    ]}
                    accessibilityLabel={`${a.label}, ${a.unlocked ? 'unlocked' : `locked. ${a.hint}`}`}
                  >
                    <Text style={[styles.achEmoji, !a.unlocked && { opacity: 0.35 }]}>{a.emoji}</Text>
                    <Text
                      style={[
                        styles.achLabel,
                        { color: a.unlocked ? colors.text : colors.textDark },
                      ]}
                      numberOfLines={2}
                    >
                      {a.unlocked ? a.label : a.hint}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* ── TIER 5: Active plans ── */}
              <Text style={styles.groupLabel}>ACTIVE PLANS</Text>
              {plans.length > 0 ? (
                plans.map((plan) => {
                  const typeConfig =
                    PLAN_TYPE_CONFIG[plan.plan_type] || PLAN_TYPE_CONFIG.combined;
                  const reached = plan.milestones_reached;
                  const total = plan.milestones_total;

                  return (
                    <View
                      key={plan.id}
                      style={styles.card}
                      accessibilityLabel={`${plan.name}, ${typeConfig.label}, ${reached} of ${total} milestones reached`}
                    >
                      {/* Plan header */}
                      <View style={styles.planHeader}>
                        <Text style={styles.planName} numberOfLines={1}>
                          {plan.name}
                        </Text>
                        <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                          <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
                            {typeConfig.label}
                          </Text>
                        </View>
                      </View>

                      {/* Milestone progress */}
                      <FrameworkProgressBar
                        pct={total > 0 ? (reached / total) * 100 : 0}
                        color={colors.success}
                      />
                      <Text style={styles.milestoneSummary}>
                        {reached} of {total} milestones reached
                      </Text>

                      {plan.milestones.length > 0 && <View style={commonStyles.divider} />}

                      {/* Milestone list */}
                      {plan.milestones.map((ms) => {
                        const isToggling = togglingMilestone === ms.id;
                        const isReached = ms.status === 'reached';
                        const subtitle = isReached
                          ? `Reached ${shortDate(ms.reached_at) || ''}`.trim()
                          : ms.target_date
                          ? `Target ${shortDate(ms.target_date)}`
                          : null;
                        const partner = resolvePartner(ms.user_id || plan.user_id);

                        return (
                          <TouchableOpacity
                            key={ms.id}
                            style={styles.milestoneRow}
                            onPress={() => handleToggleMilestone(plan.id, ms)}
                            disabled={isToggling}
                            activeOpacity={0.6}
                            accessibilityRole="button"
                            accessibilityLabel={`${ms.title}, ${
                              isReached ? 'reached' : 'pending'
                            }${subtitle ? `, ${subtitle}` : ''}${
                              partner ? `, by ${partner.name}` : ''
                            }. Double tap to toggle.`}
                          >
                            <View style={styles.milestoneControl}>
                              {isToggling ? (
                                <ActivityIndicator size="small" color={colors.primary2} />
                              ) : (
                                <Ionicons
                                  name={isReached ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={22}
                                  color={isReached ? colors.success : colors.textDark}
                                />
                              )}
                            </View>
                            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                              <Text
                                style={[
                                  styles.milestoneTitle,
                                  isReached && {
                                    color: colors.textMuted,
                                    textDecorationLine: 'line-through',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {ms.title}
                              </Text>
                              {(subtitle || partner) && (
                                <Text style={styles.milestoneSubtitle} numberOfLines={1}>
                                  {subtitle}
                                  {partner ? (
                                    <Text style={{ color: partner.color }}>
                                      {subtitle ? '  ' : ''}
                                      {partner.glyph}
                                    </Text>
                                  ) : null}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })
              ) : (
                <View style={[styles.card, styles.emptyPlans]}>
                  <Ionicons name="map-outline" size={32} color={colors.textDark} />
                  <Text style={styles.emptyPlansText}>No active plans yet</Text>
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => router.push('/plans' as any)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Create a plan"
                  >
                    <LinearGradient
                      colors={[...gradients.primaryGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.ctaGradient}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.text} />
                      <Text style={styles.ctaText}>Create a Plan</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ─── Empty hero (brand-new couple, no framework level) ──────────

function EmptyHero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <View style={[styles.hero, { paddingVertical: spacing.xxl }]}>
      <Ionicons name="compass-outline" size={72} color={colors.textDark} />
      <Text style={[styles.heroName, { marginTop: spacing.lg, textAlign: 'center' }]}>
        Your journey hasn&apos;t started yet
      </Text>
      <Text style={styles.emptyHeroSub}>
        Add your income, debts, and savings to see your CoupleFlow level
      </Text>
      <TouchableOpacity
        style={[styles.ctaButton, { marginTop: spacing.lg, alignSelf: 'stretch' }]}
        onPress={onGetStarted}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Get started"
      >
        <LinearGradient
          colors={[...gradients.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaGradient}
        >
          <Ionicons name="rocket-outline" size={16} color={colors.text} />
          <Text style={styles.ctaText}>Get started</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─── Loading skeleton (layout-matched) ──────────────────────────

function LoadingSkeleton() {
  return (
    <View>
      {/* Hero */}
      <View style={[styles.hero, { gap: spacing.md }]}>
        <Skeleton width={160} height={160} borderRadius={80} />
        <Skeleton width={140} height={22} borderRadius={radius.sm} />
        <Skeleton width={90} height={14} borderRadius={radius.sm} />
      </View>

      {/* Stepper */}
      <View style={styles.card}>
        <Skeleton width={110} height={14} />
        <View style={[styles.stepper, { marginTop: spacing.lg }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.stepContainer}>
              <Skeleton width={26} height={26} borderRadius={13} />
              <Skeleton width={40} height={10} style={{ marginTop: spacing.sm }} />
            </View>
          ))}
        </View>
      </View>

      {/* Criteria */}
      <View style={styles.card}>
        <Skeleton width={130} height={14} />
        <Skeleton width="100%" height={6} borderRadius={radius.full} style={{ marginTop: spacing.md }} />
        <Skeleton width={110} height={12} style={{ marginTop: spacing.sm }} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.criterionRow, { borderBottomWidth: 0 }]}>
            <Skeleton width={32} height={32} borderRadius={radius.full} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width="70%" height={12} />
              <Skeleton width="45%" height={10} />
            </View>
          </View>
        ))}
      </View>

      {/* Plan */}
      <View style={styles.card}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="100%" height={6} borderRadius={radius.full} style={{ marginTop: spacing.md }} />
        {[0, 1].map((i) => (
          <View key={i} style={[styles.milestoneRow, { alignItems: 'center' }]}>
            <Skeleton width={22} height={22} borderRadius={radius.full} />
            <View style={{ flex: 1, marginLeft: spacing.sm, gap: spacing.sm }}>
              <Skeleton width="65%" height={12} />
              <Skeleton width="40%" height={10} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },

  // Card (flat glass, subordinate)
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  // TIER 1 hero (the only floating card)
  hero: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ringPct: {
    ...typography.small,
    color: colors.textMuted,
  },
  ringNumber: {
    ...typography.h1,
  },
  ringLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  heroName: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
  },
  heroPct: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  emptyHeroSub: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // TIER 2 stepper
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
    paddingVertical: spacing.sm, // keep ≥44pt tappable area for future interactivity
  },
  connector: {
    position: 'absolute',
    top: spacing.lg + 2,
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
  currentRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.primary2,
  },
  stepDotNum: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  stepLabel: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Progress bar
  progressBarBg: {
    height: 6,
    backgroundColor: colors.glassLight,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // TIER 3 criteria
  criteriaSummary: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  criterionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criterionName: {
    ...typography.smallBold,
  },
  criterionDetail: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  notYet: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
    marginTop: spacing.sm,
  },
  emptyInline: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // TIER 4 next steps
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary2,
    marginTop: 7,
  },
  nextStepText: {
    ...typography.small,
    color: colors.textMuted,
    flex: 1,
  },

  // CTA button
  ctaButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    borderRadius: radius.md,
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
  },

  // Achievements
  achievementsRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingRight: spacing.lg,
  },
  achBadge: {
    width: 96,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  achBadgeUnlocked: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.primary2,
  },
  achBadgeLocked: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  achEmoji: {
    fontSize: 24,
  },
  achLabel: {
    ...typography.caption,
    textAlign: 'center',
  },

  // TIER 5 plans
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planName: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  typeBadgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  milestoneSummary: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  milestoneControl: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  milestoneSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Empty plans
  emptyPlans: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyPlansText: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
