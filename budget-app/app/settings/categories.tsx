import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/storage';
import { api } from '../../utils/apiClient';
import { v4 as uuidv4 } from 'uuid';
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
  glassEffects,
  gradients,
} from '@/utils/design-system';
import { CategoryTypeToggle } from '@/components/settings-categories-CategoryTypeToggle';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  restaurant: 'restaurant-outline',
  car: 'car-outline',
  film: 'film-outline',
  cart: 'cart-outline',
  fitness: 'fitness-outline',
  cash: 'cash-outline',
  shield: 'shield-outline',
  receipt: 'receipt-outline',
  person: 'person-outline',
  gift: 'gift-outline',
  school: 'school-outline',
  medical: 'medkit-outline',
  airplane: 'airplane-outline',
  game: 'game-controller-outline',
  music: 'musical-notes-outline',
  shirt: 'shirt-outline',
  phone: 'phone-portrait-outline',
  wifi: 'wifi-outline',
  water: 'water-outline',
  flash: 'flash-outline',
  paw: 'paw-outline',
  book: 'book-outline',
  briefcase: 'briefcase-outline',
  barbell: 'barbell-outline',
  bus: 'bus-outline',
  construct: 'construct-outline',
  trending: 'trending-up-outline',
};

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

function resolveIcon(iconName?: string): keyof typeof Ionicons.glyphMap {
  if (!iconName) return 'pricetag-outline';
  return ICON_MAP[iconName] ?? (iconName as keyof typeof Ionicons.glyphMap) ?? 'pricetag-outline';
}

// Category-picker swatches are user-selectable DATA values, not UI chrome, so
// they intentionally stay as literals. Indices 0–3 align with
// colors.primary / success / error / info for brand cohesion.
const PRESET_COLORS = [
  colors.primary, colors.success, colors.error, colors.info, '#06b6d4',
  '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

const DEFAULT_CATEGORY_COLOR = colors.primary;

type Category = {
  id: string;
  name: string;
  type?: string;
  color?: string;
  icon?: string;
  parent_id?: string | null;
  user_id?: string | null;
  subcategories?: Category[];
};

type RuleCount = Record<string, number>;

type EditData = {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_id?: string | null;
  isNew?: boolean;
  isSubcategory?: boolean;
  parentId?: string;
};

export default function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [ruleCounts, setRuleCounts] = useState<RuleCount>({});
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [userId, setUserId] = useState<string>('');

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState<EditData | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(false);
      const user = await getCurrentUser();
      if (!user?.id) return;
      setUserId(user.id);

      const [catData, rulesData] = await Promise.all([
        api.get<Category[]>(`/auth/categories/user/${user.id}`),
        api.get<any[]>('/auth/category-rules').catch(() => []),
      ]);

      const cats = Array.isArray(catData) ? catData : [];
      setCategories(cats);

      // Build rule counts per category_id
      const counts: RuleCount = {};
      if (Array.isArray(rulesData)) {
        for (const rule of rulesData) {
          const cid = rule.category_id;
          if (cid) {
            counts[cid] = (counts[cid] || 0) + 1;
          }
        }
      }
      setRuleCounts(counts);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const filteredCategories = categories.filter((cat) => cat.type === type);

  const isSystemCategory = (cat: Category) => cat.user_id === null || cat.user_id === undefined;

  // Custom vs System breakdown (parents + their subcategories) for this type
  const { customCount, systemCount } = filteredCategories.reduce(
    (acc, cat) => {
      const all = [cat, ...(cat.subcategories || [])];
      for (const c of all) {
        if (isSystemCategory(c)) acc.systemCount += 1;
        else acc.customCount += 1;
      }
      return acc;
    },
    { customCount: 0, systemCount: 0 },
  );
  const totalCount = customCount + systemCount;

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open edit modal for a category
  const openEdit = (cat: Category, isSubcategory = false) => {
    if (isSystemCategory(cat)) {
      Alert.alert('System Category', 'System categories cannot be edited.');
      return;
    }
    setEditData({
      id: cat.id,
      name: cat.name,
      color: cat.color || DEFAULT_CATEGORY_COLOR,
      icon: cat.icon || '',
      parent_id: cat.parent_id,
    });
    setEditModal(true);
  };

  // Open add new parent category
  const openAddParent = () => {
    setEditData({
      id: uuidv4(),
      name: '',
      color: DEFAULT_CATEGORY_COLOR,
      icon: 'pricetag',
      isNew: true,
    });
    setEditModal(true);
  };

  // Open add subcategory under a parent
  const openAddSubcategory = (parentId: string) => {
    setEditData({
      id: uuidv4(),
      name: '',
      color: DEFAULT_CATEGORY_COLOR,
      icon: '',
      isNew: true,
      isSubcategory: true,
      parentId,
    });
    setEditModal(true);
  };

  const closeModal = () => {
    setEditModal(false);
    setEditData(null);
  };

  const handleSaveEdit = async () => {
    if (!editData || !editData.name.trim()) {
      Alert.alert('Missing name', 'Please enter a category name.');
      return;
    }
    setEditSaving(true);
    try {
      if (editData.isNew) {
        const payload: any = {
          id: editData.id,
          name: editData.name.trim(),
          type,
          user_id: userId,
          color: editData.color,
          icon: editData.icon || undefined,
        };
        if (editData.isSubcategory && editData.parentId) {
          payload.parent_id = editData.parentId;
        }
        await api.post('/auth/categories', payload);
      } else {
        await api.put(`/auth/categories/${editData.id}`, {
          name: editData.name.trim(),
          color: editData.color,
          icon: editData.icon || undefined,
        });
      }
      setEditModal(false);
      setEditData(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to save category:', err);
      Alert.alert('Error', 'Failed to save category.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSubcategory = (cat: Category) => {
    if (isSystemCategory(cat)) {
      Alert.alert('System Category', 'System categories cannot be deleted.');
      return;
    }
    Alert.alert('Delete Subcategory', `Delete "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/categories/${cat.id}`);
            await fetchData();
          } catch (err) {
            console.error('Failed to delete:', err);
            Alert.alert('Error', 'Failed to delete subcategory.');
          }
        },
      },
    ]);
  };

  const handleDeleteParent = (cat: Category) => {
    if (isSystemCategory(cat)) {
      Alert.alert('System Category', 'System categories cannot be deleted.');
      return;
    }
    const subCount = (cat.subcategories || []).length;
    const msg = subCount > 0
      ? `Delete "${cat.name}" and its ${subCount} subcategor${subCount === 1 ? 'y' : 'ies'}?`
      : `Delete "${cat.name}"?`;

    Alert.alert('Delete Category', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/categories/${cat.id}`);
            await fetchData();
          } catch (err) {
            console.error('Failed to delete:', err);
            Alert.alert('Error', 'Failed to delete category.');
          }
        },
      },
    ]);
  };

  const getRuleCount = (catId: string): number => ruleCounts[catId] || 0;

  const getTotalRuleCount = (cat: Category): number => {
    let total = getRuleCount(cat.id);
    for (const sub of cat.subcategories || []) {
      total += getRuleCount(sub.id);
    }
    return total;
  };

  const HITSLOP = { top: 10, bottom: 10, left: 10, right: 10 };

  const renderParent = ({ item }: { item: Category }) => {
    const isExpanded = expandedIds.has(item.id);
    const iconColor = item.color || DEFAULT_CATEGORY_COLOR;
    const subCount = (item.subcategories || []).length;
    const totalRules = getTotalRuleCount(item);
    const isSystem = isSystemCategory(item);

    const a11yLabel =
      `${item.name}, ${subCount} subcategor${subCount === 1 ? 'y' : 'ies'}` +
      (totalRules > 0 ? `, ${totalRules} rule${totalRules === 1 ? '' : 's'}` : '') +
      (isSystem ? ', System, locked' : '');

    return (
      <View style={styles.parentSection}>
        {/* Parent row */}
        <TouchableOpacity
          style={styles.parentRow}
          onPress={() => toggleExpand(item.id)}
          onLongPress={() => openEdit(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint={
            isSystem
              ? 'Double-tap to expand, locked'
              : 'Double-tap to expand, long-press to edit'
          }
        >
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}1F` }]}>
            <Ionicons name={resolveIcon(item.icon)} size={20} color={iconColor} />
          </View>
          <View style={styles.parentInfo}>
            <Text style={styles.parentName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.parentMeta}>
              <Text style={styles.metaText}>
                {subCount} sub{subCount !== 1 ? 's' : ''}
              </Text>
              {totalRules > 0 && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <View style={styles.ruleBadge}>
                    <Ionicons name="git-branch-outline" size={11} color={colors.accent} />
                    <Text style={styles.ruleBadgeText}>{totalRules}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
          <View style={styles.rightCluster}>
            {isSystem ? (
              <View style={styles.systemBadge}>
                <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                <Text style={styles.systemBadgeText}>System</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleDeleteParent(item)}
                style={styles.miniAction}
                hitSlop={HITSLOP}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.name}`}
              >
                <Ionicons name="trash-outline" size={15} color={colors.error} />
              </TouchableOpacity>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {/* Subcategories */}
        {isExpanded && (
          <View style={styles.subsContainer}>
            {(item.subcategories || []).map((sub) => {
              const subColor = sub.color || iconColor;
              const subRules = getRuleCount(sub.id);
              const subIsSystem = isSystemCategory(sub);

              return (
                <View key={sub.id} style={styles.subRowWrapper}>
                  <TouchableOpacity
                    style={styles.subRow}
                    onPress={() => openEdit(sub, true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={
                      `${sub.name}` +
                      (subRules > 0 ? `, ${subRules} rule${subRules === 1 ? '' : 's'}` : '') +
                      (subIsSystem ? ', System' : '')
                    }
                  >
                    <View style={[styles.subIconCircle, { backgroundColor: `${subColor}1F` }]}>
                      <Ionicons name={resolveIcon(sub.icon)} size={14} color={subColor} />
                    </View>
                    <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                    {subRules > 0 && (
                      <View style={styles.ruleBadgeSm}>
                        <Ionicons name="git-branch-outline" size={10} color={colors.accent} />
                        <Text style={styles.ruleBadgeTextSm}>{subRules}</Text>
                      </View>
                    )}
                    {subIsSystem ? (
                      <View style={styles.systemBadgeSm}>
                        <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                        <Text style={styles.systemBadgeTextSm}>System</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleDeleteSubcategory(sub)}
                        style={styles.miniAction}
                        hitSlop={HITSLOP}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${sub.name}`}
                      >
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add subcategory button */}
            <TouchableOpacity
              style={styles.addSubBtn}
              onPress={() => openAddSubcategory(item.id)}
              accessibilityRole="button"
              accessibilityLabel="Add subcategory"
            >
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={styles.addSubText}>Add subcategory</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderCountCard = () => (
    <View style={styles.countCard}>
      <Text style={styles.countBig}>{totalCount}</Text>
      <Text style={styles.countLabel}>
        {type} categor{totalCount === 1 ? 'y' : 'ies'}
      </Text>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <Ionicons name="create-outline" size={13} color={colors.accent} />
          <Text style={styles.breakdownCustom}>{customCount} custom</Text>
        </View>
        <Text style={styles.breakdownDot}>·</Text>
        <View style={styles.breakdownItem}>
          <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          <Text style={styles.breakdownSystem}>{systemCount} system</Text>
        </View>
      </View>
      <Text style={styles.affordanceHint}>Tap a category to expand · long-press to edit</Text>
    </View>
  );

  const renderSkeleton = () => (
    <View>
      <Skeleton height={44} borderRadius={radius.full} style={{ marginBottom: spacing.lg }} />
      {/* Headline card skeleton */}
      <View style={[styles.countCard, { marginBottom: spacing.lg }]}>
        <Skeleton width={64} height={30} borderRadius={radius.sm} style={{ marginBottom: spacing.sm }} />
        <Skeleton width={150} height={14} style={{ marginBottom: spacing.md }} />
        <Skeleton width={200} height={12} />
      </View>
      {/* Parent-row skeletons */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.parentSection, styles.skeletonRow]}>
          <Skeleton width={40} height={40} borderRadius={radius.md} />
          <View style={styles.skeletonRowText}>
            <Skeleton width="55%" height={15} style={{ marginBottom: spacing.sm }} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={18} height={18} borderRadius={radius.sm} />
        </View>
      ))}
    </View>
  );

  const renderListHeader = () => (
    <View>
      <View style={styles.toggleWrap}>
        <CategoryTypeToggle value={type} onChange={setType} />
      </View>
      {!loading && !error && filteredCategories.length > 0 && renderCountCard()}
    </View>
  );

  const renderBody = () => {
    if (loading) {
      return <View style={styles.container}>{renderSkeleton()}</View>;
    }

    return (
      <FlatList
        data={error ? [] : filteredCategories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary2}
            colors={[colors.primary2]}
          />
        }
        ListHeaderComponent={renderListHeader}
        renderItem={renderParent}
        ListEmptyComponent={
          error ? (
            <ErrorState
              title="Couldn't load categories"
              message="Check your connection and try again."
              retryLabel="Try Again"
              onRetry={fetchData}
            />
          ) : (
            <EmptyState
              icon="folder-open-outline"
              title={`No ${type} categories yet`}
              description={
                type === 'income'
                  ? 'Add one to start tagging money coming in.'
                  : 'Add one to start organizing your spending.'
              }
              actionLabel="Add Category"
              onAction={openAddParent}
            />
          )
        }
        ListFooterComponent={
          !error && filteredCategories.length > 0 ? (
            <TouchableOpacity
              style={styles.addCategoryBtn}
              onPress={openAddParent}
              accessibilityRole="button"
              accessibilityLabel="Add category"
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
              <Text style={styles.addCategoryText}>Add Category</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  };

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Fixed header (outside scroll) */}
        <View style={styles.headerRow}>
          <BackButton fallback="/(tabs)/settings" color={colors.accent} size={20} />
          <Text style={styles.header}>Categories</Text>
          <TouchableOpacity
            onPress={openAddParent}
            style={styles.addHeaderBtn}
            hitSlop={HITSLOP}
            accessibilityRole="button"
            accessibilityLabel="Add category"
          >
            <Ionicons name="add" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {renderBody()}

        {/* Add / Edit form sheet */}
        <Modal visible={editModal} animationType="slide" transparent onRequestClose={closeModal}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContainer} accessibilityViewIsModal accessibilityRole="none">
              <View style={styles.grabber} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editData?.isNew
                    ? editData?.isSubcategory
                      ? 'Add Subcategory'
                      : 'Add Category'
                    : 'Edit Category'}
                </Text>
                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.closeBtn}
                  hitSlop={HITSLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Name */}
                <Text style={styles.fieldLabel}>NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Category name"
                  placeholderTextColor={colors.textMuted}
                  value={editData?.name ?? ''}
                  onChangeText={(v) =>
                    setEditData((prev) => (prev ? { ...prev, name: v } : prev))
                  }
                  autoFocus={editData?.isNew}
                />

                {/* Color */}
                <Text style={styles.fieldLabel}>COLOR</Text>
                <View style={styles.colorGrid}>
                  {PRESET_COLORS.map((color) => {
                    const selected = editData?.color === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        onPress={() =>
                          setEditData((prev) => (prev ? { ...prev, color } : prev))
                        }
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color },
                          selected && styles.colorSwatchActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${color} color`}
                        accessibilityState={{ selected }}
                      />
                    );
                  })}
                </View>

                {/* Icon */}
                <Text style={styles.fieldLabel}>ICON</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.iconGrid}
                >
                  {AVAILABLE_ICONS.map((iconKey) => {
                    const iconName = ICON_MAP[iconKey];
                    const isSelected = editData?.icon === iconKey;
                    const activeColor = editData?.color || DEFAULT_CATEGORY_COLOR;
                    return (
                      <TouchableOpacity
                        key={iconKey}
                        onPress={() =>
                          setEditData((prev) => (prev ? { ...prev, icon: iconKey } : prev))
                        }
                        style={[
                          styles.iconOption,
                          isSelected && {
                            borderColor: activeColor,
                            backgroundColor: `${activeColor}1F`,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={isSelected ? activeColor : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Preview */}
                <Text style={styles.fieldLabel}>PREVIEW</Text>
                <View style={styles.previewRow}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: `${editData?.color || DEFAULT_CATEGORY_COLOR}1F` },
                    ]}
                  >
                    <Ionicons
                      name={resolveIcon(editData?.icon)}
                      size={20}
                      color={editData?.color || DEFAULT_CATEGORY_COLOR}
                    />
                  </View>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {editData?.name || 'Category Name'}
                  </Text>
                </View>
              </ScrollView>

              {/* Save button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={editSaving}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={editData?.isNew ? 'Create' : 'Save changes'}
                >
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.saveBtn, editSaving && { opacity: 0.6 }]}
                  >
                    {editSaving ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {editData?.isNew ? 'Create' : 'Save Changes'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  header: { ...typography.h3, color: colors.text },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1F`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },

  /* Toggle */
  toggleWrap: { marginBottom: spacing.lg },

  /* Headline count card */
  countCard: {
    ...glassEffects.glassFloating,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  countBig: { ...typography.h2, color: colors.text },
  countLabel: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakdownCustom: { ...typography.smallBold, color: colors.text },
  breakdownSystem: { ...typography.small, color: colors.textMuted },
  breakdownDot: { color: colors.textDark, fontSize: 14 },
  affordanceHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  /* Parent section */
  parentSection: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  skeletonRowText: { flex: 1 },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentInfo: { flex: 1 },
  parentName: { ...typography.bodyBold, color: colors.text },
  parentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  metaText: { ...typography.caption, color: colors.textMuted },
  metaDot: { color: colors.textDark, fontSize: 12 },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.primary2}1F`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ruleBadgeText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  systemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.glassMedium,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  systemBadgeText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  miniAction: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Subcategories */
  subsContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: spacing.xs,
  },
  subRowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingRight: spacing.lg,
    paddingLeft: spacing.xxl + spacing.xl,
    gap: spacing.md,
  },
  subIconCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subName: { ...typography.small, color: colors.text, flex: 1 },
  ruleBadgeSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: `${colors.primary2}1F`,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  ruleBadgeTextSm: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  systemBadgeSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.glassMedium,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  systemBadgeTextSm: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
    backgroundColor: `${colors.primary2}14`,
  },
  addSubText: { ...typography.smallBold, color: colors.accent },

  /* Add category bottom button */
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.primary2}1F`,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    marginTop: spacing.lg,
  },
  addCategoryText: { ...typography.smallBold, color: colors.accent },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.glassStrong,
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  closeBtn: {
    width: 40,
    height: 40,
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
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: colors.text,
  },
  iconGrid: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderGlass,
  },
  previewRow: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  previewName: { ...typography.bodyBold, color: colors.text, flex: 1 },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  saveBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { ...typography.button, color: colors.text, fontWeight: '700' },
});
