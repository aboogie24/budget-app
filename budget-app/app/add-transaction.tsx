import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentUser } from '../utils/storage';
import { api } from '../utils/apiClient';
import { v4 as uuidv4 } from 'uuid';
import { successHaptic, errorHaptic } from '../utils/haptics';
import CategoryPicker from '../components/CategoryPicker';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

const frequencyOptions = ['one-time', 'weekly', 'biweekly', 'monthly'] as const;
type TxType = 'income' | 'expense';

/**
 * Add Transaction — redesigned onto the CoupleFlow design system.
 *
 * IA (top → bottom): header · type segmented control · amount hero ·
 * details card (name / category / frequency / conditional due-day) ·
 * inline save-error card · sticky keyboard-aware Save CTA.
 *
 * Validation is inline + color-independent (icon + word) instead of the old
 * blocking Alert.alert modals. The POST payload, haptics, uuid, and navigation
 * contract are preserved exactly.
 */
export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const initialType: TxType = (params.type as string) === 'income' ? 'income' : 'expense';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<string>('one-time');
  const [dueDay, setDueDay] = useState('');
  const [saving, setSaving] = useState(false);

  const [bootLoading, setBootLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [triedSave, setTriedSave] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Category availability for the empty-state affordance on the row.
  const [hasCategories, setHasCategories] = useState(true);

  const amountInputRef = useRef<TextInput>(null);

  // ── Boot: resolve userId (CategoryPicker needs it) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      const currentUser = await getCurrentUser();
      if (alive && currentUser?.id) setUserId(currentUser.id);
      if (alive) setBootLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // Reset selected category when type changes (preserve original effect).
  useEffect(() => {
    setSelectedCategory(null);
  }, [type]);

  // Probe category availability per type so the row can show an empty affordance
  // instead of opening a picker with nothing in it. Read-only; no api mutation.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const data = await api.get<any[]>(`/auth/categories/user/${userId}`, {
          user_id: userId,
          type,
        });
        if (alive) setHasCategories(Array.isArray(data) && data.length > 0);
      } catch {
        // On probe failure, assume categories exist so we don't wrongly block the picker.
        if (alive) setHasCategories(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, type]);

  // ── Type cross-fade (instant under reduced motion) ──
  const tintAnim = useRef(new Animated.Value(initialType === 'expense' ? 0 : 1)).current;
  useEffect(() => {
    const to = type === 'expense' ? 0 : 1;
    if (reduceMotion) {
      tintAnim.setValue(to);
      return;
    }
    Animated.timing(tintAnim, { toValue: to, duration: 150, useNativeDriver: false }).start();
  }, [type, reduceMotion, tintAnim]);

  // ── Due-day reveal (conditional field) ──
  const showDueDay = type === 'expense' && frequency === 'monthly';
  const dueAnim = useRef(new Animated.Value(showDueDay ? 1 : 0)).current;
  useEffect(() => {
    const to = showDueDay ? 1 : 0;
    if (reduceMotion) {
      dueAnim.setValue(to);
      return;
    }
    Animated.timing(dueAnim, { toValue: to, duration: 250, useNativeDriver: true }).start();
  }, [showDueDay, reduceMotion, dueAnim]);

  // ── Derived validation ──
  const semantic = type === 'expense' ? colors.error : colors.success;
  const sign = type === 'expense' ? '−' : '+';

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== '' && !isNaN(amountNum) && isFinite(amountNum);
  const dueDayNum = parseInt(dueDay, 10);
  const dueDayValid = !showDueDay || (!isNaN(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31);
  const categoryValid = !!selectedCategory;

  const isValid = amountValid && categoryValid && dueDayValid;

  // Field hints only surface after a save attempt (proactive but not nagging).
  const amountHint = triedSave && !amountValid ? 'Enter a valid number' : '';
  const categoryHint = triedSave && !categoryValid ? 'Select a category' : '';
  const dueDayHint = triedSave && showDueDay && !dueDayValid ? 'Day must be 1–31' : '';

  const displayAmount = amount.trim() === '' ? '' : amount;
  const heroFontStyle =
    displayAmount.length > 10 ? { fontSize: 26, lineHeight: 34 } : null;

  const handleSave = async () => {
    if (saving) return;
    setTriedSave(true);
    setSaveError(false);

    if (!isValid) {
      errorHaptic();
      return;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser || !currentUser.id) {
      errorHaptic();
      setSaveError(true);
      return;
    }

    const transaction = {
      id: uuidv4(),
      user_id: currentUser.id,
      type,
      amount: parseFloat(amount),
      category_id: selectedCategory!.id,
      category_name: selectedCategory!.name,
      note,
      date: new Date().toISOString(),
      frequency,
      due_day: frequency === 'monthly' && type === 'expense' ? parseInt(dueDay, 10) : null,
    };

    setSaving(true);
    try {
      await api.post(`/auth/transactions`, transaction);
      successHaptic();
      router.back();
    } catch (err) {
      console.error('Error saving:', err);
      errorHaptic();
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Header (renders in all states) ──
  const Header = (
    <View style={styles.header}>
      <BackButton fallback="/(tabs)/budget" />
      <View style={styles.headerCenter}>
        <Text style={styles.title}>New Transaction</Text>
        <Text style={styles.subtitle}>Log it to keep budgets fresh</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );

  // ── Loading skeleton (brief getCurrentUser window) ──
  if (bootLoading) {
    return (
      <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <View style={styles.scrollContent}>
            <Skeleton height={52} borderRadius={radius.md} style={{ marginBottom: spacing.lg }} />
            <View style={[styles.heroCard, { marginBottom: spacing.lg }]}>
              <Skeleton width={80} height={12} borderRadius={radius.sm} style={{ marginBottom: spacing.md }} />
              <Skeleton width={180} height={40} borderRadius={radius.md} />
            </View>
            <View style={styles.card}>
              <Skeleton height={48} borderRadius={radius.md} style={{ marginBottom: spacing.lg }} />
              <Skeleton height={48} borderRadius={radius.md} style={{ marginBottom: spacing.lg }} />
              <Skeleton width={120} height={44} borderRadius={radius.md} />
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Type segmented control ── */}
            <View
              style={styles.segTrack}
              accessibilityRole="tablist"
            >
              <TypeSegment
                active={type === 'expense'}
                icon="card-outline"
                label="Expense"
                color={colors.error}
                onPress={() => setType('expense')}
              />
              <TypeSegment
                active={type === 'income'}
                icon="trending-up"
                label="Income"
                color={colors.success}
                onPress={() => setType('income')}
              />
            </View>

            {/* ── Amount hero ── */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => amountInputRef.current?.focus()}
              style={[styles.heroCard, { marginBottom: spacing.lg }]}
            >
              <Text style={styles.heroLabel}>AMOUNT</Text>
              <View style={styles.heroValueRow}>
                <Text style={[styles.heroValue, heroFontStyle, { color: semantic }]}>
                  {sign} $
                </Text>
                <TextInput
                  ref={amountInputRef}
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v);
                    if (saveError) setSaveError(false);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.heroValue, styles.heroInput, heroFontStyle, { color: semantic }]}
                  accessibilityLabel="Transaction amount"
                />
              </View>
              {!!amountHint && (
                <View style={styles.hintRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                  <Text style={styles.hintText}>{amountHint}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── Details card ── */}
            <View style={styles.card}>
              {/* Name */}
              <FormField
                label="Name"
                icon="text-outline"
                placeholder={type === 'income' ? 'e.g. Paycheck, Freelance gig' : 'e.g. Coffee, Uber, Amazon'}
                value={note}
                onChangeText={setNote}
              />

              {/* Category */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Category</Text>
                {!hasCategories ? (
                  <TouchableOpacity
                    style={[styles.inputRow, styles.emptyRow]}
                    onPress={() => setCategoryPickerVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`No ${type} categories yet, create one`}
                  >
                    <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} style={styles.leadingIcon} />
                    <Text style={[styles.inputText, { color: colors.textMuted }]} numberOfLines={1}>
                      No {type} categories yet
                    </Text>
                    <Text style={styles.createText}>+ Create</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.inputRow, !!categoryHint && styles.inputRowError]}
                    onPress={() => setCategoryPickerVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Category, ${selectedCategory ? selectedCategory.name : 'none'}, opens category picker`}
                  >
                    <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} style={styles.leadingIcon} />
                    <Text
                      style={[styles.inputText, !selectedCategory && { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      {selectedCategory ? selectedCategory.name : 'Tap to select category'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textDark} style={{ flexShrink: 0 }} />
                  </TouchableOpacity>
                )}
                {!!categoryHint && (
                  <View style={styles.hintRow}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
                    <Text style={styles.hintText}>{categoryHint}</Text>
                  </View>
                )}
              </View>

              {/* Frequency */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <View style={styles.chipRow} accessibilityRole="radiogroup">
                  {frequencyOptions.map((option) => {
                    const selected = frequency === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setFrequency(option)}
                        activeOpacity={0.7}
                        style={[styles.chip, selected && styles.chipSelected]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Due day (conditional) */}
              {showDueDay && (
                <Animated.View style={{ opacity: dueAnim }}>
                  <FormField
                    label="Due day"
                    icon="calendar-outline"
                    placeholder="Enter due day (1–31)"
                    value={dueDay}
                    keyboardType="number-pad"
                    onChangeText={setDueDay}
                    hint={dueDayHint}
                    noMargin
                  />
                </Animated.View>
              )}
            </View>

            {/* ── Inline save-error card ── */}
            {saveError && (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Couldn't save transaction</Text>
                  <Text style={styles.errorSub}>Check your connection and try again.</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── Sticky Save CTA ── */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !isValid}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save transaction"
              accessibilityState={{ disabled: !isValid || saving }}
              style={styles.ctaWrap}
            >
              <LinearGradient
                colors={[...gradients.primaryGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cta, (!isValid || saving) && styles.ctaDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>Save</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {userId ? (
        <CategoryPicker
          visible={categoryPickerVisible}
          onClose={() => setCategoryPickerVisible(false)}
          onSelect={(cat) => {
            setSelectedCategory({ id: cat.id, name: cat.name });
            setHasCategories(true);
            setCategoryPickerVisible(false);
          }}
          type={type}
          userId={userId}
        />
      ) : null}
    </GradientBackground>
  );
}

// ── Sub-components ──

function TypeSegment({
  active,
  icon,
  label,
  color,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.segment,
        active && {
          backgroundColor: withAlpha(color, 0.1),
          borderColor: withAlpha(color, 0.3),
        },
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={16} color={active ? color : colors.textMuted} />
      <Text
        style={[
          styles.segmentText,
          { color: active ? color : colors.textMuted, fontWeight: active ? '700' : '400' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FormField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  hint,
  noMargin,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad' | 'numeric';
  hint?: string;
  noMargin?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={noMargin ? undefined : styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          !!hint && styles.inputRowError,
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.leadingIcon} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.inputField}
          numberOfLines={1}
        />
      </View>
      {!!hint && (
        <View style={styles.hintRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}
    </View>
  );
}

// Compose a hex color with an alpha (design tokens are hex; alpha overlays match spec).
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
  subtitle: { color: colors.textMuted, ...typography.small, marginTop: 2 },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  // Segmented control
  segTrack: {
    ...glassEffects.glass,
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: { ...typography.small },

  // Amount hero
  heroCard: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  heroValue: {
    ...typography.h1,
    fontWeight: '700',
  },
  heroInput: {
    minWidth: 60,
    padding: 0,
    marginLeft: spacing.xs,
    textAlign: 'left',
  },

  // Details card
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
  },
  fieldBlock: { marginBottom: spacing.lg },
  fieldLabel: {
    ...typography.smallBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.glassMedium,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  inputRowFocused: { borderColor: colors.primary2 },
  inputRowError: { borderColor: colors.error },
  emptyRow: {
    borderStyle: 'dashed',
    borderColor: colors.borderGlass,
  },
  leadingIcon: { marginRight: spacing.sm },
  inputField: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  createText: {
    ...typography.smallBold,
    color: colors.primary2,
    flexShrink: 0,
  },

  // Frequency chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glassMedium,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  chipSelected: {
    backgroundColor: withAlpha(colors.primary2, 0.18),
    borderColor: withAlpha(colors.primary2, 0.7),
  },
  chipText: {
    ...typography.small,
    color: colors.text,
    textTransform: 'capitalize',
  },
  chipTextSelected: { fontWeight: '700', color: colors.text },

  // Inline hints
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.error },

  // Save-error card
  errorCard: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  errorTitle: { ...typography.smallBold, color: colors.text },
  errorSub: { ...typography.small, color: colors.textMuted, marginTop: 2 },

  // Sticky footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  ctaWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    minHeight: 52,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...typography.button, color: '#fff', fontWeight: '700' },
});
