import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { successHaptic, errorHaptic } from '@/utils/haptics';
import CategoryPicker from '@/components/CategoryPicker';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import BackButton from '@/components/BackButton';
import {
  colors,
  spacing,
  radius,
  typography,
  gradients,
  glassEffects,
} from '@/utils/design-system';
import {
  BudgetAddFrequencyChips,
  type BudgetFrequency,
} from '@/components/budget-add-FrequencyChips';
import { BudgetAddStartDateField } from '@/components/budget-add-StartDateField';

type BudgetType = 'expense' | 'income';

const FREQ_ECHO: Record<BudgetFrequency, string> = {
  'one-time': 'one-time',
  weekly: 'per week',
  biweekly: 'every 2 weeks',
  monthly: 'per month',
  '1st-15th': 'on the 1st & 15th',
};

export default function AddBudgetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefill_category_id?: string; prefill_name?: string }>();

  const hasPrefill = !!params.prefill_category_id || !!params.prefill_name;

  const [name, setName] = useState(params.prefill_name ?? '');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BudgetType>('expense');
  const [categoryId, setCategoryId] = useState(params.prefill_category_id ?? '');
  const [categoryLabel, setCategoryLabel] = useState(params.prefill_name ?? '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categories, setCategories] = useState<{ label: string; value: string }[]>([]);
  const [frequency, setFrequency] = useState<BudgetFrequency>('monthly');
  const [date, setDate] = useState(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [userId, setUserId] = useState('');

  const [bootLoading, setBootLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // touched flags for gentle inline hints (don't shout on first render)
  const [nameTouched, setNameTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);

  const isSemanticExpense = type === 'expense';
  const semanticColor = isSemanticExpense ? colors.error : colors.success;

  // ── Category load (re-fetches per type; also drives the empty-state affordance) ──
  const fetchCategories = async (forType: BudgetType, uid: string) => {
    const [defaults, userCats] = await Promise.all([
      api.get(`/auth/categories`, { type: forType }).catch(() => []),
      uid ? api.get(`/auth/categories/user/${uid}`).catch(() => []) : Promise.resolve([]),
    ]);

    const filteredUserCats = (Array.isArray(userCats) ? userCats : []).filter(
      (c: any) => c.type?.toLowerCase() === forType.toLowerCase(),
    );

    const merged = [...(Array.isArray(defaults) ? defaults : []), ...filteredUserCats];
    const deduped = merged.reduce((acc: any[], curr: any) => {
      if (!acc.find((c) => c.id === curr.id || c.name === curr.name)) acc.push(curr);
      return acc;
    }, []);
    return deduped.map((c: any) => ({ label: c.name, value: c.id }));
  };

  // Initial boot: resolve user, load categories for the default type.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await getCurrentUser();
        const uid = user?.id ?? '';
        if (alive && uid) setUserId(uid);
        const items = await fetchCategories(type, uid);
        if (alive) setCategories(items);
      } catch (error) {
        console.error('Failed to load categories', error);
      } finally {
        if (alive) setBootLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch categories whenever the type changes (skip the very first boot run).
  const didBoot = useRef(false);
  useEffect(() => {
    if (!didBoot.current) {
      didBoot.current = true;
      return;
    }
    let alive = true;
    (async () => {
      try {
        const items = await fetchCategories(type, userId);
        if (alive) setCategories(items);
      } catch (error) {
        console.error('Failed to load categories', error);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ── Derived validity — single source of truth for the CTA ──
  const parsedAmount = parseFloat(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const nameValid = name.trim().length > 0;
  const categoryValid = !!categoryId;
  const isValid = nameValid && amountValid && categoryValid && !!frequency && !!type && !!date;

  const noCategories = !bootLoading && categories.length === 0;

  const handleTypeChange = (next: BudgetType) => {
    if (next === type) return;
    setType(next);
    // Reset category on type switch (list re-fetches via the [type] effect).
    setCategoryId('');
    setCategoryLabel('');
  };

  const handleSave = async () => {
    if (!isValid || saving) {
      setNameTouched(true);
      setAmountTouched(true);
      return;
    }
    setSaving(true);
    setSaveError(false);

    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      setSaving(false);
      return;
    }

    const body = {
      name,
      amount: parsedAmount,
      type,
      frequency,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      category_id: categoryId,
      user_id: currentUser.id,
      start_date: date.toISOString(),
    };

    try {
      await api.post('/auth/budgets', body);
      successHaptic();
      router.back();
    } catch (err) {
      console.error('Save error', err);
      errorHaptic();
      setSaveError(true);
      setSaving(false);
    }
  };

  const amountLen = (amount || '').length;

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/budget" />
          <View style={styles.headerCenter}>
            <Text style={styles.title}>New Budget</Text>
            <Text style={styles.subtitle}>Set a limit to keep spending on track</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => dateOpen && setDateOpen(false)}
          >
            {bootLoading && !hasPrefill ? (
              <SkeletonForm />
            ) : (
              <>
                {/* ── Type segmented control ── */}
                <View style={styles.segmentTrack} accessibilityRole="tablist">
                  <TouchableOpacity
                    style={[styles.segment, type === 'expense' && styles.segmentActiveExpense]}
                    onPress={() => handleTypeChange('expense')}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: type === 'expense' }}
                  >
                    <Ionicons
                      name="card-outline"
                      size={18}
                      color={type === 'expense' ? colors.error : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        type === 'expense' && { color: colors.error, fontWeight: '700' },
                      ]}
                    >
                      Expense
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, type === 'income' && styles.segmentActiveIncome]}
                    onPress={() => handleTypeChange('income')}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: type === 'income' }}
                  >
                    <Ionicons
                      name="trending-up"
                      size={18}
                      color={type === 'income' ? colors.success : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        type === 'income' && { color: colors.success, fontWeight: '700' },
                      ]}
                    >
                      Income
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ── Amount hero ── */}
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>BUDGET AMOUNT</Text>
                  <View style={styles.heroRow}>
                    <Text style={[styles.heroSign, { color: semanticColor }]}>
                      {isSemanticExpense ? '−' : '+'}
                    </Text>
                    <Text style={[styles.heroCurrency, { color: semanticColor }]}>$</Text>
                    <TextInput
                      style={[styles.heroInput, { color: semanticColor }]}
                      value={amount}
                      onChangeText={setAmount}
                      onBlur={() => setAmountTouched(true)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      accessibilityLabel="Budget amount"
                      adjustsFontSizeToFit={amountLen > 10}
                      numberOfLines={1}
                    />
                  </View>
                  <Text style={styles.heroEcho}>{FREQ_ECHO[frequency]}</Text>
                  {amountTouched && !amountValid && (
                    <View style={styles.hintRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                      <Text style={styles.hintText}>Enter a budget amount</Text>
                    </View>
                  )}
                </View>

                {/* ── Details card ── */}
                <View style={styles.detailsCard}>
                  {/* Name */}
                  <Text style={styles.fieldLabel}>Name</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="text-outline" size={18} color={colors.textMuted} style={styles.leadingIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      value={name}
                      onChangeText={setName}
                      onBlur={() => setNameTouched(true)}
                      placeholder="Budget name"
                      placeholderTextColor={colors.textMuted}
                      numberOfLines={1}
                    />
                  </View>
                  {nameTouched && !nameValid && (
                    <View style={styles.hintRow}>
                      <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                      <Text style={styles.hintText}>Name your budget</Text>
                    </View>
                  )}

                  {/* Category */}
                  <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Category</Text>
                  {noCategories ? (
                    <TouchableOpacity
                      style={styles.emptyCategoryRow}
                      onPress={() => setShowCategoryPicker(true)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`No ${type} categories yet, create one`}
                    >
                      <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} style={styles.leadingIcon} />
                      <Text style={styles.emptyCategoryText} numberOfLines={1}>
                        No {type} categories yet
                      </Text>
                      <Text style={styles.emptyCreateText}>+ Create</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.inputRow}
                      onPress={() => setShowCategoryPicker(true)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Category, ${categoryLabel || 'none'}, opens picker`}
                    >
                      <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} style={styles.leadingIcon} />
                      <Text
                        style={[styles.fieldInput, !categoryId && styles.placeholderText]}
                        numberOfLines={1}
                      >
                        {categoryLabel || 'Tap to select category'}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.textDark} style={styles.trailingIcon} />
                    </TouchableOpacity>
                  )}

                  {/* Frequency */}
                  <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Frequency</Text>
                  <BudgetAddFrequencyChips value={frequency} onChange={setFrequency} />

                  {/* Start date */}
                  <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Start date</Text>
                  <BudgetAddStartDateField
                    value={date}
                    onChange={setDate}
                    open={dateOpen}
                    onToggle={() => setDateOpen((o) => !o)}
                  />
                </View>

                {/* ── Inline save error ── */}
                {saveError && (
                  <View style={styles.errorCard}>
                    <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                    <View style={styles.errorTextWrap}>
                      <Text style={styles.errorTitle}>Couldn't save budget</Text>
                      <Text style={styles.errorSub}>Check your connection and try again.</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* ── Sticky footer CTA ── */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={!isValid || saving || bootLoading}
              accessibilityRole="button"
              accessibilityLabel="Save budget"
              accessibilityState={{ disabled: !isValid || saving }}
              style={(!isValid || bootLoading) && !saving ? styles.ctaDisabled : undefined}
            >
              <LinearGradient
                colors={[...gradients.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {saving ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.ctaText}>Saving…</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.ctaText}>Save Budget</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {userId !== '' && (
          <CategoryPicker
            visible={showCategoryPicker}
            onClose={() => setShowCategoryPicker(false)}
            onSelect={(selected) => {
              setCategoryId(selected.id);
              const label = selected.parent_name
                ? `${selected.parent_name} > ${selected.name}`
                : selected.name;
              setCategoryLabel(label);
              if (!name.trim()) {
                setName(selected.name);
              }
              setShowCategoryPicker(false);
            }}
            type={type}
            userId={userId}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Loading skeleton for the form body ──
function SkeletonForm() {
  return (
    <View style={{ gap: spacing.lg }}>
      <Skeleton height={48} borderRadius={radius.md} />
      <View style={styles.heroCard}>
        <Skeleton width={110} height={12} borderRadius={radius.sm} />
        <View style={{ height: spacing.md }} />
        <Skeleton width={180} height={40} borderRadius={radius.md} />
      </View>
      <View style={styles.detailsCard}>
        <Skeleton width={60} height={14} borderRadius={radius.sm} />
        <View style={{ height: spacing.sm }} />
        <Skeleton height={48} borderRadius={radius.md} />
        <View style={{ height: spacing.md }} />
        <Skeleton width={80} height={14} borderRadius={radius.sm} />
        <View style={{ height: spacing.sm }} />
        <Skeleton height={48} borderRadius={radius.md} />
        <View style={{ height: spacing.md }} />
        <Skeleton width={90} height={14} borderRadius={radius.sm} />
        <View style={{ height: spacing.sm }} />
        <Skeleton height={44} borderRadius={radius.md} />
        <View style={{ height: spacing.md }} />
        <Skeleton height={48} borderRadius={radius.md} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: { color: colors.text, ...typography.h3, fontWeight: '800' },
  subtitle: { color: colors.textMuted, ...typography.small, marginTop: 2 },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },

  // Type segmented control
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActiveExpense: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.30)',
  },
  segmentActiveIncome: {
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderColor: 'rgba(34,197,94,0.30)',
  },
  segmentText: { ...typography.small, color: colors.textMuted },

  // Amount hero
  heroCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '600',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    maxWidth: '100%',
  },
  heroSign: { ...typography.h1 },
  heroCurrency: { ...typography.h1, marginLeft: 2 },
  heroInput: {
    ...typography.h1,
    minWidth: 40,
    marginLeft: 2,
    padding: 0,
    textAlign: 'left',
  },
  heroEcho: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Details card
  detailsCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
  },
  fieldLabel: { ...typography.smallBold, color: colors.text, marginBottom: spacing.sm },
  fieldSpacer: { marginTop: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  leadingIcon: { marginRight: spacing.sm },
  trailingIcon: { flexShrink: 0, marginLeft: spacing.sm },
  fieldInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    padding: 0,
  },
  placeholderText: { color: colors.textMuted },

  // Empty category affordance
  emptyCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  emptyCategoryText: { flex: 1, ...typography.body, color: colors.textMuted },
  emptyCreateText: { ...typography.smallBold, color: colors.primary2, flexShrink: 0 },

  // Inline hints
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  hintText: { ...typography.caption, color: colors.error },

  // Inline save error card
  errorCard: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorTextWrap: { flex: 1 },
  errorTitle: { ...typography.smallBold, color: colors.text },
  errorSub: { ...typography.small, color: colors.textMuted, marginTop: 2 },

  // Sticky footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...typography.button, color: '#fff' },
});
