import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton, SkeletonStack } from '@/components/Skeleton';
import { ErrorState } from '@/components/ErrorState';
import {
  colors,
  spacing,
  radius,
  typography,
  gradients,
  glassEffects,
} from '@/utils/design-system';

// ── Constants ──

const STORAGE_KEY = 'frequencyMultipliers';

// Illustrative base for the live conversion preview. NOT user data — a fixed
// constant so "$50 weekly → $200/month" reads as a concrete example.
const PREVIEW_BASE = 50;

// Sane bounds for a per-month occurrence count. A weekly item can plausibly hit
// ~5 in a long month; monthly is 1. Clamp keeps nonsense ("12" weekly) out.
const MIN_MULTIPLIER = 1;
const MAX_MULTIPLIER = 31;

// The medium transition duration lives in design intent (animation.medium); we
// key inline morphs off a single constant so success/error revert in lockstep.
const MORPH_MS = 250;

type FieldKey = 'weekly' | 'biweekly' | 'monthly';

type FieldConfig = {
  key: FieldKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  freqWord: string;
  default: number;
};

const FIELDS: FieldConfig[] = [
  { key: 'weekly', label: 'Weekly', icon: 'calendar-outline', freqWord: 'weekly', default: 4 },
  { key: 'biweekly', label: 'Biweekly', icon: 'swap-horizontal-outline', freqWord: 'biweekly', default: 2 },
  { key: 'monthly', label: 'Monthly', icon: 'today-outline', freqWord: 'monthly', default: 1 },
];

const DEFAULTS: Record<FieldKey, number> = { weekly: 4, biweekly: 2, monthly: 1 };

// ── Helpers ──

const digitsOnly = (v: string) => v.replace(/[^0-9]/g, '');

const clamp = (n: number) => Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, n));

const HERO_COPY =
  'These numbers convert a per-occurrence budget into a monthly amount. A weekly item counts 4× a month; biweekly 2×; monthly 1×.';

// ── FrequencyField (settings-frequency local component) ──

type FrequencyFieldProps = {
  config: FieldConfig;
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  reduceMotion: boolean;
};

function FrequencyField({ config, value, onChangeText, onBlur, reduceMotion }: FrequencyFieldProps) {
  const [focused, setFocused] = useState(false);
  const numeric = parseInt(value, 10);
  const invalid = value.length > 0 && (isNaN(numeric) || numeric < MIN_MULTIPLIER || numeric > MAX_MULTIPLIER);
  const effective = isNaN(numeric) || numeric < 1 ? config.default : numeric;

  const borderColor = invalid
    ? colors.error
    : focused
    ? colors.primary2
    : colors.borderGlass;

  return (
    <View
      style={styles.field}
      accessible
      accessibilityLabel={`${config.label}, counts ${effective} times per month, edit box, ${value || config.default}`}
    >
      <View style={styles.fieldLeft}>
        <View style={styles.fieldIcon}>
          <Ionicons name={config.icon} size={18} color={colors.accent} />
        </View>
        <View style={styles.fieldTextWrap}>
          <Text style={styles.fieldLabel}>{config.label}</Text>
          <Text style={styles.fieldHint} numberOfLines={2}>
            counts {effective}× per month
          </Text>
          {invalid && (
            <View style={styles.invalidRow}>
              <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
              <Text style={styles.invalidText}>1–31</Text>
            </View>
          )}
        </View>
      </View>
      <TextInput
        style={[styles.fieldInput, { borderColor }]}
        value={value}
        onChangeText={(v) => onChangeText(digitsOnly(v))}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        keyboardType="numeric"
        maxLength={2}
        selectTextOnFocus
        placeholder={String(config.default)}
        placeholderTextColor={colors.textDark}
        accessibilityLabel={`${config.label} multiplier`}
      />
    </View>
  );
}

// ── FrequencyPreviewCard (settings-frequency local component) ──

function FrequencyPreviewCard({ values }: { values: Record<FieldKey, string> }) {
  return (
    <View style={styles.previewCard}>
      <Text style={styles.sectionLabel}>PREVIEW</Text>
      {FIELDS.map((f) => {
        const numeric = parseInt(values[f.key], 10);
        const mult = isNaN(numeric) || numeric < 1 ? f.default : numeric;
        const monthly = PREVIEW_BASE * mult;
        return (
          <View
            key={f.key}
            style={styles.previewRow}
            accessible
            accessibilityLabel={`A ${PREVIEW_BASE} dollar ${f.freqWord} budget equals ${monthly} dollars per month`}
          >
            <Text style={styles.previewBase}>
              A ${PREVIEW_BASE} {f.freqWord} budget
            </Text>
            <View style={styles.previewResult}>
              <Ionicons
                name="arrow-forward"
                size={13}
                color={colors.textDark}
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={styles.previewArrow}
              />
              <Text style={styles.previewMonthly}>${monthly} / month</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Loading skeleton ──

function LoadingBody() {
  return (
    <View>
      <Skeleton height={96} borderRadius={radius.xl} style={{ marginBottom: spacing.xl }} />
      <Skeleton width={90} height={10} borderRadius={radius.sm} style={{ marginBottom: spacing.md }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.field, styles.fieldSkeleton]}>
          <View style={styles.fieldLeft}>
            <Skeleton width={34} height={34} borderRadius={radius.md} />
            <View style={styles.fieldTextWrap}>
              <SkeletonStack count={2} height={12} gap={6} />
            </View>
          </View>
          <Skeleton width={60} height={36} borderRadius={radius.md} />
        </View>
      ))}
      <Skeleton height={110} borderRadius={radius.lg} style={{ marginTop: spacing.md }} />
    </View>
  );
}

// ── Screen ──

type SaveState = 'idle' | 'saved' | 'error';

export default function FrequencySettingsScreen() {
  const [weekly, setWeekly] = useState('4');
  const [biweekly, setBiweekly] = useState('2');
  const [monthly, setMonthly] = useState('1');

  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [reduceMotion, setReduceMotion] = useState(false);

  const morphTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setters: Record<FieldKey, React.Dispatch<React.SetStateAction<string>>> = {
    weekly: setWeekly,
    biweekly: setBiweekly,
    monthly: setMonthly,
  };
  const values: Record<FieldKey, string> = { weekly, biweekly, monthly };

  const applyStored = useCallback((v: Record<FieldKey, number>) => {
    setWeekly(String(v.weekly));
    setBiweekly(String(v.biweekly));
    setMonthly(String(v.monthly));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setReadError(false);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const v = JSON.parse(stored);
        applyStored({
          weekly: Number(v.weekly) || DEFAULTS.weekly,
          biweekly: Number(v.biweekly) || DEFAULTS.biweekly,
          monthly: Number(v.monthly) || DEFAULTS.monthly,
        });
        setIsFirstRun(false);
      } else {
        // First run: never saved. Keep usable defaults, show first-run notice.
        applyStored(DEFAULTS);
        setIsFirstRun(true);
      }
    } catch {
      // Read failed: keep defaults so the screen stays usable, surface error.
      applyStored(DEFAULTS);
      setReadError(true);
    } finally {
      setLoading(false);
    }
  }, [applyStored]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (morphTimer.current) clearTimeout(morphTimer.current);
    };
  }, []);

  const flashState = useCallback(
    (state: SaveState) => {
      setSaveState(state);
      if (morphTimer.current) clearTimeout(morphTimer.current);
      const revert = () => setSaveState('idle');
      if (reduceMotion) {
        // Under reduced motion still show the result briefly, but keep it simple.
        morphTimer.current = setTimeout(revert, MORPH_MS);
      } else {
        morphTimer.current = setTimeout(revert, MORPH_MS * 4);
      }
    },
    [reduceMotion],
  );

  // Clamp a raw string field to bounds on blur, repopulating what's stored.
  const handleFieldBlur = useCallback((key: FieldKey) => {
    setters[key]((prev) => {
      const n = parseInt(prev, 10);
      if (isNaN(n) || n < 1) return prev; // blank/zero handled at save
      return String(clamp(n));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    const settings = {
      weekly: clamp(parseInt(weekly, 10) || DEFAULTS.weekly),
      biweekly: clamp(parseInt(biweekly, 10) || DEFAULTS.biweekly),
      monthly: clamp(parseInt(monthly, 10) || DEFAULTS.monthly),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      // Reflect any coercion back into the fields so the user sees what stored.
      applyStored(settings);
      setIsFirstRun(false);
      setReadError(false);
      flashState('saved');
      AccessibilityInfo.announceForAccessibility('Saved');
    } catch {
      flashState('error');
      AccessibilityInfo.announceForAccessibility('Couldn’t save, retry');
    }
  }, [weekly, biweekly, monthly, applyStored, flashState]);

  const handleReset = useCallback(() => {
    Alert.alert('Reset to defaults', 'This discards unsaved edits and restores 4 / 2 / 1.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
            applyStored(DEFAULTS);
            setIsFirstRun(false);
            setReadError(false);
            flashState('saved');
            AccessibilityInfo.announceForAccessibility('Saved');
          } catch {
            flashState('error');
            AccessibilityInfo.announceForAccessibility('Couldn’t save, retry');
          }
        },
      },
    ]);
  }, [applyStored, flashState]);

  const showHelp = useCallback(() => {
    Alert.alert('How multipliers work', HERO_COPY);
  }, []);

  // ── CTA visual state ──
  const ctaConfig = {
    idle: {
      icon: 'checkmark-circle-outline' as const,
      label: 'Save changes',
      color: colors.text,
    },
    saved: {
      icon: 'checkmark-circle-outline' as const,
      label: 'Saved',
      color: colors.success,
    },
    error: {
      icon: 'alert-circle-outline' as const,
      label: 'Couldn’t save — retry',
      color: colors.error,
    },
  }[saveState];

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe}>
        {/* Fixed header (outside scroll) */}
        <View style={styles.headerRow}>
          <BackButton fallback="/(tabs)/settings" color={colors.accent} size={20} />
          <Text style={styles.headerTitle}>Frequency</Text>
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={showHelp}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="How multipliers work, help"
          >
            <Ionicons name="help-circle-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <LoadingBody />
          ) : (
            <>
              {/* Read error — inline, above still-usable default fields */}
              {readError && (
                <ErrorState
                  title="Couldn't load your settings"
                  message="Your saved multipliers didn't load. You can still edit — changes save when the store recovers."
                  retryLabel="Retry"
                  onRetry={load}
                />
              )}

              {/* Hero explainer */}
              <View style={styles.hero}>
                <View style={styles.heroHeaderRow}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="sync-outline" size={18} color={colors.accent} />
                  </View>
                  <Text style={styles.heroTitle}>How multipliers work</Text>
                </View>
                <Text style={styles.heroBody}>{HERO_COPY}</Text>
              </View>

              {/* First-run notice */}
              {isFirstRun && !readError && (
                <View style={styles.notice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={colors.info}
                    style={styles.noticeIcon}
                  />
                  <View style={styles.fieldTextWrap}>
                    <Text style={styles.noticeTitle}>Using default multipliers</Text>
                    <Text style={styles.noticeBody}>
                      4 / 2 / 1 haven't been customized yet. Adjust them below, or keep the
                      defaults.
                    </Text>
                  </View>
                </View>
              )}

              {/* Section label */}
              <Text style={[styles.sectionLabel, styles.sectionLabelSpacing]}>MULTIPLIERS</Text>

              {/* Fields */}
              {FIELDS.map((f) => (
                <FrequencyField
                  key={f.key}
                  config={f}
                  value={values[f.key]}
                  onChangeText={setters[f.key]}
                  onBlur={() => handleFieldBlur(f.key)}
                  reduceMotion={reduceMotion}
                />
              ))}

              {/* Live preview */}
              <FrequencyPreviewCard values={values} />

              {/* Save CTA */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel={
                  saveState === 'saved'
                    ? 'Saved'
                    : saveState === 'error'
                    ? 'Couldn’t save, retry'
                    : 'Save changes, button'
                }
                style={styles.ctaWrap}
              >
                {saveState === 'idle' ? (
                  <LinearGradient
                    colors={gradients.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cta}
                  >
                    <Ionicons name={ctaConfig.icon} size={18} color={ctaConfig.color} />
                    <Text style={[styles.ctaText, { color: ctaConfig.color }]}>
                      {ctaConfig.label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.cta,
                      styles.ctaMorph,
                      {
                        backgroundColor:
                          saveState === 'saved' ? `${colors.success}1a` : `${colors.error}1a`,
                        borderColor: saveState === 'saved' ? colors.success : colors.error,
                      },
                    ]}
                  >
                    <Ionicons name={ctaConfig.icon} size={18} color={ctaConfig.color} />
                    <Text style={[styles.ctaText, { color: ctaConfig.color }]}>
                      {ctaConfig.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Reset link */}
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleReset}
                accessibilityRole="button"
                accessibilityLabel="Reset to defaults, button"
              >
                <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
                <Text style={styles.resetText}>Reset to defaults</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.text },
  helpBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  // Hero
  hero: {
    ...glassEffects.glassFloating,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1a`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { ...typography.bodyBold, color: colors.text },
  heroBody: { ...typography.small, color: colors.textMuted },

  // First-run notice
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    ...glassEffects.glass,
    borderRadius: radius.lg,
    borderColor: `${colors.info}1a`,
    backgroundColor: `${colors.info}1a`,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeIcon: { marginTop: 1 },
  noticeTitle: { ...typography.smallBold, color: colors.text },
  noticeBody: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // Section label
  sectionLabel: {
    ...typography.caption,
    color: colors.textDark,
    letterSpacing: 1,
    fontWeight: '700',
  },
  sectionLabelSpacing: { marginBottom: spacing.md },

  // Field
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fieldSkeleton: { opacity: 0.9 },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1a`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldTextWrap: { flex: 1 },
  fieldLabel: { ...typography.smallBold, color: colors.text },
  fieldHint: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  invalidRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  invalidText: { ...typography.caption, color: colors.error, fontWeight: '600' },
  fieldInput: {
    width: 60,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.glassMedium,
    color: colors.text,
    textAlign: 'center',
    ...typography.bodyBold,
    flexShrink: 0,
    paddingVertical: spacing.sm,
  },

  // Preview
  previewCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  previewBase: { ...typography.small, color: colors.textMuted, flexShrink: 1 },
  previewResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewArrow: { marginHorizontal: 2 },
  previewMonthly: { ...typography.smallBold, color: colors.text },

  // CTA
  ctaWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.lg,
  },
  ctaMorph: { borderWidth: 1.5 },
  ctaText: { ...typography.button },

  // Reset
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.md,
  },
  resetText: { ...typography.smallBold, color: colors.textMuted },
});
