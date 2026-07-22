import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  commonStyles,
} from '@/utils/design-system';

const EXTRA_PRESETS = [0, 100, 250, 500, 1000, 2000];

type Debt = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  min_payment: number;
};

type Strategy = 'avalanche' | 'snowball' | 'custom';

type PayoffResult = {
  totalMonths: number;
  totalInterest: number;
  payoffDate: string;
  perDebt: { id: string; name: string; months: number; interest: number }[];
};

const MAX_MONTHS = 600;

function computePayoff(debts: Debt[], extraPayment: number, strategy: Strategy): PayoffResult {
  if (debts.length === 0) {
    return { totalMonths: 0, totalInterest: 0, payoffDate: new Date().toISOString(), perDebt: [] };
  }

  // Clone balances
  const state = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    apr: d.apr,
    minPayment: d.min_payment,
    interest: 0,
    paidOff: false,
    paidOffMonth: 0,
  }));

  // Sort by strategy
  const sorted = [...state];
  if (strategy === 'avalanche') {
    sorted.sort((a, b) => b.apr - a.apr); // highest APR first
  } else if (strategy === 'snowball') {
    sorted.sort((a, b) => a.balance - b.balance); // lowest balance first
  }
  // 'custom' keeps original order

  let months = 0;
  let totalInterest = 0;
  // Minimums freed by cleared debts roll forward PERMANENTLY — that
  // acceleration is the entire point of snowball/avalanche. Resetting the
  // pool each month silently dropped the freed minimums after the clearing
  // month, overstating payoff time and interest for multi-debt plans.
  let rolledMinimums = 0;

  while (months < MAX_MONTHS) {
    const allPaid = sorted.every((d) => d.balance <= 0);
    if (allPaid) break;

    months++;
    let extraPool = extraPayment + rolledMinimums;

    // 1. Apply monthly interest
    for (const d of sorted) {
      if (d.balance <= 0) continue;
      const monthlyInterest = d.balance * (d.apr / 100) / 12;
      d.balance += monthlyInterest;
      d.interest += monthlyInterest;
      totalInterest += monthlyInterest;
    }

    // 2. Apply min payments to all debts
    for (const d of sorted) {
      if (d.balance <= 0) continue;
      const payment = Math.min(d.minPayment, d.balance);
      d.balance -= payment;
      if (d.balance <= 0.01) {
        d.balance = 0;
        if (!d.paidOff) {
          d.paidOff = true;
          d.paidOffMonth = months;
          // The full minimum frees up starting NEXT month; this month only
          // the unused slice of it is still available to spend.
          rolledMinimums += d.minPayment;
          extraPool += d.minPayment - payment;
        }
      }
    }

    // 3. Apply extra payment to priority debt (first unpaid in sorted order)
    for (const d of sorted) {
      if (d.balance <= 0 || extraPool <= 0) continue;
      const payment = Math.min(extraPool, d.balance);
      d.balance -= payment;
      extraPool -= payment;
      if (d.balance <= 0.01) {
        d.balance = 0;
        if (!d.paidOff) {
          d.paidOff = true;
          d.paidOffMonth = months;
          // Its minimum was already spent this month — it frees from next month.
          rolledMinimums += d.minPayment;
        }
      }
    }
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    totalMonths: months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    payoffDate: payoffDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    perDebt: sorted.map((d) => ({
      id: d.id,
      name: d.name,
      months: d.paidOffMonth || months,
      interest: Math.round(d.interest * 100) / 100,
    })),
  };
}

const fmt = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const STRATEGIES: { key: Strategy; label: string; desc: string }[] = [
  { key: 'avalanche', label: 'Avalanche', desc: 'Highest APR' },
  { key: 'snowball', label: 'Snowball', desc: 'Lowest bal' },
  { key: 'custom', label: 'Custom', desc: 'Your order' },
];

// ── Group label (uppercase caption, e.g. "YOUR LEVERS") ──
function GroupLabel({ children }: { children: string }) {
  return <Text style={styles.groupLabel}>{children}</Text>;
}

// ── Loading skeleton, layout-matched to the three tiers ──
function LoadingSkeleton() {
  return (
    <View>
      {/* Tier 1 — floating headline */}
      <View style={[glassEffects.glassFloating, styles.headlineCard]}>
        <Skeleton width={110} height={12} />
        <Skeleton width={200} height={34} style={{ marginTop: spacing.md }} />
        <Skeleton width={140} height={12} style={{ marginTop: spacing.sm }} />
        <View style={styles.metricRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.metricCell}>
              <Skeleton width={54} height={14} />
              <Skeleton width={40} height={10} style={{ marginTop: spacing.xs }} />
            </View>
          ))}
        </View>
        <Skeleton width="100%" height={36} style={{ marginTop: spacing.lg, borderRadius: radius.md }} />
      </View>

      {/* Tier 2 — levers */}
      <GroupLabel>YOUR LEVERS</GroupLabel>
      <View style={[glassEffects.glass, styles.tierCard]}>
        <View style={styles.segmentRow}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={56} style={{ flex: 1, borderRadius: radius.md }} />
          ))}
        </View>
        <View style={commonStyles.divider} />
        <Skeleton width={140} height={28} style={{ alignSelf: 'center' }} />
        <View style={[styles.presetRow, { marginTop: spacing.md }]}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={60} height={36} style={{ borderRadius: radius.full }} />
          ))}
        </View>
        <View style={commonStyles.divider} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={48} style={{ borderRadius: radius.md, marginBottom: spacing.sm }} />
        ))}
      </View>

      {/* Tier 3 — breakdown */}
      <GroupLabel>THE BREAKDOWN</GroupLabel>
      <View style={[glassEffects.glass, styles.tierCard]}>
        <Skeleton height={16} style={{ marginBottom: spacing.md }} />
        <Skeleton height={16} width="70%" />
      </View>
      <GroupLabel>PAYOFF ORDER</GroupLabel>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={52} style={{ borderRadius: radius.md, marginBottom: spacing.sm }} />
      ))}
    </View>
  );
}

export default function PayoffCalculatorScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extraPayment, setExtraPayment] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  const heroOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduceMotion(v));
    return () => {
      mounted = false;
      // @ts-ignore — older RN returns void; newer returns a subscription
      sub?.remove?.();
    };
  }, []);

  const loadDebts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const userId = await api.getUserId();
      if (!userId) {
        setDebts([]);
        setSelectedIds(new Set());
        return;
      }
      const data = await api.get<Debt[]>('/auth/debts', { user_id: userId });
      const active = (Array.isArray(data) ? data : []).filter((d) => d.balance > 0);
      setDebts(active);
      setSelectedIds(new Set(active.map((d) => d.id)));
    } catch (e) {
      console.error('Failed to load debts:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const focusedDebts = useMemo(
    () => debts.filter((d) => selectedIds.has(d.id)),
    [debts, selectedIds]
  );

  const result = useMemo(
    () => computePayoff(focusedDebts, extraPayment, strategy),
    [focusedDebts, extraPayment, strategy]
  );

  // Baseline result with $0 extra — for the savings callout diff. Memoized on
  // [focusedDebts, strategy] so typing an amount doesn't recompute it.
  const baseResult = useMemo(
    () => computePayoff(focusedDebts, 0, strategy),
    [focusedDebts, strategy]
  );

  const monthsSaved = baseResult.totalMonths - result.totalMonths;
  // When the $0-extra baseline never amortizes it hits the 600-month cap, so
  // its interest total is truncated — a diff against it would understate the
  // real savings. Show months saved but not a misleading interest figure.
  const baselineCapped = baseResult.totalMonths >= MAX_MONTHS;
  const interestSaved = baselineCapped ? 0 : baseResult.totalInterest - result.totalInterest;
  const showSavings = extraPayment > 0 && monthsSaved > 0;

  // Cross-fade the hero date when the payoff answer changes.
  useEffect(() => {
    if (reduceMotion) return;
    heroOpacity.setValue(0.35);
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [result.payoffDate, result.totalMonths, reduceMotion, heroOpacity]);

  const toggleDebt = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = debts.length > 0 && selectedIds.size === debts.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(debts.map((d) => d.id)));
  };

  const totalBalance = focusedDebts.reduce((s, d) => s + d.balance, 0);
  const totalCost = totalBalance + result.totalInterest;

  const neverPayable = result.totalMonths >= MAX_MONTHS;
  const noSelection = selectedIds.size === 0;

  // ── Header (shared across all states) ──
  const Header = (
    <View style={styles.headerRow}>
      <BackButton fallback="/(tabs)/goals" />
      <Text style={styles.headerTitle}>Payoff Calculator</Text>
      <View style={{ width: spacing.xxxl }} />
    </View>
  );

  const heroLabel = neverPayable
    ? 'Over 50 years'
    : noSelection
    ? ''
    : result.payoffDate;
  const heroSub = neverPayable
    ? 'at this rate'
    : `${result.totalMonths} months from now`;

  // ── TIER 1 — Payoff headline ──
  const renderHeadline = () => {
    if (noSelection) {
      return (
        <View
          style={[glassEffects.glassFloating, styles.headlineCard]}
          accessibilityRole="summary"
          accessibilityLabel="Pick at least one debt below to see your payoff."
        >
          <View style={styles.headlineWash} />
          <View style={styles.eyebrowRow}>
            <Ionicons name="flag" size={16} color={colors.primary2} />
            <Text style={styles.eyebrow}>DEBT-FREE BY</Text>
          </View>
          <View style={styles.promptRow}>
            <Ionicons name="funnel-outline" size={18} color={colors.textMuted} />
            <Text style={styles.promptText}>Pick at least one debt below to see your payoff.</Text>
          </View>
        </View>
      );
    }

    const a11y =
      `Debt-free by ${heroLabel}, ${heroSub}. ` +
      `Time to pay ${result.totalMonths} months. Interest ${fmt(result.totalInterest)}. ` +
      `Total cost ${fmt(totalCost)}.` +
      (showSavings
        ? ` Adding ${fmt(extraPayment)} a month saves ${monthsSaved} months${
            interestSaved > 0 ? ` and ${fmt(interestSaved)} in interest` : ''
          }.`
        : '');

    return (
      <View
        style={[glassEffects.glassFloating, styles.headlineCard]}
        accessibilityRole="summary"
        accessibilityLabel={a11y}
      >
        <View style={styles.headlineWash} />
        <View style={styles.eyebrowRow}>
          <Ionicons name="flag" size={16} color={colors.primary2} />
          <Text style={styles.eyebrow}>DEBT-FREE BY</Text>
        </View>

        <Animated.Text style={[styles.heroDate, { opacity: heroOpacity }]}>
          {heroLabel}
        </Animated.Text>
        <Text style={styles.heroSub}>{heroSub}</Text>

        {/* 3 metric cells split by vertical rules */}
        <View style={styles.metricRow}>
          <View style={styles.metricCell}>
            <View style={styles.metricValueRow}>
              <Ionicons name="time-outline" size={14} color={colors.primary2} />
              <Text style={styles.metricValue}>
                {neverPayable ? '50+ yr' : `${result.totalMonths} mo`}
              </Text>
            </View>
            <Text style={styles.metricLabel}>Time to pay</Text>
          </View>
          <View style={styles.metricRule} />
          <View style={styles.metricCell}>
            <View style={styles.metricValueRow}>
              <Ionicons name="trending-up-outline" size={14} color={colors.error} />
              <Text style={styles.metricValue}>{fmt(result.totalInterest)}</Text>
            </View>
            <Text style={styles.metricLabel}>Interest</Text>
          </View>
          <View style={styles.metricRule} />
          <View style={styles.metricCell}>
            <View style={styles.metricValueRow}>
              <Ionicons name="wallet-outline" size={14} color={colors.text} />
              <Text style={styles.metricValue}>{fmt(totalCost)}</Text>
            </View>
            <Text style={styles.metricLabel}>Total cost</Text>
          </View>
        </View>

        {/* Savings callout / never-payable nudge */}
        {neverPayable ? (
          <View style={[styles.calloutBase, styles.nudgeCallout]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.nudgeText}>
              Minimum payments barely cover interest — try adding an extra payment.
            </Text>
          </View>
        ) : showSavings ? (
          <View style={[styles.calloutBase, styles.savingsCallout]}>
            <Ionicons name="play" size={12} color={colors.success} />
            <Text style={styles.savingsText}>
              +{fmt(extraPayment)}/mo saves you {monthsSaved} mo
              {interestSaved > 0 ? ` · ${fmt(interestSaved)} interest` : ''}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ── TIER 2 — Levers ──
  const renderLevers = () => (
    <View style={[glassEffects.glass, styles.tierCard]}>
      {/* Strategy */}
      <Text style={styles.leverLabel}>Strategy</Text>
      <View style={styles.segmentRow} accessibilityRole="radiogroup">
        {STRATEGIES.map((s) => {
          const active = strategy === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setStrategy(s.key)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.label}, ${s.desc} first`}
            >
              <View style={styles.segmentLabelRow}>
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                  {s.label}
                </Text>
                {active && <Ionicons name="checkmark" size={13} color={colors.text} />}
              </View>
              <Text style={[styles.segmentDesc, active && styles.segmentDescActive]}>
                {s.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={commonStyles.divider} />

      {/* Extra monthly payment */}
      <Text style={styles.leverLabel}>Extra monthly payment</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amountAffix}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={extraPayment > 0 ? String(extraPayment) : ''}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          accessibilityLabel="Extra monthly payment amount"
          onChangeText={(text) => {
            const num = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
            setExtraPayment(Math.max(0, num));
          }}
        />
      </View>
      <View style={styles.presetRow}>
        {EXTRA_PRESETS.map((val) => {
          const selected = extraPayment === val;
          return (
            <TouchableOpacity
              key={val}
              style={[styles.presetChip, selected && styles.presetChipActive]}
              onPress={() => setExtraPayment(val)}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Extra payment $${val}${selected ? ', selected' : ''}`}
            >
              {selected && (
                <Ionicons name="checkmark" size={12} color={colors.text} style={{ marginRight: spacing.xs }} />
              )}
              <Text style={[styles.presetText, selected && styles.presetTextActive]}>${val}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={commonStyles.divider} />

      {/* Debts included */}
      <View style={styles.debtsHeaderRow}>
        <Text style={styles.leverLabel}>Debts included</Text>
        <View style={styles.debtsHeaderRight}>
          <Text style={styles.debtsCount}>
            {selectedIds.size} of {debts.length}
          </Text>
          <TouchableOpacity
            onPress={toggleAll}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={allSelected ? 'Deselect all debts' : 'Select all debts'}
          >
            <Text style={styles.selectAllText}>{allSelected ? 'None' : 'All'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        {debts.map((d) => {
          const selected = selectedIds.has(d.id);
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.debtRow, selected && styles.debtRowActive]}
              onPress={() => toggleDebt(d.id)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${d.name}, ${fmt(d.balance)}, ${d.apr} percent APR${selected ? ', included' : ''}`}
              accessibilityHint="Double tap to include or exclude from payoff."
            >
              <Ionicons
                name={selected ? 'checkbox' : 'checkbox-outline'}
                size={20}
                color={selected ? colors.primary2 : colors.textDark}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.debtName, !selected && styles.debtNameMuted]}
                  numberOfLines={1}
                >
                  {d.name}
                </Text>
                <Text style={styles.debtMeta} numberOfLines={1}>
                  {fmt(d.balance)} · {d.apr}% APR
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {noSelection && (
        <View style={styles.inlineWarnRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
          <Text style={styles.inlineWarnText}>Select at least one debt to calculate.</Text>
        </View>
      )}
    </View>
  );

  // ── TIER 3 — Breakdown ──
  const renderBreakdown = () => {
    if (noSelection) {
      return (
        <View style={[glassEffects.glass, styles.tierCard]}>
          <View style={styles.promptRow}>
            <Ionicons name="funnel-outline" size={18} color={colors.textMuted} />
            <Text style={styles.promptText}>Pick at least one debt above to see your breakdown.</Text>
          </View>
        </View>
      );
    }
    return (
      <>
        <View style={[glassEffects.glass, styles.tierCard]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total debt</Text>
            <Text style={styles.summaryValue}>{fmt(totalBalance)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Interest you'll pay</Text>
            <View style={styles.summaryValueRow}>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                +{fmt(result.totalInterest)}
              </Text>
              <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            </View>
          </View>
          <View style={commonStyles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total cost</Text>
            <Text style={styles.summaryTotalValue}>{fmt(totalCost)}</Text>
          </View>
        </View>

        <GroupLabel>PAYOFF ORDER</GroupLabel>
        <View style={{ gap: spacing.sm }}>
          {result.perDebt.map((d, i) => {
            const first = i === 0;
            return (
              <View
                key={d.id}
                style={[glassEffects.glass, styles.payoffRow, first && styles.payoffRowFirst]}
                accessibilityLabel={`Number ${i + 1}, ${d.name}, paid off in ${d.months} months, ${fmt(d.interest)} interest.`}
              >
                <View style={styles.rankChip}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoffName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.payoffMeta} numberOfLines={1}>
                    {d.months} mo · {fmt(d.interest)} interest
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  // ── Error state (distinct from empty) ──
  const renderError = () => (
    <View style={[glassEffects.glass, styles.centeredCard]}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.error} />
      <Text style={styles.centeredTitle}>Couldn't load your debts.</Text>
      <TouchableOpacity
        onPress={loadDebts}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Retry loading debts"
      >
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Empty — no debts at all (celebratory) ──
  const renderDebtFree = () => (
    <View style={[glassEffects.glass, styles.centeredCard]}>
      <Ionicons name="checkmark-circle" size={48} color={colors.success} />
      <Text style={styles.debtFreeTitle}>You're debt-free!</Text>
      <Text style={styles.debtFreeSub}>
        No outstanding debts to pay off. Add a debt to run a payoff scenario.
      </Text>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/goals')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Add a debt"
      >
        <Text style={styles.retryText}>Add a debt</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {Header}

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            renderError()
          ) : debts.length === 0 ? (
            renderDebtFree()
          ) : (
            <>
              {renderHeadline()}
              <GroupLabel>YOUR LEVERS</GroupLabel>
              {renderLevers()}
              <GroupLabel>THE BREAKDOWN</GroupLabel>
              {renderBreakdown()}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl * 2,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    ...typography.h3, fontWeight: '800',
    color: colors.text,
  },

  // Group labels ("YOUR LEVERS", etc.)
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },

  // ── TIER 1 — Headline ──
  headlineCard: {
    padding: spacing.xl,
  },
  headlineWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: `${colors.primary}14`,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  heroDate: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.md,
  },
  heroSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  promptText: {
    ...typography.small,
    color: colors.textMuted,
    flex: 1,
  },

  metricRow: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    alignItems: 'stretch',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  metricRule: {
    width: 1,
    backgroundColor: colors.borderGlass,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },

  calloutBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  savingsCallout: {
    backgroundColor: `${colors.success}14`,
  },
  savingsText: {
    ...typography.smallBold,
    color: colors.success,
    flex: 1,
  },
  nudgeCallout: {
    backgroundColor: `${colors.warning}14`,
  },
  nudgeText: {
    ...typography.small,
    color: colors.warning,
    flex: 1,
  },

  // ── Shared tier card ──
  tierCard: {
    padding: spacing.lg,
  },

  leverLabel: {
    ...typography.smallBold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Strategy segments
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: 'center',
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary2,
  },
  segmentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  segmentLabel: {
    ...typography.smallBold,
    color: colors.textMuted,
  },
  segmentLabelActive: {
    color: colors.text,
  },
  segmentDesc: {
    ...typography.caption,
    color: colors.textDark,
    marginTop: 2,
  },
  segmentDescActive: {
    color: colors.text,
    opacity: 0.85,
  },

  // Extra payment
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  amountAffix: {
    ...typography.h3,
    color: colors.textMuted,
  },
  amountInput: {
    ...typography.h2,
    color: colors.primary2,
    textAlign: 'center',
    minWidth: 100,
    paddingVertical: spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary2,
  },
  presetText: {
    ...typography.smallBold,
    color: colors.textMuted,
  },
  presetTextActive: {
    color: colors.text,
  },

  // Debts included
  debtsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  debtsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  debtsCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  selectAllText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: 'transparent',
  },
  debtRowActive: {
    backgroundColor: `${colors.primary}0f`,
  },
  debtName: {
    ...typography.smallBold,
    color: colors.text,
  },
  debtNameMuted: {
    color: colors.textMuted,
  },
  debtMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
    flexShrink: 0,
  },
  inlineWarnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inlineWarnText: {
    ...typography.caption,
    color: colors.warning,
  },

  // ── TIER 3 — Breakdown ──
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.smallBold,
    color: colors.text,
  },
  summaryTotalLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  summaryTotalValue: {
    ...typography.bodyBold,
    color: colors.text,
  },

  payoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    padding: spacing.md,
  },
  payoffRowFirst: {
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.success,
  },
  rankChip: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}2e`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
  payoffName: {
    ...typography.smallBold,
    color: colors.text,
  },
  payoffMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
    flexShrink: 0,
  },

  // ── Centered cards (error / debt-free) ──
  centeredCard: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  centeredTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
    marginTop: spacing.xs,
  },
  debtFreeTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  debtFreeSub: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
