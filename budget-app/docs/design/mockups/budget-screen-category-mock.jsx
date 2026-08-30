/**
 * BUDGET SCREEN REDESIGN — Category-Based Budgeting Mock
 * ═══════════════════════════════════════════════════════
 *
 * KEY CHANGES from current budget.tsx:
 * ─────────────────────────────────────
 * 1. Categories ARE the budget — no separate "budget" entity.
 *    Each category row shows its icon, name, budget amount, and spending progress.
 *
 * 2. Inline budget editing — tap the amount to edit it right on the row.
 *    No separate "add budget" flow needed for existing categories.
 *
 * 3. Add/Delete categories — users can add new categories or delete existing ones
 *    directly from the budget screen (reuses the edit modal from categories settings).
 *
 * 4. Parent/subcategory grouping — parent categories are expandable sections.
 *    Budget amounts can be set on parents OR individual subcategories.
 *
 * 5. Unbudgeted section — categories with no budget amount are shown separately
 *    so users know what still needs a budget.
 *
 * WHAT STAYS THE SAME:
 * ─────────────────────
 * - Monthly overview hero card (income/budgeted/remaining)
 * - Month switcher navigation
 * - Glassmorphic dark theme + purple accents
 * - Progress rings and bars
 * - AI nudges / alerts
 * - Shared/joint budget support
 * - Bills section
 *
 * This is a MOCK for review — not wired to API yet.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Dimensions,
  Platform,
  Modal,
  RefreshControl,
  Alert,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { checkBudgetThresholds } from '@/utils/api';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { ProgressRing } from '@/components/ProgressRing';
import UnverifiedTransactionsBanner from '@/components/UnverifiedTransactionsBanner';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─── Icon Map (shared with categories settings) ─── */
const ICON_MAP = {
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

const PRESET_COLORS = [
  '#7c3aed', '#22c55e', '#ef4444', '#3b82f6', '#06b6d4',
  '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

const AVAILABLE_ICONS = Object.keys(ICON_MAP);

function resolveIcon(iconName) {
  if (!iconName) return 'pricetag-outline';
  return ICON_MAP[iconName] ?? iconName ?? 'pricetag-outline';
}

/* ─── Types ─── */
// CategoryBudget = a category with an optional budget amount + spending data
// This merges category data with budget data into one unified object.
//
// type CategoryBudget = {
//   id: string;
//   name: string;
//   color: string;
//   icon?: string;
//   type: 'expense' | 'income';
//   parent_id?: string | null;
//   user_id?: string | null;
//   budget_amount: number | null;    // null = unbudgeted
//   spent: number;
//   transaction_count: number;
//   has_unverified: boolean;
//   unverified_count: number;
//   subcategories: CategoryBudget[];
// };

/* ─── Helpers ─── */
const fmt = (n) =>
  '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtShort = (n) => {
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
};

/* ─── Progress Bar ─── */
const ProgressBar = ({ percent, color = '#34d399', height = 4 }) => (
  <View style={{ height, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: height / 2, overflow: 'hidden' }}>
    <View style={{ height: '100%', width: `${Math.min(Math.max(percent, 0), 100)}%`, backgroundColor: color, borderRadius: height / 2 }} />
  </View>
);

/* ═══════════════════════════════════════════════════════
   CATEGORY BUDGET ROW — The core new component
   ═══════════════════════════════════════════════════════
   Each category is a row showing:
   - Icon (colored circle)
   - Category name
   - Budget amount (tappable to edit inline)
   - Spent amount + progress bar
   - Delete button (swipe or long-press)
*/
const CategoryBudgetRow = ({
  category,
  onSetBudget,
  onDelete,
  isSubcategory = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const hasBudget = category.budget_amount != null && category.budget_amount > 0;
  const spent = category.spent || 0;
  const budgeted = category.budget_amount || 0;
  const pct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
  const overBudget = spent > budgeted && hasBudget;
  const isSystem = !category.user_id;
  const iconColor = category.color || '#7c3aed';

  const progressColor = overBudget
    ? '#ef4444'
    : pct > 80
      ? '#f59e0b'
      : '#22c55e';

  const handleStartEdit = () => {
    setEditValue(hasBudget ? String(budgeted) : '');
    setEditing(true);
  };

  const handleSaveEdit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      onSetBudget(category.id, val);
    }
    setEditing(false);
  };

  const handleClearBudget = () => {
    onSetBudget(category.id, null);
    setEditing(false);
  };

  return (
    <View style={[
      styles.categoryRow,
      isSubcategory && styles.subcategoryRow,
      overBudget && { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.04)' },
    ]}>
      {/* Left: Icon + Name */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, minWidth: 0 }}>
        <View style={[
          isSubcategory ? styles.subIconCircle : styles.iconCircle,
          { backgroundColor: `${iconColor}22` },
        ]}>
          <Ionicons
            name={resolveIcon(category.icon)}
            size={isSubcategory ? 14 : 18}
            color={iconColor}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[styles.categoryName, isSubcategory && styles.subcategoryName]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
            {overBudget && (
              <View style={[styles.chipBadge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="warning-outline" size={9} color="#ef4444" />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#ef4444', marginLeft: 2 }}>Over</Text>
              </View>
            )}
            {(category.unverified_count || 0) > 0 && (
              <View style={[styles.chipBadge, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
                <Ionicons name="alert-circle" size={9} color="#fbbf24" />
                <Text style={{ fontSize: 9, color: '#fbbf24', marginLeft: 2 }}>{category.unverified_count}</Text>
              </View>
            )}
          </View>

          {/* Spending info */}
          {hasBudget ? (
            <View style={{ marginTop: 4 }}>
              <ProgressBar percent={pct} color={progressColor} height={3} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                <Text style={styles.spentText}>{fmt(spent)} spent</Text>
                <Text style={[styles.spentText, overBudget && { color: '#ef4444' }]}>
                  {overBudget ? `${fmt(spent - budgeted)} over` : `${fmt(budgeted - spent)} left`}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noBudgetHint}>
              {spent > 0 ? `${fmt(spent)} spent · No budget set` : 'Tap amount to set budget'}
            </Text>
          )}
        </View>
      </View>

      {/* Right: Budget Amount (tappable) + Delete */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {editing ? (
          <View style={styles.inlineEditContainer}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.inlineEditInput}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              autoFocus
              placeholder="0"
              placeholderTextColor="#475569"
              onBlur={handleSaveEdit}
              onSubmitEditing={handleSaveEdit}
              selectTextOnFocus
            />
            {hasBudget && (
              <TouchableOpacity onPress={handleClearBudget} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity onPress={handleStartEdit} style={styles.budgetAmountBtn}>
            <Text style={[
              styles.budgetAmountText,
              !hasBudget && styles.budgetAmountPlaceholder,
            ]}>
              {hasBudget ? fmt(budgeted) : '+ Set'}
            </Text>
          </TouchableOpacity>
        )}

        {!isSystem && (
          <TouchableOpacity
            onPress={() => onDelete(category)}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color="#f87171" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/* ═══════════════════════════════════════════════════════
   CATEGORY GROUP — Parent category with expandable subs
   ═══════════════════════════════════════════════════════ */
const CategoryGroup = ({
  category,
  onSetBudget,
  onDelete,
  onAddSubcategory,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasSubs = (category.subcategories || []).length > 0;
  const iconColor = category.color || '#7c3aed';

  // Aggregate budget and spending from subcategories
  const totalBudgeted = (category.subcategories || []).reduce(
    (sum, sub) => sum + (sub.budget_amount || 0), 0
  ) + (category.budget_amount || 0);

  const totalSpent = (category.subcategories || []).reduce(
    (sum, sub) => sum + (sub.spent || 0), 0
  ) + (category.spent || 0);

  const pct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  return (
    <View style={styles.categoryGroup}>
      {/* Parent row — tappable to expand */}
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded(!expanded);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={resolveIcon(category.icon)} size={18} color={iconColor} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
            {hasSubs && (
              <Text style={styles.subCount}>
                {category.subcategories.length} sub{category.subcategories.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {totalBudgeted > 0 && (
            <View style={{ marginTop: 4 }}>
              <ProgressBar
                percent={pct}
                color={pct > 80 ? (pct > 100 ? '#ef4444' : '#f59e0b') : '#22c55e'}
                height={3}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                <Text style={styles.spentText}>{fmt(totalSpent)} spent</Text>
                <Text style={styles.spentText}>{fmt(totalBudgeted)} budgeted</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.groupTotal, totalBudgeted === 0 && { color: '#475569' }]}>
            {totalBudgeted > 0 ? fmt(totalBudgeted) : '—'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="rgba(255,255,255,0.35)"
          />
        </View>
      </TouchableOpacity>

      {/* Expanded: show parent budget row + subcategory rows */}
      {expanded && (
        <View style={styles.groupBody}>
          {/* If parent has no subcategories, show its own budget row */}
          {!hasSubs && (
            <CategoryBudgetRow
              category={category}
              onSetBudget={onSetBudget}
              onDelete={onDelete}
            />
          )}

          {/* Subcategory rows */}
          {(category.subcategories || []).map((sub) => (
            <CategoryBudgetRow
              key={sub.id}
              category={sub}
              onSetBudget={onSetBudget}
              onDelete={onDelete}
              isSubcategory
            />
          ))}

          {/* Add subcategory button */}
          <TouchableOpacity
            style={styles.addSubBtn}
            onPress={() => onAddSubcategory(category.id)}
          >
            <Ionicons name="add" size={14} color="#a855f7" />
            <Text style={styles.addSubText}>Add Subcategory</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ═══════════════════════════════════════════════════════
   ADD CATEGORY MODAL
   ═══════════════════════════════════════════════════════ */
const AddCategoryModal = ({ visible, onClose, onSave, type, parentId = null }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [icon, setIcon] = useState('pricetag');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a category name.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: uuidv4(),
        name: name.trim(),
        type,
        color,
        icon,
        parent_id: parentId,
        budget_amount: budgetAmount ? parseFloat(budgetAmount) : null,
      });
      // Reset
      setName('');
      setColor('#7c3aed');
      setIcon('pricetag');
      setBudgetAmount('');
      onClose();
    } catch (err) {
      Alert.alert('Error', 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {parentId ? 'Add Subcategory' : 'Add Category'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#e5e7eb" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category name"
              placeholderTextColor="#475569"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            {/* Budget Amount — new! Set budget right when creating */}
            <Text style={styles.fieldLabel}>
              Monthly Budget <Text style={{ color: '#64748b', fontWeight: '400' }}>(optional)</Text>
            </Text>
            <View style={styles.budgetInputRow}>
              <Text style={styles.dollarPrefix}>$</Text>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                placeholder="0.00"
                placeholderTextColor="#475569"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="numeric"
              />
            </View>

            {/* Color */}
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
                />
              ))}
            </View>

            {/* Icon */}
            <Text style={styles.fieldLabel}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconGrid}>
              {AVAILABLE_ICONS.map((iconKey) => {
                const iconName = ICON_MAP[iconKey];
                const isSelected = icon === iconKey;
                return (
                  <TouchableOpacity
                    key={iconKey}
                    onPress={() => setIcon(iconKey)}
                    style={[
                      styles.iconOption,
                      isSelected && { borderColor: color, backgroundColor: `${color}22` },
                    ]}
                  >
                    <Ionicons name={iconName} size={20} color={isSelected ? color : '#64748b'} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Preview */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Preview</Text>
              <View style={styles.previewRow}>
                <View style={[styles.iconCircle, { backgroundColor: `${color}22` }]}>
                  <Ionicons name={resolveIcon(icon)} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{name || 'Category Name'}</Text>
                  {budgetAmount ? (
                    <Text style={styles.previewBudget}>${parseFloat(budgetAmount || '0').toFixed(2)} / month</Text>
                  ) : (
                    <Text style={[styles.previewBudget, { color: '#475569' }]}>No budget set</Text>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Save */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Create Category</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════ */
export default function BudgetScreen() {
  const router = useRouter();

  // ─── State ───
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [bills, setBills] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [type, setType] = useState('expense'); // expense | income
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  // Modal state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addParentId, setAddParentId] = useState(null);

  // Section toggles
  const [budgetedExpanded, setBudgetedExpanded] = useState(true);
  const [unbudgetedExpanded, setUnbudgetedExpanded] = useState(false);

  // ─── Derived ───
  const monthLabel = useMemo(() => {
    const date = new Date(monthYear.year, monthYear.month, 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }, [monthYear]);

  const changeMonth = useCallback((delta) => {
    setMonthYear((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { month: next.getMonth(), year: next.getFullYear() };
    });
  }, []);

  // Filter by type
  const filteredCategories = useMemo(
    () => categoryBudgets.filter((c) => c.type === type),
    [categoryBudgets, type]
  );

  // Split into budgeted vs unbudgeted
  const budgetedCategories = useMemo(
    () => filteredCategories.filter((c) => {
      const hasSelfBudget = c.budget_amount != null && c.budget_amount > 0;
      const hasSubBudget = (c.subcategories || []).some((s) => s.budget_amount > 0);
      return hasSelfBudget || hasSubBudget;
    }),
    [filteredCategories]
  );

  const unbudgetedCategories = useMemo(
    () => filteredCategories.filter((c) => {
      const hasSelfBudget = c.budget_amount != null && c.budget_amount > 0;
      const hasSubBudget = (c.subcategories || []).some((s) => s.budget_amount > 0);
      return !hasSelfBudget && !hasSubBudget;
    }),
    [filteredCategories]
  );

  // Totals
  const totalBudgeted = useMemo(() => {
    let total = 0;
    for (const cat of filteredCategories) {
      total += cat.budget_amount || 0;
      for (const sub of cat.subcategories || []) {
        total += sub.budget_amount || 0;
      }
    }
    return total;
  }, [filteredCategories]);

  const totalSpent = useMemo(() => {
    let total = 0;
    for (const cat of filteredCategories) {
      total += cat.spent || 0;
      for (const sub of cat.subcategories || []) {
        total += sub.spent || 0;
      }
    }
    return total;
  }, [filteredCategories]);

  const totalRemaining = Math.max(totalBudgeted - totalSpent, 0);
  const usedPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  // ─── Data Loading ───
  // TODO: Wire to actual API. Merge category data with budget amounts + spending.
  // API call would be something like:
  //   GET /auth/categories/user/{userId}/budgets?month=4&year=2026
  // which returns categories with their budget_amount and spent fields merged in.

  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setUserId(user.id);
    try {
      // TODO: Replace with merged category+budget endpoint
      const [catData, summaryData, billsData] = await Promise.all([
        api.get(`/auth/categories/user/${user.id}`),
        api.get(`/auth/budgets/user/${user.id}/summary`, {
          month: monthYear.month + 1,
          year: monthYear.year,
        }).catch(() => null),
        api.get('/auth/bills', { user_id: user.id }).catch(() => []),
      ]);

      // Merge budget amounts + spending into category objects
      const cats = Array.isArray(catData) ? catData : [];
      const budgets = summaryData?.budgets || [];

      // Build a lookup: category_id → { budgeted, spent, ... }
      const budgetLookup = {};
      for (const b of budgets) {
        for (const c of b.categories || []) {
          budgetLookup[c.id] = {
            spent: c.spent || 0,
            transaction_count: c.transaction_count || 0,
            has_unverified: c.has_unverified || false,
            unverified_count: c.unverified_count || 0,
          };
        }
        // Also map the budget itself by name to a category
        if (b.categories?.length === 1) {
          const catId = b.categories[0].id;
          if (!budgetLookup[catId]) budgetLookup[catId] = {};
          budgetLookup[catId].budget_amount = b.budgeted;
        }
      }

      // Merge
      const merged = cats.map((cat) => {
        const info = budgetLookup[cat.id] || {};
        return {
          ...cat,
          budget_amount: info.budget_amount || null,
          spent: info.spent || 0,
          transaction_count: info.transaction_count || 0,
          has_unverified: info.has_unverified || false,
          unverified_count: info.unverified_count || 0,
          subcategories: (cat.subcategories || []).map((sub) => {
            const subInfo = budgetLookup[sub.id] || {};
            return {
              ...sub,
              budget_amount: subInfo.budget_amount || null,
              spent: subInfo.spent || 0,
              transaction_count: subInfo.transaction_count || 0,
              has_unverified: subInfo.has_unverified || false,
              unverified_count: subInfo.unverified_count || 0,
            };
          }),
        };
      });

      setCategoryBudgets(merged);
      setBills(Array.isArray(billsData) ? billsData : []);
      setError(null);
    } catch (e) {
      console.error('Budget screen fetch error', e);
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [monthYear.month, monthYear.year]);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ─── Handlers ───
  const handleSetBudget = async (categoryId, amount) => {
    // TODO: Call API to create/update budget for this category
    // POST /auth/budgets { category_id, amount, month, year }
    // For now, update local state
    setCategoryBudgets((prev) =>
      prev.map((cat) => {
        if (cat.id === categoryId) return { ...cat, budget_amount: amount };
        return {
          ...cat,
          subcategories: (cat.subcategories || []).map((sub) =>
            sub.id === categoryId ? { ...sub, budget_amount: amount } : sub
          ),
        };
      })
    );
  };

  const handleDeleteCategory = (category) => {
    const isSystem = !category.user_id;
    if (isSystem) {
      Alert.alert('System Category', 'System categories cannot be deleted.');
      return;
    }
    Alert.alert('Delete Category', `Delete "${category.name}" and its budget?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/categories/${category.id}`);
            loadData();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete category.');
          }
        },
      },
    ]);
  };

  const handleAddCategory = async (categoryData) => {
    try {
      await api.post('/auth/categories', {
        ...categoryData,
        user_id: userId,
      });
      // If budget amount was set, also create a budget
      if (categoryData.budget_amount) {
        await api.post('/auth/budgets', {
          id: uuidv4(),
          user_id: userId,
          name: categoryData.name,
          amount: categoryData.budget_amount,
          type: categoryData.type,
          category_id: categoryData.id,
          frequency: 'monthly',
          start_date: new Date().toISOString(),
        });
      }
      await loadData();
    } catch (err) {
      throw err; // Let modal handle error display
    }
  };

  const handleAddSubcategory = (parentId) => {
    setAddParentId(parentId);
    setShowAddCategory(true);
  };

  // ─── Render ───
  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Budget</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/settings/categories')}>
              <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setAddParentId(null); setShowAddCategory(true); }}>
              <LinearGradient
                colors={['#7c3aed', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButton}
              >
                <Ionicons name="add" size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Month Switcher ── */}
        <View style={styles.monthSwitcher}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 4 }}>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* ── Type Toggle (Expenses / Income) ── */}
        <View style={styles.typeToggleRow}>
          {(['expense', 'income']).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeToggle, type === t && styles.typeToggleActive]}
              onPress={() => setType(t)}
            >
              <Ionicons
                name={t === 'expense' ? 'trending-down' : 'trending-up'}
                size={14}
                color={type === t ? '#c084fc' : '#64748b'}
                style={{ marginRight: 4 }}
              />
              <Text style={type === t ? styles.typeToggleTextActive : styles.typeToggleText}>
                {t === 'expense' ? 'Expenses' : 'Income'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a855f7" colors={['#a855f7']} />
          }
        >
          {loading ? (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </>
          ) : (
            <>
              {/* ── Monthly Overview Hero ── */}
              <View style={styles.heroCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={styles.heroLabel}>
                    {type === 'expense' ? 'EXPENSE BUDGET' : 'INCOME BUDGET'}
                  </Text>
                  <View style={[styles.usedBadge, usedPct > 80 && { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <Text style={[styles.usedBadgeText, usedPct > 80 && { color: '#ef4444' }]}>
                      {usedPct}% {type === 'expense' ? 'used' : 'earned'}
                    </Text>
                  </View>
                </View>

                {/* Stat row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text style={styles.statLabel}>Budgeted</Text>
                    <Text style={styles.statValue}>{fmtShort(totalBudgeted)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.statLabel}>{type === 'expense' ? 'Spent' : 'Earned'}</Text>
                    <Text style={[styles.statValue, { color: type === 'expense' ? '#f59e0b' : '#34d399' }]}>
                      {fmtShort(totalSpent)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.statLabel}>Remaining</Text>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>
                      {fmtShort(totalRemaining)}
                    </Text>
                  </View>
                </View>

                <ProgressBar
                  percent={usedPct}
                  color={usedPct > 80 ? '#ef4444' : '#a855f7'}
                  height={6}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={styles.faintText}>
                    {budgetedCategories.length} categories budgeted
                  </Text>
                  <Text style={styles.faintText}>
                    {fmt(totalRemaining)} left
                  </Text>
                </View>
              </View>

              {/* ── Error State ── */}
              {error && (
                <ErrorState
                  title="Something went wrong"
                  message={error}
                  onRetry={() => { setError(null); loadData(); }}
                />
              )}

              {/* ── Empty State ── */}
              {!error && filteredCategories.length === 0 && (
                <EmptyState
                  icon="pricetags-outline"
                  title={`No ${type} categories`}
                  description="Add categories to start budgeting. Each category becomes a budget line."
                  actionLabel="Add Category"
                  onAction={() => { setAddParentId(null); setShowAddCategory(true); }}
                />
              )}

              {!error && filteredCategories.length > 0 && (
                <>
                  {/* ═══ BUDGETED CATEGORIES SECTION ═══ */}
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => setBudgetedExpanded((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={[styles.sectionIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                        <Ionicons name="wallet-outline" size={14} color="#22c55e" />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>
                          Budgeted ({budgetedCategories.length})
                        </Text>
                        <Text style={{ fontSize: 10, color: '#22c55e' }}>
                          {fmt(totalBudgeted)} total
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={budgetedExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="rgba(255,255,255,0.35)"
                    />
                  </TouchableOpacity>

                  {budgetedExpanded && budgetedCategories.map((cat) => (
                    <CategoryGroup
                      key={cat.id}
                      category={cat}
                      onSetBudget={handleSetBudget}
                      onDelete={handleDeleteCategory}
                      onAddSubcategory={handleAddSubcategory}
                    />
                  ))}

                  {/* ═══ UNBUDGETED CATEGORIES SECTION ═══ */}
                  {unbudgetedCategories.length > 0 && (
                    <>
                      <TouchableOpacity
                        style={[styles.sectionHeader, { marginTop: 4 }]}
                        onPress={() => setUnbudgetedExpanded((v) => !v)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.sectionHeaderLeft}>
                          <View style={[styles.sectionIcon, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
                            <Ionicons name="help-circle-outline" size={14} color="#64748b" />
                          </View>
                          <View>
                            <Text style={styles.sectionTitle}>
                              Unbudgeted ({unbudgetedCategories.length})
                            </Text>
                            <Text style={{ fontSize: 10, color: '#64748b' }}>
                              Tap to set a budget
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={unbudgetedExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color="rgba(255,255,255,0.35)"
                        />
                      </TouchableOpacity>

                      {unbudgetedExpanded && unbudgetedCategories.map((cat) => (
                        <CategoryGroup
                          key={cat.id}
                          category={cat}
                          onSetBudget={handleSetBudget}
                          onDelete={handleDeleteCategory}
                          onAddSubcategory={handleAddSubcategory}
                        />
                      ))}
                    </>
                  )}
                </>
              )}

              <View style={{ height: 20 }} />
            </>
          )}
        </ScrollView>

        {/* ── FAB: Add Category ── */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => { setAddParentId(null); setShowAddCategory(true); }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#7c3aed', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Add Category Modal ── */}
        <AddCategoryModal
          visible={showAddCategory}
          onClose={() => { setShowAddCategory(false); setAddParentId(null); }}
          onSave={handleAddCategory}
          type={type}
          parentId={addParentId}
        />

      </SafeAreaView>
    </LinearGradient>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  /* Month switcher */
  monthSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  /* Type toggle */
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  typeToggle: {
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
  typeToggleActive: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderColor: 'rgba(192,132,252,0.3)',
  },
  typeToggleText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  typeToggleTextActive: { color: '#c084fc', fontWeight: '800', fontSize: 13 },

  /* Hero card */
  heroCard: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  usedBadge: {
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  usedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a855f7',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
  },
  faintText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },

  /* Section headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },

  /* Category group */
  categoryGroup: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  groupTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  groupBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
  },
  subCount: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },

  /* Category row */
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  subcategoryRow: {
    paddingLeft: 52,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  subcategoryName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#cbd5e1',
  },
  spentText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  noBudgetHint: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },

  /* Icon circles */
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Budget amount button */
  budgetAmountBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 64,
    alignItems: 'center',
  },
  budgetAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  budgetAmountPlaceholder: {
    color: '#a855f7',
    fontWeight: '600',
    fontSize: 12,
  },

  /* Inline edit */
  inlineEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    gap: 2,
  },
  dollarSign: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c084fc',
  },
  inlineEditInput: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    minWidth: 50,
    paddingVertical: 4,
  },

  /* Delete button */
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Chip badge */
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },

  /* Add subcategory */
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

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 10,
  },
  fabGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

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
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
    marginBottom: 4,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dollarPrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: '#c084fc',
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
  previewBudget: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
