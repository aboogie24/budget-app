import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { successHaptic, errorHaptic, lightHaptic } from '@/utils/haptics';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
  commonStyles,
} from '@/utils/design-system';
import { LinearGradient } from 'expo-linear-gradient';

type Category = { id: string; name: string; type: string };
type BudgetData = {
  id: string;
  name: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_at?: string;
};

const FREQUENCIES = ['monthly', 'weekly', 'biweekly', '1st-15th'] as const;

// ── Relative-time helper (additive; degrades gracefully on missing/invalid) ──
function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export default function EditBudget() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState((params.name as string) || '');
  const [amount, setAmount] = useState((params.amount as string) || '');
  const [type, setType] = useState<'income' | 'expense'>(
    (params.type as 'income' | 'expense') || 'expense',
  );
  const [categoryId, setCategoryId] = useState((params.category_id as string) || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [frequency, setFrequency] = useState((params.frequency as string) || 'monthly');
  const [startDate, setStartDate] = useState(() => {
    const raw = params.start_date as string;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [shared, setShared] = useState((params.is_shared as string) === '1');
  const [saving, setSaving] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // ── Data load: current user → budget record → categories ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        // No session — bounce to login rather than a blocking modal.
        router.replace('/login' as any);
        return;
      }
      setCurrentUserId(user.id);

      // Categories (non-fatal — a failed category fetch shouldn't block editing).
      try {
        const catData = await api.get(`/auth/categories/user/${user.id}`);
        setCategories(Array.isArray(catData) ? catData : []);
      } catch (e) {
        console.error('Failed to load categories:', e);
        setCategories([]);
      }

      // Budget record (fatal — drives the load-error surface).
      if (params.id) {
        const data = await api.get(`/auth/budgets/${params.id}`);
        setBudgetData(data);
      }
    } catch (e) {
      console.error('Failed to load budget:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived valid state (replaces the old Alert.alert('Missing fields')) ──
  const amountValid = amount.trim().length > 0 && !isNaN(Number(amount)) && isFinite(Number(amount));
  const nameValid = name.trim().length > 0;
  const isValid = nameValid && amountValid;

  const semanticColor = type === 'expense' ? colors.error : colors.success;
  const signPrefix = type === 'expense' ? '−' : '+';

  const filteredCategories = useMemo(
    () => categories.filter((c) => (c.type || '').toLowerCase() === type),
    [categories, type],
  );

  // Format the amount hero display (keep the raw input, only prettify the shown number).
  const heroDisplay = useMemo(() => {
    if (!amount.trim()) return '0.00';
    const n = Number(amount);
    if (isNaN(n)) return amount;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [amount]);

  const heroTooLong = heroDisplay.length > 10;

  const handleTypeChange = (t: 'income' | 'expense') => {
    if (t === type) return;
    lightHaptic();
    setType(t);
    // If the selected category no longer belongs to the new type, clear it.
    const stillValid = categories.some(
      (c) => c.id === categoryId && (c.type || '').toLowerCase() === t,
    );
    if (!stillValid) setCategoryId('');
  };

  const handleSave = async () => {
    setSaveError(false);
    const user = await getCurrentUser();
    if (!user?.id) {
      router.replace('/login' as any);
      return;
    }
    if (!isValid) {
      setShowValidation(true);
      errorHaptic();
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        amount: parseFloat(amount),
        type,
        category_id: categoryId || undefined,
        start_date: startDate.toISOString(),
        frequency: frequency || 'monthly',
        user_id: user.id,
        id: (params.id as string) || uuidv4(),
        is_shared: shared,
      };
      await api.put(`/auth/budgets/${params.id}`, body);
      successHaptic();
      router.back();
    } catch (e) {
      console.error('Failed to save budget:', e);
      errorHaptic();
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Co-edit banner data ──
  const showCoEdit =
    !!budgetData?.updated_by && budgetData.updated_by !== currentUserId;
  const partnerName = budgetData?.updated_by_name || 'partner';
  const rel = relativeTime(budgetData?.updated_at);

  // Partner glyph: A → primary2 / ◑, B → info / ◐. Fallback neutral dot.
  // We don't know A/B ordering from the record, so tint by name hash for a
  // stable-but-color-independent glyph; the words carry the meaning.
  const glyphIsA = (partnerName.charCodeAt(0) || 0) % 2 === 0;
  const glyphColor = budgetData?.updated_by
    ? glyphIsA
      ? colors.primary2
      : colors.info
    : colors.textMuted;
  const glyph = budgetData?.updated_by ? (glyphIsA ? '◑' : '◐') : '•';

  const formattedDate = startDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // ─────────────────────────────────────────────────────────────
  // Header (shared across all states)
  // ─────────────────────────────────────────────────────────────
  const Header = (
    <View style={styles.header}>
      <BackButton fallback="/(tabs)/budget" size={20} />
      <View style={styles.headerCenter}>
        <Text style={styles.title}>Edit Budget</Text>
        <Text style={styles.subtitle}>Update this recurring budget line</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );

  // ─────────────────────────────────────────────────────────────
  // Loading skeleton (§3.2)
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.heroCard, { gap: spacing.md }]}>
              <Skeleton width={80} height={12} borderRadius={radius.sm} style={{ alignSelf: 'center' }} />
              <Skeleton width={180} height={36} borderRadius={radius.md} style={{ alignSelf: 'center' }} />
              <Skeleton height={44} borderRadius={radius.md} />
            </View>
            <View style={[styles.detailsCard, { gap: spacing.md }]}>
              <Skeleton width={60} height={12} borderRadius={radius.sm} />
              <Skeleton height={48} borderRadius={radius.md} />
              <Skeleton width={80} height={12} borderRadius={radius.sm} />
              <Skeleton height={44} borderRadius={radius.md} />
              <Skeleton height={44} borderRadius={radius.md} />
              <Skeleton width={80} height={12} borderRadius={radius.sm} />
              <Skeleton height={44} borderRadius={radius.md} />
              <Skeleton width={70} height={12} borderRadius={radius.sm} />
              <Skeleton height={48} borderRadius={radius.md} />
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={[styles.saveBtn, { opacity: 0.5 }]}>
              <Skeleton width={120} height={18} borderRadius={radius.sm} />
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Load error (§3.4)
  // ─────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <View style={styles.errorStateWrap}>
            <View style={styles.inlineErrorCard}>
              <View style={styles.inlineErrorHeadRow}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                <Text style={styles.inlineErrorTitle}>Couldn't load this budget</Text>
              </View>
              <Text style={styles.inlineErrorBody}>Check your connection and try again.</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={loadData}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Retry loading budget"
              >
                <Ionicons name="refresh" size={16} color={colors.primary2} />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Populated form
  // ─────────────────────────────────────────────────────────────
  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {Header}

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Co-edit banner (§5.2) */}
            {showCoEdit && (
              <View
                style={styles.coEditBanner}
                accessibilityRole="text"
                accessibilityLabel={`Last edited by ${partnerName}${rel ? `, ${rel}` : ''}`}
              >
                <Text style={[styles.coEditGlyph, { color: glyphColor }]}>{glyph}</Text>
                <Text style={styles.coEditText} numberOfLines={1}>
                  Last edited by {partnerName}
                  {rel ? ` · ${rel}` : ''}
                </Text>
              </View>
            )}

            {/* Amount hero + Type control (§5, glassFloating) */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>AMOUNT</Text>
              <View style={styles.heroRow}>
                <Text style={[styles.heroSign, { color: semanticColor }]}>{signPrefix}</Text>
                <Text style={[styles.heroCurrency, { color: semanticColor }]}>$</Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => {
                    setAmount(t);
                    if (saveError) setSaveError(false);
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={[
                    styles.heroInput,
                    { color: semanticColor },
                    heroTooLong && styles.heroInputSmall,
                  ]}
                  accessibilityLabel="Budget amount"
                />
              </View>
              {showValidation && !amountValid && (
                <View style={styles.fieldHint}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                  <Text style={styles.fieldHintText}>Enter a valid amount</Text>
                </View>
              )}

              {/* Type segmented control */}
              <View style={styles.segmentRow}>
                {(['expense', 'income'] as const).map((t) => {
                  const active = type === t;
                  const tint = t === 'expense' ? colors.error : colors.success;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.segment,
                        active && {
                          borderColor: tint,
                          backgroundColor: t === 'expense'
                            ? 'rgba(239,68,68,0.16)'
                            : 'rgba(34,197,94,0.16)',
                        },
                      ]}
                      onPress={() => handleTypeChange(t)}
                      activeOpacity={0.85}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t === 'expense' ? 'Expense' : 'Income'}
                    >
                      <Ionicons
                        name={t === 'expense' ? 'card-outline' : 'trending-up-outline'}
                        size={16}
                        color={active ? tint : colors.textMuted}
                      />
                      <Text style={[styles.segmentText, active && { color: colors.text, fontWeight: '800' }]}>
                        {t === 'expense' ? 'Expense' : 'Income'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Details card (§5) */}
            <View style={styles.detailsCard}>
              {/* Name */}
              <View>
                <Text style={styles.fieldLabel}>Name</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      if (saveError) setSaveError(false);
                    }}
                    placeholder="Budget name"
                    placeholderTextColor={colors.textMuted}
                    style={styles.inputText}
                    numberOfLines={1}
                    accessibilityLabel="Budget name"
                  />
                </View>
                {showValidation && !nameValid && (
                  <View style={styles.fieldHint}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                    <Text style={styles.fieldHintText}>Give this budget a name</Text>
                  </View>
                )}
              </View>

              {/* Category (§5.3) */}
              <View>
                <Text style={styles.fieldLabel}>Category</Text>
                {filteredCategories.length === 0 ? (
                  <View style={styles.emptyCategory}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.emptyCategoryText} numberOfLines={1}>
                      No {type} categories yet
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/categories' as any)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Create category"
                    >
                      <Text style={styles.emptyCategoryAction}>+ Create</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View
                    style={styles.selectBox}
                    accessibilityRole="radiogroup"
                  >
                    <ScrollView
                      style={{ maxHeight: 44 * 5 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {filteredCategories.map((cat, idx) => {
                        const selected = categoryId === cat.id;
                        const isLast = idx === filteredCategories.length - 1;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.selectItem,
                              !isLast && styles.selectItemBorder,
                              selected && styles.selectItemActive,
                            ]}
                            onPress={() => setCategoryId(selected ? '' : cat.id)}
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={cat.name}
                          >
                            <Text style={styles.selectText} numberOfLines={1}>
                              {cat.name}
                            </Text>
                            {selected && (
                              <Ionicons
                                name="checkmark"
                                size={18}
                                color={colors.primary2}
                                style={{ flexShrink: 0 }}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Frequency chips */}
              <View>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <View style={styles.chipRow}>
                  {FREQUENCIES.map((f) => {
                    const active = frequency === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setFrequency(f)}
                        activeOpacity={0.7}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={f}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Start date (§5.4) */}
              <View>
                <Text style={styles.fieldLabel}>Start date</Text>
                <TouchableOpacity
                  style={styles.inputRow}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Start date, ${formattedDate}, opens date picker`}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary2} />
                  <Text style={styles.inputText}>{formattedDate}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                    onChange={(_, selected) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (selected) setStartDate(selected);
                    }}
                    themeVariant="dark"
                  />
                )}
                {showDatePicker && Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.datePickerDone}
                    onPress={() => setShowDatePicker(false)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Done selecting date"
                  >
                    <Text style={styles.datePickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Share with household (§5.5) */}
              <View style={commonStyles.divider} />
              <View
                style={styles.shareRow}
                accessible
                accessibilityRole="switch"
                accessibilityState={{ checked: shared }}
                accessibilityLabel="Share with household"
                accessibilityHint="Let your partner view and edit this budget"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareTitle}>Share with household</Text>
                  <Text style={styles.shareSubcopy}>
                    Let your partner view and edit this budget
                  </Text>
                </View>
                <Switch
                  value={shared}
                  onValueChange={setShared}
                  thumbColor="#fff"
                  trackColor={{ true: colors.primary2, false: colors.textDark }}
                />
              </View>
            </View>

            {/* Save error (§3.4) — sits above the sticky CTA */}
            {saveError && (
              <View style={styles.inlineErrorCard}>
                <View style={styles.inlineErrorHeadRow}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                  <Text style={styles.inlineErrorTitle}>Couldn't save budget</Text>
                </View>
                <Text style={styles.inlineErrorBody}>Check your connection and try again.</Text>
              </View>
            )}
          </ScrollView>

          {/* Sticky Save CTA (§5.6) */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !isValid}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save budget"
              accessibilityState={{ disabled: saving || !isValid }}
              style={{ opacity: !isValid && !saving ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={[...gradients.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                {saving ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.saveText}>Saving…</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.saveText}>Save Budget</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
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
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: colors.text, ...typography.h3, fontWeight: '800' },
  subtitle: { color: colors.textMuted, ...typography.small, marginTop: spacing.xs },

  // Scroll
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },

  // Co-edit banner
  coEditBanner: {
    ...glassEffects.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  coEditGlyph: { fontSize: 14, lineHeight: 16 },
  coEditText: { flex: 1, color: colors.textMuted, ...typography.caption },

  // Hero card
  heroCard: {
    ...glassEffects.glassFloating,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroSign: { ...typography.h1, marginRight: spacing.xs },
  heroCurrency: { ...typography.h2, marginRight: 2 },
  heroInput: {
    ...typography.h1,
    minWidth: 60,
    padding: 0,
    textAlign: 'center',
  },
  heroInputSmall: { fontSize: 24, lineHeight: 32 },

  // Type segmented control
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
  },
  segmentText: { color: colors.textMuted, ...typography.smallBold },

  // Details card
  detailsCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  fieldLabel: { color: colors.text, ...typography.smallBold, fontWeight: '700', marginBottom: spacing.sm },

  // Generic input / date row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassMedium,
  },
  inputText: { flex: 1, color: colors.text, ...typography.smallBold, padding: 0 },

  // Validation hints
  fieldHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  fieldHintText: { color: colors.error, ...typography.caption },

  // Category select
  selectBox: {
    ...glassEffects.glass,
    borderRadius: radius.md,
  },
  selectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  selectItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  selectItemActive: { backgroundColor: 'rgba(168,85,247,0.12)' },
  selectText: { flex: 1, color: colors.text, ...typography.bodyBold, marginRight: spacing.sm },

  // Empty category affordance
  emptyCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
  },
  emptyCategoryText: { flex: 1, color: colors.textMuted, ...typography.small },
  emptyCategoryAction: { color: colors.primary2, ...typography.smallBold, fontWeight: '700' },

  // Frequency chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
  },
  chipActive: { borderColor: colors.primary2, backgroundColor: 'rgba(168,85,247,0.16)' },
  chipText: { color: colors.textMuted, ...typography.smallBold, textTransform: 'capitalize' },
  chipTextActive: { color: colors.text, fontWeight: '800' },

  // Date "Done" pill
  datePickerDone: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  datePickerDoneText: { color: colors.primary2, ...typography.smallBold, fontWeight: '700' },

  // Share row
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  shareTitle: { color: colors.text, ...typography.smallBold, fontWeight: '700' },
  shareSubcopy: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },

  // Inline error card
  inlineErrorCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  inlineErrorHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineErrorTitle: { color: colors.text, ...typography.smallBold, fontWeight: '700' },
  inlineErrorBody: { color: colors.textMuted, ...typography.small },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  retryText: { color: colors.primary2, ...typography.smallBold, fontWeight: '700' },

  errorStateWrap: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },

  // Sticky footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  saveText: { color: '#fff', ...typography.button, fontWeight: '800' },
});
