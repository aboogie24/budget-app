import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/storage';
import { api } from '../../utils/apiClient';
import CategoryPicker from '../../components/CategoryPicker';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import {
  colors,
  spacing,
  radius,
  typography,
  gradients,
  glassEffects,
  commonStyles,
} from '@/utils/design-system';

type CategoryRule = {
  id: string;
  rule_type: string; // 'merchant' | 'keyword' | 'system'
  match_value: string;
  category_id: string;
  category_name?: string;
  user_id?: string | null;
  usage_count?: number;
  auto_created?: boolean;
  created_at?: string;
};

type RuleGroup = {
  title: string;
  type: string;
  icon: keyof typeof Ionicons.glyphMap;
  rules: CategoryRule[];
};

// ── Provenance predicate — drives system-rule styling everywhere ──
const isSystemRule = (rule: CategoryRule) =>
  rule.rule_type === 'system' || rule.rule_type === 'default' || rule.user_id === null;

// ── Semantic tint composites (documented 8% / 12% recipes) ──
const WARNING_TINT = 'rgba(234,179,8,0.12)'; // colors.warning @ 12%
const INFO_TINT = 'rgba(59,130,246,0.12)'; // colors.info @ 12%
const MUTED_TINT = 'rgba(148,163,184,0.12)'; // colors.textMuted @ 12%
const PRIMARY_TINT = 'rgba(168,85,247,0.12)'; // colors.primary2 @ 12%
const PRIMARY_BORDER = 'rgba(168,85,247,0.3)'; // colors.primary2 @ 30%
const ACCENT_TINT = 'rgba(192,132,252,0.12)'; // colors.accent @ 12%
const ACCENT_BORDER = 'rgba(192,132,252,0.3)'; // colors.accent @ 30%
const ERROR_TINT = 'rgba(239,68,68,0.08)'; // colors.error @ 8% (destructive recipe)

export default function CategoryRulesScreen() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState('');

  // Add modal state
  const [addModal, setAddModal] = useState(false);
  const [newRuleType, setNewRuleType] = useState<'merchant' | 'keyword'>('merchant');
  const [newMatchValue, setNewMatchValue] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  // Category picker state
  const [pickerVisible, setPickerVisible] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      setError(false);
      const user = await getCurrentUser();
      if (!user?.id) return;
      setUserId(user.id);
      const data = await api.get<CategoryRule[]>('/auth/category-rules');
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching rules:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRules();
    setRefreshing(false);
  }, [fetchRules]);

  // Group rules by type (keep filtering & memo shape — only rendering changes)
  const allGroups: RuleGroup[] = [
    {
      title: 'Merchant Rules',
      type: 'merchant',
      icon: 'storefront-outline',
      rules: rules.filter((r) => r.rule_type === 'merchant'),
    },
    {
      title: 'Keyword Rules',
      type: 'keyword',
      icon: 'text-outline',
      rules: rules.filter((r) => r.rule_type === 'keyword'),
    },
    {
      title: 'System Rules',
      type: 'system',
      icon: 'settings-outline',
      rules: rules.filter((r) => r.rule_type === 'system' || r.rule_type === 'default'),
    },
  ];
  const groupedRules = allGroups.filter((g) => g.rules.length > 0);

  // Derived hero breakdown counts (cheap)
  const autoCount = rules.filter((r) => r.auto_created && !isSystemRule(r)).length;
  const systemCount = rules.filter(isSystemRule).length;
  const manualCount = rules.length - autoCount - systemCount;

  const handleDeleteRule = (rule: CategoryRule) => {
    Alert.alert('Delete Rule', `Delete rule for "${rule.match_value}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/category-rules/${rule.id}`);
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
          } catch (err) {
            console.error('Failed to delete rule:', err);
            Alert.alert('Error', 'Failed to delete rule.');
          }
        },
      },
    ]);
  };

  const openAddModal = () => {
    setNewRuleType('merchant');
    setNewMatchValue('');
    setNewCategoryId('');
    setNewCategoryName('');
    setAddModal(true);
  };

  const handleCategorySelected = (cat: { id: string; name: string; parent_name?: string }) => {
    setNewCategoryId(cat.id);
    setNewCategoryName(cat.parent_name ? `${cat.parent_name} > ${cat.name}` : cat.name);
    setPickerVisible(false);
  };

  const handleSaveRule = async () => {
    if (!newMatchValue.trim()) {
      Alert.alert('Missing value', 'Please enter a match value.');
      return;
    }
    if (!newCategoryId) {
      Alert.alert('Missing category', 'Please select a target category.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<CategoryRule>('/auth/category-rules', {
        rule_type: newRuleType,
        match_value: newMatchValue.trim(),
        category_id: newCategoryId,
      });
      if (created) {
        setRules((prev) => [...prev, { ...created, category_name: newCategoryName }]);
      }
      setAddModal(false);
    } catch (err) {
      console.error('Failed to create rule:', err);
      Alert.alert('Error', 'Failed to create rule.');
    } finally {
      setSaving(false);
    }
  };

  // ── Status badge (icon + word + color, never color alone) ──
  const renderBadge = (rule: CategoryRule) => {
    const sys = isSystemRule(rule);
    if (sys) {
      return (
        <View style={[styles.badge, { backgroundColor: MUTED_TINT }]}>
          <Ionicons name="lock-closed-outline" size={11} color={colors.textMuted} />
          <Text style={[styles.badgeText, { color: colors.textMuted }]}>System</Text>
        </View>
      );
    }
    if (rule.auto_created) {
      return (
        <View style={[styles.badge, { backgroundColor: WARNING_TINT }]}>
          <Ionicons name="flash-outline" size={11} color={colors.warning} />
          <Text style={[styles.badgeText, { color: colors.warning }]}>Auto</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: INFO_TINT }]}>
        <Ionicons name="person-outline" size={11} color={colors.info} />
        <Text style={[styles.badgeText, { color: colors.info }]}>Manual</Text>
      </View>
    );
  };

  const renderRule = (rule: CategoryRule) => {
    const sys = isSystemRule(rule);
    const hasUsage = rule.usage_count != null && rule.usage_count > 0;
    const a11y =
      `${rule.match_value}, ${sys ? 'system' : rule.auto_created ? 'auto' : 'manual'} rule, ` +
      `categorizes as ${rule.category_name || 'unknown'}` +
      (hasUsage ? `, used ${rule.usage_count} times` : '');

    return (
      <View
        key={rule.id}
        style={[styles.ruleCard, sys && styles.ruleCardSystem]}
        accessible
        accessibilityLabel={a11y}
        accessibilityHint={sys ? 'System rule, read-only' : undefined}
      >
        <View style={styles.ruleContent}>
          <View style={styles.ruleTop}>
            <Text
              style={[styles.matchValue, sys && { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {rule.match_value}
            </Text>
            {renderBadge(rule)}
          </View>

          <View style={styles.ruleBottom}>
            <View style={styles.categoryTag}>
              <Ionicons name="arrow-forward" size={12} color={colors.primary2} />
              <Text style={styles.categoryName} numberOfLines={1}>
                {rule.category_name || 'Unknown'}
              </Text>
            </View>
            {hasUsage && <Text style={styles.usageText}>Used {rule.usage_count}x</Text>}
          </View>
        </View>

        {!sys && (
          <TouchableOpacity
            onPress={() => handleDeleteRule(rule)}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete rule for ${rule.match_value}`}
            accessibilityHint="Double tap to delete"
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderGroup = (group: RuleGroup) => (
    <View key={group.type} style={styles.groupSection}>
      <View
        style={styles.groupHeader}
        accessible
        accessibilityLabel={`${group.title}, ${group.rules.length} rules`}
      >
        <View style={styles.groupHeaderLeft}>
          <View style={styles.groupIconChip}>
            <Ionicons name={group.icon} size={16} color={colors.accent} />
          </View>
          <Text style={styles.groupTitle}>{group.title}</Text>
        </View>
        <View style={styles.groupCountBadge}>
          <Text style={styles.groupCountText}>{group.rules.length}</Text>
        </View>
      </View>
      <View style={styles.groupBody}>{group.rules.map(renderRule)}</View>
    </View>
  );

  // ── Hero summary chip ──
  const renderChip = (
    icon: keyof typeof Ionicons.glyphMap,
    count: number,
    word: string,
    tint: string,
    color: string,
  ) => (
    <View style={[styles.chip, { backgroundColor: tint }, count === 0 && styles.chipZero]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.chipText, { color }]}>
        {count} {word}
      </Text>
    </View>
  );

  const renderHero = () => {
    if (loading) {
      return (
        <View style={styles.hero}>
          <Skeleton width={64} height={14} />
          <Skeleton width={96} height={32} style={{ marginTop: spacing.sm }} />
          <Skeleton width="70%" height={14} style={{ marginTop: spacing.sm }} />
          <View style={styles.chipRow}>
            <Skeleton width={64} height={20} borderRadius={radius.sm} />
            <Skeleton width={64} height={20} borderRadius={radius.sm} />
            <Skeleton width={48} height={20} borderRadius={radius.sm} />
          </View>
        </View>
      );
    }
    return (
      <View
        style={styles.hero}
        accessible
        accessibilityLabel={`${rules.length} rules. ${autoCount} auto, ${manualCount} manual, ${systemCount} system.`}
      >
        <Text style={styles.heroOverline}>RULES</Text>
        <Text style={styles.heroCount}>{rules.length}</Text>
        <Text style={styles.heroCaption}>
          {rules.length === 1
            ? 'rule auto-categorizing your transactions'
            : 'rules auto-categorizing your transactions'}
        </Text>
        <View style={styles.chipRow}>
          {renderChip('flash-outline', autoCount, 'auto', WARNING_TINT, colors.warning)}
          {renderChip('person-outline', manualCount, 'manual', INFO_TINT, colors.info)}
          {renderChip('lock-closed-outline', systemCount, 'system', MUTED_TINT, colors.textMuted)}
        </View>
      </View>
    );
  };

  // ── Loading skeleton group ──
  const renderSkeletonGroup = (key: string) => (
    <View key={key} style={styles.groupSection}>
      <Skeleton width={140} height={16} style={{ marginBottom: spacing.md }} />
      <View style={styles.groupBody}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.ruleCard}>
            <View style={styles.ruleContent}>
              <View style={styles.ruleTop}>
                <Skeleton width="55%" height={16} />
                <Skeleton width={56} height={20} borderRadius={radius.sm} />
              </View>
              <Skeleton width="35%" height={12} style={{ marginTop: spacing.sm }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return (
        <>
          {renderHero()}
          {renderSkeletonGroup('sk1')}
          {renderSkeletonGroup('sk2')}
        </>
      );
    }

    if (error) {
      return (
        <ErrorState
          title="Couldn't load your rules"
          message="Check your connection and try again."
          onRetry={fetchRules}
        />
      );
    }

    if (!rules.length) {
      return (
        <EmptyState
          icon="git-branch-outline"
          title="No category rules yet"
          description="Add a rule to auto-categorize your transactions by merchant or word."
          actionLabel="Add first rule"
          onAction={openAddModal}
        />
      );
    }

    return (
      <>
        {renderHero()}
        <Text style={styles.description}>
          Rules assign categories to transactions automatically from merchant names or keywords.
        </Text>
        {groupedRules.map(renderGroup)}
        <TouchableOpacity
          style={styles.addRuleBtn}
          onPress={openAddModal}
          accessibilityRole="button"
          accessibilityLabel="Add category rule"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary2} />
          <Text style={styles.addRuleText}>Add Rule</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={commonStyles.flex1}>
        {/* Fixed header row (outside the scroll) */}
        <View style={styles.headerRow}>
          <BackButton fallback="/(tabs)/settings" color={colors.accent} size={20} />
          <Text style={styles.header}>Category Rules</Text>
          <TouchableOpacity
            onPress={openAddModal}
            style={styles.addHeaderBtn}
            accessibilityRole="button"
            accessibilityLabel="Add category rule"
          >
            <Ionicons name="add" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
          {renderBody()}
        </ScrollView>

        {/* Add Rule Sheet */}
        <Modal visible={addModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Rule</Text>
                <TouchableOpacity
                  onPress={() => setAddModal(false)}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Rule type segmented control */}
                <Text style={styles.fieldLabel}>RULE TYPE</Text>
                <View style={styles.typeToggleRow}>
                  {(['merchant', 'keyword'] as const).map((t) => {
                    const active = newRuleType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeToggle, active && styles.typeToggleActive]}
                        onPress={() => setNewRuleType(t)}
                      >
                        <Ionicons
                          name={t === 'merchant' ? 'storefront-outline' : 'text-outline'}
                          size={16}
                          color={active ? colors.accent : colors.textDark}
                        />
                        <Text
                          style={[
                            styles.typeToggleText,
                            active && styles.typeToggleTextActive,
                          ]}
                        >
                          {t === 'merchant' ? 'Merchant' : 'Keyword'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Match value */}
                <Text style={styles.fieldLabel}>
                  {newRuleType === 'merchant' ? 'MERCHANT NAME' : 'KEYWORD'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    newRuleType === 'merchant'
                      ? 'e.g., Whole Foods, Starbucks'
                      : 'e.g., grocery, subscription'
                  }
                  placeholderTextColor={colors.textDark}
                  value={newMatchValue}
                  onChangeText={setNewMatchValue}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <Text style={styles.inputHint}>
                  {newRuleType === 'merchant'
                    ? 'Matches merchant name (case-insensitive)'
                    : 'Matches if keyword appears anywhere in transaction description'}
                </Text>

                {/* Category picker */}
                <Text style={styles.fieldLabel}>TARGET CATEGORY</Text>
                <TouchableOpacity
                  style={styles.categorySelector}
                  onPress={() => setPickerVisible(true)}
                >
                  <Ionicons
                    name={newCategoryId ? 'pricetag' : 'pricetag-outline'}
                    size={16}
                    color={newCategoryId ? colors.primary2 : colors.textDark}
                  />
                  <Text
                    style={[
                      styles.categorySelectorText,
                      !newCategoryId && styles.categorySelectorPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {newCategoryName || 'Select category'}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textDark} />
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  onPress={handleSaveRule}
                  disabled={!newMatchValue.trim() || !newCategoryId || saving}
                  activeOpacity={0.85}
                  style={
                    (!newMatchValue.trim() || !newCategoryId || saving) && { opacity: 0.4 }
                  }
                >
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtn}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.saveBtnText}>Save Rule</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Category picker */}
        <CategoryPicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={handleCategorySelected}
          userId={userId}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    ...typography.h3,
    color: colors.text,
  },
  addHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: PRIMARY_TINT,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero summary */
  hero: {
    ...glassEffects.glassFloating,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  heroOverline: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroCount: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.xs,
  },
  heroCaption: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  chipZero: {
    opacity: 0.55,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },

  description: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },

  /* Group */
  groupSection: {
    marginBottom: spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupIconChip: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.sm,
    backgroundColor: ACCENT_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  groupCountBadge: {
    backgroundColor: colors.glassMedium,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  groupCountText: {
    ...typography.smallBold,
    color: colors.textMuted,
  },
  groupBody: {
    gap: spacing.sm,
  },

  /* Rule card */
  ruleCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  ruleCardSystem: {
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
    backgroundColor: 'transparent',
  },
  ruleContent: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  ruleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  matchValue: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  ruleBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  categoryName: {
    ...typography.smallBold,
    fontSize: 12,
    color: colors.primary2,
    flex: 1,
  },
  usageText: {
    ...typography.caption,
    color: colors.textDark,
    flexShrink: 0,
  },

  /* Badge */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },

  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: ERROR_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    flexShrink: 0,
  },

  /* Add rule footer button */
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: PRIMARY_TINT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    marginTop: spacing.sm,
  },
  addRuleText: {
    ...typography.bodyBold,
    color: colors.primary2,
  },

  /* Modal / sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.smallBold,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
  },
  typeToggleActive: {
    backgroundColor: ACCENT_TINT,
    borderColor: ACCENT_BORDER,
  },
  typeToggleText: {
    ...typography.smallBold,
    color: colors.textDark,
  },
  typeToggleTextActive: {
    color: colors.accent,
  },
  input: {
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  inputHint: {
    ...typography.caption,
    color: colors.textDark,
    marginTop: spacing.xs,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glassMedium,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  categorySelectorText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  categorySelectorPlaceholder: {
    color: colors.textDark,
  },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  saveBtnText: {
    ...typography.button,
    color: '#fff',
  },
});
