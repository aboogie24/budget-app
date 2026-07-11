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
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
  commonStyles,
} from '@/utils/design-system';

type Priority = {
  id: string;
  user_id: string;
  household_id?: string;
  title: string;
  rank: number;
  notes: string;
  is_shared: boolean;
};

// Rank-1 accent tints (12% on the semantic colors — kept out of the row logic).
const RANK1_TINT = 'rgba(234,179,8,0.12)'; // colors.warning @ 12%
const RANK_TINT = 'rgba(168,85,247,0.12)'; // colors.primary2 @ 12%
const DISABLED_OPACITY = 0.35;

export default function PrioritiesScreen() {
  const router = useRouter();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Priority | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const loadPriorities = useCallback(async () => {
    try {
      const userId = await api.getUserId();
      if (!userId) return;
      const data = await api.get<Priority[]>('/auth/priorities', { user_id: userId });
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      setPriorities(list);
      setError(null);
    } catch (e) {
      console.error('Failed to load priorities:', e);
      setError('Failed to load priorities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPriorities();
  }, [loadPriorities]);

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (p: Priority) => {
    setEditing(p);
    setTitle(p.title);
    setNotes(p.notes || '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required.');
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }

    const payload = {
      user_id: userId,
      title: title.trim(),
      rank: editing ? editing.rank : priorities.length + 1,
      notes: notes.trim(),
      is_shared: false,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/auth/priorities/${editing.id}`, payload);
      } else {
        await api.post('/auth/priorities', payload);
      }
      setShowForm(false);
      resetForm();
      loadPriorities();
    } catch (e) {
      console.error('Save priority error:', e);
      Alert.alert('Error', 'Failed to save priority.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Priority) => {
    Alert.alert('Delete Priority', `Remove "${p.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/priorities/${p.id}`);
            loadPriorities();
          } catch (e) {
            console.error('Delete priority error:', e);
            Alert.alert('Error', 'Failed to delete priority.');
          }
        },
      },
    ]);
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= priorities.length) return;

    const reordered = [...priorities];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setPriorities(reordered);

    try {
      await api.patch('/auth/priorities/reorder', {
        order: reordered.map((p) => p.id),
      });
    } catch (e) {
      console.error('Reorder error:', e);
      loadPriorities();
    }
  };

  // ── Header block (static — renders in every state) ──
  const renderHeader = () => (
    <>
      <View style={styles.headerRow}>
        <BackButton fallback="/(tabs)/goals" />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Financial Priorities
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel="Add a priority"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add-circle" size={28} color={colors.primary2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.contextStrip}>
        Rank what matters most so your spending stays aligned with your goals. Drag order with
        the arrows.
      </Text>
    </>
  );

  // ── Loading skeleton card (layout-matched to a real PriorityCard) ──
  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardRow}>
        <Skeleton width={40} height={40} borderRadius={radius.md} />
        <View style={styles.cardBody}>
          <Skeleton height={16} width="70%" />
          <View style={{ height: spacing.sm }} />
          <Skeleton height={12} width="45%" />
        </View>
      </View>
      <View style={commonStyles.divider} />
      <Skeleton height={12} width="30%" />
    </View>
  );

  const renderPriorityCard = (p: Priority, index: number) => {
    const isTop = p.rank === 1;
    const upDisabled = index === 0;
    const downDisabled = index === priorities.length - 1;
    const accent = isTop ? colors.warning : colors.primary2;
    const badgeFill = isTop ? RANK1_TINT : RANK_TINT;

    const a11yLabel = `Priority ${p.rank}${isTop ? ', top priority' : ''}: ${p.title}.${
      p.notes ? ` ${p.notes}.` : ''
    }`;

    return (
      <View key={p.id} style={styles.card} accessible accessibilityLabel={a11yLabel}>
        <View style={styles.cardRow}>
          {/* Rank badge — number carries order; color is a supporting accent only */}
          <View style={[styles.rankBadge, { backgroundColor: badgeFill, borderColor: accent }]}>
            <Text style={[styles.rankText, { color: accent }]}>{p.rank}</Text>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {p.title}
              </Text>
              {isTop && (
                <View style={styles.topPill}>
                  <Ionicons name="star" size={11} color={colors.warning} />
                  <Text style={styles.topPillText}>TOP</Text>
                </View>
              )}
            </View>
            {p.notes ? (
              <Text style={styles.notesText} numberOfLines={2}>
                {p.notes}
              </Text>
            ) : null}
          </View>

          {/* Reorder control column */}
          <View style={styles.reorderCol}>
            <TouchableOpacity
              onPress={() => moveItem(index, 'up')}
              disabled={upDisabled}
              style={styles.reorderBtn}
              accessibilityRole="button"
              accessibilityLabel={`Move ${p.title} up`}
              accessibilityState={{ disabled: upDisabled }}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={upDisabled ? colors.textMuted : colors.text}
                style={upDisabled ? { opacity: DISABLED_OPACITY } : undefined}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveItem(index, 'down')}
              disabled={downDisabled}
              style={styles.reorderBtn}
              accessibilityRole="button"
              accessibilityLabel={`Move ${p.title} down`}
              accessibilityState={{ disabled: downDisabled }}
              hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={downDisabled ? colors.textMuted : colors.text}
                style={downDisabled ? { opacity: DISABLED_OPACITY } : undefined}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={commonStyles.divider} />

        {/* Action row */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => openEdit(p)}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${p.title}`}
          >
            <Ionicons name="pencil" size={14} color={colors.primary2} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(p)}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${p.title}`}
            accessibilityHint="Double tap to remove this priority."
          >
            <Ionicons name="trash-outline" size={14} color={colors.error} />
            <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <ErrorState
          title="Couldn't load your priorities"
          message="Check your connection and try again."
          retryLabel="Retry"
          onRetry={() => {
            setError(null);
            setLoading(true);
            loadPriorities();
          }}
        />
      );
    }

    if (loading) {
      return (
        <View>
          {renderSkeletonCard(0)}
          {renderSkeletonCard(1)}
          {renderSkeletonCard(2)}
        </View>
      );
    }

    if (priorities.length === 0) {
      return (
        <EmptyState
          icon="flag-outline"
          title="No priorities set"
          description="Define your financial priorities to stay focused on what matters most."
          actionLabel="Add Priority"
          onAction={openCreate}
        />
      );
    }

    return <View>{priorities.map((p, index) => renderPriorityCard(p, index))}</View>;
  };

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}
          <View style={styles.listWrap}>{renderContent()}</View>
        </ScrollView>

        {/* Add/Edit bottom sheet */}
        <Modal visible={showForm} animationType="slide" transparent onRequestClose={closeForm}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalKav}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Edit Priority' : 'New Priority'}
                  </Text>
                  <TouchableOpacity
                    onPress={closeForm}
                    style={styles.closeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Pay off student loans"
                  placeholderTextColor={colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Why is this important?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />

                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.saveBtn}
                  disabled={saving}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={editing ? 'Update' : 'Add Priority'}
                >
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnInner}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.text} />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {editing ? 'Update' : 'Add Priority'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  addBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  contextStrip: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  listWrap: {
    marginTop: spacing.xl,
  },

  // Card
  card: {
    ...commonStyles.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    ...typography.smallBold,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 1,
  },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: RANK1_TINT,
  },
  topPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.warning,
  },
  notesText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Reorder column
  reorderCol: {
    flexShrink: 0,
    marginLeft: spacing.sm,
  },
  reorderBtn: {
    width: 44,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action row
  cardActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  actionText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
  removeText: {
    color: colors.error,
  },

  // Modal / bottom sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalKav: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  label: {
    ...typography.smallBold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    ...glassEffects.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.text,
  },
});
