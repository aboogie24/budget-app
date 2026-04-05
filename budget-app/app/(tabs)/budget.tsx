import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  Modal,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCard } from '@/components/SkeletonLoader';

/* ====================================================================
   TYPES
   ==================================================================== */

type SubcategoryData = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  type: string;
  user_id?: string | null;
  parent_id?: string | null;
  budget_id?: string | null;
  budget_amount: number | null;
  spent: number;
  unverified_count: number;
};

type CategoryData = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  type: string;
  user_id?: string | null;
  budget_id?: string | null;
  budget_amount: number | null;
  spent: number;
  unverified_count: number;
  subcategories: SubcategoryData[];
};

type CategoryFromAPI = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  type?: string;
  user_id?: string | null;
  budget_id?: string | null;
  parent_id?: string | null;
  subcategories?: CategoryFromAPI[];
};

type BudgetSummaryItem = {
  id: string;
  name: string;
  type: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percent: number;
  frequency: string;
  category_id?: string;
  categories: {
    id: string;
    name: string;
    color: string;
    icon?: string;
    spent: number;
    transaction_count: number;
    has_unverified: boolean;
    unverified_count: number;
    subcategories: {
      id: string;
      name: string;
      color: string;
      icon?: string;
      spent: number;
      transaction_count: number;
      has_unverified: boolean;
      unverified_count: number;
    }[];
  }[];
};

type SummaryResponse = {
  month: number;
  year: number;
  total_income: number;
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  total_unverified: number;
  budgets: BudgetSummaryItem[];
};

/* ====================================================================
   ICON MAPPING — maps backend icon names to Ionicons glyph names
   ==================================================================== */

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

/* Available icons for the Add Category modal */
const PICKER_ICONS = [
  'home', 'restaurant', 'car', 'film', 'cart', 'fitness',
  'cash', 'shield', 'receipt', 'person', 'gift', 'school',
  'medical', 'airplane', 'game', 'music', 'shirt', 'phone',
  'wifi', 'water', 'flash', 'paw', 'book', 'briefcase',
];

const PICKER_COLORS = [
  '#7c3aed', '#22c55e', '#ef4444', '#3b82f6', '#06b6d4',
  '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
];

/* ====================================================================
   HELPERS
   ==================================================================== */

const fmt = (n: number) =>
  '$' +
  Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
};

/* ====================================================================
   PROGRESS BAR
   ==================================================================== */

const ProgressBar = ({
  percent,
  color = '#34d399',
  height = 4,
}: {
  percent: number;
  color?: string;
  height?: number;
}) => (
  <View
    style={{
      height,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: height / 2,
      overflow: 'hidden',
    }}
  >
    <View
      style={{
        height: '100%',
        width: `${Math.min(Math.max(percent, 0), 100)}%`,
        backgroundColor: color,
        borderRadius: height / 2,
      }}
    />
  </View>
);

/* ====================================================================
   CATEGORY BUDGET ROW — subcategory or leaf category
   ==================================================================== */

const CategoryBudgetRow = ({
  category,
  onSetBudget,
  isSubcategory = false,
}: {
  category: SubcategoryData | CategoryData;
  onSetBudget: (categoryId: string, budgetId: string | null | undefined, amount: number) => void;
  isSubcategory?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const hasBudget = category.budget_amount != null && category.budget_amount > 0;
  const spent = category.spent || 0;
  const budgeted = category.budget_amount || 0;
  const pct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
  const overBudget = spent > budgeted && hasBudget;

  const progressColor = overBudget ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e';
  const iconName = resolveIcon(category.icon);

  const handleStartEdit = () => {
    setEditValue(hasBudget ? String(budgeted) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      onSetBudget(category.id, category.budget_id, val);
    }
    setEditing(false);
    Keyboard.dismiss();
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: isSubcategory ? 10 : 12,
          paddingHorizontal: 14,
          paddingLeft: isSubcategory ? 52 : 14,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.04)',
        },
        overBudget && { backgroundColor: 'rgba(239,68,68,0.04)' },
      ]}
    >
      {/* Icon */}
      <View
        style={{
          width: isSubcategory ? 28 : 36,
          height: isSubcategory ? 28 : 36,
          borderRadius: isSubcategory ? 8 : 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${category.color || '#7c3aed'}22`,
        }}
      >
        <Ionicons
          name={iconName}
          size={isSubcategory ? 14 : 18}
          color={category.color || '#7c3aed'}
        />
      </View>

      {/* Name + Progress */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text
            style={{
              fontSize: isSubcategory ? 13 : 14,
              fontWeight: isSubcategory ? '500' : '600',
              color: isSubcategory ? '#cbd5e1' : '#f8fafc',
            }}
            numberOfLines={1}
          >
            {category.name}
          </Text>
          {overBudget && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
                backgroundColor: 'rgba(239,68,68,0.12)',
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Ionicons name="warning" size={8} color="#ef4444" />
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#ef4444' }}>Over</Text>
            </View>
          )}
          {(category.unverified_count || 0) > 0 && (
            <View
              style={{
                backgroundColor: 'rgba(251,191,36,0.12)',
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 9, color: '#fbbf24' }}>
                {category.unverified_count} unverified
              </Text>
            </View>
          )}
        </View>
        {hasBudget ? (
          <View style={{ marginTop: 4 }}>
            <ProgressBar percent={pct} color={progressColor} height={3} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {fmt(spent)} spent
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: overBudget ? '#ef4444' : 'rgba(255,255,255,0.4)',
                }}
              >
                {overBudget ? `${fmt(spent - budgeted)} over` : `${fmt(budgeted - spent)} left`}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {spent > 0 ? `${fmt(spent)} spent \u00B7 No budget set` : 'Tap amount to set budget'}
          </Text>
        )}
      </View>

      {/* Budget Amount — tap to edit */}
      {editing ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(168,85,247,0.12)',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderWidth: 1,
            borderColor: 'rgba(168,85,247,0.4)',
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#c084fc' }}>$</Text>
          <TextInput
            ref={inputRef}
            value={editValue}
            onChangeText={setEditValue}
            keyboardType="numeric"
            onBlur={handleSubmit}
            onSubmitEditing={handleSubmit}
            style={{
              color: '#f8fafc',
              fontSize: 14,
              fontWeight: '700',
              width: 60,
              paddingVertical: 4,
              paddingHorizontal: 0,
            }}
            placeholder="0"
            placeholderTextColor="#64748b"
            returnKeyType="done"
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleStartEdit}
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            minWidth: 64,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: hasBudget ? '#f8fafc' : '#a855f7',
              fontSize: hasBudget ? 13 : 12,
              fontWeight: hasBudget ? '700' : '600',
            }}
          >
            {hasBudget ? fmt(budgeted) : '+ Set'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* ====================================================================
   CATEGORY GROUP — expandable parent category card
   ==================================================================== */

const CategoryGroup = ({
  category,
  onSetBudget,
  onAddSub,
}: {
  category: CategoryData;
  onSetBudget: (categoryId: string, budgetId: string | null | undefined, amount: number) => void;
  onAddSub: (parentId: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasSubs = (category.subcategories || []).length > 0;

  const totalBudgeted =
    (category.subcategories || []).reduce((s, c) => s + (c.budget_amount || 0), 0) +
    (category.budget_amount || 0);
  const totalSpent =
    (category.subcategories || []).reduce((s, c) => s + (c.spent || 0), 0) +
    (category.spent || 0);
  const pct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;
  const iconName = resolveIcon(category.icon);

  return (
    <View style={styles.categoryGroupCard}>
      {/* Header */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${category.color || '#7c3aed'}22`,
          }}
        >
          <Ionicons name={iconName} size={18} color={category.color || '#7c3aed'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#f8fafc' }} numberOfLines={1}>
              {category.name}
            </Text>
            {hasSubs && (
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>
                {category.subcategories.length} sub
                {category.subcategories.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {totalBudgeted > 0 && (
            <View style={{ marginTop: 4 }}>
              <ProgressBar
                percent={pct}
                color={pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e'}
                height={3}
              />
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}
              >
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {fmt(totalSpent)} spent
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {fmt(totalBudgeted)} budgeted
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: totalBudgeted > 0 ? '#f8fafc' : '#475569',
            marginRight: 4,
          }}
        >
          {totalBudgeted > 0 ? fmt(totalBudgeted) : '\u2014'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="rgba(255,255,255,0.35)"
        />
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.06)',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          {/* If no subs, show the parent as its own editable row */}
          {!hasSubs && (
            <CategoryBudgetRow category={category} onSetBudget={onSetBudget} />
          )}
          {/* Subcategory rows */}
          {(category.subcategories || []).map((sub) => (
            <CategoryBudgetRow
              key={sub.id}
              category={sub}
              onSetBudget={onSetBudget}
              isSubcategory
            />
          ))}
          {/* Add Subcategory button */}
          <TouchableOpacity
            onPress={() => onAddSub(category.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 10,
              marginHorizontal: 14,
              marginVertical: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: 'rgba(168,85,247,0.25)',
              backgroundColor: 'rgba(168,85,247,0.06)',
            }}
          >
            <Ionicons name="add" size={14} color="#a855f7" />
            <Text style={{ color: '#a855f7', fontSize: 12, fontWeight: '700' }}>
              Add Subcategory
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ====================================================================
   ADD CATEGORY MODAL
   ==================================================================== */

const AddCategoryModal = ({
  visible,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { name: string; budget: string; color: string; icon: string }) => void;
  saving: boolean;
}) => {
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [icon, setIcon] = useState('home');

  const handleSave = () => {
    if (name.trim()) {
      onSave({ name: name.trim(), budget, color, icon });
    }
  };

  const handleClose = () => {
    setName('');
    setBudget('');
    setColor('#7c3aed');
    setIcon('home');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Category</Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#e5e7eb" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={styles.sheetLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                placeholderTextColor="#64748b"
                autoFocus
                style={styles.sheetInput}
              />

              {/* Monthly Budget (optional) */}
              <Text style={styles.sheetLabel}>
                Monthly Budget{' '}
                <Text style={{ color: '#64748b', fontWeight: '400' }}>(optional)</Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#c084fc' }}>$</Text>
                <TextInput
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  style={[styles.sheetInput, { flex: 1, marginBottom: 0 }]}
                />
              </View>

              {/* Color */}
              <Text style={styles.sheetLabel}>Color</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                {PICKER_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: c,
                      borderWidth: 2,
                      borderColor: color === c ? '#fff' : 'transparent',
                    }}
                  />
                ))}
              </View>

              {/* Icon */}
              <Text style={styles.sheetLabel}>Icon</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {PICKER_ICONS.map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setIcon(i)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        icon === i ? `${color}22` : 'rgba(255,255,255,0.06)',
                      borderWidth: 1.5,
                      borderColor:
                        icon === i ? color : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Ionicons name={resolveIcon(i)} size={20} color={icon === i ? color : '#94a3b8'} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              <Text style={styles.sheetLabel}>Preview</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: `${color}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={resolveIcon(icon)} size={18} color={color} />
                </View>
                <View>
                  <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '700' }}>
                    {name || 'Category Name'}
                  </Text>
                  <Text
                    style={{
                      color: budget ? '#22c55e' : '#475569',
                      fontSize: 12,
                      fontWeight: '600',
                      marginTop: 2,
                    }}
                  >
                    {budget
                      ? `$${parseFloat(budget || '0').toFixed(2)} / month`
                      : 'No budget set'}
                  </Text>
                </View>
              </View>

              {/* Save */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!name.trim() || saving}
                style={[styles.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
              >
                <Text style={styles.saveText}>
                  {saving ? 'Creating...' : 'Create Category'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ====================================================================
   MAIN BUDGET SCREEN
   ==================================================================== */

export default function BudgetScreen() {
  const router = useRouter();
  const [mergedCategories, setMergedCategories] = useState<CategoryData[]>([]);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [budgetedExpanded, setBudgetedExpanded] = useState(true);
  const [unbudgetedExpanded, setUnbudgetedExpanded] = useState(false);
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  /* Raw API data stored for merging */
  const rawCategories = useRef<CategoryFromAPI[]>([]);
  const rawSummary = useRef<SummaryResponse | null>(null);

  const monthLabel = useMemo(() => {
    const date = new Date(monthYear.year, monthYear.month, 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }, [monthYear]);

  const changeMonth = useCallback((delta: number) => {
    setMonthYear((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { month: next.getMonth(), year: next.getFullYear() };
    });
  }, []);

  /* ─── Merge category tree with spending summary ─── */
  const buildMergedView = useCallback(
    (cats: CategoryFromAPI[], summary: SummaryResponse | null): CategoryData[] => {
      // Build a lookup of budget info by category_id from the summary
      const budgetByCategoryId: Record<
        string,
        { budget_id: string; budgeted: number; spent: number }
      > = {};
      const spentByCategoryId: Record<string, number> = {};

      if (summary?.budgets) {
        for (const b of summary.budgets) {
          // The budget itself may be mapped to a category_id
          if (b.category_id) {
            budgetByCategoryId[b.category_id] = {
              budget_id: b.id,
              budgeted: b.budgeted,
              spent: b.spent,
            };
          }
          // Also accumulate spending from the categories array inside each budget
          for (const cat of b.categories || []) {
            spentByCategoryId[cat.id] = (spentByCategoryId[cat.id] || 0) + cat.spent;
            for (const sub of cat.subcategories || []) {
              spentByCategoryId[sub.id] = (spentByCategoryId[sub.id] || 0) + sub.spent;
            }
          }
        }
      }

      return cats.map((cat) => {
        const budgetInfo = budgetByCategoryId[cat.id];
        const catSpent = spentByCategoryId[cat.id] || budgetInfo?.spent || 0;

        const subcategories: SubcategoryData[] = (cat.subcategories || []).map((sub) => {
          const subBudgetInfo = budgetByCategoryId[sub.id];
          const subSpent = spentByCategoryId[sub.id] || subBudgetInfo?.spent || 0;
          return {
            id: sub.id,
            name: sub.name,
            color: sub.color || cat.color || '#7c3aed',
            icon: sub.icon,
            type: sub.type || cat.type || 'expense',
            user_id: sub.user_id,
            parent_id: sub.parent_id,
            budget_id: sub.budget_id || subBudgetInfo?.budget_id || null,
            budget_amount: subBudgetInfo?.budgeted ?? null,
            spent: subSpent,
            unverified_count: 0,
          };
        });

        return {
          id: cat.id,
          name: cat.name,
          color: cat.color || '#7c3aed',
          icon: cat.icon,
          type: cat.type || 'expense',
          user_id: cat.user_id,
          budget_id: cat.budget_id || budgetInfo?.budget_id || null,
          budget_amount: budgetInfo?.budgeted ?? null,
          spent: catSpent,
          unverified_count: 0,
          subcategories,
        };
      });
    },
    []
  );

  /* ─── Data Loading ─── */
  const loadData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.id) return;
    setUserId(user.id);
    try {
      const [catData, summaryData] = await Promise.all([
        api.get(`/auth/categories/user/${user.id}`),
        api.get(`/auth/budgets/user/${user.id}/summary`, {
          month: monthYear.month + 1,
          year: monthYear.year,
        }),
      ]);

      const cats = Array.isArray(catData) ? (catData as CategoryFromAPI[]) : [];
      const summary = summaryData as SummaryResponse;
      rawCategories.current = cats;
      rawSummary.current = summary;

      setMergedCategories(buildMergedView(cats, summary));
      setError(null);
    } catch (e) {
      console.error('Budget screen fetch error', e);
      setError('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [monthYear.month, monthYear.year, buildMergedView]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  /* ─── Filtered & Split Data ─── */
  const filtered = useMemo(
    () =>
      mergedCategories.filter((c) => {
        const t = (c.type || '').toLowerCase();
        return t === type || t === '' || t === 'category';
      }),
    [mergedCategories, type]
  );

  const budgeted = useMemo(
    () =>
      filtered.filter((c) => {
        const selfBudgeted = c.budget_amount != null && c.budget_amount > 0;
        const subsBudgeted = (c.subcategories || []).some(
          (s) => s.budget_amount != null && s.budget_amount > 0
        );
        return selfBudgeted || subsBudgeted;
      }),
    [filtered]
  );

  const unbudgeted = useMemo(
    () =>
      filtered.filter((c) => {
        const selfBudgeted = c.budget_amount != null && c.budget_amount > 0;
        const subsBudgeted = (c.subcategories || []).some(
          (s) => s.budget_amount != null && s.budget_amount > 0
        );
        return !selfBudgeted && !subsBudgeted;
      }),
    [filtered]
  );

  const totalBudgetedAmount = useMemo(() => {
    let t = 0;
    for (const c of filtered) {
      t += c.budget_amount || 0;
      for (const s of c.subcategories || []) t += s.budget_amount || 0;
    }
    return t;
  }, [filtered]);

  const totalSpentAmount = useMemo(() => {
    let t = 0;
    for (const c of filtered) {
      t += c.spent || 0;
      for (const s of c.subcategories || []) t += s.spent || 0;
    }
    return t;
  }, [filtered]);

  const totalRemaining = Math.max(totalBudgetedAmount - totalSpentAmount, 0);
  const usedPct =
    totalBudgetedAmount > 0
      ? Math.round((totalSpentAmount / totalBudgetedAmount) * 100)
      : 0;

  const totalUnbudgetedSpent = useMemo(() => {
    let t = 0;
    for (const c of unbudgeted) {
      t += c.spent || 0;
      for (const s of c.subcategories || []) t += s.spent || 0;
    }
    return t;
  }, [unbudgeted]);

  /* ─── Set / Create Budget Handler ─── */
  const handleSetBudget = useCallback(
    async (categoryId: string, budgetId: string | null | undefined, amount: number) => {
      try {
        if (budgetId) {
          // Update existing budget
          await api.put(`/auth/budgets/${budgetId}`, { amount });
        } else {
          // Find category name for the new budget
          let catName = 'Budget';
          for (const c of rawCategories.current) {
            if (c.id === categoryId) {
              catName = c.name;
              break;
            }
            for (const s of c.subcategories || []) {
              if (s.id === categoryId) {
                catName = s.name;
                break;
              }
            }
          }
          // Create new budget
          await api.post('/auth/budgets', {
            id: uuidv4(),
            user_id: userId,
            name: catName,
            amount,
            type,
            category_id: categoryId,
            frequency: 'monthly',
          });
        }
        // Optimistically update local state
        setMergedCategories((prev) =>
          prev.map((cat) => {
            if (cat.id === categoryId) {
              return { ...cat, budget_amount: amount };
            }
            return {
              ...cat,
              subcategories: (cat.subcategories || []).map((s) =>
                s.id === categoryId ? { ...s, budget_amount: amount } : s
              ),
            };
          })
        );
        // Reload to get actual server state
        loadData();
      } catch (e) {
        console.error('Failed to set budget:', e);
        Alert.alert('Error', 'Failed to save budget. Please try again.');
      }
    },
    [userId, type, loadData]
  );

  /* ─── Add Category Handler ─── */
  const handleAddCategory = useCallback(
    async (data: { name: string; budget: string; color: string; icon: string }) => {
      if (!userId) return;
      setAddingSaving(true);
      try {
        const catPayload = {
          id: uuidv4(),
          name: data.name,
          color: data.color,
          icon: data.icon,
          type,
          user_id: userId,
        };
        const created = await api.post<CategoryFromAPI>('/auth/categories', catPayload);

        // If a budget amount was provided, also create the budget
        if (data.budget && parseFloat(data.budget) > 0 && created) {
          await api.post('/auth/budgets', {
            id: uuidv4(),
            user_id: userId,
            name: data.name,
            amount: parseFloat(data.budget),
            type,
            category_id: created.id || catPayload.id,
            frequency: 'monthly',
          });
        }

        setShowAddModal(false);
        loadData();
      } catch (e) {
        console.error('Failed to create category:', e);
        Alert.alert('Error', 'Failed to create category. Please try again.');
      } finally {
        setAddingSaving(false);
      }
    },
    [userId, type, loadData]
  );

  /* ─── Add Subcategory Handler ─── */
  const handleAddSub = useCallback(
    (parentId: string) => {
      Alert.prompt(
        'Add Subcategory',
        'Enter subcategory name:',
        async (text) => {
          if (!text?.trim() || !userId) return;
          try {
            await api.post('/auth/categories', {
              id: uuidv4(),
              name: text.trim(),
              type,
              user_id: userId,
              parent_id: parentId,
              color: '#7c3aed',
              icon: 'pricetag',
            });
            loadData();
          } catch (e) {
            console.error('Failed to add subcategory:', e);
            Alert.alert('Error', 'Failed to add subcategory.');
          }
        },
        'plain-text'
      );
    },
    [userId, type, loadData]
  );

  /* ====================================================================
     RENDER
     ==================================================================== */

  return (
    <LinearGradient colors={['#0f0a1e', '#1a1035', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Budget</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/settings/budget-settings' as any)}>
              <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
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

        {/* Month Switcher */}
        <View style={styles.monthSwitcher}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 4 }}>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* Type Toggle */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 }}>
          {(['expense', 'income'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              style={[
                styles.typeToggle,
                type === t && styles.typeToggleActive,
              ]}
            >
              <Ionicons
                name={t === 'expense' ? 'trending-down' : 'trending-up'}
                size={14}
                color={type === t ? '#c084fc' : '#64748b'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: type === t ? '800' : '700',
                  color: type === t ? '#c084fc' : '#64748b',
                }}
              >
                {t === 'expense' ? 'Expenses' : 'Income'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scrollable Content */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a855f7"
              colors={['#a855f7']}
            />
          }
        >
          {loading ? (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </>
          ) : error ? (
            <ErrorState
              title="Something went wrong"
              message={error}
              onRetry={() => {
                setError(null);
                loadData();
              }}
            />
          ) : (
            <>
              {/* Hero Card */}
              <View style={styles.heroCard}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Text style={styles.heroLabel}>
                    {type === 'expense' ? 'EXPENSE BUDGET' : 'INCOME BUDGET'}
                  </Text>
                  <View
                    style={[
                      styles.usedBadge,
                      usedPct > 80 && { backgroundColor: 'rgba(239,68,68,0.12)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.usedBadgeText,
                        usedPct > 80 && { color: '#ef4444' },
                      ]}
                    >
                      {usedPct}% {type === 'expense' ? 'used' : 'earned'}
                    </Text>
                  </View>
                </View>

                {/* Stats row */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <View>
                    <Text style={styles.statLabel}>Budgeted</Text>
                    <Text style={styles.statValue}>{fmtShort(totalBudgetedAmount)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.statLabel}>
                      {type === 'expense' ? 'Spent' : 'Earned'}
                    </Text>
                    <Text
                      style={[
                        styles.statValue,
                        { color: type === 'expense' ? '#f59e0b' : '#34d399' },
                      ]}
                    >
                      {fmtShort(totalSpentAmount)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.statLabel}>Remaining</Text>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>
                      {fmtShort(totalRemaining)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <ProgressBar
                  percent={usedPct}
                  color={usedPct > 80 ? '#ef4444' : '#a855f7'}
                  height={6}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 6,
                  }}
                >
                  <Text style={styles.faintText}>
                    {budgeted.length} categories budgeted
                  </Text>
                  <Text style={styles.faintText}>{fmt(totalRemaining)} left</Text>
                </View>
              </View>

              {/* Empty state for no categories at all */}
              {filtered.length === 0 && (
                <EmptyState
                  icon="wallet-outline"
                  title="No categories yet"
                  description={`Create your first ${type} category to start budgeting`}
                  actionLabel="Add Category"
                  onAction={() => setShowAddModal(true)}
                />
              )}

              {filtered.length > 0 && (
                <>
                  {/* ═══ BUDGETED SECTION ═══ */}
                  <TouchableOpacity
                    onPress={() => setBudgetedExpanded(!budgetedExpanded)}
                    activeOpacity={0.7}
                    style={styles.sectionHeader}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View
                        style={[
                          styles.sectionIcon,
                          { backgroundColor: 'rgba(34,197,94,0.12)' },
                        ]}
                      >
                        <Ionicons name="wallet-outline" size={14} color="#22c55e" />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>
                          Budgeted ({budgeted.length})
                        </Text>
                        <Text style={{ fontSize: 10, color: '#22c55e' }}>
                          {fmt(totalBudgetedAmount)} total
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={budgetedExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="rgba(255,255,255,0.35)"
                    />
                  </TouchableOpacity>

                  {budgetedExpanded &&
                    budgeted.map((cat) => (
                      <CategoryGroup
                        key={cat.id}
                        category={cat}
                        onSetBudget={handleSetBudget}
                        onAddSub={handleAddSub}
                      />
                    ))}

                  {budgetedExpanded && budgeted.length === 0 && (
                    <View
                      style={{
                        padding: 20,
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: 14,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                        No budgeted categories yet. Tap "+ Set" on a category to get started.
                      </Text>
                    </View>
                  )}

                  {/* ═══ UNBUDGETED SECTION ═══ */}
                  {unbudgeted.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setUnbudgetedExpanded(!unbudgetedExpanded)}
                        activeOpacity={0.7}
                        style={[styles.sectionHeader, { marginTop: 4 }]}
                      >
                        <View style={styles.sectionHeaderLeft}>
                          <View
                            style={[
                              styles.sectionIcon,
                              { backgroundColor: 'rgba(100,116,139,0.12)' },
                            ]}
                          >
                            <Ionicons name="help-circle-outline" size={14} color="#64748b" />
                          </View>
                          <View>
                            <Text style={styles.sectionTitle}>
                              Unbudgeted ({unbudgeted.length})
                            </Text>
                            <Text style={{ fontSize: 10, color: '#64748b' }}>
                              {totalUnbudgetedSpent > 0
                                ? `${fmt(totalUnbudgetedSpent)} spent`
                                : 'Tap to set a budget'}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={unbudgetedExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color="rgba(255,255,255,0.35)"
                        />
                      </TouchableOpacity>

                      {unbudgetedExpanded &&
                        unbudgeted.map((cat) => (
                          <CategoryGroup
                            key={cat.id}
                            category={cat}
                            onSetBudget={handleSetBudget}
                            onAddSub={handleAddSub}
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

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
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

        {/* Add Category Modal */}
        <AddCategoryModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddCategory}
          saving={addingSaving}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ====================================================================
   STYLES
   ==================================================================== */

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
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },

  /* Type toggle */
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
    borderColor: 'rgba(192,132,252,0.3)',
    backgroundColor: 'rgba(192,132,252,0.12)',
  },

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

  /* Category group card */
  categoryGroupCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    overflow: 'hidden',
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

  /* Modal / Sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f0a1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: Dimensions.get('window').height * 0.85,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetLabel: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
