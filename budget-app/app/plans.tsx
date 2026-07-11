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
import { colors, spacing, radius, typography, glassEffects, gradients } from '@/utils/design-system';

// ─── Types ──────────────────────────────────────────────────────

type PlanType = 'debt_payoff' | 'savings' | 'combined';
type PlanStatus = 'draft' | 'active' | 'paused' | 'completed';

type Plan = {
  id: string;
  name: string;
  plan_type: PlanType;
  status: PlanStatus;
  monthly_contribution: number;
  start_date: string;
  projected_end_date: string;
  created_at: string;
};

type Milestone = {
  id: string;
  plan_id: string;
  title: string;
  target_amount?: number;
  target_date?: string;
  status: 'pending' | 'reached' | 'skipped';
  completed_at?: string;
};

type Allocation = {
  id: string;
  plan_id: string;
  target_type: string;
  target_id?: string;
  monthly_amount: number;
  target_name?: string;
};

type Approval = {
  id: string;
  plan_id: string;
  user_id: string;
  user_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  responded_at?: string;
};

type PlanDetail = Plan & {
  ai_analysis?: any;
  scenarios?: any;
  milestones: Milestone[];
  allocations: Allocation[];
  approvals?: Approval[];
};

// ─── Semantic tint recipe (documented 12%/8% status backgrounds) ─
// These rgba tints are the ONE allowed literal in this file per spec §2 —
// the "semantic color at 12%/8%" recipe shared with the sibling screens.
const tint = {
  success: 'rgba(34,197,94,0.12)',
  error: 'rgba(239,68,68,0.12)',
  primary2: 'rgba(168,85,247,0.12)',
  warning: 'rgba(234,179,8,0.12)',
  info: 'rgba(59,130,246,0.12)',
  muted: 'rgba(148,163,184,0.12)',
  feedback: 'rgba(239,68,68,0.08)',
} as const;

// Single source of truth for type visuals (replaces PLAN_TYPE_CONFIG).
const TYPE_VISUAL: Record<
  PlanType,
  { label: string; color: string; tint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  savings: { label: 'Savings', color: colors.success, tint: tint.success, icon: 'trending-up' },
  debt_payoff: { label: 'Debt Payoff', color: colors.error, tint: tint.error, icon: 'card-outline' },
  combined: { label: 'Combined', color: colors.primary2, tint: tint.primary2, icon: 'git-merge-outline' },
};

// Single source of truth for status visuals (replaces STATUS_CONFIG + inline).
const STATUS_VISUAL: Record<
  PlanStatus,
  { word: string; color: string; tint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  active: { word: 'Active', color: colors.success, tint: tint.success, icon: 'checkmark-circle' },
  draft: { word: 'Draft', color: colors.textMuted, tint: tint.muted, icon: 'time-outline' },
  paused: { word: 'Paused', color: colors.warning, tint: tint.warning, icon: 'pause-circle' },
  completed: { word: 'Completed', color: colors.info, tint: tint.info, icon: 'ribbon-outline' },
};

// Single source of truth for milestone visuals (replaces MILESTONE_ICONS + inline).
const MILESTONE_VISUAL: Record<
  Milestone['status'],
  { word: string; color: string; tint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  reached: { word: 'Reached', color: colors.success, tint: tint.success, icon: 'checkmark-circle' },
  pending: { word: 'Pending', color: colors.textMuted, tint: tint.muted, icon: 'ellipse-outline' },
  skipped: { word: 'Skipped', color: colors.error, tint: tint.error, icon: 'close-circle' },
};

// Single source of truth for approval visuals (replaces inline ternaries).
const APPROVAL_VISUAL: Record<
  Approval['status'],
  { word: string; color: string; tint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  approved: { word: 'Approved', color: colors.success, tint: tint.success, icon: 'checkmark-circle' },
  rejected: { word: 'Rejected', color: colors.error, tint: tint.error, icon: 'close-circle' },
  pending: { word: 'Awaiting review', color: colors.textMuted, tint: tint.muted, icon: 'time-outline' },
};

// ─── Helpers ────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const formatDate = (dateStr: string | undefined | null) => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const capitalize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const isDraft = (p: { status: PlanStatus }) => p.status === 'draft';

// ─── Small presentational primitives (in-file) ──────────────────

function GroupLabel({
  children,
  right,
  icon,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.groupLabelRow}>
      <View style={styles.groupLabelLeft}>
        {icon ? <Ionicons name={icon} size={14} color={colors.accent} style={{ marginRight: spacing.xs }} /> : null}
        <Text style={styles.groupLabel}>{children}</Text>
      </View>
      {right}
    </View>
  );
}

function Chip({
  icon,
  label,
  color,
  bg,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={color} style={{ marginRight: spacing.xs }} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ProgressBar({ ratio, color }: { ratio: number; color?: string }) {
  const pct = Math.max(0, Math.min(ratio, 1)) * 100;
  return (
    <View style={styles.progressTrack}>
      <LinearGradient
        colors={color ? [color, color] : [...gradients.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.progressFill, { width: `${pct}%` }]}
      />
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────

export default function PlansScreen() {
  const router = useRouter();

  // List state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail state
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<PlanType>('savings');
  const [createContribution, setCreateContribution] = useState('');
  const [creating, setCreating] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  // Edit plan modal
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContribution, setEditContribution] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  // Edit milestone modal
  const [showEditMilestone, setShowEditMilestone] = useState(false);
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null);
  const [editMsTitle, setEditMsTitle] = useState('');
  const [editMsAmount, setEditMsAmount] = useState('');
  const [editMsDate, setEditMsDate] = useState('');

  // ─── Data fetching ──────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    try {
      const data = await api.get<Plan[]>('/auth/plans');
      setPlans(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error('Failed to load plans:', e);
      setError('Failed to load financial plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const loadPlanDetail = async (planId: string) => {
    setDetailLoading(true);
    try {
      const data = await api.get<PlanDetail>(`/auth/plans/${planId}`);
      setSelectedPlan(data);
    } catch (e) {
      console.error('Failed to load plan detail:', e);
      Alert.alert('Error', 'Failed to load plan details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Actions ────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createName.trim()) {
      Alert.alert('Validation', 'Plan name is required.');
      return;
    }
    if (!createContribution || isNaN(Number(createContribution)) || Number(createContribution) <= 0) {
      Alert.alert('Validation', 'Enter a valid monthly contribution.');
      return;
    }

    setCreating(true);
    try {
      const newPlan = await api.post<Plan>('/auth/plans', {
        name: createName.trim(),
        plan_type: createType,
        monthly_contribution: parseFloat(createContribution),
      });
      setShowCreate(false);
      resetCreateForm();
      await loadPlans();
      if (newPlan?.id) {
        loadPlanDetail(newPlan.id);
      }
    } catch (e) {
      console.error('Create plan error:', e);
      Alert.alert('Error', 'Failed to create plan.');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedPlan) return;
    setActionLoading(true);
    try {
      await api.put(`/auth/plans/${selectedPlan.id}`, { status: newStatus });
      setSelectedPlan({ ...selectedPlan, status: newStatus as Plan['status'] });
      loadPlans();
    } catch (e) {
      console.error('Status update error:', e);
      Alert.alert('Error', 'Failed to update plan status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selectedPlan) return;
    Alert.alert(
      'Delete Plan',
      `Are you sure you want to delete "${selectedPlan.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await api.delete(`/auth/plans/${selectedPlan.id}`);
              setSelectedPlan(null);
              loadPlans();
            } catch (e) {
              console.error('Delete plan error:', e);
              Alert.alert('Error', 'Failed to delete plan.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleApprove = async () => {
    if (!selectedPlan) return;
    setActionLoading(true);
    try {
      await api.post(`/auth/plans/${selectedPlan.id}/approve`);
      await loadPlanDetail(selectedPlan.id);
      loadPlans();
    } catch (e) {
      console.error('Approve error:', e);
      Alert.alert('Error', 'Failed to approve plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPlan) return;
    setActionLoading(true);
    try {
      await api.post(`/auth/plans/${selectedPlan.id}/reject`, {
        feedback: rejectFeedback.trim() || undefined,
      });
      setShowReject(false);
      setRejectFeedback('');
      await loadPlanDetail(selectedPlan.id);
      loadPlans();
    } catch (e) {
      console.error('Reject error:', e);
      Alert.alert('Error', 'Failed to reject plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditPlan = () => {
    if (!selectedPlan) return;
    setEditName(selectedPlan.name);
    setEditContribution(String(selectedPlan.monthly_contribution || ''));
    setEditEndDate(selectedPlan.projected_end_date || '');
    setShowEditPlan(true);
  };

  const handleEditPlan = async () => {
    if (!selectedPlan) return;
    setActionLoading(true);
    try {
      const updates: any = {};
      if (editName.trim() && editName.trim() !== selectedPlan.name) updates.name = editName.trim();
      if (editContribution && Number(editContribution) !== selectedPlan.monthly_contribution) updates.monthly_contribution = Number(editContribution);
      if (editEndDate && editEndDate !== selectedPlan.projected_end_date) updates.projected_end_date = editEndDate;
      if (Object.keys(updates).length === 0) { setShowEditPlan(false); setActionLoading(false); return; }
      await api.put(`/auth/plans/${selectedPlan.id}`, updates);
      setShowEditPlan(false);
      await loadPlanDetail(selectedPlan.id);
      loadPlans();
    } catch (e) {
      console.error('Edit plan error:', e);
      Alert.alert('Error', 'Failed to update plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditMilestone = (m: Milestone) => {
    setEditMilestone(m);
    setEditMsTitle(m.title);
    setEditMsAmount(m.target_amount ? String(m.target_amount) : '');
    setEditMsDate(m.target_date || '');
    setShowEditMilestone(true);
  };

  const handleEditMilestone = async () => {
    if (!selectedPlan || !editMilestone) return;
    setActionLoading(true);
    try {
      const updates: any = {};
      if (editMsTitle.trim() && editMsTitle.trim() !== editMilestone.title) updates.title = editMsTitle.trim();
      if (editMsAmount && Number(editMsAmount) !== editMilestone.target_amount) updates.target_amount = Number(editMsAmount);
      if (editMsDate && editMsDate !== editMilestone.target_date) updates.target_date = editMsDate;
      if (Object.keys(updates).length === 0) { setShowEditMilestone(false); setActionLoading(false); return; }
      await api.put(`/auth/plans/${selectedPlan.id}/milestones/${editMilestone.id}`, updates);
      setShowEditMilestone(false);
      setEditMilestone(null);
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      console.error('Edit milestone error:', e);
      Alert.alert('Error', 'Failed to update milestone.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMilestoneStatus = async (m: Milestone, newStatus: string) => {
    if (!selectedPlan) return;
    try {
      await api.put(`/auth/plans/${selectedPlan.id}/milestones/${m.id}`, { status: newStatus });
      await loadPlanDetail(selectedPlan.id);
    } catch (e) {
      console.error('Milestone status error:', e);
    }
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreateType('savings');
    setCreateContribution('');
  };

  // ─── Computed ───────────────────────────────────────────────

  const activePlans = plans.filter((p) => p.status === 'active');
  const totalContributions = activePlans.reduce((s, p) => s + (p.monthly_contribution || 0), 0);

  // Type totals across active plans → hero legend + proportion bar.
  const typeTotals = (Object.keys(TYPE_VISUAL) as PlanType[])
    .map((t) => ({
      type: t,
      total: activePlans
        .filter((p) => p.plan_type === t)
        .reduce((s, p) => s + (p.monthly_contribution || 0), 0),
    }))
    .filter((e) => e.total > 0);

  const statusCounts = {
    active: plans.filter((p) => p.status === 'active').length,
    draft: plans.filter((p) => p.status === 'draft').length,
    completed: plans.filter((p) => p.status === 'completed').length,
  };

  const milestoneProgress = (ms?: Milestone[]) => {
    const total = ms?.length || 0;
    const reached = ms?.filter((m) => m.status === 'reached').length || 0;
    return { reached, total, ratio: total > 0 ? reached / total : 0 };
  };

  // ─── AI analysis renderer ──────────────────────────────────

  const renderAiAnalysis = (analysis: any) => {
    if (!analysis) return null;

    if (typeof analysis === 'string') {
      return <Text style={styles.analysisText}>{analysis}</Text>;
    }

    if (typeof analysis === 'object') {
      return (
        <View>
          {Object.entries(analysis).map(([key, value]) => (
            <View key={key} style={styles.analysisRow}>
              <Text style={styles.analysisKey}>{capitalize(key)}</Text>
              <Text style={styles.analysisValue}>
                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  // ─── Shared form-sheet recipe ───────────────────────────────

  const FormSheet = ({
    visible,
    title,
    onClose,
    children,
    submitLabel,
    submitGradient = [...gradients.primaryGradient] as string[],
    onSubmit,
    submitting,
  }: {
    visible: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    submitLabel: string;
    submitGradient?: string[];
    onSubmit: () => void;
    submitting: boolean;
  }) => (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetBackdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <TouchableOpacity
            onPress={onSubmit}
            style={[styles.sheetSubmit, submitting && styles.disabledBtn]}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={submitGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetSubmitInner}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sheetSubmitText}>{submitLabel}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─── Detail View ────────────────────────────────────────────

  if (selectedPlan) {
    const plan = selectedPlan;
    const typeVis = TYPE_VISUAL[plan.plan_type] || TYPE_VISUAL.combined;
    const statusVis = STATUS_VISUAL[plan.status] || STATUS_VISUAL.draft;
    const maxAllocation = Math.max(...(plan.allocations?.map((a) => a.monthly_amount) || [1]), 1);
    const msProgress = milestoneProgress(plan.milestones);
    const hasPendingApproval =
      plan.status === 'draft' && !!plan.approvals?.some((a) => a.status === 'pending');

    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {/* Fixed detail header */}
          <View style={styles.header}>
            <BackButton onPress={() => setSelectedPlan(null)} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {plan.name}
            </Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={openEditPlan}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Edit plan"
                style={styles.headerIconBtn}
              >
                <Ionicons name="create-outline" size={22} color={colors.accent} />
              </TouchableOpacity>
              <Chip icon={statusVis.icon} label={statusVis.word} color={statusVis.color} bg={statusVis.tint} />
            </View>
          </View>

          {detailLoading ? (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Overview hero skeleton */}
              <View style={[styles.heroCard, { padding: spacing.xl }]}>
                <Skeleton width="45%" height={12} />
                <Skeleton width="55%" height={30} style={{ marginTop: spacing.md }} />
                <View style={styles.metaGrid}>
                  <Skeleton width="40%" height={14} />
                  <Skeleton width="40%" height={14} />
                </View>
              </View>
              {/* Section skeleton */}
              <View style={{ marginTop: spacing.lg }}>
                <Skeleton width="35%" height={12} style={{ marginBottom: spacing.md }} />
                <View style={styles.glassCard}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width="100%" height={16} style={{ marginBottom: spacing.md }} />
                  ))}
                </View>
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Overview hero */}
              <View style={[styles.heroCard, { padding: spacing.xl }]}>
                <GroupLabel
                  right={<Chip icon={typeVis.icon} label={typeVis.label} color={typeVis.color} bg={typeVis.tint} />}
                >
                  MONTHLY CONTRIBUTION
                </GroupLabel>
                <Text style={styles.heroValue}>
                  {fmt(plan.monthly_contribution || 0)}
                  <Text style={styles.heroValueSuffix}> /mo</Text>
                </Text>
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Start</Text>
                    <Text style={styles.metaValue}>{formatDate(plan.start_date)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Projected end</Text>
                    <Text style={styles.metaValue}>{formatDate(plan.projected_end_date)}</Text>
                  </View>
                </View>
              </View>

              {/* AI Analysis */}
              {plan.ai_analysis && (
                <View style={styles.section}>
                  <GroupLabel icon="sparkles">AI ANALYSIS</GroupLabel>
                  <View style={styles.glassCard}>{renderAiAnalysis(plan.ai_analysis)}</View>
                </View>
              )}

              {/* Milestones */}
              <View style={styles.section}>
                <GroupLabel
                  right={
                    msProgress.total > 0 ? (
                      <Text style={styles.groupLabelRightText}>
                        {msProgress.reached} of {msProgress.total} reached
                      </Text>
                    ) : undefined
                  }
                >
                  MILESTONES
                </GroupLabel>
                <View style={styles.glassCard}>
                  {msProgress.total > 0 && (
                    <View style={{ marginBottom: spacing.md }}>
                      <ProgressBar ratio={msProgress.ratio} />
                    </View>
                  )}
                  {!plan.milestones || plan.milestones.length === 0 ? (
                    <Text style={styles.emptySubtext}>No milestones set for this plan.</Text>
                  ) : (
                    plan.milestones.map((m, idx) => {
                      const mv = MILESTONE_VISUAL[m.status] || MILESTONE_VISUAL.pending;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.milestoneRow, idx > 0 && styles.rowDivider]}
                          onPress={() => openEditMilestone(m)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`${m.title}, ${mv.word}${
                            m.target_amount ? `, target ${fmt(m.target_amount)}` : ''
                          }${m.target_date ? `, target date ${formatDate(m.target_date)}` : ''}. Double tap to edit.`}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              handleMilestoneStatus(m, m.status === 'reached' ? 'pending' : 'reached')
                            }
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.milestoneToggle}
                            accessibilityRole="button"
                            accessibilityLabel={`Mark ${m.title} ${
                              m.status === 'reached' ? 'not reached' : 'reached'
                            }`}
                          >
                            <Ionicons name={mv.icon} size={22} color={mv.color} />
                          </TouchableOpacity>
                          <View style={{ flex: 1, marginLeft: spacing.md }}>
                            <Text style={styles.milestoneTitle} numberOfLines={1}>
                              {m.title}
                            </Text>
                            {m.target_amount ? (
                              <Text style={styles.metaLabel}>{fmt(m.target_amount)}</Text>
                            ) : null}
                            {m.target_date ? (
                              <Text style={styles.metaLabel}>Target: {formatDate(m.target_date)}</Text>
                            ) : null}
                          </View>
                          <View style={[styles.milestoneStateChip, { backgroundColor: mv.tint }]}>
                            <Text style={[styles.milestoneStateText, { color: mv.color }]} numberOfLines={1}>
                              {mv.word}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>

              {/* Allocations */}
              <View style={styles.section}>
                <GroupLabel>ALLOCATIONS</GroupLabel>
                <View style={styles.glassCard}>
                  {!plan.allocations || plan.allocations.length === 0 ? (
                    <Text style={styles.emptySubtext}>No allocations configured.</Text>
                  ) : (
                    plan.allocations.map((a) => {
                      const ratio = maxAllocation > 0 ? a.monthly_amount / maxAllocation : 0;
                      return (
                        <View key={a.id} style={styles.allocationRow}>
                          <View style={styles.allocationHeader}>
                            <Text style={styles.allocationLabel} numberOfLines={1}>
                              {capitalize(a.target_name || a.target_type || 'Unknown')}
                            </Text>
                            <Text style={styles.allocationAmount}>{fmt(a.monthly_amount)}/mo</Text>
                          </View>
                          <ProgressBar ratio={ratio} />
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

              {/* Partner approvals */}
              {plan.approvals && plan.approvals.length > 0 && (
                <View style={styles.section}>
                  <GroupLabel icon="people">PARTNER APPROVALS</GroupLabel>
                  <View style={styles.glassCard}>
                    {plan.approvals.map((a, idx) => {
                      const av = APPROVAL_VISUAL[a.status] || APPROVAL_VISUAL.pending;
                      return (
                        <View
                          key={a.id}
                          style={[styles.approvalRow, idx > 0 && styles.rowDivider]}
                          accessibilityLabel={`${a.user_name || 'Partner'}, ${av.word}${
                            a.responded_at ? `, ${formatDate(a.responded_at)}` : ''
                          }.`}
                        >
                          <View style={[styles.approvalIcon, { backgroundColor: av.tint }]}>
                            <Ionicons name={av.icon} size={20} color={av.color} />
                          </View>
                          <View style={{ flex: 1, marginLeft: spacing.md }}>
                            <Text style={styles.approvalName}>{a.user_name || 'Partner'}</Text>
                            <Text style={styles.approvalSub}>
                              {av.word}
                              {a.responded_at ? ` · ${formatDate(a.responded_at)}` : ''}
                            </Text>
                            {a.feedback ? (
                              <View style={styles.feedbackBox}>
                                <Text style={styles.feedbackText}>&ldquo;{a.feedback}&rdquo;</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}

                    {hasPendingApproval && (
                      <View style={styles.approvalActions}>
                        <TouchableOpacity
                          style={[styles.gradientBtn, actionLoading && styles.disabledBtn]}
                          onPress={handleApprove}
                          disabled={actionLoading}
                          activeOpacity={0.85}
                        >
                          <LinearGradient
                            colors={[...gradients.successGradient]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientBtnInner}
                          >
                            {actionLoading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                <Text style={styles.gradientBtnText}>Approve</Text>
                              </>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.outlineBtn,
                            { borderColor: tint.error },
                            actionLoading && styles.disabledBtn,
                          ]}
                          onPress={() => setShowReject(true)}
                          disabled={actionLoading}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.error} />
                          <Text style={[styles.outlineBtnText, { color: colors.error }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Action bar */}
              <View style={styles.actionBar}>
                {plan.status === 'draft' && (
                  <TouchableOpacity
                    style={[styles.gradientBtn, actionLoading && styles.disabledBtn]}
                    onPress={() => handleStatusChange('active')}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={[...gradients.successGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientBtnInnerLg}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                          <Text style={styles.gradientBtnTextLg}>Activate Plan</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                {plan.status === 'active' && (
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: tint.warning }, actionLoading && styles.disabledBtn]}
                    onPress={() => handleStatusChange('paused')}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="pause-circle-outline" size={18} color={colors.warning} />
                    <Text style={[styles.outlineBtnText, { color: colors.warning }]}>Pause Plan</Text>
                  </TouchableOpacity>
                )}
                {plan.status === 'paused' && (
                  <TouchableOpacity
                    style={[styles.outlineBtn, { borderColor: tint.success }, actionLoading && styles.disabledBtn]}
                    onPress={() => handleStatusChange('active')}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play-circle-outline" size={18} color={colors.success} />
                    <Text style={[styles.outlineBtnText, { color: colors.success }]}>Resume Plan</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: tint.error }, actionLoading && styles.disabledBtn]}
                  onPress={handleDelete}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[styles.outlineBtnText, { color: colors.error }]}>Delete Plan</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Reject sheet */}
          <FormSheet
            visible={showReject}
            title="Reject Plan"
            onClose={() => {
              setShowReject(false);
              setRejectFeedback('');
            }}
            submitLabel="Reject Plan"
            submitGradient={[...gradients.errorGradient]}
            onSubmit={handleReject}
            submitting={actionLoading}
          >
            <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Feedback</Text>
            <Text style={styles.fieldHint}>Share your feedback so your partner can adjust the plan.</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="What would you change? (optional)"
              placeholderTextColor={colors.textDark}
              value={rejectFeedback}
              onChangeText={setRejectFeedback}
              multiline
            />
          </FormSheet>

          {/* Edit plan sheet */}
          <FormSheet
            visible={showEditPlan}
            title="Edit Plan"
            onClose={() => setShowEditPlan(false)}
            submitLabel="Save Changes"
            onSubmit={handleEditPlan}
            submitting={actionLoading}
          >
            <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Plan Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Plan name"
              placeholderTextColor={colors.textDark}
            />
            <Text style={styles.fieldLabel}>Monthly Contribution</Text>
            <TextInput
              style={styles.input}
              value={editContribution}
              onChangeText={setEditContribution}
              placeholder="0.00"
              placeholderTextColor={colors.textDark}
              keyboardType="numeric"
            />
            <Text style={styles.fieldLabel}>Projected End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={editEndDate}
              onChangeText={setEditEndDate}
              placeholder="2026-12-31"
              placeholderTextColor={colors.textDark}
            />
          </FormSheet>

          {/* Edit milestone sheet */}
          <FormSheet
            visible={showEditMilestone}
            title="Edit Milestone"
            onClose={() => {
              setShowEditMilestone(false);
              setEditMilestone(null);
            }}
            submitLabel="Save Changes"
            onSubmit={handleEditMilestone}
            submitting={actionLoading}
          >
            <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Title</Text>
            <TextInput
              style={styles.input}
              value={editMsTitle}
              onChangeText={setEditMsTitle}
              placeholder="Milestone title"
              placeholderTextColor={colors.textDark}
            />
            <Text style={styles.fieldLabel}>Target Amount</Text>
            <TextInput
              style={styles.input}
              value={editMsAmount}
              onChangeText={setEditMsAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textDark}
              keyboardType="numeric"
            />
            <Text style={styles.fieldLabel}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={editMsDate}
              onChangeText={setEditMsDate}
              placeholder="2026-12-31"
              placeholderTextColor={colors.textDark}
            />
          </FormSheet>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ─── List View ──────────────────────────────────────────────

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Fixed header */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/goals" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Financial Plans
          </Text>
          <View style={styles.headerRight}>
            {refreshing && <ActivityIndicator color={colors.primary2} size="small" style={{ marginRight: spacing.sm }} />}
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Create plan"
              style={styles.headerIconBtn}
            >
              <Ionicons name="add-circle" size={28} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {error ? (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                loadPlans();
              }}
            />
          ) : loading ? (
            <>
              {/* Hero skeleton */}
              <View style={[styles.heroCard, { padding: spacing.xl }]}>
                <Skeleton width="50%" height={12} />
                <Skeleton width="60%" height={30} style={{ marginTop: spacing.md }} />
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                  <Skeleton width="30%" height={12} />
                  <Skeleton width="30%" height={12} />
                </View>
                <Skeleton width="100%" height={6} borderRadius={radius.full} style={{ marginTop: spacing.md }} />
              </View>
              {/* Row skeletons */}
              <View style={{ marginTop: spacing.lg }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.rowCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Skeleton width={90} height={22} borderRadius={radius.full} />
                      <Skeleton width={70} height={22} borderRadius={radius.full} />
                    </View>
                    <Skeleton width="60%" height={16} style={{ marginTop: spacing.md }} />
                    <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
                  </View>
                ))}
              </View>
            </>
          ) : plans.length === 0 ? (
            <EmptyState
              icon="map-outline"
              title="No financial plans"
              description="Create your first plan to start organizing your debt payoff and savings strategy"
              actionLabel="Create Plan"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <>
              {/* Summary hero */}
              <View
                style={[styles.heroCard, { padding: spacing.xl }]}
                accessibilityLabel={`Monthly commitment ${fmt(totalContributions)}. ${statusCounts.active} active, ${statusCounts.draft} draft, ${statusCounts.completed} completed.`}
              >
                <GroupLabel>MONTHLY COMMITMENT</GroupLabel>
                <Text style={styles.heroValue}>
                  {fmt(totalContributions)}
                  <Text style={styles.heroValueSuffix}> /mo</Text>
                </Text>

                {typeTotals.length > 0 && (
                  <>
                    <View style={styles.legendRow}>
                      {typeTotals.map((e) => {
                        const tv = TYPE_VISUAL[e.type];
                        return (
                          <View key={e.type} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: tv.color }]} />
                            <Text style={styles.legendText}>
                              {tv.label} {fmt(e.total)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.proportionBar}>
                      {typeTotals.map((e) => {
                        const tv = TYPE_VISUAL[e.type];
                        return (
                          <View
                            key={e.type}
                            style={{ flex: e.total, backgroundColor: tv.color, height: '100%' }}
                          />
                        );
                      })}
                    </View>
                  </>
                )}

                <Text style={styles.statusCounts}>
                  {statusCounts.active} active
                  {'  ·  '}
                  <Text style={{ color: colors.warning }}>{statusCounts.draft} draft</Text>
                  {'  ·  '}
                  {statusCounts.completed} completed
                </Text>
              </View>

              {/* Plan list */}
              <GroupLabel>YOUR PLANS</GroupLabel>
              {plans.map((p) => {
                const tv = TYPE_VISUAL[p.plan_type] || TYPE_VISUAL.combined;
                const sv = STATUS_VISUAL[p.status] || STATUS_VISUAL.draft;
                const draft = isDraft(p);
                const subtitle = draft
                  ? `${tv.label} · awaiting partner`
                  : `${tv.label} · ends ${formatDate(p.projected_end_date)}`;
                const amountStr = `${draft ? '~' : ''}${fmt(p.monthly_contribution || 0)}`;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.rowCard, draft && styles.rowCardDraft]}
                    onPress={() => loadPlanDetail(p.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}, ${tv.label}, ${sv.word}, monthly ${amountStr}${
                      draft ? ', draft, awaiting approval' : ''
                    }.`}
                  >
                    <View style={styles.rowHeader}>
                      <Chip icon={tv.icon} label={tv.label} color={tv.color} bg={tv.tint} />
                      <Chip icon={sv.icon} label={draft ? 'Draft' : sv.word} color={sv.color} bg={sv.tint} />
                    </View>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {subtitle}
                    </Text>
                    <View style={styles.rowFooterDivider} />
                    <View style={styles.rowFooter}>
                      <View>
                        <Text style={styles.metaLabel}>Monthly</Text>
                        <Text style={[styles.rowAmount, draft && styles.rowAmountDraft]}>{amountStr}</Text>
                      </View>
                      <View style={styles.rowFooterRight}>
                        <Text style={styles.rowHint} numberOfLines={1}>
                          {draft ? 'needs approval' : ''}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textDark} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>

        {/* Create sheet */}
        <FormSheet
          visible={showCreate}
          title="Create Plan"
          onClose={() => {
            setShowCreate(false);
            resetCreateForm();
          }}
          submitLabel="Create Plan"
          onSubmit={handleCreate}
          submitting={creating}
        >
          <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Plan Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Debt Freedom 2027"
            placeholderTextColor={colors.textDark}
            value={createName}
            onChangeText={setCreateName}
          />

          <Text style={styles.fieldLabel}>Plan Type</Text>
          <View style={styles.typeRow}>
            {(Object.keys(TYPE_VISUAL) as PlanType[]).map((t) => {
              const tv = TYPE_VISUAL[t];
              const active = createType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    active && { backgroundColor: tv.tint, borderColor: tv.color },
                  ]}
                  onPress={() => setCreateType(t)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={tv.icon}
                    size={14}
                    color={active ? tv.color : colors.textMuted}
                    style={{ marginBottom: spacing.xs }}
                  />
                  <Text style={[styles.typeText, active && { color: tv.color, fontWeight: '700' }]}>
                    {tv.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Monthly Contribution</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={colors.textDark}
            keyboardType="numeric"
            value={createContribution}
            onChangeText={setCreateContribution}
          />
        </FormSheet>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Group labels
  groupLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groupLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  groupLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  groupLabelRightText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Hero
  heroCard: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
  },
  heroValue: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  heroValueSuffix: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: '400',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  legendText: {
    ...typography.caption,
    color: colors.text,
  },
  proportionBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.glassMedium,
    marginTop: spacing.md,
  },
  statusCounts: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },

  // Sections
  section: {
    marginTop: spacing.lg,
  },
  glassCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
  },

  // Detail overview meta grid
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  metaValue: {
    ...typography.smallBold,
    color: colors.text,
    marginTop: spacing.xs,
  },

  // Chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    maxWidth: 160,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Progress bar
  progressTrack: {
    height: 6,
    backgroundColor: colors.glassMedium,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // List rows
  rowCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowCardDraft: {
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rowTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  rowFooterDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  rowFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    marginLeft: spacing.md,
  },
  rowAmount: {
    ...typography.smallBold,
    color: colors.text,
    marginTop: spacing.xs,
    flexShrink: 0,
  },
  rowAmountDraft: {
    color: colors.textMuted,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },

  // AI analysis
  analysisText: {
    ...typography.body,
    color: colors.textMuted,
  },
  analysisRow: {
    marginBottom: spacing.md,
  },
  analysisKey: {
    ...typography.smallBold,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  analysisValue: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Milestones
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  milestoneToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  milestoneStateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
    alignSelf: 'center',
  },
  milestoneStateText: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Allocations
  allocationRow: {
    marginBottom: spacing.md,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  allocationLabel: {
    ...typography.smallBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  allocationAmount: {
    ...typography.smallBold,
    color: colors.accent,
    flexShrink: 0,
  },

  // Approvals
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  approvalIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalName: {
    ...typography.smallBold,
    color: colors.text,
  },
  approvalSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  feedbackBox: {
    backgroundColor: tint.feedback,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  feedbackText: {
    ...typography.small,
    color: colors.error,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },

  // Buttons
  gradientBtn: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  gradientBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  gradientBtnInnerLg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  gradientBtnText: {
    ...typography.smallBold,
    color: '#fff',
  },
  gradientBtnTextLg: {
    ...typography.button,
    color: '#fff',
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.glassLight,
  },
  outlineBtnText: {
    ...typography.smallBold,
  },
  disabledBtn: {
    opacity: 0.6,
  },

  // Action bar
  actionBar: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  // Empty subtext
  emptySubtext: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  // Sheets
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  sheetSubmit: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  sheetSubmitInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  sheetSubmitText: {
    ...typography.button,
    color: '#fff',
  },

  // Form fields
  fieldLabel: {
    ...typography.smallBold,
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  fieldHint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  input: {
    ...glassEffects.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
  },
  typeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
