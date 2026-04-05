import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { v4 as uuidv4 } from 'uuid';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Map backend icon names to Ionicons glyph names
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

function resolveIcon(iconName?: string): keyof typeof Ionicons.glyphMap {
  if (!iconName) return 'pricetag-outline';
  return ICON_MAP[iconName] ?? (iconName as keyof typeof Ionicons.glyphMap) ?? 'pricetag-outline';
}

type Category = {
  id: string;
  name: string;
  type?: string;
  color?: string;
  icon?: string;
  parent_id?: string | null;
  subcategories?: Category[];
};

type CategoryPickerProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (category: { id: string; name: string; parent_name?: string }) => void;
  type?: 'income' | 'expense';
  userId: string;
};

export default function CategoryPicker({
  visible,
  onClose,
  onSelect,
  type,
  userId,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setLoading(true);
    const fetchCategories = async () => {
      try {
        const params: Record<string, string> = { user_id: userId };
        if (type) params.type = type;
        const data = await api.get<Category[]>(`/auth/categories/user/${userId}`, params);
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch categories:', e);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [visible, userId, type]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const term = search.toLowerCase();
    return categories
      .map((parent) => {
        const parentMatch = parent.name.toLowerCase().includes(term);
        const matchingSubs = (parent.subcategories ?? []).filter((sub) =>
          sub.name.toLowerCase().includes(term)
        );
        if (parentMatch || matchingSubs.length > 0) {
          return {
            ...parent,
            subcategories: parentMatch ? parent.subcategories : matchingSubs,
          };
        }
        return null;
      })
      .filter(Boolean) as Category[];
  }, [categories, search]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectParent = (cat: Category) => {
    setSelectedId(cat.id);
    onSelect({ id: cat.id, name: cat.name });
  };

  const handleSelectSub = (sub: Category, parentName: string) => {
    setSelectedId(sub.id);
    onSelect({ id: sub.id, name: sub.name, parent_name: parentName });
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreating(true);
    try {
      const payload = {
        id: uuidv4(),
        name: newCategoryName.trim(),
        user_id: userId,
        type: type ?? 'expense',
        color: '#a855f7',
      };
      const created = await api.post<Category>('/auth/categories', payload);
      if (created) {
        setCategories((prev) => [...prev, created]);
        setSelectedId(created.id);
        onSelect({ id: created.id, name: created.name });
        setNewCategoryName('');
        setShowAddInput(false);
      }
    } catch (err) {
      console.error('Failed to create category:', err);
      Alert.alert('Error', 'Failed to create category.');
    } finally {
      setCreating(false);
    }
  };

  const renderParent = ({ item }: { item: Category }) => {
    const isExpanded = expandedIds.has(item.id) || search.trim().length > 0;
    const hasSubs = (item.subcategories ?? []).length > 0;
    const iconColor = item.color ?? '#a855f7';

    return (
      <View style={styles.parentSection}>
        <TouchableOpacity
          style={styles.parentRow}
          onPress={() => {
            if (hasSubs) {
              toggleExpand(item.id);
            } else {
              handleSelectParent(item);
            }
          }}
          onLongPress={() => handleSelectParent(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}22` }]}>
            <Ionicons name={resolveIcon(item.icon)} size={20} color={iconColor} />
          </View>
          <Text style={styles.parentName}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {selectedId === item.id && (
              <Ionicons name="checkmark-circle" size={22} color="#a855f7" />
            )}
            {hasSubs && (
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#94a3b8"
              />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && hasSubs && (
          <View style={styles.subsContainer}>
            {(item.subcategories ?? []).map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={styles.subRow}
                onPress={() => handleSelectSub(sub, item.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.subIconCircle, { backgroundColor: `${sub.color ?? iconColor}18` }]}>
                  <Ionicons
                    name={resolveIcon(sub.icon)}
                    size={16}
                    color={sub.color ?? iconColor}
                  />
                </View>
                <Text style={styles.subName}>{sub.name}</Text>
                {selectedId === sub.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#a855f7" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Category</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#e5e7eb" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            renderItem={renderParent}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open-outline" size={48} color="#475569" />
                <Text style={styles.emptyText}>
                  {search ? 'No matching categories' : 'No categories found'}
                </Text>
              </View>
            }
          />
        )}

        {/* Add Custom */}
        <View style={styles.addSection}>
          {showAddInput ? (
            <View style={styles.addInputRow}>
              <TextInput
                style={styles.addInput}
                placeholder="New category name..."
                placeholderTextColor="#64748b"
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAddCategory}
              />
              <TouchableOpacity
                style={styles.addConfirmBtn}
                onPress={handleAddCategory}
                disabled={creating || !newCategoryName.trim()}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addCancelBtn}
                onPress={() => {
                  setShowAddInput(false);
                  setNewCategoryName('');
                }}
              >
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addCustomBtn}
              onPress={() => setShowAddInput(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#a855f7" />
              <Text style={styles.addCustomText}>Add Custom Category</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0a1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
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
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
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
  parentName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
  addSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f0a1e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    paddingBottom: 36,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  addCustomText: {
    color: '#a855f7',
    fontSize: 15,
    fontWeight: '700',
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addConfirmBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
