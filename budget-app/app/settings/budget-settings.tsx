import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { v4 as uuidv4 } from 'uuid';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

// ── Types ──

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  limit_amount?: number;
  rollover_enabled?: boolean;
  budget_id?: string | null;
};

type BudgetGroup = {
  id: string;
  name: string;
  type: 'income' | 'expense';
};

// Per-category / swatch accent colors are a sanctioned per-item-color exception
// to the no-literal rule (categories carry their own `color`). Documented as the
// AddCategorySheet swatchPalette.
const SWATCH_PALETTE = ['#7c3aed', '#22c55e', '#ef4444', '#06b6d4', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'];

// The documented ≈12% semantic accent tint (primary2 @ 0x1f alpha).
const ACCENT_TINT = `${colors.primary2}1f`;

// Thousands-separated, no-cents money — the hero/committed figure grammar.
// (formatCurrency from the design system emits fixed decimals without grouping,
// so for the whole-dollar budget figures we format with grouping here.)
const money = (v?: number) =>
  '$' + Math.round(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// ── Scope Toggle (Expenses | Income) — budget-tab-TypeToggle grammar ──

function ScopeToggle({
  value,
  onChange,
}: {
  value: 'income' | 'expense';
  onChange: (t: 'income' | 'expense') => void;
}) {
  return (
    <View style={styles.toggleRow}>
      {(['expense', 'income'] as const).map((t) => {
        const active = value === t;
        return (
          <TouchableOpacity
            key={t}
            style={[styles.toggle, active && styles.toggleActive]}
            onPress={() => onChange(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t === 'expense' ? 'Expenses' : 'Income'}
          >
            <Ionicons
              name={t === 'expense' ? 'cart-outline' : 'cash-outline'}
              size={16}
              color={active ? colors.primary2 : colors.textMuted}
              style={{ marginRight: spacing.xs + 2 }}
            />
            <Text style={active ? styles.toggleTextActive : styles.toggleText}>
              {t === 'expense' ? 'Expenses' : 'Income'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Budget Hero (Tier 1 — glassFloating, h1) ──

function BudgetHero({
  scope,
  onScope,
  total,
  count,
  rolloverCount,
  errored,
}: {
  scope: 'income' | 'expense';
  onScope: (t: 'income' | 'expense') => void;
  total: number;
  count: number;
  rolloverCount: number;
  errored: boolean;
}) {
  const proof =
    `${count} ${count === 1 ? 'category' : 'categories'}` +
    (rolloverCount > 0 ? ` · ${rolloverCount} with rollover` : '');

  return (
    <View
      style={styles.hero}
      accessible
      accessibilityLabel={`Total monthly budget, ${errored ? 'unavailable' : money(total)}, ${proof}. Scope: ${
        scope === 'expense' ? 'Expenses' : 'Income'
      } selected.`}
    >
      <ScopeToggle value={scope} onChange={onScope} />
      <Text style={styles.heroLabel}>TOTAL MONTHLY BUDGET</Text>
      <Text style={styles.heroValue}>{errored ? '—' : money(total)}</Text>
      <Text style={styles.heroProof}>{proof}</Text>
    </View>
  );
}

// ── Category Row (Tier 2 — flat glass, expandable) ──

function CategoryRow({
  cat,
  scope,
  expanded,
  onToggle,
  budgetOptions,
  onUpdate,
  onDelete,
}: {
  cat: Category;
  scope: 'income' | 'expense';
  expanded: boolean;
  onToggle: () => void;
  budgetOptions: BudgetGroup[];
  onUpdate: (updates: Partial<Category>) => void;
  onDelete: () => void;
}) {
  const committed = (cat.limit_amount || 0) > 0;
  const accent = cat.color || colors.primary2;
  const groupName = budgetOptions.find((b) => b.id === cat.budget_id)?.name;
  const subtitle = committed
    ? `${groupName || 'No group'}${cat.rollover_enabled ? ' · Rollover' : ''}`
    : 'No group · Tap to set a limit';

  const chevronAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: expanded ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded, chevronAnim]);
  const rotate = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={[styles.catCard, !committed && styles.catCardUntracked]}>
      <TouchableOpacity
        style={styles.catHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${cat.name}, ${committed ? `${money(cat.limit_amount)} per month` : 'no limit set'}, ${
          groupName || 'no group'
        }, rollover ${cat.rollover_enabled ? 'on' : 'off'}`}
        accessibilityHint="Double tap to edit"
      >
        <View style={[styles.catIcon, { backgroundColor: `${accent}20`, borderColor: `${accent}40` }]}>
          <Ionicons
            name={scope === 'expense' ? 'cart-outline' : 'cash-outline'}
            size={16}
            color={accent}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.catName} numberOfLines={1}>
            {cat.name}
          </Text>
          <Text style={styles.catSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        {committed ? (
          <Text style={styles.catAmount}>{money(cat.limit_amount)}/mo</Text>
        ) : (
          <Text style={styles.catNoLimit}>No limit</Text>
        )}

        {cat.rollover_enabled && (
          <View style={styles.rollBadge} accessibilityLabel="Rollover enabled">
            <Ionicons name="refresh" size={13} color={colors.primary2} />
          </View>
        )}

        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.editor}>
          {/* Monthly limit */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Monthly limit</Text>
            <TextInput
              style={styles.fieldInput}
              keyboardType="numeric"
              placeholderTextColor={colors.textDark}
              defaultValue={cat.limit_amount ? String(cat.limit_amount) : ''}
              onEndEditing={(e) =>
                onUpdate({ limit_amount: e.nativeEvent.text ? parseFloat(e.nativeEvent.text) : 0 })
              }
              placeholder="$0"
            />
          </View>

          {/* Group */}
          {budgetOptions.length > 0 && (
            <View style={styles.fieldRowStacked}>
              <Text style={styles.fieldLabel}>Group</Text>
              <View style={styles.segmented}>
                <TouchableOpacity
                  style={[styles.segItem, !cat.budget_id && styles.segItemActive]}
                  onPress={() => onUpdate({ budget_id: null })}
                >
                  <Text style={!cat.budget_id ? styles.segTextActive : styles.segText}>None</Text>
                </TouchableOpacity>
                {budgetOptions.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.segItem, cat.budget_id === b.id && styles.segItemActive]}
                    onPress={() => onUpdate({ budget_id: b.id })}
                  >
                    <Text style={cat.budget_id === b.id ? styles.segTextActive : styles.segText}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Rollover */}
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Rollover</Text>
            <Switch
              value={!!cat.rollover_enabled}
              onValueChange={(v) => onUpdate({ rollover_enabled: v })}
              thumbColor={colors.text}
              trackColor={{ true: colors.primary2, false: colors.glassMedium }}
              accessibilityRole="switch"
              accessibilityState={{ checked: !!cat.rollover_enabled }}
            />
          </View>

          <View style={styles.editorDivider} />

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${cat.name}`}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={styles.deleteText}>Delete category</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ──

export default function BudgetSettingsScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [auth, setAuth] = useState<{ id: string; token?: string } | null>(null);
  const [budgets, setBudgets] = useState<BudgetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add-sheet state (relocated verbatim)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SWATCH_PALETTE[0]);
  const [newLimit, setNewLimit] = useState('');
  const [newRollover, setNewRollover] = useState(false);
  const [newBudgetId, setNewBudgetId] = useState('');
  const [sharePartner, setSharePartner] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const user = await getCurrentUser();
    if (!user?.id) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    setAuth({ id: user.id, token: user.token });

    let ok = true;
    try {
      const catData = await api.get(`/auth/categories/user/${user.id}`);
      setCategories(Array.isArray(catData) ? catData : []);
    } catch (e) {
      console.error('Failed to load categories:', e);
      ok = false;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const budgetData = await api.get(`/auth/budgets/user/${user.id}`, { month, year });
      setBudgets(Array.isArray(budgetData) ? budgetData : []);
    } catch (e) {
      console.error('Failed to load budgets:', e);
    }

    setLoadError(!ok);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = categories.filter((c) => c.type === type);
  const budgetOptions = budgets.filter((b) => b.type === type);
  const totalMonthlyBudget = filtered.reduce((sum, c) => sum + (c.limit_amount || 0), 0);
  const rolloverCount = filtered.filter((c) => c.rollover_enabled).length;

  const updateCategory = async (cat: Category, updates: Partial<Category>) => {
    if (!auth?.id) {
      Alert.alert('Session', 'Please log in again.');
      return;
    }
    // Optimistic
    const prevSnapshot = categories;
    setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...updates } : c)));
    try {
      const updated: any = await api.put(`/auth/categories/${cat.id}`, {
        name: updates.name ?? cat.name,
        color: updates.color ?? cat.color,
        limit_amount: updates.limit_amount ?? cat.limit_amount ?? 0,
        rollover_enabled: updates.rollover_enabled ?? cat.rollover_enabled ?? false,
        budget_id: updates.budget_id ?? cat.budget_id ?? null,
      });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...updated } : c)));
    } catch (e) {
      console.error('Failed to update category:', e);
      setCategories(prevSnapshot);
      Alert.alert('Error', 'Could not update category');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewColor(SWATCH_PALETTE[0]);
    setNewLimit('');
    setNewRollover(false);
    setNewBudgetId('');
    setSharePartner(false);
  };

  const openSheet = () => {
    resetForm();
    setSheetOpen(true);
  };

  const handleAdd = async () => {
    if (!auth?.id) {
      Alert.alert('Session', 'Please log in again');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Missing name', 'Enter a category name');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: uuidv4(),
        name: newName.trim(),
        type,
        user_id: auth.id,
        color: newColor,
        limit_amount: newLimit ? parseFloat(newLimit) : 0,
        rollover_enabled: newRollover,
        budget_id: newBudgetId || null,
        // TODO wire share flag — sharePartner has no backend payload yet.
      };
      const created: any = await api.post(`/auth/categories`, payload);
      setCategories((prev) => [...prev, created]);
      setSheetOpen(false);
      resetForm();
    } catch (e) {
      console.error('Failed to add category:', e);
      Alert.alert('Error', 'Could not add category');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = (cat: Category) => {
    Alert.alert('Delete', `Remove "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/auth/categories/${cat.id}`);
            setCategories((prev) => prev.filter((c) => c.id !== cat.id));
          } catch (e) {
            console.error('Failed to delete category:', e);
            Alert.alert('Error', 'Could not delete category');
          }
        },
      },
    ]);
  };

  const scopeWord = type === 'expense' ? 'expense' : 'income';

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Fixed header (outside scroll) */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />
          <Text style={styles.title}>Budget Settings</Text>
          <TouchableOpacity
            style={styles.addAction}
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel={`Add ${scopeWord} category`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={22} color={colors.primary2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <>
              {/* Hero skeleton */}
              <View style={styles.hero}>
                <View style={styles.toggleRow}>
                  <Skeleton height={40} borderRadius={radius.md} style={{ flex: 1 }} />
                  <Skeleton height={40} borderRadius={radius.md} style={{ flex: 1 }} />
                </View>
                <Skeleton width={140} height={12} borderRadius={radius.sm} style={{ marginTop: spacing.lg }} />
                <Skeleton width={180} height={34} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
                <Skeleton width={160} height={12} borderRadius={radius.sm} style={{ marginTop: spacing.sm }} />
              </View>
              <Skeleton width={140} height={12} borderRadius={radius.sm} style={{ marginTop: spacing.xl, marginBottom: spacing.sm }} />
              <View style={styles.listCard}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={[styles.skeletonRow, i > 0 && styles.skeletonRowBorder]}>
                    <Skeleton width={36} height={36} borderRadius={radius.md} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Skeleton width="55%" height={14} borderRadius={radius.sm} />
                      <Skeleton width="35%" height={10} borderRadius={radius.sm} />
                    </View>
                    <Skeleton width={60} height={14} borderRadius={radius.sm} />
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <BudgetHero
                scope={type}
                onScope={(t) => {
                  setType(t);
                  setExpandedId(null);
                }}
                total={totalMonthlyBudget}
                count={filtered.length}
                rolloverCount={rolloverCount}
                errored={loadError}
              />

              {/* Section label */}
              {!loadError && filtered.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>
                    {type === 'expense' ? 'EXPENSE CATEGORIES' : 'INCOME CATEGORIES'}
                  </Text>
                  <Text style={styles.sectionCount}>{filtered.length}</Text>
                </View>
              )}

              {/* Error state */}
              {loadError ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="alert-circle-outline" size={26} color={colors.error} />
                  <Text style={styles.noticeTitle}>Couldn't load your categories</Text>
                  <Text style={styles.noticeSub}>Check your connection and try again.</Text>
                  <TouchableOpacity style={styles.noticeRetry} onPress={load} accessibilityRole="button">
                    <Ionicons name="refresh" size={16} color={colors.primary2} />
                    <Text style={styles.noticeRetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : filtered.length === 0 ? (
                /* Empty state */
                <View style={styles.noticeCard}>
                  <Ionicons name="folder-open-outline" size={30} color={colors.textMuted} />
                  <Text style={styles.noticeTitle}>No {scopeWord} categories yet</Text>
                  <Text style={styles.noticeSub}>Add your first category to start budgeting.</Text>
                  <TouchableOpacity style={styles.emptyCta} onPress={openSheet} accessibilityRole="button">
                    <LinearGradient
                      colors={[...gradients.primaryGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.emptyCtaInner}
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                      <Text style={styles.emptyCtaText}>Add category</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Category list */}
                  <View style={styles.listCard}>
                    {filtered.map((cat) => (
                      <CategoryRow
                        key={cat.id}
                        cat={cat}
                        scope={type}
                        expanded={expandedId === cat.id}
                        onToggle={() => setExpandedId((cur) => (cur === cat.id ? null : cat.id))}
                        budgetOptions={budgetOptions}
                        onUpdate={(updates) => updateCategory(cat, updates)}
                        onDelete={() => deleteCategory(cat)}
                      />
                    ))}
                  </View>

                  {/* Add CTA row (Tier 3) */}
                  <TouchableOpacity
                    style={styles.addRow}
                    onPress={openSheet}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${scopeWord} category`}
                  >
                    <Ionicons name="add" size={20} color={colors.primary2} />
                    <Text style={styles.addRowText}>Add {scopeWord} category</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* Add-Category bottom sheet */}
        <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSheetOpen(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>New {scopeWord} category</Text>
                  <TouchableOpacity
                    onPress={() => setSheetOpen(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Name */}
                  <View style={styles.addInputRow}>
                    <View style={[styles.catIcon, { backgroundColor: `${newColor}20`, borderColor: `${newColor}40` }]}>
                      <Ionicons
                        name={type === 'expense' ? 'cart-outline' : 'cash-outline'}
                        size={16}
                        color={newColor}
                      />
                    </View>
                    <TextInput
                      placeholder="Category name"
                      placeholderTextColor={colors.textDark}
                      value={newName}
                      onChangeText={setNewName}
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    />
                  </View>

                  {/* Monthly limit */}
                  <Text style={styles.sheetFieldLabel}>Monthly limit (optional)</Text>
                  <TextInput
                    placeholder="$0"
                    placeholderTextColor={colors.textDark}
                    value={newLimit}
                    onChangeText={setNewLimit}
                    keyboardType="numeric"
                    style={styles.input}
                  />

                  {/* Rollover */}
                  <View style={styles.switchRow}>
                    <Text style={styles.fieldLabel}>Enable rollover</Text>
                    <Switch
                      value={newRollover}
                      onValueChange={setNewRollover}
                      thumbColor={colors.text}
                      trackColor={{ true: colors.primary2, false: colors.glassMedium }}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: newRollover }}
                    />
                  </View>

                  {/* Share with partner */}
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Share with partner</Text>
                      <Text style={styles.fieldHint}>Partner can see this category</Text>
                    </View>
                    <Switch
                      value={sharePartner}
                      onValueChange={setSharePartner}
                      thumbColor={colors.text}
                      trackColor={{ true: colors.primary2, false: colors.glassMedium }}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: sharePartner }}
                    />
                  </View>

                  {/* Color */}
                  <Text style={styles.sheetFieldLabel}>Color</Text>
                  <View style={styles.colorGrid}>
                    {SWATCH_PALETTE.map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setNewColor(c)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Color ${c}`}
                        accessibilityState={{ selected: c === newColor }}
                        style={[styles.colorSwatch, { backgroundColor: c }, c === newColor && styles.colorSwatchActive]}
                      />
                    ))}
                  </View>

                  {/* Group */}
                  {budgetOptions.length > 0 && (
                    <>
                      <Text style={styles.sheetFieldLabel}>Group</Text>
                      <View style={styles.segmented}>
                        <TouchableOpacity
                          style={[styles.segItem, !newBudgetId && styles.segItemActive]}
                          onPress={() => setNewBudgetId('')}
                        >
                          <Text style={!newBudgetId ? styles.segTextActive : styles.segText}>None</Text>
                        </TouchableOpacity>
                        {budgetOptions.map((b) => (
                          <TouchableOpacity
                            key={b.id}
                            style={[styles.segItem, newBudgetId === b.id && styles.segItemActive]}
                            onPress={() => setNewBudgetId(b.id)}
                          >
                            <Text style={newBudgetId === b.id ? styles.segTextActive : styles.segText}>{b.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Save */}
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleAdd}
                    disabled={saving}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Save category"
                  >
                    <LinearGradient
                      colors={[...gradients.primaryGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveBtnInner}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.text} size="small" />
                      ) : (
                        <Text style={styles.saveText}>Save category</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { color: colors.text, ...typography.h3, fontWeight: '800' },
  addAction: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero (Tier 1) */
  hero: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  heroLabel: {
    color: colors.textMuted,
    ...typography.caption,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  heroValue: { color: colors.text, ...typography.h1, marginTop: spacing.xs },
  heroProof: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },

  /* Scope toggle */
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
  },
  toggleActive: { backgroundColor: ACCENT_TINT, borderColor: colors.primary2 },
  toggleText: { color: colors.textMuted, ...typography.smallBold },
  toggleTextActive: { color: colors.primary2, ...typography.smallBold, fontWeight: '800' },

  /* Section label */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: { color: colors.textMuted, ...typography.caption, letterSpacing: 1.2, fontWeight: '700' },
  sectionCount: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },

  /* Category list card (Tier 2) */
  listCard: { ...glassEffects.glass, padding: spacing.xs },
  catCard: {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  catCardUntracked: {
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderLeftColor: colors.borderGlass,
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  catName: { color: colors.text, ...typography.smallBold, fontWeight: '700' },
  catSub: { color: colors.textMuted, ...typography.caption, marginTop: 1 },
  catAmount: { color: colors.text, ...typography.smallBold, fontWeight: '700', flexShrink: 0 },
  catNoLimit: { color: colors.textMuted, ...typography.caption, flexShrink: 0 },
  rollBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: ACCENT_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Expanded editor */
  editor: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
    gap: spacing.sm,
  },
  editorDivider: { height: 1, backgroundColor: colors.borderGlass, marginVertical: spacing.xs },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldRowStacked: { gap: spacing.sm },
  fieldLabel: { color: colors.textMuted, ...typography.smallBold },
  fieldHint: { color: colors.textDark, ...typography.caption, marginTop: 1 },
  fieldInput: {
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.smallBold,
    minWidth: 90,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },

  /* Delete */
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  deleteText: { color: colors.error, ...typography.smallBold, fontWeight: '700' },

  /* Add CTA row (Tier 3) */
  addRow: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  addRowText: { flex: 1, color: colors.text, ...typography.smallBold, fontWeight: '700' },

  /* Notice cards (empty / error) */
  noticeCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeTitle: { color: colors.text, ...typography.bodyBold, fontWeight: '700', textAlign: 'center' },
  noticeSub: { color: colors.textMuted, ...typography.small, textAlign: 'center', paddingHorizontal: spacing.md },
  noticeRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  noticeRetryText: { color: colors.primary2, ...typography.smallBold, fontWeight: '700' },
  emptyCta: { marginTop: spacing.sm, borderRadius: radius.md, overflow: 'hidden' },
  emptyCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  emptyCtaText: { color: colors.text, ...typography.button, fontWeight: '700' },

  /* Skeleton rows */
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  skeletonRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderGlass },

  /* Add sheet */
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.glassStrong,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: { color: colors.text, ...typography.h3 },
  sheetFieldLabel: { color: colors.textMuted, ...typography.smallBold, marginBottom: spacing.sm, marginTop: spacing.md },

  input: {
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },

  /* Segmented */
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  segItem: {
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glassLight,
  },
  segItemActive: { borderColor: colors.primary2, backgroundColor: ACCENT_TINT },
  segText: { color: colors.textMuted, ...typography.caption, fontWeight: '700' },
  segTextActive: { color: colors.primary2, ...typography.caption, fontWeight: '800' },

  /* Colors */
  colorGrid: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: colors.text },

  /* Save */
  saveBtn: { marginTop: spacing.xl, borderRadius: radius.md, overflow: 'hidden' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  saveText: { color: colors.text, ...typography.button, fontWeight: '800' },
});
