import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { SavingsProgressBar } from '@/components/savings-ProgressBar';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

type SavingsGoal = {
  id: string;
  user_id: string;
  household_id?: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  priority: number;
  is_shared: boolean;
};

type GoalStatus = 'funded' | 'on_track' | 'behind';

type StatusMeta = {
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  word: string;
};

const STATUS_META: Record<GoalStatus, StatusMeta> = {
  funded: { color: colors.success, icon: 'checkmark-circle', word: 'FUNDED' },
  on_track: { color: colors.info, icon: 'trending-up', word: 'ON TRACK' },
  behind: { color: colors.warning, icon: 'alert-circle', word: 'BEHIND' },
};

/** 12% opacity tint for status chip / update-button backgrounds. */
const tint = (hex: string) => `${hex}1f`;

const daysBetween = (from: Date, toStr: string): number => {
  const to = new Date(toStr);
  if (isNaN(to.getTime())) return Infinity;
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

/**
 * Derive a scannable status per goal (spec §9). Conservative — when in doubt,
 * "On track". "Behind" only fires when a real deadline is genuinely at risk.
 */
const getGoalStatus = (g: SavingsGoal): GoalStatus => {
  const target = g.target_amount || 0;
  const current = g.current_amount || 0;
  if (target > 0 && current >= target) return 'funded';
  if (!g.target_date) return 'on_track';

  const today = new Date();
  const daysLeft = daysBetween(today, g.target_date);
  const remaining = target - current;
  if (remaining <= 0) return 'funded';

  // Past-due with money still owed → behind.
  if (daysLeft <= 0) return 'behind';

  const pct = target > 0 ? (current / target) * 100 : 0;
  // Conservative near-deadline heuristic: a close date with low progress.
  if (daysLeft < 30 && pct < 60) return 'behind';

  return 'on_track';
};

export default function SavingsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progressAmount, setProgressAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('');

  const loadGoals = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) {
        setLoading(false);
        setLoadedOnce(true);
        return;
      }
      const data = await api.get<SavingsGoal[]>('/auth/savings-goals', { user_id: userId });
      setGoals(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error('Failed to load savings goals:', e);
      setError('Failed to load savings goals');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const resetForm = () => {
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    setTargetDate('');
    setPriority('');
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditing(g);
    setName(g.name);
    setTargetAmount(String(g.target_amount));
    setCurrentAmount(String(g.current_amount));
    setTargetDate(g.target_date || '');
    setPriority(g.priority ? String(g.priority) : '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!targetAmount || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
      Alert.alert('Validation', 'Enter a valid target amount.');
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }

    const payload = {
      user_id: userId,
      name: name.trim(),
      target_amount: parseFloat(targetAmount),
      current_amount: parseFloat(currentAmount) || 0,
      target_date: targetDate.trim(),
      priority: parseInt(priority) || 0,
      is_shared: false,
    };

    try {
      if (editing) {
        await api.put(`/auth/savings-goals/${editing.id}`, payload);
      } else {
        await api.post('/auth/savings-goals', payload);
      }
      setShowForm(false);
      resetForm();
      loadGoals();
    } catch (e) {
      console.error('Save savings goal error:', e);
      Alert.alert('Error', 'Failed to save savings goal.');
    }
  };

  const handleUpdateProgress = async () => {
    if (!progressAmount || isNaN(Number(progressAmount))) {
      Alert.alert('Validation', 'Enter a valid amount.');
      return;
    }
    const id = progressId;
    const newAmount = parseFloat(progressAmount);

    // Optimistic bump — the bar (and possibly the status) reacts before refetch.
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, current_amount: newAmount } : g)),
    );

    try {
      await api.patch(`/auth/savings-goals/${id}/progress`, {
        current_amount: newAmount,
      });
      setProgressId(null);
      setProgressAmount('');
      loadGoals();
    } catch (e) {
      console.error('Update progress error:', e);
      Alert.alert('Error', 'Failed to update progress.');
      loadGoals(); // reconcile on failure
    }
  };

  const totalCurrent = goals.reduce((s, g) => s + (g.current_amount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.target_amount || 0), 0);
  const overallPercent = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const fmtWhole = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const getPercent = (g: SavingsGoal) =>
    g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0;

  const fundedCount = goals.filter((g) => g.target_amount > 0 && g.current_amount >= g.target_amount).length;
  const behindCount = goals.filter((g) => getGoalStatus(g) === 'behind').length;

  const showSkeleton = loading && !loadedOnce;
  const isEmpty = !error && !showSkeleton && goals.length === 0;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <BackButton fallback="/(tabs)/goals" color={colors.text} />
            <Text style={styles.headerTitle}>Savings Goals</Text>
            <View style={styles.headerRight}>
              {loading && loadedOnce && (
                <ActivityIndicator color={colors.primary2} size="small" />
              )}
              <TouchableOpacity
                onPress={openAdd}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Add savings goal"
              >
                <Ionicons name="add-circle" size={28} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Hero: Overall Progress (the only floating card) ── */}
          <View
            style={styles.hero}
            accessible
            accessibilityLabel={`Overall progress, ${fmt(totalCurrent)} saved of ${fmt(
              totalTarget,
            )}, ${overallPercent.toFixed(0)} percent. ${goals.length} goals, ${fundedCount} funded, ${behindCount} behind.`}
          >
            <Text style={styles.heroLabel}>OVERALL PROGRESS</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{fmt(totalCurrent)}</Text>
              <Text style={styles.heroValueSub}> saved of {fmt(totalTarget)} target</Text>
            </View>

            <View style={styles.heroBarRow}>
              <View style={{ flex: 1 }}>
                <SavingsProgressBar percent={overallPercent} color={colors.primary} />
              </View>
              <Text style={styles.heroPercent}>{overallPercent.toFixed(0)}%</Text>
            </View>

            {/* Summary chips: icon + count + word (color-independent). */}
            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Ionicons name="ellipse" size={10} color={colors.textMuted} />
                <Text style={styles.heroChipText}>
                  {goals.length} goal{goals.length === 1 ? '' : 's'}
                </Text>
              </View>
              {fundedCount > 0 && (
                <>
                  <Text style={styles.heroChipDot}>·</Text>
                  <View style={styles.heroChip}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                    <Text style={[styles.heroChipText, { color: colors.success }]}>
                      {fundedCount} funded
                    </Text>
                  </View>
                </>
              )}
              {behindCount > 0 && (
                <>
                  <Text style={styles.heroChipDot}>·</Text>
                  <View style={styles.heroChip}>
                    <Ionicons name="alert-circle" size={12} color={colors.warning} />
                    <Text style={[styles.heroChipText, { color: colors.warning }]}>
                      {behindCount} behind
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Error (inline, under hero) ── */}
          {error && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                setLoadedOnce(false);
                loadGoals();
              }}
            />
          )}

          {/* ── Loading skeleton ── */}
          {!error && showSkeleton && (
            <View style={{ marginTop: spacing.xl }}>
              <Skeleton width={80} height={12} style={{ marginBottom: spacing.sm }} />
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.goalRow}>
                  <View style={styles.goalTopRow}>
                    <Skeleton width="55%" height={14} />
                    <View style={styles.skelTopRight}>
                      <Skeleton width={72} height={20} borderRadius={radius.full} />
                      <Skeleton width={64} height={16} />
                    </View>
                  </View>
                  <View style={{ marginTop: spacing.md }}>
                    <Skeleton width="100%" height={8} borderRadius={radius.full} />
                  </View>
                  <View style={styles.goalBottomRow}>
                    <Skeleton width="45%" height={10} />
                    <Skeleton width={84} height={28} borderRadius={radius.md} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Empty ── */}
          {isEmpty && (
            <EmptyState
              icon="sparkles-outline"
              title="No savings goals"
              description="Create your first savings goal to start building wealth"
              actionLabel="Create Goal"
              onAction={openAdd}
            />
          )}

          {/* ── Goals list ── */}
          {!error && !showSkeleton && goals.length > 0 && (
            <>
              <Text style={styles.groupLabel}>YOUR GOALS</Text>
              {goals.map((g) => {
                const pct = getPercent(g);
                const status = getGoalStatus(g);
                const meta = STATUS_META[status];
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.goalRow}
                    onPress={() => openEdit(g)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${g.name}, ${meta.word.toLowerCase()}, ${fmt(
                      g.current_amount,
                    )} saved of ${fmt(g.target_amount)}, ${pct.toFixed(0)} percent${
                      g.target_date ? `, due ${g.target_date}` : ''
                    }.`}
                  >
                    {/* Row 1 — name / status chip / amount */}
                    <View style={styles.goalTopRow}>
                      <Text style={styles.goalName} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <View style={styles.goalTopRight}>
                        <View style={[styles.statusChip, { backgroundColor: tint(meta.color) }]}>
                          <Ionicons name={meta.icon} size={12} color={meta.color} />
                          <Text style={[styles.statusChipText, { color: meta.color }]}>
                            {meta.word}
                          </Text>
                        </View>
                        <Text style={styles.goalAmount}>{fmtWhole(g.current_amount)}</Text>
                      </View>
                    </View>

                    {/* Row 2 — progress bar + pct */}
                    <View style={styles.goalBarRow}>
                      <View style={{ flex: 1 }}>
                        <SavingsProgressBar percent={pct} color={meta.color} />
                      </View>
                      <Text style={styles.goalPercent}>{pct.toFixed(0)}%</Text>
                    </View>

                    {/* Row 3 — sub-line + update action */}
                    <View style={styles.goalBottomRow}>
                      <Text style={styles.goalSub} numberOfLines={1}>
                        of {fmtWhole(g.target_amount)}
                        {g.target_date ? ` · by ${g.target_date}` : ''}
                      </Text>
                      <TouchableOpacity
                        style={styles.updateBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setProgressId(g.id);
                          setProgressAmount(String(g.current_amount));
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Update ${g.name} progress.`}
                      >
                        <Ionicons name="trending-up" size={14} color={colors.success} />
                        <Text style={styles.updateBtnText}>Update</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* ── Add / Edit Goal sheet ── */}
        <Modal visible={showForm} animationType="slide" transparent>
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.sheet}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {editing ? 'Edit Goal' : 'New Savings Goal'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Emergency Fund"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.fieldLabel}>Target Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                />

                <Text style={styles.fieldLabel}>Current Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={currentAmount}
                  onChangeText={setCurrentAmount}
                />

                <Text style={styles.fieldLabel}>Target Date (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2026-12-31"
                  placeholderTextColor={colors.textMuted}
                  value={targetDate}
                  onChangeText={setTargetDate}
                />

                <Text style={styles.fieldLabel}>Priority (1 = highest)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={priority}
                  onChangeText={setPriority}
                />

                <TouchableOpacity onPress={handleSave} style={styles.ctaBtn} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaInner}
                  >
                    <Text style={styles.ctaText}>{editing ? 'Update' : 'Create Goal'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ── Update Progress sheet ── */}
        <Modal visible={progressId !== null} animationType="fade" transparent>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setProgressId(null)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <TouchableOpacity activeOpacity={1} style={styles.sheet}>
                <Text style={styles.sheetTitle}>Update Savings</Text>
                <Text style={styles.sheetBody}>Enter the new total saved amount</Text>
                <TextInput
                  style={[styles.input, { marginTop: spacing.md }]}
                  placeholder="Current amount saved"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={progressAmount}
                  onChangeText={setProgressAmount}
                  autoFocus
                />
                <TouchableOpacity onPress={handleUpdateProgress} style={styles.ctaBtn} activeOpacity={0.85}>
                  <LinearGradient
                    colors={[...gradients.successGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaInner}
                  >
                    <Text style={styles.ctaText}>Save Progress</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    marginLeft: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  // Hero
  hero: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  heroValue: {
    ...typography.h1,
    color: colors.text,
  },
  heroValueSub: {
    ...typography.small,
    color: colors.textMuted,
  },
  heroBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  heroPercent: {
    ...typography.smallBold,
    color: colors.primary,
    flexShrink: 0,
  },
  heroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  heroChipDot: {
    ...typography.caption,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },

  // Group label
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },

  // Goal row
  goalRow: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalName: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 1,
  },
  goalTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  skelTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusChipText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  goalAmount: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 0,
  },
  goalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  goalPercent: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
  },
  goalBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  goalSub: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: `${colors.success}1f`,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  updateBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.success,
  },

  // Modals / sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
  },
  sheetBody: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  fieldLabel: {
    ...typography.smallBold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  ctaBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
  },
});
