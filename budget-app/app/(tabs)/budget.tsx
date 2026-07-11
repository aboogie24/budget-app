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
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { aiCategorizeTransactions } from '@/utils/api';
import { getCurrentUser } from '@/utils/storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius, typography, glassEffects, gradients } from '@/utils/design-system';

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

/* Category palette values — these are data (per-category color), not theme tokens. */
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

/* ── Budget-health status model (icon + word + color) — the single source of
   truth for all budget-health color across the hero, groups, and rows. ── */
type BudgetStatus = 'ontrack' | 'watch' | 'over';

function budgetStatus(spent: number, budgeted: number): BudgetStatus {
  if (budgeted > 0 && spent > budgeted) return 'over';
  const pct = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  if (pct > 80) return 'watch';
  return 'ontrack';
}

const STATUS_COLOR: Record<BudgetStatus, string> = {
  ontrack: colors.success,
  watch: colors.warning,
  over: colors.error,
};

const STATUS_ICON: Record<BudgetStatus, keyof typeof Ionicons.glyphMap> = {
  ontrack: 'checkmark-circle',
  watch: 'alert-circle',
  over: 'warning',
};

const STATUS_WORD: Record<BudgetStatus, string> = {
  ontrack: 'On track',
  watch: 'Watch',
  over: 'Over',
};

/* ====================================================================
   PROGRESS BAR
   ==================================================================== */

const ProgressBar = ({
  percent,
  color = colors.success,
  height = 4,
}: {
  percent: number;
  color?: string;
  height?: number;
}) => (
  <View
    style={{
      height,
      backgroundColor: colors.glassLight,
      borderRadius: radius.full,
      overflow: 'hidden',
    }}
  >
    <View
      style={{
        height: '100%',
        width: `${Math.min(Math.max(percent, 0), 100)}%`,
        backgroundColor: color,
        borderRadius: radius.full,
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
  const router = useRouter();

  // Drill into this category's transactions.
  const openTransactions = () => {
    router.push({
      pathname: '/transaction/list',
      params: { category_id: category.id, category_name: category.name },
    });
  };
  // Jump to the review screen filtered to this category's unverified transactions.
  const openReview = () => {
    router.push({
      pathname: '/transactions/review',
      params: { category_id: category.id, category_name: category.name },
    });
  };

  const hasBudget = category.budget_amount != null && category.budget_amount > 0;
  const spent = category.spent || 0;
  const budgeted = category.budget_amount || 0;
  const pct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;
  const overBudget = spent > budgeted && hasBudget;

  const status = budgetStatus(spent, budgeted);
  const progressColor = STATUS_COLOR[status];
  const iconName = resolveIcon(category.icon);
  const catColor = category.color || colors.primary;

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
          minHeight: 44,
          paddingVertical: isSubcategory ? spacing.sm : spacing.md,
          paddingHorizontal: spacing.md,
          paddingLeft: isSubcategory ? spacing.xxl : spacing.md,
          gap: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        },
        overBudget && { backgroundColor: `${colors.error}0a` },
      ]}
    >
      {/* Icon */}
      <View
        style={{
          width: isSubcategory ? 28 : 36,
          height: isSubcategory ? 28 : 36,
          borderRadius: isSubcategory ? radius.sm : radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${catColor}22`,
          flexShrink: 0,
        }}
      >
        <Ionicons name={iconName} size={isSubcategory ? 14 : 18} color={catColor} />
      </View>

      {/* Name + Progress — tap to drill into this category's transactions */}
      <TouchableOpacity
        style={{ flex: 1, minWidth: 0 }}
        activeOpacity={0.6}
        onPress={openTransactions}
        accessibilityRole="button"
        accessibilityLabel={
          hasBudget
            ? `${category.name}, ${fmt(spent)} spent of ${fmt(budgeted)}, ${
                overBudget ? `${fmt(spent - budgeted)} over budget` : `${fmt(budgeted - spent)} left`
              }. Double tap to view transactions.`
            : `${category.name}, ${fmt(spent)} spent, no budget set. Double tap to view transactions.`
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
          <Text
            style={[
              isSubcategory ? typography.small : typography.smallBold,
              { color: isSubcategory ? colors.textMuted : colors.text, flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {category.name}
          </Text>
          {overBudget && (
            <View style={[styles.rowChip, { backgroundColor: `${colors.error}1f` }]}>
              <Ionicons name="warning" size={9} color={colors.error} />
              <Text style={[styles.rowChipText, { color: colors.error }]}>Over</Text>
            </View>
          )}
          {(category.unverified_count || 0) > 0 && (
            <TouchableOpacity
              onPress={openReview}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`${category.unverified_count} transactions to review in ${category.name}. Double tap to open.`}
              style={[styles.rowChip, { backgroundColor: `${colors.warning}1f` }]}
            >
              <Text style={[styles.rowChipText, { color: colors.warning }]}>
                {category.unverified_count} to review
              </Text>
              <Ionicons name="chevron-forward" size={9} color={colors.warning} />
            </TouchableOpacity>
          )}
        </View>
        {hasBudget ? (
          <View style={{ marginTop: spacing.xs }}>
            <ProgressBar percent={pct} color={progressColor} height={3} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {fmt(spent)} spent
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: overBudget ? colors.error : colors.textMuted },
                ]}
              >
                {overBudget ? `${fmt(spent - budgeted)} over` : `${fmt(budgeted - spent)} left`}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[typography.caption, { color: colors.textDark, marginTop: 2 }]}>
            {spent > 0 ? `${fmt(spent)} spent · No budget set` : 'Tap amount to set budget'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Budget Amount — tap to edit */}
      {editing ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${colors.primary2}1f`,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderWidth: 1,
            borderColor: `${colors.primary2}66`,
            gap: spacing.xs,
            flexShrink: 0,
          }}
        >
          <Text style={[typography.smallBold, { color: colors.primary2, fontWeight: '700' }]}>$</Text>
          <TextInput
            ref={inputRef}
            value={editValue}
            onChangeText={setEditValue}
            keyboardType="numeric"
            onBlur={handleSubmit}
            onSubmitEditing={handleSubmit}
            style={{
              color: colors.text,
              ...typography.smallBold,
              fontWeight: '700',
              width: 60,
              paddingVertical: 4,
              paddingHorizontal: 0,
            }}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleStartEdit}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Set budget for ${category.name}, currently ${
            hasBudget ? fmt(budgeted) : 'unset'
          }. Double tap to edit.`}
          style={{
            backgroundColor: colors.glassLight,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderWidth: 1,
            borderColor: colors.borderGlass,
            minWidth: 64,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Text
            style={[
              hasBudget ? typography.smallBold : typography.caption,
              { color: hasBudget ? colors.text : colors.primary2, fontWeight: hasBudget ? '700' : '600' },
            ]}
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
  const catColor = category.color || colors.primary;
  const aggColor = STATUS_COLOR[budgetStatus(totalSpent, totalBudgeted)];

  return (
    <View style={styles.categoryGroupCard}>
      {/* Header */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
        accessibilityRole="button"
        accessibilityLabel={`${category.name}, ${
          totalBudgeted > 0 ? `${fmt(totalSpent)} spent of ${fmt(totalBudgeted)}` : 'no budget'
        }, ${expanded ? 'expanded' : 'collapsed'}. Double tap to toggle.`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${catColor}22`,
            flexShrink: 0,
          }}
        >
          <Ionicons name={iconName} size={18} color={catColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={[typography.smallBold, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
              {category.name}
            </Text>
            {hasSubs && (
              <Text style={[typography.caption, { color: colors.textDark, fontWeight: '600' }]}>
                {category.subcategories.length} sub
                {category.subcategories.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {totalBudgeted > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <ProgressBar percent={pct} color={aggColor} height={3} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {fmt(totalSpent)} spent
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {fmt(totalBudgeted)} budgeted
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text
          style={[
            typography.smallBold,
            {
              color: totalBudgeted > 0 ? colors.text : colors.textDark,
              fontWeight: '700',
              marginRight: spacing.xs,
              flexShrink: 0,
            },
          ]}
        >
          {totalBudgeted > 0 ? fmt(totalBudgeted) : '—'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.borderGlass,
            paddingTop: spacing.xs,
            paddingBottom: spacing.xs,
          }}
        >
          {/* If no subs, show the parent as its own editable row */}
          {!hasSubs && <CategoryBudgetRow category={category} onSetBudget={onSetBudget} />}
          {/* Subcategory rows */}
          {(category.subcategories || []).map((sub) => (
            <CategoryBudgetRow key={sub.id} category={sub} onSetBudget={onSetBudget} isSubcategory />
          ))}
          {/* Add Subcategory button */}
          <TouchableOpacity
            onPress={() => onAddSub(category.id)}
            accessibilityRole="button"
            accessibilityLabel={`Add subcategory to ${category.name}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              gap: spacing.xs,
              padding: spacing.sm,
              marginHorizontal: spacing.md,
              marginVertical: spacing.xs,
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: `${colors.primary2}40`,
              backgroundColor: `${colors.primary2}0f`,
            }}
          >
            <Ionicons name="add" size={14} color={colors.primary2} />
            <Text style={[typography.caption, { color: colors.primary2, fontWeight: '700' }]}>
              Add Subcategory
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ====================================================================
   TYPE TOGGLE — segmented control (Expenses | Income)
   ==================================================================== */

const TypeToggle = ({
  value,
  onChange,
}: {
  value: 'expense' | 'income';
  onChange: (t: 'expense' | 'income') => void;
}) => {
  const SEGMENTS: { key: 'expense' | 'income'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'expense', label: 'Expenses', icon: 'trending-down' },
    { key: 'income', label: 'Income', icon: 'trending-up' },
  ];

  const handlePress = (t: 'expense' | 'income') => {
    if (t === value) return;
    onChange(t);
    AccessibilityInfo.announceForAccessibility?.(
      t === 'expense' ? 'Showing expenses' : 'Showing income',
    );
  };

  return (
    <View style={styles.typeToggleContainer} accessibilityRole="tablist">
      {SEGMENTS.map((seg) => {
        const active = seg.key === value;
        return (
          <TouchableOpacity
            key={seg.key}
            onPress={() => handlePress(seg.key)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={seg.label}
            style={[styles.typeSegment, active && styles.typeSegmentActive]}
          >
            <Ionicons
              name={seg.icon}
              size={14}
              color={active ? colors.text : colors.textMuted}
              style={{ marginRight: spacing.xs }}
            />
            <Text
              style={[
                typography.smallBold,
                { fontSize: 12, color: active ? colors.text : colors.textMuted },
              ]}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  const [color, setColor] = useState(PICKER_COLORS[0]);
  const [icon, setIcon] = useState('home');

  const handleSave = () => {
    if (name.trim()) {
      onSave({ name: name.trim(), budget, color, icon });
    }
  };

  const handleClose = () => {
    setName('');
    setBudget('');
    setColor(PICKER_COLORS[0]);
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
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Text style={styles.sheetLabel}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Category name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                style={styles.sheetInput}
              />

              {/* Monthly Budget (optional) */}
              <Text style={styles.sheetLabel}>
                Monthly Budget{' '}
                <Text style={{ color: colors.textDark, fontWeight: '400' }}>(optional)</Text>
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                <Text style={[typography.h3, { color: colors.primary2, fontWeight: '800' }]}>$</Text>
                <TextInput
                  value={budget}
                  onChangeText={setBudget}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.sheetInput, { flex: 1, marginBottom: 0 }]}
                />
              </View>

              {/* Color */}
              <Text style={styles.sheetLabel}>Color</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                {PICKER_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.md,
                      backgroundColor: c,
                      borderWidth: 2,
                      borderColor: color === c ? '#fff' : 'transparent',
                    }}
                  />
                ))}
              </View>

              {/* Icon */}
              <Text style={styles.sheetLabel}>Icon</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                {PICKER_ICONS.map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setIcon(i)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: icon === i ? `${color}22` : colors.glassLight,
                      borderWidth: 1.5,
                      borderColor: icon === i ? color : colors.borderGlass,
                    }}
                  >
                    <Ionicons
                      name={resolveIcon(i)}
                      size={20}
                      color={icon === i ? color : colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              <Text style={styles.sheetLabel}>Preview</Text>
              <View style={styles.previewCard}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    backgroundColor: `${color}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={resolveIcon(icon)} size={18} color={color} />
                </View>
                <View>
                  <Text style={[typography.bodyBold, { color: colors.text, fontWeight: '700' }]}>
                    {name || 'Category Name'}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: budget ? colors.success : colors.textDark,
                        fontWeight: '600',
                        marginTop: 2,
                      },
                    ]}
                  >
                    {budget ? `$${parseFloat(budget || '0').toFixed(2)} / month` : 'No budget set'}
                  </Text>
                </View>
              </View>

              {/* Save */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={!name.trim() || saving}
                activeOpacity={0.85}
                style={[(!name.trim() || saving) && { opacity: 0.5 }]}
              >
                <LinearGradient
                  colors={[...gradients.primaryGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveText}>{saving ? 'Creating...' : 'Create Category'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ====================================================================
   HERO SUMMARY CARD
   ==================================================================== */

const BudgetHeroSummary = ({
  type,
  totalBudgeted,
  totalSpent,
  totalRemaining,
  usedPct,
  budgetedCount,
}: {
  type: 'expense' | 'income';
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  usedPct: number;
  budgetedCount: number;
}) => {
  const status = budgetStatus(totalSpent, totalBudgeted);
  const statusColor = STATUS_COLOR[status];
  const overAmount = totalSpent - totalBudgeted;
  const isOver = overAmount > 0 && totalBudgeted > 0;

  // Spent color follows the status model; on-track stays neutral.
  const spentColor = status === 'ontrack' ? colors.text : statusColor;

  return (
    <View
      style={styles.heroCard}
      accessible
      accessibilityLabel={`${type === 'expense' ? 'Expense' : 'Income'} budget, ${
        STATUS_WORD[status]
      }, ${usedPct} percent ${type === 'expense' ? 'used' : 'earned'}. Budgeted ${fmt(
        totalBudgeted,
      )}, spent ${fmt(totalSpent)}, remaining ${fmt(totalRemaining)}.`}
    >
      {/* Label + status badge */}
      <View style={styles.heroTopRow}>
        <Text style={styles.heroLabel}>
          {type === 'expense' ? 'EXPENSE BUDGET' : 'INCOME BUDGET'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1f` }]}>
          <Ionicons name={STATUS_ICON[status]} size={12} color={statusColor} />
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
            {STATUS_WORD[status]} · {usedPct}% {type === 'expense' ? 'used' : 'earned'}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.heroStatsRow}>
        <View>
          <Text style={styles.statLabel}>Budgeted</Text>
          <Text style={styles.statValue}>{fmtShort(totalBudgeted)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.statLabel}>{type === 'expense' ? 'Spent' : 'Earned'}</Text>
          <Text style={[styles.statValue, { color: spentColor }]}>{fmtShort(totalSpent)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.statLabel}>{isOver ? 'Over by' : 'Remaining'}</Text>
          <Text
            style={[
              styles.statValue,
              { color: isOver ? colors.error : colors.success },
            ]}
          >
            {isOver ? `-${fmtShort(overAmount)}` : fmtShort(totalRemaining)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.heroBarRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar percent={usedPct} color={statusColor} height={6} />
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{usedPct}%</Text>
      </View>

      {/* Footer meta */}
      <View style={styles.heroFooter}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {budgetedCount} categories budgeted
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          {isOver ? `${fmt(overAmount)} over` : `${fmt(totalRemaining)} left`}
        </Text>
      </View>
    </View>
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
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [aiCategorizing, setAiCategorizing] = useState(false);
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
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
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
      const unverifiedByCategoryId: Record<string, number> = {};

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
          // Also accumulate spending + unverified counts from the categories
          // array inside each budget.
          for (const cat of b.categories || []) {
            spentByCategoryId[cat.id] = (spentByCategoryId[cat.id] || 0) + cat.spent;
            if (cat.unverified_count) {
              unverifiedByCategoryId[cat.id] =
                (unverifiedByCategoryId[cat.id] || 0) + cat.unverified_count;
            }
            for (const sub of cat.subcategories || []) {
              spentByCategoryId[sub.id] = (spentByCategoryId[sub.id] || 0) + sub.spent;
              if (sub.unverified_count) {
                unverifiedByCategoryId[sub.id] =
                  (unverifiedByCategoryId[sub.id] || 0) + sub.unverified_count;
              }
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
            color: sub.color || cat.color || colors.primary,
            icon: sub.icon,
            type: sub.type || cat.type || 'expense',
            user_id: sub.user_id,
            parent_id: sub.parent_id,
            budget_id: sub.budget_id || subBudgetInfo?.budget_id || null,
            budget_amount: subBudgetInfo?.budgeted ?? null,
            spent: subSpent,
            unverified_count: unverifiedByCategoryId[sub.id] || 0,
          };
        });

        return {
          id: cat.id,
          name: cat.name,
          color: cat.color || colors.primary,
          icon: cat.icon,
          type: cat.type || 'expense',
          user_id: cat.user_id,
          budget_id: cat.budget_id || budgetInfo?.budget_id || null,
          budget_amount: budgetInfo?.budgeted ?? null,
          spent: catSpent,
          unverified_count: unverifiedByCategoryId[cat.id] || 0,
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
      setLoadedOnce(true);
    }
  }, [monthYear.month, monthYear.year, buildMergedView]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const runAICategorize = useCallback(async () => {
    if (aiCategorizing) return;
    setAiCategorizing(true);
    try {
      const res = await aiCategorizeTransactions();
      const applied = res?.applied ?? 0;
      const classified = res?.classified ?? 0;
      if (applied > 0) {
        Alert.alert(
          'AI Categorize',
          `Classified ${classified} merchant${classified !== 1 ? 's' : ''}, applied to ${applied} transaction${applied !== 1 ? 's' : ''}.`,
        );
        loadData();
      } else {
        Alert.alert('AI Categorize', 'No uncategorized transactions to classify.');
      }
    } catch (e) {
      console.error('AI categorize error:', e);
      Alert.alert('Error', 'AI categorization failed. Please try again.');
    } finally {
      setAiCategorizing(false);
    }
  }, [aiCategorizing, loadData]);

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
          // Update just the amount of an existing budget — leaves the
          // category link intact.
          await api.patch(`/auth/budgets/${budgetId}/amount`, {
            user_id: userId,
            amount,
          });
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
              color: colors.primary,
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

  const showSkeleton = loading && !loadedOnce;

  /* ====================================================================
     RENDER
     ==================================================================== */

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header — slim single row */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <BackButton iconName="chevron-back" color={colors.textMuted} fallback="/(tabs)/goals" />
            <Text style={styles.headerTitle}>Budget</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {loading && loadedOnce && !aiCategorizing && (
              <ActivityIndicator size="small" color={colors.primary2} />
            )}
            <TouchableOpacity
              onPress={runAICategorize}
              disabled={aiCategorizing}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="AI categorize transactions"
              style={styles.iconBtn}
            >
              {aiCategorizing ? (
                <ActivityIndicator size="small" color={colors.primary2} />
              ) : (
                <Ionicons name="sparkles-outline" size={16} color={colors.primary2} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/settings/budget-settings' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Budget settings"
              style={styles.iconBtn}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Add category"
            >
              <LinearGradient
                colors={[...gradients.primaryGradient]}
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
          <TouchableOpacity
            onPress={() => changeMonth(-1)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Ionicons name="chevron-back" size={18} color={colors.primary2} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={() => changeMonth(1)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.primary2} />
          </TouchableOpacity>
        </View>

        {/* Type Toggle */}
        <View style={styles.toggleWrap}>
          <TypeToggle value={type} onChange={setType} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary2}
              colors={[colors.primary2]}
            />
          }
        >
          {showSkeleton ? (
            <View style={{ gap: spacing.md }}>
              {/* Hero-shaped skeleton */}
              <Skeleton height={140} borderRadius={radius.xl} />
              {/* Section header skeleton */}
              <Skeleton height={40} borderRadius={radius.md} />
              {/* Category card skeletons */}
              <Skeleton height={64} borderRadius={radius.lg} />
              <Skeleton height={64} borderRadius={radius.lg} />
              <Skeleton height={64} borderRadius={radius.lg} />
            </View>
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
              <BudgetHeroSummary
                type={type}
                totalBudgeted={totalBudgetedAmount}
                totalSpent={totalSpentAmount}
                totalRemaining={totalRemaining}
                usedPct={usedPct}
                budgetedCount={budgeted.length}
              />

              {/* Empty state for no categories at all */}
              {filtered.length === 0 && (
                <EmptyState
                  icon="wallet-outline"
                  title={`No ${type} categories yet`}
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
                    accessibilityRole="button"
                    accessibilityLabel={`Budgeted, ${budgeted.length} categories, ${fmt(
                      totalBudgetedAmount,
                    )} total, ${budgetedExpanded ? 'expanded' : 'collapsed'}. Double tap to toggle.`}
                    style={styles.sectionHeader}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={[styles.sectionIcon, { backgroundColor: `${colors.success}1f` }]}>
                        <Ionicons name="wallet-outline" size={14} color={colors.success} />
                      </View>
                      <View>
                        <Text style={styles.sectionTitle}>Budgeted ({budgeted.length})</Text>
                        <Text style={[typography.caption, { color: colors.success }]}>
                          {fmt(totalBudgetedAmount)} total
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={budgetedExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
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
                    <View style={styles.inlineNote}>
                      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                        {'No budgeted categories yet. Tap "+ Set" on a category to get started.'}
                      </Text>
                    </View>
                  )}

                  {/* ═══ UNBUDGETED SECTION ═══ */}
                  {unbudgeted.length > 0 && (
                    <>
                      <TouchableOpacity
                        onPress={() => setUnbudgetedExpanded(!unbudgetedExpanded)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Unbudgeted, ${unbudgeted.length} categories, ${
                          unbudgetedExpanded ? 'expanded' : 'collapsed'
                        }. Double tap to toggle.`}
                        style={[styles.sectionHeader, { marginTop: spacing.xs }]}
                      >
                        <View style={styles.sectionHeaderLeft}>
                          <View
                            style={[styles.sectionIcon, { backgroundColor: `${colors.textMuted}1f` }]}
                          >
                            <Ionicons name="help-circle-outline" size={14} color={colors.textMuted} />
                          </View>
                          <View>
                            <Text style={styles.sectionTitle}>
                              Unbudgeted ({unbudgeted.length})
                            </Text>
                            <Text style={[typography.caption, { color: colors.textMuted }]}>
                              {totalUnbudgetedSpent > 0
                                ? `${fmt(totalUnbudgetedSpent)} spent`
                                : 'Tap to set a budget'}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={unbudgetedExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.textMuted}
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

              <View style={{ height: spacing.lg }} />
            </>
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add category"
        >
          <LinearGradient
            colors={[...gradients.primaryGradient]}
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
    </GradientBackground>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
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
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  monthLabel: {
    color: colors.text,
    ...typography.bodyBold,
    fontWeight: '700',
  },

  /* Type toggle */
  toggleWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  typeToggleContainer: {
    ...glassEffects.glass,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    padding: 2,
  },
  typeSegment: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  typeSegmentActive: {
    backgroundColor: colors.primary,
  },

  /* Hero card */
  heroCard: {
    ...glassEffects.glassFloating,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '800',
  },
  heroBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },

  /* Section headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.smallBold,
    color: colors.text,
    fontWeight: '700',
  },
  inlineNote: {
    ...glassEffects.glass,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  /* Category group card */
  categoryGroupCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },

  /* Row chips */
  rowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  rowChipText: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 30,
    right: spacing.lg,
    zIndex: 10,
  },
  fabGradient: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
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
    backgroundColor: colors.surfaceDark,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    maxHeight: Dimensions.get('window').height * 0.85,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderBottomWidth: 0,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetLabel: {
    color: colors.textMuted,
    ...typography.smallBold,
    fontWeight: '700',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
    backgroundColor: colors.glassMedium,
    marginBottom: spacing.sm,
  },
  previewCard: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  saveBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveText: {
    color: '#fff',
    ...typography.button,
    fontWeight: '800',
  },
});
