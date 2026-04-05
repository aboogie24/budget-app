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
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser } from '../../utils/storage';
import { api } from '../../utils/apiClient';
import { router } from 'expo-router';
import CategoryPicker from '../../components/CategoryPicker';

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

export default function CategoryRulesScreen() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
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
      const user = await getCurrentUser();
      if (!user?.id) return;
      setUserId(user.id);
      const data = await api.get<CategoryRule[]>('/auth/category-rules');
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching rules:', err);
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

  // Group rules by type
  const groupedRules: RuleGroup[] = [
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
  ].filter((g) => g.rules.length > 0);

  const isSystemRule = (rule: CategoryRule) =>
    rule.rule_type === 'system' || rule.rule_type === 'default' || rule.user_id === null;

  const handleDeleteRule = (rule: CategoryRule) => {
    if (isSystemRule(rule)) {
      Alert.alert('System Rule', 'System rules cannot be deleted.');
      return;
    }
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

  const renderRule = (rule: CategoryRule) => {
    const isAuto = rule.auto_created;
    const isSys = isSystemRule(rule);

    return (
      <View key={rule.id} style={styles.ruleCard}>
        <View style={styles.ruleContent}>
          <View style={styles.ruleTop}>
            <Text style={styles.matchValue} numberOfLines={1}>
              {rule.match_value}
            </Text>
            <View style={styles.badges}>
              {isAuto && (
                <View style={styles.autoBadge}>
                  <Ionicons name="flash-outline" size={10} color="#eab308" />
                  <Text style={styles.autoBadgeText}>Auto</Text>
                </View>
              )}
              {!isAuto && !isSys && (
                <View style={styles.manualBadge}>
                  <Ionicons name="person-outline" size={10} color="#3b82f6" />
                  <Text style={styles.manualBadgeText}>Manual</Text>
                </View>
              )}
              {isSys && (
                <View style={styles.systemBadge}>
                  <Text style={styles.systemBadgeText}>System</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.ruleBottom}>
            <View style={styles.categoryTag}>
              <Ionicons name="arrow-forward" size={12} color="#a855f7" />
              <Text style={styles.categoryName} numberOfLines={1}>
                {rule.category_name || 'Unknown'}
              </Text>
            </View>
            {rule.usage_count != null && rule.usage_count > 0 && (
              <Text style={styles.usageText}>
                Used {rule.usage_count}x
              </Text>
            )}
          </View>
        </View>

        {!isSys && (
          <TouchableOpacity
            onPress={() => handleDeleteRule(rule)}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#f87171" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderGroup = ({ item }: { item: RuleGroup }) => (
    <View style={styles.groupSection}>
      <View style={styles.groupHeader}>
        <View style={styles.groupHeaderLeft}>
          <View style={styles.groupIconCircle}>
            <Ionicons name={item.icon} size={16} color="#c084fc" />
          </View>
          <Text style={styles.groupTitle}>{item.title}</Text>
        </View>
        <View style={styles.groupCountBadge}>
          <Text style={styles.groupCountText}>{item.rules.length}</Text>
        </View>
      </View>
      {item.rules.map(renderRule)}
    </View>
  );

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          data={groupedRules}
          keyExtractor={(item) => item.type}
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
              <View style={styles.headerRow}>
                <TouchableOpacity
                  onPress={() => router.navigate('/(tabs)/settings' as any)}
                  style={styles.backBtn}
                >
                  <Ionicons name="arrow-back" size={20} color="#c084fc" />
                </TouchableOpacity>
                <Text style={styles.header}>Category Rules</Text>
                <TouchableOpacity onPress={openAddModal} style={styles.addHeaderBtn}>
                  <Ionicons name="add" size={22} color="#c084fc" />
                </TouchableOpacity>
              </View>

              <Text style={styles.description}>
                Rules automatically assign categories to transactions based on merchant names or keywords.
              </Text>

              <Text style={styles.sectionLabel}>
                {rules.length} rule{rules.length !== 1 ? 's' : ''} total
              </Text>
            </>
          }
          renderItem={renderGroup}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={styles.emptyText}>Loading rules...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="git-branch-outline" size={36} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>No category rules yet</Text>
                <Text style={styles.emptyHint}>
                  Add rules to auto-categorize transactions
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            !loading ? (
              <TouchableOpacity style={styles.addRuleBtn} onPress={openAddModal}>
                <Ionicons name="add-circle-outline" size={20} color="#a855f7" />
                <Text style={styles.addRuleText}>Add Rule</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {/* Add Rule Modal */}
        <Modal visible={addModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Rule</Text>
                <TouchableOpacity
                  onPress={() => setAddModal(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={22} color="#e5e7eb" />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Rule type picker */}
                <Text style={styles.fieldLabel}>Rule Type</Text>
                <View style={styles.typeToggleRow}>
                  {(['merchant', 'keyword'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeToggle, newRuleType === t && styles.typeToggleActive]}
                      onPress={() => setNewRuleType(t)}
                    >
                      <Ionicons
                        name={t === 'merchant' ? 'storefront-outline' : 'text-outline'}
                        size={16}
                        color={newRuleType === t ? '#c084fc' : '#64748b'}
                      />
                      <Text
                        style={newRuleType === t ? styles.typeToggleTextActive : styles.typeToggleText}
                      >
                        {t === 'merchant' ? 'Merchant' : 'Keyword'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Match value */}
                <Text style={styles.fieldLabel}>
                  {newRuleType === 'merchant' ? 'Merchant Name' : 'Keyword'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={
                    newRuleType === 'merchant'
                      ? 'e.g., Whole Foods, Starbucks'
                      : 'e.g., grocery, subscription'
                  }
                  placeholderTextColor="#475569"
                  value={newMatchValue}
                  onChangeText={setNewMatchValue}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <Text style={styles.inputHint}>
                  {newRuleType === 'merchant'
                    ? 'Matches transaction merchant name (case-insensitive)'
                    : 'Matches if keyword appears anywhere in transaction description'}
                </Text>

                {/* Category picker */}
                <Text style={styles.fieldLabel}>Target Category</Text>
                <TouchableOpacity
                  style={styles.categorySelector}
                  onPress={() => setPickerVisible(true)}
                >
                  <Ionicons
                    name={newCategoryId ? 'pricetag' : 'pricetag-outline'}
                    size={16}
                    color={newCategoryId ? '#a855f7' : '#64748b'}
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
                  <Ionicons name="chevron-forward" size={14} color="#64748b" />
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    (!newMatchValue.trim() || !newCategoryId || saving) && { opacity: 0.4 },
                  ]}
                  onPress={handleSaveRule}
                  disabled={!newMatchValue.trim() || !newCategoryId || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>Save Rule</Text>
                    </>
                  )}
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
    marginBottom: 12,
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
  description: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
  },

  /* Group */
  groupSection: {
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  groupCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  groupCountText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Rule card */
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 8,
  },
  ruleContent: {
    flex: 1,
    gap: 6,
  },
  ruleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  matchValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(234,179,8,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoBadgeText: {
    color: '#eab308',
    fontSize: 10,
    fontWeight: '700',
  },
  manualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  manualBadgeText: {
    color: '#3b82f6',
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
  ruleBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  categoryName: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  usageText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  /* Add rule button */
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    marginTop: 8,
  },
  addRuleText: {
    color: '#a855f7',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Empty */
  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: '600' },
  emptyHint: { color: '#475569', fontSize: 12 },

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
    maxHeight: '80%',
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
  },
  fieldLabel: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 14,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeToggleActive: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderColor: 'rgba(192,132,252,0.3)',
  },
  typeToggleText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 14,
  },
  typeToggleTextActive: {
    color: '#c084fc',
    fontWeight: '800',
    fontSize: 14,
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
  inputHint: {
    color: '#475569',
    fontSize: 11,
    marginTop: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categorySelectorText: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  categorySelectorPlaceholder: {
    color: '#64748b',
    fontWeight: '500',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
