import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { api } from '../utils/apiClient';
import { fetchAccountBalances } from '../utils/api';
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
} from '@/utils/design-system';
import {
  FormSheet,
  FormField,
  FormInput,
  AmountInput,
  FormDateField,
  FormPickerRow,
  FormButton,
} from '@/components/form';
import { successHaptic, errorHaptic } from '@/utils/haptics';

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
  /** When set, this goal's progress mirrors the linked bank account balance. */
  linked_balance_id?: string | null;
  linked_account_name?: string;
  /** $/month flowing to this goal from the couple's active plans (source of truth for monthly contribution). */
  effective_monthly?: number;
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

/** Monthly $/mo from active plans, guarded against missing/older cached data. */
const effectiveMonthly = (g: SavingsGoal): number => {
  const v = g.effective_monthly;
  return typeof v === 'number' && v > 0 ? v : 0;
};

/**
 * Months to goal from the plan-funded monthly contribution (source of truth).
 * Returns null when there's no funding or the goal is already met.
 */
const monthsToGoal = (g: SavingsGoal): number | null => {
  const monthly = effectiveMonthly(g);
  if (monthly <= 0) return null;
  const remaining = (g.target_amount || 0) - (g.current_amount || 0);
  if (remaining <= 0) return null;
  return Math.ceil(remaining / monthly);
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
  const [dateOpen, setDateOpen] = useState(false);
  const [priority, setPriority] = useState('');
  const [linkedBalanceId, setLinkedBalanceId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Inline validation state
  const [nameTouched, setNameTouched] = useState(false);
  const [targetTouched, setTargetTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progressTouched, setProgressTouched] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  // Synced accounts for the "fund account" picker — loaded once, lazily.
  const accountsLoaded = useRef(false);
  const ensureAccounts = useCallback(async () => {
    if (accountsLoaded.current) return;
    accountsLoaded.current = true;
    try {
      const accts = await fetchAccountBalances();
      setBankAccounts(accts);
    } catch (e) {
      console.log('Account list load failed (link picker hidden):', e);
    }
  }, []);

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
    setDateOpen(false);
    setPriority('');
    setLinkedBalanceId(null);
    setEditing(null);
    setNameTouched(false);
    setTargetTouched(false);
    setSaveError(null);
  };

  const openAdd = () => {
    resetForm();
    ensureAccounts();
    setShowForm(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditing(g);
    setName(g.name);
    setTargetAmount(String(g.target_amount));
    setCurrentAmount(String(g.current_amount));
    setTargetDate(g.target_date || '');
    setPriority(g.priority ? String(g.priority) : '');
    setLinkedBalanceId(g.linked_balance_id || null);
    ensureAccounts();
    setShowForm(true);
  };

  // Derived validity — the save CTA gates on this.
  const parsedTarget = Number(targetAmount);
  const goalNameValid = name.trim().length > 0;
  const targetValid = !!targetAmount && Number.isFinite(parsedTarget) && parsedTarget > 0;
  const isGoalFormValid = goalNameValid && targetValid;

  const handleSave = async () => {
    if (!isGoalFormValid || saving) {
      setNameTouched(true);
      setTargetTouched(true);
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      setSaveError('No user session found.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      user_id: userId,
      name: name.trim(),
      target_amount: parsedTarget,
      current_amount: parseFloat(currentAmount) || 0,
      target_date: targetDate.trim(),
      priority: parseInt(priority) || 0,
      is_shared: false,
      // null clears the link; the backend snaps current_amount to the account
      // balance whenever a link is set.
      linked_balance_id: linkedBalanceId,
    };

    try {
      if (editing) {
        await api.put(`/auth/savings-goals/${editing.id}`, payload);
      } else {
        await api.post('/auth/savings-goals', payload);
      }
      successHaptic();
      setShowForm(false);
      resetForm();
      loadGoals();
    } catch (e: any) {
      console.error('Save savings goal error:', e);
      errorHaptic();
      setSaveError(
        e?.status === 409
          ? 'That account is already linked to another goal.'
          : 'Failed to save savings goal. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const parsedProgress = Number(progressAmount);
  const progressValid = !!progressAmount && Number.isFinite(parsedProgress);

  const handleUpdateProgress = async () => {
    if (!progressValid || progressSaving) {
      setProgressTouched(true);
      return;
    }
    const id = progressId;

    setProgressSaving(true);
    setProgressError(null);

    // Optimistic bump — the bar (and possibly the status) reacts before refetch.
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, current_amount: parsedProgress } : g)),
    );

    try {
      await api.patch(`/auth/savings-goals/${id}/progress`, {
        current_amount: parsedProgress,
      });
      successHaptic();
      setProgressId(null);
      setProgressAmount('');
      setProgressTouched(false);
      loadGoals();
    } catch (e) {
      console.error('Update progress error:', e);
      errorHaptic();
      setProgressError('Failed to update progress. Try again.');
      loadGoals(); // reconcile on failure
    } finally {
      setProgressSaving(false);
    }
  };

  // Local-timezone YYYY-MM-DD (toISOString would shift the day near midnight).
  const toISODate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const parsedTargetDate = targetDate ? new Date(`${targetDate.slice(0, 10)}T00:00:00`) : null;
  const targetDateValue =
    parsedTargetDate && !isNaN(parsedTargetDate.getTime()) ? parsedTargetDate : new Date();

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
                const monthly = effectiveMonthly(g);
                const months = monthsToGoal(g);
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
                    }${
                      monthly > 0
                        ? `, ${fmtWhole(monthly)} per month from plans${
                            months !== null ? `, about ${months} months to goal` : ''
                          }`
                        : ', not funded by a plan yet'
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

                    {/* Row 2b — plan funding (source of truth for monthly contribution) */}
                    <View style={styles.goalFundingRow}>
                      {monthly > 0 ? (
                        <>
                          <Ionicons name="repeat" size={12} color={colors.primary} />
                          <Text style={[styles.goalFunding, { color: colors.primary }]}>
                            {fmtWhole(monthly)}/mo from plans
                            {months !== null
                              ? ` · ~${months} mo${months === 1 ? '' : 's'} to goal`
                              : ''}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.goalFunding}>Not funded by a plan yet</Text>
                      )}
                    </View>

                    {/* Row 3 — sub-line + update action (linked goals track the
                        account balance automatically, so no manual update) */}
                    <View style={styles.goalBottomRow}>
                      <Text style={styles.goalSub} numberOfLines={1}>
                        of {fmtWhole(g.target_amount)}
                        {g.target_date ? ` · by ${g.target_date}` : ''}
                      </Text>
                      {g.linked_balance_id ? (
                        <View style={styles.linkedBadge}>
                          <Ionicons name="link" size={12} color={colors.primary2} />
                          <Text style={styles.linkedBadgeText} numberOfLines={1}>
                            {g.linked_account_name || 'Linked account'}
                          </Text>
                        </View>
                      ) : (
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
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* ── Add / Edit Goal sheet ── */}
        <FormSheet
          visible={showForm}
          title={editing ? 'Edit Goal' : 'New Savings Goal'}
          onClose={() => {
            setShowForm(false);
            resetForm();
          }}
          footer={
            <>
              {saveError ? (
                <View style={styles.formErrorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.formErrorText}>{saveError}</Text>
                </View>
              ) : null}
              <FormButton
                label={editing ? 'Update Goal' : 'Create Goal'}
                onPress={handleSave}
                disabled={!isGoalFormValid}
                loading={saving}
              />
            </>
          }
        >
          <FormField label="Name" error={nameTouched && !goalNameValid ? 'Name your goal' : null}>
            <FormInput
              icon="text-outline"
              placeholder="e.g. Emergency Fund"
              value={name}
              onChangeText={setName}
              onBlur={() => setNameTouched(true)}
              error={nameTouched && !goalNameValid}
            />
          </FormField>

          <FormField
            label="Target Amount"
            error={targetTouched && !targetValid ? 'Enter a valid target amount' : null}
          >
            <AmountInput
              compact
              value={targetAmount}
              onChangeText={setTargetAmount}
              onBlur={() => setTargetTouched(true)}
              error={targetTouched && !targetValid ? 'Enter a valid target amount' : null}
              accessibilityLabel="Target amount"
            />
          </FormField>

          {linkedBalanceId == null && (
            <FormField label="Current Amount" optional>
              <AmountInput
                compact
                value={currentAmount}
                onChangeText={setCurrentAmount}
                accessibilityLabel="Current amount"
              />
            </FormField>
          )}

          {bankAccounts.length > 0 && (
            <FormField label="Fund Account" optional>
              <Text style={styles.fieldHint}>
                Link a real account (e.g. your HYSA) and this goal's progress will mirror its
                balance automatically — no manual updates.
              </Text>
              <TouchableOpacity
                style={[styles.accountOption, linkedBalanceId == null && styles.accountOptionActive]}
                onPress={() => setLinkedBalanceId(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: linkedBalanceId == null }}
              >
                <Ionicons
                  name={linkedBalanceId == null ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={linkedBalanceId == null ? colors.primary2 : colors.textMuted}
                />
                <Text style={styles.accountOptionText}>Track manually</Text>
              </TouchableOpacity>
              {bankAccounts.map((a) => {
                const selected = linkedBalanceId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.accountOption, selected && styles.accountOptionActive]}
                    onPress={() => setLinkedBalanceId(a.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={selected ? colors.primary2 : colors.textMuted}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.accountOptionText} numberOfLines={1}>
                        {a.name || 'Account'}
                        {a.institution_name ? ` · ${a.institution_name}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.accountOptionBalance}>
                      {fmtWhole(a.current_balance || 0)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </FormField>
          )}

          <FormField label="Target Date" optional>
            {targetDate ? (
              <>
                <FormDateField
                  value={targetDateValue}
                  onChange={(d) => setTargetDate(toISODate(d))}
                  open={dateOpen}
                  onToggle={() => setDateOpen((o) => !o)}
                  accessibilityLabel="Target date"
                />
                <TouchableOpacity
                  onPress={() => {
                    setTargetDate('');
                    setDateOpen(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear target date"
                >
                  <Text style={styles.clearDateText}>Clear target date</Text>
                </TouchableOpacity>
              </>
            ) : (
              <FormPickerRow
                icon="calendar-outline"
                value={null}
                placeholder="No target date — tap to set"
                onPress={() => {
                  setTargetDate(toISODate(new Date()));
                  setDateOpen(true);
                }}
                accessibilityLabel="Set a target date"
              />
            )}
          </FormField>

          <FormField label="Priority (1 = highest)" optional>
            <FormInput
              icon="flag-outline"
              placeholder="1"
              keyboardType="number-pad"
              value={priority}
              onChangeText={setPriority}
            />
          </FormField>
        </FormSheet>

        {/* ── Update Progress sheet ── */}
        <FormSheet
          visible={progressId !== null}
          title="Update Savings"
          onClose={() => {
            setProgressId(null);
            setProgressAmount('');
            setProgressTouched(false);
            setProgressError(null);
          }}
          maxHeightPct={0.5}
          footer={
            <>
              {progressError ? (
                <View style={styles.formErrorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.formErrorText}>{progressError}</Text>
                </View>
              ) : null}
              <FormButton
                label="Save Progress"
                onPress={handleUpdateProgress}
                disabled={!progressValid}
                loading={progressSaving}
              />
            </>
          }
        >
          <Text style={styles.sheetBody}>Enter the new total saved amount</Text>
          <FormField
            label="Current Amount Saved"
            error={progressTouched && !progressValid ? 'Enter a valid amount' : null}
          >
            <AmountInput
              compact
              value={progressAmount}
              onChangeText={setProgressAmount}
              onBlur={() => setProgressTouched(true)}
              error={progressTouched && !progressValid ? 'Enter a valid amount' : null}
              accessibilityLabel="Current amount saved"
              autoFocus
            />
          </FormField>
        </FormSheet>
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
  goalFundingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  goalFunding: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
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
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary2}1f`,
  },
  linkedBadgeText: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '600',
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.xs,
  },
  accountOptionActive: {
    borderColor: colors.primary2,
    backgroundColor: `${colors.primary}1a`,
  },
  accountOptionText: {
    ...typography.small,
    color: colors.text,
  },
  accountOptionBalance: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // Form sheet extras
  formErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  formErrorText: {
    flex: 1,
    ...typography.caption,
    color: colors.error,
  },
  clearDateText: {
    ...typography.caption,
    color: colors.primary2,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  sheetBody: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
