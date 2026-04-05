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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';

// ─── Types ──────────────────────────────────────────────────────

type Plan = {
  id: string;
  name: string;
  plan_type: 'debt_payoff' | 'savings' | 'combined';
  status: 'draft' | 'active' | 'paused' | 'completed';
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

const PLAN_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  debt_payoff: { label: 'Debt Payoff', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  savings: { label: 'Savings', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  combined: { label: 'Combined', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  active: { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  paused: { label: 'Paused', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  completed: { label: 'Completed', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
};

const MILESTONE_ICONS: Record<string, { name: string; color: string }> = {
  pending: { name: 'ellipse-outline', color: '#94a3b8' },
  reached: { name: 'checkmark-circle', color: '#22c55e' },
  skipped: { name: 'close-circle', color: '#ef4444' },
};

// ─── Component ──────────────────────────────────────────────────

export default function PlansScreen() {
  const router = useRouter();

  // List state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail state
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'debt_payoff' | 'savings' | 'combined'>('savings');
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

  // ─── Render helpers ─────────────────────────────────────────

  const renderBadge = (config: { label: string; color: string; bg: string }) => (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );

  const renderAiAnalysis = (analysis: any) => {
    if (!analysis) return null;

    // Handle string analysis
    if (typeof analysis === 'string') {
      return <Text style={styles.analysisText}>{analysis}</Text>;
    }

    // Handle JSONB object — render key-value pairs
    if (typeof analysis === 'object') {
      return (
        <View>
          {Object.entries(analysis).map(([key, value]) => (
            <View key={key} style={styles.analysisRow}>
              <Text style={styles.analysisKey}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
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

  // ─── Detail View ────────────────────────────────────────────

  if (selectedPlan) {
    const plan = selectedPlan;
    const typeConfig = PLAN_TYPE_CONFIG[plan.plan_type] || PLAN_TYPE_CONFIG.combined;
    const statusConfig = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
    const maxAllocation = Math.max(...(plan.allocations?.map((a) => a.monthly_amount) || [1]), 1);

    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {detailLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#c084fc" size="large" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
              {/* Header */}
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.iconButton}>
                  <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={styles.headerTitle} numberOfLines={1}>{plan.name}</Text>
                </View>
                <TouchableOpacity onPress={openEditPlan} style={{ marginRight: 8 }}>
                  <Ionicons name="create-outline" size={20} color="#c084fc" />
                </TouchableOpacity>
                {renderBadge(statusConfig)}
              </View>

              {/* Summary Section */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Plan Overview</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Monthly Contribution</Text>
                    <Text style={styles.detailValue}>{fmt(plan.monthly_contribution || 0)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Plan Type</Text>
                    {renderBadge(typeConfig)}
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Start Date</Text>
                    <Text style={styles.detailValue}>{formatDate(plan.start_date)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Projected End</Text>
                    <Text style={styles.detailValue}>{formatDate(plan.projected_end_date)}</Text>
                  </View>
                </View>
              </View>

              {/* AI Analysis Section */}
              {plan.ai_analysis && (
                <View style={styles.card}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="sparkles" size={18} color="#c084fc" />
                    <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
                      AI Analysis
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  {renderAiAnalysis(plan.ai_analysis)}
                </View>
              )}

              {/* Milestones Section */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Milestones</Text>
                {(!plan.milestones || plan.milestones.length === 0) ? (
                  <Text style={styles.emptySubtext}>No milestones set for this plan.</Text>
                ) : (
                  plan.milestones.map((m) => {
                    const iconConfig = MILESTONE_ICONS[m.status] || MILESTONE_ICONS.pending;
                    return (
                      <TouchableOpacity key={m.id} style={styles.milestoneRow} onPress={() => openEditMilestone(m)} activeOpacity={0.7}>
                        <TouchableOpacity
                          onPress={() => handleMilestoneStatus(m, m.status === 'reached' ? 'pending' : 'reached')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={iconConfig.name as any}
                            size={20}
                            color={iconConfig.color}
                          />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.milestoneTitle}>{m.title}</Text>
                          {m.target_amount ? (
                            <Text style={styles.milestoneDesc}>{fmt(m.target_amount)}</Text>
                          ) : null}
                          {m.target_date && (
                            <Text style={styles.milestoneDate}>
                              Target: {formatDate(m.target_date)}
                            </Text>
                          )}
                        </View>
                        <View
                          style={[
                            styles.milestoneBadge,
                            { backgroundColor: MILESTONE_ICONS[m.status]?.color + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.milestoneBadgeText,
                              { color: MILESTONE_ICONS[m.status]?.color },
                            ]}
                          >
                            {m.status}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Allocations Section */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Allocations</Text>
                {(!plan.allocations || plan.allocations.length === 0) ? (
                  <Text style={styles.emptySubtext}>No allocations configured.</Text>
                ) : (
                  plan.allocations.map((a) => {
                    const pct = maxAllocation > 0 ? (a.monthly_amount / maxAllocation) : 0;
                    return (
                      <View key={a.id} style={styles.allocationRow}>
                        <View style={styles.allocationHeader}>
                          <Text style={styles.allocationLabel}>
                            {a.target_name || a.target_type?.replace(/_/g, ' ') || 'Unknown'}
                          </Text>
                          <Text style={styles.allocationAmount}>{fmt(a.monthly_amount)}/mo</Text>
                        </View>
                        <View style={styles.progressBar}>
                          <LinearGradient
                            colors={['#a855f7', '#7c3aed']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.progressFill, { width: `${Math.min(pct * 100, 100)}%` }]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Partner Approvals Section */}
              {plan.approvals && plan.approvals.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="people" size={18} color="#c084fc" />
                    <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
                      Partner Approvals
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  {plan.approvals.map((a) => {
                    const statusColor = a.status === 'approved' ? '#22c55e' : a.status === 'rejected' ? '#ef4444' : '#94a3b8';
                    const statusIcon = a.status === 'approved' ? 'checkmark-circle' : a.status === 'rejected' ? 'close-circle' : 'time-outline';
                    return (
                      <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: statusColor + '20', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name={statusIcon as any} size={20} color={statusColor} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: '#f8fafc', fontWeight: '600', fontSize: 14 }}>
                            {a.user_name || 'Partner'}
                          </Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                            {a.status === 'pending' ? 'Awaiting review' : a.status === 'approved' ? 'Approved' : 'Rejected'}
                            {a.responded_at ? ` · ${formatDate(a.responded_at)}` : ''}
                          </Text>
                          {a.feedback && (
                            <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: 8, marginTop: 6 }}>
                              <Text style={{ color: '#f87171', fontSize: 13 }}>"{a.feedback}"</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}

                  {/* Show approve/reject buttons if this plan has a pending approval for the current user */}
                  {plan.status === 'draft' && plan.approvals.some((a) => a.status === 'pending') && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                      <TouchableOpacity
                        style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
                        onPress={handleApprove}
                        disabled={actionLoading}
                      >
                        <LinearGradient
                          colors={['#22c55e', '#15803d']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
                        >
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Approve</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
                        onPress={() => setShowReject(true)}
                        disabled={actionLoading}
                      >
                        <Ionicons name="close-circle" size={18} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {plan.status === 'active' && (
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => handleStatusChange('paused')}
                    disabled={actionLoading}
                  >
                    <Ionicons name="pause-circle-outline" size={18} color="#eab308" />
                    <Text style={[styles.actionBtnOutlineText, { color: '#eab308' }]}>
                      Pause Plan
                    </Text>
                  </TouchableOpacity>
                )}
                {plan.status === 'paused' && (
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => handleStatusChange('active')}
                    disabled={actionLoading}
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#22c55e" />
                    <Text style={[styles.actionBtnOutlineText, { color: '#22c55e' }]}>
                      Resume Plan
                    </Text>
                  </TouchableOpacity>
                )}
                {plan.status === 'draft' && (
                  <TouchableOpacity
                    style={{ borderRadius: 14, overflow: 'hidden' }}
                    onPress={() => handleStatusChange('active')}
                    disabled={actionLoading}
                  >
                    <LinearGradient
                      colors={['#22c55e', '#15803d']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionBtnGradientInner}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.actionBtnGradientText}>Activate Plan</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtnOutline, { borderColor: 'rgba(239,68,68,0.3)' }]}
                  onPress={handleDelete}
                  disabled={actionLoading}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={[styles.actionBtnOutlineText, { color: '#ef4444' }]}>
                    Delete Plan
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reject Modal */}
              <Modal visible={showReject} transparent animationType="slide">
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <View style={{ backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
                      Reject Plan
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
                      Share your feedback so your partner can adjust the plan.
                    </Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top' }}
                      placeholder="What would you change? (optional)"
                      placeholderTextColor="#475569"
                      value={rejectFeedback}
                      onChangeText={setRejectFeedback}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
                        onPress={() => { setShowReject(false); setRejectFeedback(''); }}
                      >
                        <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
                        onPress={handleReject}
                        disabled={actionLoading}
                      >
                        <LinearGradient
                          colors={['#ef4444', '#b91c1c']}
                          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 12 }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {actionLoading ? 'Sending...' : 'Reject Plan'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* Edit Plan Modal */}
              <Modal visible={showEditPlan} transparent animationType="slide">
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <View style={{ backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Edit Plan</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Plan Name</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, marginBottom: 14 }}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Plan name"
                      placeholderTextColor="#475569"
                    />
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Monthly Contribution</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, marginBottom: 14 }}
                      value={editContribution}
                      onChangeText={setEditContribution}
                      placeholder="0.00"
                      placeholderTextColor="#475569"
                      keyboardType="numeric"
                    />
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Projected End Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, marginBottom: 16 }}
                      value={editEndDate}
                      onChangeText={setEditEndDate}
                      placeholder="2026-12-31"
                      placeholderTextColor="#475569"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
                        onPress={() => setShowEditPlan(false)}
                      >
                        <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
                        onPress={handleEditPlan}
                        disabled={actionLoading}
                      >
                        <LinearGradient
                          colors={['#a855f7', '#7c3aed']}
                          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 12 }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {actionLoading ? 'Saving...' : 'Save Changes'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              {/* Edit Milestone Modal */}
              <Modal visible={showEditMilestone} transparent animationType="slide">
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <View style={{ backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Edit Milestone</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Title</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, marginBottom: 14 }}
                      value={editMsTitle}
                      onChangeText={setEditMsTitle}
                      placeholder="Milestone title"
                      placeholderTextColor="#475569"
                    />
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Target Amount</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, marginBottom: 14 }}
                      value={editMsAmount}
                      onChangeText={setEditMsAmount}
                      placeholder="0.00"
                      placeholderTextColor="#475569"
                      keyboardType="numeric"
                    />
                    <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Target Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#f8fafc', padding: 14, fontSize: 15, marginBottom: 16 }}
                      value={editMsDate}
                      onChangeText={setEditMsDate}
                      placeholder="2026-12-31"
                      placeholderTextColor="#475569"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
                        onPress={() => { setShowEditMilestone(false); setEditMilestone(null); }}
                      >
                        <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}
                        onPress={handleEditMilestone}
                        disabled={actionLoading}
                      >
                        <LinearGradient
                          colors={['#a855f7', '#7c3aed']}
                          style={{ paddingVertical: 14, alignItems: 'center', borderRadius: 12 }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {actionLoading ? 'Saving...' : 'Save Changes'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </ScrollView>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── List View ──────────────────────────────────────────────

  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.navigate('/(tabs)/goals' as any)} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color="#e5e7eb" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Financial Plans</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)}>
              <Ionicons name="add-circle" size={28} color="#c084fc" />
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>Active Plans</Text>
                <Text style={styles.summaryValue}>{activePlans.length}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Monthly Contributions</Text>
                <Text style={styles.summaryValue}>{fmt(totalContributions)}</Text>
              </View>
            </View>
          </View>

          {/* Error */}
          {error && (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                setLoading(true);
                loadPlans();
              }}
            />
          )}

          {/* Loading / Empty / List */}
          {!error && loading ? (
            <ActivityIndicator color="#c084fc" style={{ marginTop: 40 }} />
          ) : !error && plans.length === 0 ? (
            <EmptyState
              icon="map-outline"
              title="No financial plans"
              description="Create your first plan to start organizing your debt payoff and savings strategy"
              actionLabel="Create Plan"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            !error &&
            plans.map((p) => {
              const typeConfig = PLAN_TYPE_CONFIG[p.plan_type] || PLAN_TYPE_CONFIG.combined;
              const statusConfig = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.card}
                  onPress={() => loadPlanDetail(p.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
                    {renderBadge(statusConfig)}
                  </View>
                  <View style={styles.cardBadgeRow}>
                    {renderBadge(typeConfig)}
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.cardDetailsRow}>
                    <View>
                      <Text style={styles.cardDetailLabel}>Monthly</Text>
                      <Text style={styles.cardDetailValue}>{fmt(p.monthly_contribution || 0)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardDetailLabel}>Projected End</Text>
                      <Text style={styles.cardDetailValue}>{formatDate(p.projected_end_date)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Create Plan Modal */}
        <Modal visible={showCreate} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Create Plan</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCreate(false);
                      resetCreateForm();
                    }}
                  >
                    <Ionicons name="close" size={24} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Plan Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Debt Freedom 2027"
                  placeholderTextColor="#94a3b8"
                  value={createName}
                  onChangeText={setCreateName}
                />

                <Text style={styles.label}>Plan Type</Text>
                <View style={styles.typeRow}>
                  {(['debt_payoff', 'savings', 'combined'] as const).map((t) => {
                    const cfg = PLAN_TYPE_CONFIG[t];
                    const isActive = createType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeBtn,
                          isActive && { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                        onPress={() => setCreateType(t)}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            isActive && { color: cfg.color, fontWeight: '700' },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Monthly Contribution</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={createContribution}
                  onChangeText={setCreateContribution}
                />

                <TouchableOpacity
                  onPress={handleCreate}
                  style={styles.saveBtn}
                  disabled={creating}
                >
                  <LinearGradient
                    colors={['#a855f7', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnInner}
                  >
                    {creating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Create Plan</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
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

  // Summary
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  summaryValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },

  // Cards
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
    alignItems: 'center',
  },
  cardTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardDetailLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  cardDetailValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },

  // Badges
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },

  // Detail — sections
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  // Detail grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    width: '45%',
    marginBottom: 4,
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },

  // AI Analysis
  analysisText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
  analysisRow: {
    marginBottom: 12,
  },
  analysisKey: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  analysisValue: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },

  // Milestones
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  milestoneTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  milestoneDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  milestoneDate: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  milestoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  milestoneBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Allocations
  allocationRow: {
    marginBottom: 14,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  allocationLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  allocationAmount: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Action buttons
  actionsContainer: {
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionBtnOutlineText: {
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnGradientInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  actionBtnGradientText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  // Empty
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
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
    fontWeight: '800',
  },

  // Form
  label: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 15,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  typeText: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
