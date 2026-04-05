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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/storage';
import { api } from '../../utils/apiClient';
import { v4 as uuidv4 } from 'uuid';
import { router } from 'expo-router';

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

const PRESET_COLORS = [
  '#7c3aed', '#22c55e', '#ef4444', '#3b82f6', '#06b6d4',
  '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

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

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSystemCategory = (cat: Category) => cat.user_id === null || cat.user_id === undefined;

  // Open edit modal for a category
  const openEdit = (cat: Category, isSubcategory = false) => {
    if (isSystemCategory(cat)) {
      Alert.alert('System Category', 'System categories cannot be edited.');
      return;
    }
    setEditData({
      id: cat.id,
      name: cat.name,
      color: cat.color || '#7c3aed',
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
      color: '#7c3aed',
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
      color: '#7c3aed',
      icon: '',
      isNew: true,
      isSubcategory: true,
      parentId,
    });
    setEditModal(true);
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

  const getRuleCount = (catId: string): number => {
    let count = ruleCounts[catId] || 0;
    return count;
  };

  const getTotalRuleCount = (cat: Category): number => {
    let total = getRuleCount(cat.id);
    for (const sub of cat.subcategories || []) {
      total += getRuleCount(sub.id);
    }
    return total;
  };

  const renderParent = ({ item }: { item: Category }) => {
    const isExpanded = expandedIds.has(item.id);
    const hasSubs = (item.subcategories || []).length > 0;
    const iconColor = item.color || '#7c3aed';
    const subCount = (item.subcategories || []).length;
    const totalRules = getTotalRuleCount(item);
    const isSystem = isSystemCategory(item);

    return (
      <View style={styles.parentSection}>
        {/* Parent row */}
        <TouchableOpacity
          style={styles.parentRow}
          onPress={() => toggleExpand(item.id)}
          onLongPress={() => openEdit(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}22` }]}>
            <Ionicons name={resolveIcon(item.icon)} size={20} color={iconColor} />
          </View>
          <View style={styles.parentInfo}>
            <Text style={styles.parentName}>{item.name}</Text>
            <View style={styles.parentMeta}>
              {subCount > 0 && (
                <Text style={styles.metaText}>
                  {subCount} sub{subCount !== 1 ? 's' : ''}
                </Text>
              )}
              {totalRules > 0 && (
                <View style={styles.ruleBadge}>
                  <Ionicons name="git-branch-outline" size={10} color="#c084fc" />
                  <Text style={styles.ruleBadgeText}>{totalRules}</Text>
                </View>
              )}
              {isSystem && (
                <View style={styles.systemBadge}>
                  <Text style={styles.systemBadgeText}>System</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isSystem && (
              <TouchableOpacity
                onPress={() => handleDeleteParent(item)}
                style={styles.miniAction}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={14} color="#f87171" />
              </TouchableOpacity>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#64748b"
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
                  >
                    <View style={[styles.subIconCircle, { backgroundColor: `${subColor}18` }]}>
                      <Ionicons name={resolveIcon(sub.icon)} size={14} color={subColor} />
                    </View>
                    <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                    {subRules > 0 && (
                      <View style={styles.ruleBadgeSm}>
                        <Ionicons name="git-branch-outline" size={9} color="#c084fc" />
                        <Text style={styles.ruleBadgeTextSm}>{subRules}</Text>
                      </View>
                    )}
                    {subIsSystem && (
                      <View style={styles.systemBadgeSm}>
                        <Text style={styles.systemBadgeTextSm}>Sys</Text>
                      </View>
                    )}
                    {!subIsSystem && (
                      <TouchableOpacity
                        onPress={() => handleDeleteSubcategory(sub)}
                        style={styles.miniAction}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={13} color="#f87171" />
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
            >
              <Ionicons name="add" size={16} color="#a855f7" />
              <Text style={styles.addSubText}>Add Subcategory</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
          ListHeaderComponent={
            <>
              {/* Header */}
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => router.navigate('/(tabs)/settings' as any)}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={20} color="#c084fc" />
                </TouchableOpacity>
                <Text style={styles.header}>Categories</Text>
                <TouchableOpacity onPress={openAddParent} style={styles.addHeaderBtn}>
                  <Ionicons name="add" size={22} color="#c084fc" />
                </TouchableOpacity>
              </View>

              {/* Type toggle */}
              <View style={styles.toggleRow}>
                {(['expense', 'income'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toggle, type === t && styles.toggleActive]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons
                      name={t === 'expense' ? 'cart-outline' : 'cash-outline'}
                      size={16}
                      color={type === t ? '#c084fc' : '#64748b'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={type === t ? styles.toggleTextActive : styles.toggleText}>
                      {t === 'expense' ? 'Expenses' : 'Income'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>
                {filteredCategories.length} {type} categor{filteredCategories.length !== 1 ? 'ies' : 'y'}
              </Text>
              <Text style={styles.hint}>
                Tap to expand, long-press to edit
              </Text>
            </>
          }
          renderItem={renderParent}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.emptyText}>Loading categories...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={32} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>No {type} categories yet</Text>
              </View>
            )
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.addCategoryBtn} onPress={openAddParent}>
              <Ionicons name="add-circle-outline" size={20} color="#a855f7" />
              <Text style={styles.addCategoryText}>Add Category</Text>
            </TouchableOpacity>
          }
        />

        {/* Edit / Add Modal */}
        <Modal visible={editModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editData?.isNew
                    ? editData?.isSubcategory
                      ? 'Add Subcategory'
                      : 'Add Category'
                    : 'Edit Category'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditModal(false);
                    setEditData(null);
                  }}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color="#e5e7eb" />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Name */}
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Category name"
                  placeholderTextColor="#475569"
                  value={editData?.name ?? ''}
                  onChangeText={(v) =>
                    setEditData((prev) => (prev ? { ...prev, name: v } : prev))
                  }
                  autoFocus={editData?.isNew}
                />

                {/* Color */}
                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.colorGrid}>
                  {PRESET_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() =>
                        setEditData((prev) => (prev ? { ...prev, color } : prev))
                      }
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        editData?.color === color && styles.colorSwatchActive,
                      ]}
                    />
                  ))}
                </View>

                {/* Icon */}
                <Text style={styles.fieldLabel}>Icon</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.iconGrid}
                >
                  {AVAILABLE_ICONS.map((iconKey) => {
                    const iconName = ICON_MAP[iconKey];
                    const isSelected = editData?.icon === iconKey;
                    return (
                      <TouchableOpacity
                        key={iconKey}
                        onPress={() =>
                          setEditData((prev) => (prev ? { ...prev, icon: iconKey } : prev))
                        }
                        style={[
                          styles.iconOption,
                          isSelected && {
                            borderColor: editData?.color || '#a855f7',
                            backgroundColor: `${editData?.color || '#a855f7'}22`,
                          },
                        ]}
                      >
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={isSelected ? editData?.color || '#a855f7' : '#64748b'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Preview */}
                <View style={styles.previewSection}>
                  <Text style={styles.fieldLabel}>Preview</Text>
                  <View style={styles.previewRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: `${editData?.color || '#7c3aed'}22` },
                      ]}
                    >
                      <Ionicons
                        name={resolveIcon(editData?.icon)}
                        size={20}
                        color={editData?.color || '#7c3aed'}
                      />
                    </View>
                    <Text style={styles.previewName}>
                      {editData?.name || 'Category Name'}
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Save button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.saveBtn, editSaving && { opacity: 0.5 }]}
                  onPress={handleSaveEdit}
                  disabled={editSaving}
                >
                  {editSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editData?.isNew ? 'Create' : 'Save Changes'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },

  /* Toggle */
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleActive: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderColor: 'rgba(192,132,252,0.3)',
  },
  toggleText: { color: '#64748b', fontWeight: '700' },
  toggleTextActive: { color: '#c084fc', fontWeight: '800' },

  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 14,
  },

  /* Parent section */
  parentSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  parentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(192,132,252,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ruleBadgeText: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '700',
  },
  systemBadge: {
    backgroundColor: 'rgba(100,116,139,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  miniAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Subcategories */
  subsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
  },
  subRowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    paddingLeft: 56,
    gap: 10,
  },
  subIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
  },
  ruleBadgeSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(192,132,252,0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  ruleBadgeTextSm: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: '700',
  },
  systemBadgeSm: {
    backgroundColor: 'rgba(100,116,139,0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  systemBadgeTextSm: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
  },
  addSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(168,85,247,0.25)',
    backgroundColor: 'rgba(168,85,247,0.06)',
  },
  addSubText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Add category bottom button */
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    marginTop: 16,
  },
  addCategoryText: {
    color: '#a855f7',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0f0a1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#fff',
  },
  iconGrid: {
    gap: 8,
    paddingVertical: 4,
  },
  iconOption: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewSection: {
    marginTop: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
