import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';

import { getCurrentUser } from '../../../utils/storage';
import { api } from '../../../utils/apiClient';
import { successHaptic, errorHaptic, lightHaptic } from '../../../utils/haptics';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import CategoryPicker from '@/components/CategoryPicker';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

// ── Constants ──

const frequencyOptions = ['one-time', 'weekly', 'biweekly', 'monthly'] as const;

// ── Types ──

interface Transaction {
  id: string;
  amount: number;
  category_id?: string;
  category?: string;
  category_name?: string;
  note?: string;
  type: 'income' | 'expense';
  frequency?: string;
  due_day?: number;
  date?: string;
}

interface CategoryLite {
  id: string;
  name: string;
}

type FatalKind = 'notFound' | 'noSession' | 'loadError';

interface FormSnapshot {
  type: 'income' | 'expense';
  amount: string;
  categoryId: string;
  categoryName: string;
  note: string;
  frequency: string;
  dueDay: string;
}

// ── Helpers ──

const formatAmount = (raw: string): string => {
  const n = Number(raw);
  if (!isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function EditTransactionScreen() {
  const params = useLocalSearchParams();
  const transactionId = params.id as string;
  const router = useRouter();

  // Load / fatal states
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<FatalKind | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState('one-time');
  const [dueDay, setDueDay] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  // Snapshot for dirty tracking
  const [initialForm, setInitialForm] = useState<FormSnapshot | null>(null);

  // Write / delete states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [writeError, setWriteError] = useState<'save' | 'delete' | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Field-level validation surfacing (only after a save attempt / interaction)
  const [touched, setTouched] = useState(false);

  const [reduceMotion, setReduceMotion] = useState(false);

  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // ── Load the transaction and seed the form ──
  const loadTransaction = useCallback(async () => {
    try {
      setLoading(true);
      setFatal(null);

      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        setFatal('noSession');
        return;
      }
      currentUserIdRef.current = currentUser.id;

      const transactions = await api.get<Transaction[]>(`/auth/transactions`, {
        user_id: currentUser.id,
      });
      const transaction = Array.isArray(transactions)
        ? transactions.find((t) => t.id === transactionId)
        : undefined;

      if (!transaction) {
        setFatal('notFound');
        return;
      }

      const seededAmount = String(transaction.amount ?? '');
      const seededCategoryName =
        transaction.category_name || transaction.category || '';
      const seededCategoryId = transaction.category_id || '';
      const seededNote = transaction.note || '';
      const seededType = transaction.type || 'expense';
      const seededFrequency = transaction.frequency || 'one-time';
      const seededDueDay = transaction.due_day ? String(transaction.due_day) : '';

      setAmount(seededAmount);
      setCategoryName(seededCategoryName);
      setCategoryId(seededCategoryId);
      setNote(seededNote);
      setType(seededType);
      setFrequency(seededFrequency);
      setDueDay(seededDueDay);

      setInitialForm({
        type: seededType,
        amount: seededAmount,
        categoryId: seededCategoryId,
        categoryName: seededCategoryName,
        note: seededNote,
        frequency: seededFrequency,
        dueDay: seededDueDay,
      });

      // Categories for the create-if-missing lookup in handleSave.
      const categoriesData = await api.get<CategoryLite[]>(`/auth/categories`, {
        type: seededType,
        user_id: currentUser.id,
      });
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      console.error('Failed to fetch transaction:', err);
      setFatal('loadError');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (transactionId) {
      loadTransaction();
    }
  }, [transactionId, loadTransaction]);

  // Refetch categories when the type changes (after initial load).
  useEffect(() => {
    if (loading || fatal) return;
    let cancelled = false;
    const fetchCategories = async () => {
      try {
        const uid = currentUserIdRef.current;
        const data = await api.get<CategoryLite[]>(`/auth/categories`, {
          type,
          user_id: uid ?? '',
        });
        if (!cancelled) {
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Failed to fetch categories:', e);
      }
    };
    fetchCategories();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ── Derived validation / dirty ──

  const amountValid = useMemo(() => {
    const n = Number(amount);
    return amount.trim().length > 0 && isFinite(n) && n > 0;
  }, [amount]);

  const dueDayRequired = frequency === 'monthly' && type === 'expense';
  const dueDayValid = useMemo(() => {
    if (!dueDayRequired) return true;
    const d = parseInt(dueDay, 10);
    return !isNaN(d) && d >= 1 && d <= 31;
  }, [dueDayRequired, dueDay]);

  const categoryValid = categoryName.trim().length > 0;

  const isValid = amountValid && categoryValid && dueDayValid;

  const isDirty = useMemo(() => {
    if (!initialForm) return false;
    return (
      initialForm.type !== type ||
      initialForm.amount !== amount ||
      initialForm.categoryName !== categoryName ||
      initialForm.note !== note ||
      initialForm.frequency !== frequency ||
      initialForm.dueDay !== dueDay
    );
  }, [initialForm, type, amount, categoryName, note, frequency, dueDay]);

  const canSave = isDirty && isValid && !saving;

  const disabledReason = !isDirty
    ? 'No changes yet'
    : !amountValid
    ? 'Enter a valid amount'
    : !categoryValid
    ? 'Select a category'
    : !dueDayValid
    ? 'Day must be 1–31'
    : '';

  // ── Actions ──

  const handleTypeChange = (next: 'income' | 'expense') => {
    if (next === type) return;
    lightHaptic();
    setType(next);
    // Switching type invalidates the previously selected category.
    setCategoryId('');
    setCategoryName('');
  };

  const handleCategorySelect = (cat: { id: string; name: string }) => {
    setCategoryId(cat.id);
    setCategoryName(cat.name);
    setPickerOpen(false);
  };

  const handleSave = async () => {
    setTouched(true);
    if (!canSave) return;

    try {
      setSaving(true);
      setWriteError(null);

      const currentUser = await getCurrentUser();
      if (!currentUser?.id) {
        setFatal('noSession');
        return;
      }

      // Resolve the category — create it if the typed name doesn't exist.
      let selectedCategory: CategoryLite | undefined = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
      );

      if (!selectedCategory) {
        const newCatPayload = {
          id: uuidv4(),
          name: categoryName,
          user_id: currentUser.id,
          type,
          color: colors.success,
        };
        const created = await api.post<CategoryLite>(`/auth/categories`, newCatPayload);
        selectedCategory = created ?? undefined;
        if (created) {
          setCategories((prev) => [...prev, created]);
        }
      }

      const updatePayload = {
        user_id: currentUser.id,
        type,
        amount: parseFloat(amount),
        category_id: selectedCategory?.id ?? categoryId,
        category_name: selectedCategory?.name ?? categoryName,
        note,
        date: new Date().toISOString(),
        frequency,
        due_day: dueDayRequired ? parseInt(dueDay, 10) : null,
      };

      await api.put(`/auth/transactions/${transactionId}`, updatePayload);
      successHaptic();
      router.back();
    } catch (err) {
      console.error('Error saving:', err);
      errorHaptic();
      setWriteError('save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setWriteError(null);
      await api.delete(`/auth/transactions/${transactionId}`);
      successHaptic();
      setShowDelete(false);
      router.back();
    } catch (err) {
      console.error('Error deleting:', err);
      errorHaptic();
      setShowDelete(false);
      setWriteError('delete');
    } finally {
      setDeleting(false);
    }
  };

  const goToTransactions = () => router.navigate('/(tabs)/budget');

  // ── Render: fatal states ──

  if (fatal) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <Header showDelete={false} deleteDisabled onDelete={() => {}} />
          <View style={styles.fatalWrap}>
            <EditStateCard
              kind={fatal}
              retrying={retrying}
              onRetry={() => {
                setRetrying(true);
                loadTransaction();
              }}
              onBack={goToTransactions}
            />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Render: main / loading ──

  const amountColor = type === 'expense' ? colors.error : colors.success;
  const sign = type === 'expense' ? '−' : '+';

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Header
          showDelete
          deleteDisabled={loading}
          onDelete={() => {
            lightHaptic();
            setShowDelete(true);
          }}
        />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <>
                {/* Type segmented control */}
                <View style={styles.segmented}>
                  <SegmentButton
                    active={type === 'expense'}
                    icon="card-outline"
                    label="Expense"
                    tint={colors.error}
                    onPress={() => handleTypeChange('expense')}
                  />
                  <SegmentButton
                    active={type === 'income'}
                    icon="trending-up"
                    label="Income"
                    tint={colors.success}
                    onPress={() => handleTypeChange('income')}
                  />
                </View>

                {/* Amount hero */}
                <View style={styles.amountHero}>
                  <Text
                    style={styles.amountLabel}
                    accessibilityRole="text"
                  >
                    AMOUNT
                  </Text>
                  <View style={styles.amountRow}>
                    <Text style={[styles.amountSign, { color: amountColor }]}>
                      {sign}
                    </Text>
                    <Text style={[styles.amountCurrency, { color: amountColor }]}>$</Text>
                    <TextInput
                      value={amount}
                      onChangeText={(t) => {
                        setWriteError(null);
                        setAmount(t);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.amountInput,
                        { color: amountColor },
                        amount.length > 10 && styles.amountInputSmall,
                      ]}
                      accessibilityLabel="Transaction amount"
                    />
                  </View>
                  {touched && !amountValid && (
                    <FieldHint text="Enter a valid number" />
                  )}
                </View>

                {/* Details card */}
                <View style={styles.card}>
                  {/* Name */}
                  <Text style={styles.fieldLabel}>Name</Text>
                  <View style={styles.inputInset}>
                    <Ionicons
                      name="text-outline"
                      size={18}
                      color={note ? colors.text : colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      placeholder={
                        type === 'income'
                          ? 'e.g. Paycheck, Freelance gig'
                          : 'e.g. Coffee, Uber, Amazon'
                      }
                      placeholderTextColor={colors.textMuted}
                      style={styles.textInput}
                      numberOfLines={1}
                    />
                  </View>

                  {/* Category */}
                  <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Category</Text>
                  <TouchableOpacity
                    style={[styles.inputInset, !categoryValid && styles.inputInsetEmpty]}
                    activeOpacity={0.75}
                    onPress={() => {
                      lightHaptic();
                      setPickerOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Category, ${
                      categoryName || 'none'
                    }, opens picker`}
                  >
                    <Ionicons
                      name="pricetag-outline"
                      size={18}
                      color={categoryValid ? colors.text : colors.textMuted}
                      style={styles.inputIcon}
                    />
                    <Text
                      style={[
                        styles.categoryText,
                        !categoryValid && styles.categoryPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {categoryName || `Choose a ${type} category`}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                      style={styles.chevron}
                    />
                  </TouchableOpacity>
                  {touched && !categoryValid && (
                    <FieldHint text="Select a category" />
                  )}

                  {/* Frequency */}
                  <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Frequency</Text>
                  <View
                    style={styles.freqRow}
                    accessibilityRole="radiogroup"
                  >
                    {frequencyOptions.map((option) => {
                      const selected = frequency === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          onPress={() => {
                            lightHaptic();
                            setFrequency(option);
                          }}
                          style={[styles.chip, selected && styles.chipSelected]}
                          activeOpacity={0.75}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Due day (conditional) */}
                  {dueDayRequired && (
                    <>
                      <Text style={[styles.fieldLabel, styles.fieldSpacer]}>
                        Due day
                      </Text>
                      <View style={styles.inputInset}>
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={dueDay ? colors.text : colors.textMuted}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          value={dueDay}
                          onChangeText={setDueDay}
                          placeholder="Enter due day (1-31)"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="number-pad"
                          style={styles.textInput}
                        />
                      </View>
                      {touched && !dueDayValid && (
                        <FieldHint text="Day must be 1–31" />
                      )}
                    </>
                  )}
                </View>

                {/* Save / delete error card */}
                {writeError && (
                  <View style={styles.errorCard}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={20}
                      color={colors.error}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.errorTitle}>
                        {writeError === 'save'
                          ? "Couldn't save your changes"
                          : "Couldn't delete"}
                      </Text>
                      <Text style={styles.errorSub}>
                        Check your connection and try again.
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Sticky footer CTA */}
          <View style={styles.footer}>
            {loading ? (
              <Skeleton height={54} borderRadius={radius.lg} />
            ) : (
              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.85}
                style={[styles.ctaWrap, !canSave && styles.ctaDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
                accessibilityHint={!canSave ? disabledReason : undefined}
                accessibilityState={{ disabled: !canSave }}
              >
                <LinearGradient
                  colors={[...gradients.primaryGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaInner}
                >
                  {saving ? (
                    <>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={styles.ctaText}>Saving…</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.ctaText}>Save Changes</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.text} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Category picker */}
      {currentUserIdRef.current && (
        <CategoryPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handleCategorySelect}
          type={type}
          userId={currentUserIdRef.current}
        />
      )}

      {/* Delete confirm sheet */}
      <DeleteConfirmSheet
        visible={showDelete}
        deleting={deleting}
        reduceMotion={reduceMotion}
        summary={`${note || 'this transaction'} ${sign}$${formatAmount(amount || '0')}`}
        onCancel={() => setShowDelete(false)}
        onConfirm={handleDelete}
      />
    </GradientBackground>
  );
}

// ── Header ──

function Header({
  showDelete,
  deleteDisabled,
  onDelete,
}: {
  showDelete: boolean;
  deleteDisabled: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.header}>
      <BackButton fallback="/(tabs)/budget" />
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Edit Transaction</Text>
        <Text style={styles.headerSubtitle}>Update the details, then save</Text>
      </View>
      {showDelete ? (
        <TouchableOpacity
          onPress={onDelete}
          disabled={deleteDisabled}
          style={[styles.deleteAction, deleteDisabled && styles.deleteActionDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Delete transaction"
          accessibilityHint="Opens a delete confirmation."
          accessibilityState={{ disabled: deleteDisabled }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

// ── Segment button ──

function SegmentButton({
  active,
  icon,
  label,
  tint,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.segment,
        active && {
          backgroundColor: `${tint}1A`,
          borderColor: `${tint}4D`,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={16} color={active ? tint : colors.textMuted} />
      <Text
        style={[
          styles.segmentText,
          active && { color: tint, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Field hint (validation) ──

function FieldHint({ text }: { text: string }) {
  return (
    <View style={styles.fieldHint}>
      <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
      <Text style={styles.fieldHintText}>{text}</Text>
    </View>
  );
}

// ── Loading skeleton ──

function LoadingSkeleton() {
  return (
    <>
      <Skeleton height={48} borderRadius={radius.md} style={{ marginBottom: spacing.lg }} />
      <View style={[styles.amountHero, { alignItems: 'center', gap: spacing.md }]}>
        <Skeleton width={80} height={12} />
        <Skeleton width={180} height={40} borderRadius={radius.md} />
      </View>
      <View style={styles.card}>
        <Skeleton width={60} height={12} style={{ marginBottom: spacing.sm }} />
        <Skeleton height={48} borderRadius={radius.md} style={{ marginBottom: spacing.lg }} />
        <Skeleton width={80} height={12} style={{ marginBottom: spacing.sm }} />
        <Skeleton height={48} borderRadius={radius.md} style={{ marginBottom: spacing.lg }} />
        <Skeleton width={80} height={12} style={{ marginBottom: spacing.sm }} />
        <View style={styles.freqRow}>
          {frequencyOptions.map((o) => (
            <Skeleton key={o} width={72} height={36} borderRadius={radius.md} />
          ))}
        </View>
      </View>
    </>
  );
}

// ── Edit state card (fatal states) ──

function EditStateCard({
  kind,
  retrying,
  onRetry,
  onBack,
}: {
  kind: FatalKind;
  retrying: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const config = {
    notFound: {
      icon: 'search-outline' as const,
      iconColor: colors.textMuted,
      title: "We couldn't find this transaction",
      sub: 'It may have been deleted or moved.',
      showRetry: false,
    },
    noSession: {
      icon: 'person-outline' as const,
      iconColor: colors.textMuted,
      title: "You're signed out",
      sub: 'Sign in again to edit this transaction.',
      showRetry: false,
    },
    loadError: {
      icon: 'alert-circle-outline' as const,
      iconColor: colors.error,
      title: "Couldn't load this transaction",
      sub: 'Check your connection and try again.',
      showRetry: true,
    },
  }[kind];

  return (
    <View style={styles.stateCard}>
      <Ionicons name={config.icon} size={40} color={config.iconColor} />
      <Text style={styles.stateTitle}>{config.title}</Text>
      <Text style={styles.stateSub}>{config.sub}</Text>
      <View style={styles.stateActions}>
        {config.showRetry && (
          <TouchableOpacity
            onPress={onRetry}
            disabled={retrying}
            activeOpacity={0.85}
            style={styles.stateRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <LinearGradient
              colors={[...gradients.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.stateRetryInner}
            >
              {retrying ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.ctaText}>Retry</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.85}
          style={styles.stateBack}
          accessibilityRole="button"
          accessibilityLabel="Back to transactions"
        >
          <Text style={styles.stateBackText}>
            {config.showRetry ? 'Back' : 'Back to transactions'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Delete confirm sheet ──

function DeleteConfirmSheet({
  visible,
  deleting,
  reduceMotion,
  summary,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  deleting: boolean;
  reduceMotion: boolean;
  summary: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <Pressable style={styles.sheetBackdrop} onPress={deleting ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Delete this transaction?
          </Text>
          <Text style={styles.sheetBody} numberOfLines={2}>
            This removes “{summary}” and can't be undone.
          </Text>

          <TouchableOpacity
            onPress={onConfirm}
            disabled={deleting}
            activeOpacity={0.85}
            style={styles.sheetDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete transaction, deletes permanently."
          >
            {deleting ? (
              <>
                <ActivityIndicator size="small" color={colors.text} />
                <Text style={styles.sheetDeleteText}>Deleting…</Text>
              </>
            ) : (
              <Text style={styles.sheetDeleteText}>Delete</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            disabled={deleting}
            activeOpacity={0.85}
            style={styles.sheetCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  headerSpacer: { width: 40 },
  deleteAction: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionDisabled: { opacity: 0.4 },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  segmentText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Amount hero
  amountHero: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountSign: {
    ...typography.h1,
    marginRight: spacing.xs,
  },
  amountCurrency: {
    ...typography.h2,
    marginRight: spacing.xs,
  },
  amountInput: {
    ...typography.h1,
    minWidth: 100,
    textAlign: 'left',
    padding: 0,
  },
  amountInputSmall: {
    fontSize: 26,
    lineHeight: 32,
  },

  // Details card
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.smallBold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fieldSpacer: { marginTop: spacing.lg },

  inputInset: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassMedium,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  inputInsetEmpty: {
    borderStyle: 'dashed',
  },
  inputIcon: { marginRight: spacing.sm },
  chevron: { marginLeft: spacing.sm, flexShrink: 0 },
  textInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  categoryText: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  categoryPlaceholder: {
    color: colors.textMuted,
  },

  // Frequency chips
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.glassMedium,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  chipSelected: {
    backgroundColor: `${colors.primary2}2E`,
    borderColor: `${colors.primary2}B3`,
  },
  chipText: {
    ...typography.small,
    color: colors.text,
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },

  // Field validation hint
  fieldHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  fieldHintText: {
    ...typography.caption,
    color: colors.error,
  },

  // Inline write error card
  errorCard: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  errorSub: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Footer CTA
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  ctaWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
    fontWeight: '800',
  },

  // Fatal state
  fatalWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  stateCard: {
    ...glassEffects.glass,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  stateTitle: {
    ...typography.smallBold,
    color: colors.text,
    textAlign: 'center',
  },
  stateSub: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stateActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stateRetry: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  stateRetryInner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBack: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBackText: {
    ...typography.button,
    color: colors.text,
  },

  // Delete sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  sheetBody: {
    ...typography.small,
    color: colors.textMuted,
  },
  sheetDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  sheetDeleteText: {
    ...typography.button,
    color: colors.text,
    fontWeight: '700',
  },
  sheetCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
  sheetCancelText: {
    ...typography.button,
    color: colors.text,
  },
});
