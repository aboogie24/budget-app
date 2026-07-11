import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import GradientBackground from '@/components/GradientBackground';
import { BackButton } from '@/components/BackButton';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  gradients,
  glassEffects,
} from '@/utils/design-system';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── CoupleFlow Method Levels (copy/order preserved; colors → tokens per spec §7.1) ─
const LEVELS: {
  title: string;
  description: string;
  icon: IoniconName;
  color: string;
}[] = [
  { title: 'Foundation', description: 'Set up budgets & emergency fund', icon: 'home-outline', color: colors.primary2 },
  { title: 'Attack Debt', description: 'Eliminate high-interest debt', icon: 'flame-outline', color: colors.error },
  { title: 'Build Security', description: '3-6 month safety net', icon: 'shield-checkmark-outline', color: colors.success },
  { title: 'Grow Wealth', description: 'Invest & build assets', icon: 'trending-up-outline', color: colors.info },
  { title: 'Dream Big', description: 'Plan your dream goals', icon: 'star-outline', color: colors.primary2 },
];

const TOTAL_STEPS = 4;
const FADE_MS = 150;

// ─── §4.1 Progress rail ───────────────────────────────────────
function OnboardingProgressRail({
  totalSteps,
  currentStep,
}: {
  totalSteps: number;
  currentStep: number;
}) {
  return (
    <View
      style={styles.rail}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}`}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep + 1 }}
    >
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.railSeg,
            { backgroundColor: i <= currentStep ? colors.primary : colors.glassLight },
          ]}
        />
      ))}
    </View>
  );
}

// ─── §4.2 Header ──────────────────────────────────────────────
function OnboardingHeader({
  title,
  onBack,
  onSkip,
  showBack,
}: {
  title: string;
  onBack: () => void;
  onSkip?: () => void;
  showBack: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {showBack ? (
          <BackButton onPress={onBack} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        {onSkip ? (
          <TouchableOpacity
            onPress={onSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
          >
            <Text style={styles.skipHeaderText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    </View>
  );
}

// ─── §4.3 Primary CTA ─────────────────────────────────────────
function OnboardingPrimaryCta({
  label,
  onPress,
  loading,
  disabled,
  loadingLabel,
  iconLeading,
  iconTrailing,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
  iconLeading?: IoniconName;
  iconTrailing?: IoniconName;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[styles.ctaWrapper, isDisabled && !loading && styles.ctaDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      <LinearGradient
        colors={[...gradients.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cta}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.text} />
            {loadingLabel ? <Text style={styles.ctaText}>{loadingLabel}</Text> : null}
          </>
        ) : (
          <>
            {iconLeading ? <Ionicons name={iconLeading} size={18} color={colors.text} /> : null}
            <Text style={styles.ctaText}>{label}</Text>
            {iconTrailing ? <Ionicons name={iconTrailing} size={18} color={colors.text} /> : null}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── §4.4 Status pill ─────────────────────────────────────────
function OnboardingStatusPill({ label }: { label: string }) {
  return (
    <View
      style={styles.statusPill}
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

// ─── §4.5 Notice card (recoverable / non-blocking) ────────────
function OnboardingNoticeCard({
  message,
  onRetry,
  retryLabel = 'Retry',
  tone = 'warning',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: 'warning' | 'error';
}) {
  const toneColor = tone === 'error' ? colors.error : colors.warning;
  return (
    <View
      style={styles.noticeCard}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="alert-circle-outline" size={20} color={toneColor} />
      <Text style={styles.noticeText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
        >
          <Text style={styles.noticeRetry}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── §4.6 Email field ─────────────────────────────────────────
function OnboardingField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          { borderColor: focused ? colors.primary2 : colors.borderGlass },
          !editable && styles.fieldInputDisabled,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textDark}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

// ─── §4.7 Roadmap ─────────────────────────────────────────────
function OnboardingRoadmap() {
  return (
    <View style={styles.roadmapCard} accessibilityRole="list">
      {LEVELS.map((level, index) => (
        <View
          key={level.title}
          style={styles.roadmapItem}
          accessibilityLabel={`${level.title}: ${level.description}`}
        >
          <View style={styles.roadmapLeft}>
            <View style={[styles.levelChip, { backgroundColor: `${level.color}33` }]}>
              <Ionicons name={level.icon} size={20} color={level.color} />
            </View>
            {index < LEVELS.length - 1 && <View style={styles.connector} />}
          </View>
          <View style={styles.roadmapRight}>
            <Text style={styles.levelTitle}>{level.title}</Text>
            <Text style={styles.levelDesc} numberOfLines={2}>
              {level.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Decorative orbs (step 0) ─────────────────────────────────
function WelcomeOrbs() {
  return (
    <View
      style={styles.orbsContainer}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.orb, { backgroundColor: `${colors.primary2}2e`, left: 0 }]} />
      <View style={[styles.orb, { backgroundColor: `${colors.info}2e`, right: 0 }]} />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────
export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Initial-mount async resolve (§3.4 / §3.5)
  const [booting, setBooting] = useState(true);
  const [noSession, setNoSession] = useState(false);
  const reduceMotion = useRef(false);

  // Step 1 state
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState(false);

  // Step 2 state
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [linkError, setLinkError] = useState(false);

  // Step 3 state
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rm = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) reduceMotion.current = rm;
      } catch {}
      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        if (!user?.id) setNoSession(true);
      } catch {
        if (mounted) setNoSession(true);
      } finally {
        if (mounted) setBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ─── Navigation ─────────────────────────────────────────────
  const animateTransition = (nextStep: number) => {
    if (reduceMotion.current) {
      setCurrentStep(nextStep);
      return;
    }
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCurrentStep(nextStep), FADE_MS);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(Math.min(currentStep + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    animateTransition(Math.max(currentStep - 1, 0));
  };

  // ─── Step 1: Send Invite ────────────────────────────────────
  const handleSendInvite = async () => {
    if (!partnerEmail.trim()) {
      goNext();
      return;
    }
    Keyboard.dismiss();
    setInviteError(false);
    setInviteSending(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');

      let householdId: string | null = null;
      try {
        const hh = await api.get<any>('/auth/households/me');
        householdId = hh?.household_id;
      } catch {}

      if (!householdId) {
        const newHH = await api.post<any>('/auth/households', {
          name: `${user.full_name || 'My'} Household`,
        });
        householdId = newHH?.id;
      }

      if (householdId) {
        await api.post('/auth/households/invite', {
          household_id: householdId,
          invitee_email: partnerEmail.trim(),
        });
      }

      setInviteSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => goNext(), 800);
    } catch (err) {
      console.error('Invite error:', err);
      setInviteError(true);
    } finally {
      setInviteSending(false);
    }
  };

  // ─── Step 2: Plaid Link ─────────────────────────────────────
  const handleLinkAccount = async () => {
    setLinkError(false);
    setLinking(true);
    try {
      const { link_token } = await api.get<any>('/auth/link_token');
      if (!link_token) throw new Error('No link token');

      const baseUrl = api.getBaseUrl();
      const url = `${baseUrl}/plaid/link-page?token=${encodeURIComponent(link_token)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, 'budgetapp://');

      if (result.type === 'success') {
        setLinked(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => goNext(), 500);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setLinkError(true);
      }
    } catch (err) {
      console.error('Plaid link error:', err);
      setLinkError(true);
    } finally {
      setLinking(false);
    }
  };

  // ─── Step 3: Complete Onboarding ────────────────────────────
  const handleComplete = async () => {
    setCompleteError(false);
    setCompleting(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');

      await api.post('/auth/onboarding/complete', {
        user_id: user.id,
        monthly_budget_goal: 0,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      console.error('Complete onboarding error:', err);
      // Never block the user — surface a brief notice, then still navigate (§3.6)
      setCompleteError(true);
      setTimeout(() => router.replace('/(tabs)/dashboard'), 900);
    } finally {
      setCompleting(false);
    }
  };

  // ─── Step content ───────────────────────────────────────────
  const stepMeta = [
    { title: 'Welcome', showBack: false, skippable: false },
    { title: 'Invite Partner', showBack: true, skippable: true },
    { title: 'Link a Bank', showBack: true, skippable: true },
    { title: 'Your CoupleFlow Journey', showBack: true, skippable: false },
  ];

  const renderStep0 = () => (
    <View style={styles.welcomeContent}>
      <WelcomeOrbs />
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmarkCouple}>Couple</Text>
        <Ionicons name="heart" size={26} color={colors.primary2} style={styles.wordmarkHeart} />
        <Text style={styles.wordmarkFlow}>Flow</Text>
      </View>
      <Text style={styles.headline}>Build your financial future, together</Text>
      <Text style={styles.subtitle}>Take control of your money as a couple</Text>
      <View style={styles.welcomeCtaWrap}>
        <OnboardingPrimaryCta label="Get Started" onPress={goNext} iconTrailing="arrow-forward" />
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.illustrationRow}>
        <Ionicons name="phone-portrait-outline" size={40} color={colors.primary2} />
        <Ionicons name="arrow-forward" size={24} color={colors.textDark} style={styles.illoArrow} />
        <Ionicons name="phone-portrait-outline" size={40} color={colors.info} />
      </View>

      <View style={styles.glassCard}>
        <Text style={styles.cardTitle}>Budget together</Text>
        <Text style={styles.cardBody}>Invite your partner to share this household.</Text>
        <OnboardingField
          label="PARTNER'S EMAIL"
          value={partnerEmail}
          onChangeText={setPartnerEmail}
          placeholder="partner@example.com"
          editable={!inviteSending && !inviteSent}
        />
      </View>

      {inviteError && (
        <OnboardingNoticeCard
          message="Couldn't send the invite — you can add your partner later in Settings."
          onRetry={handleSendInvite}
        />
      )}

      {inviteSent ? (
        <OnboardingStatusPill label="Invite sent" />
      ) : (
        <OnboardingPrimaryCta
          label={inviteError ? 'Continue' : partnerEmail.trim() ? 'Send Invite' : 'Continue'}
          onPress={inviteError ? goNext : handleSendInvite}
          loading={inviteSending}
          loadingLabel="Sending…"
        />
      )}

      {!inviteSent && (
        <TouchableOpacity onPress={goNext} style={styles.skipLink} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.skipLinkText}>Skip for now</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.linkGlyphWrap}>
        <Ionicons name="link" size={32} color={colors.primary2} />
      </View>

      <View style={styles.glassCard}>
        <Text style={styles.cardTitle}>See your real money move</Text>
        <Text style={styles.cardBody}>
          Connect a bank to auto-import income, spending, and bills. You can add more accounts anytime.
        </Text>
        <View style={styles.securityRow}>
          <Ionicons name="lock-closed" size={16} color={colors.success} />
          <Text style={styles.securityText}>Bank-level encryption · read-only access</Text>
        </View>
      </View>

      {linkError && (
        <OnboardingNoticeCard
          message="Couldn't connect your bank — you can link one later in Settings."
          onRetry={handleLinkAccount}
          retryLabel="Try again"
        />
      )}

      {linked ? (
        <OnboardingStatusPill label="Account connected" />
      ) : (
        <OnboardingPrimaryCta
          label="Connect a bank"
          onPress={handleLinkAccount}
          loading={linking}
          loadingLabel="Connecting…"
          iconLeading="link"
        />
      )}

      {!linked && (
        <TouchableOpacity onPress={goNext} style={styles.skipLink} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.skipLinkText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.journeyIntro}>
        Our AI meets you where you are and guides you level by level.
      </Text>

      <OnboardingRoadmap />

      {completeError && (
        <OnboardingNoticeCard message="We'll finish setting things up in the background." />
      )}

      <OnboardingPrimaryCta
        label="Let's Go!"
        onPress={handleComplete}
        loading={completing}
        loadingLabel="Finishing…"
        iconTrailing="rocket-outline"
      />
    </View>
  );

  const STEP_RENDERERS = [renderStep0, renderStep1, renderStep2, renderStep3];
  const meta = stepMeta[currentStep];

  // ─── Empty state (§3.5) ─────────────────────────────────────
  const renderNoSession = () => (
    <View style={styles.centerCard}>
      <Ionicons name="information-circle" size={48} color={colors.info} />
      <Text style={styles.centerTitle}>Let's get you signed in</Text>
      <Text style={styles.centerBody}>You'll need an account to set up CoupleFlow.</Text>
      <View style={styles.centerCtaWrap}>
        <OnboardingPrimaryCta label="Sign in" onPress={() => router.replace('/login')} />
      </View>
    </View>
  );

  // ─── Loading skeleton (§3.4) ────────────────────────────────
  const renderSkeleton = () => (
    <View style={styles.stepContent}>
      <Skeleton width={140} height={18} style={{ marginBottom: spacing.xl }} />
      <View style={styles.glassCard}>
        <Skeleton width="60%" height={16} style={{ marginBottom: spacing.sm }} />
        <Skeleton width="40%" height={12} style={{ marginBottom: spacing.lg }} />
        <Skeleton width="100%" height={44} borderRadius={radius.md} />
      </View>
      <Skeleton width="100%" height={52} borderRadius={radius.lg} style={{ marginTop: spacing.md }} />
    </View>
  );

  const scrollBody = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: reduceMotion.current ? 1 : fadeAnim, flexGrow: 1 }}>
        {booting
          ? renderSkeleton()
          : noSession
          ? renderNoSession()
          : STEP_RENDERERS[currentStep]()}
      </Animated.View>
    </ScrollView>
  );

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.railWrap}>
          <OnboardingProgressRail totalSteps={TOTAL_STEPS} currentStep={currentStep} />
        </View>

        {!booting && !noSession && currentStep > 0 && (
          <OnboardingHeader
            title={meta.title}
            onBack={goBack}
            onSkip={meta.skippable ? goNext : undefined}
            showBack={meta.showBack}
          />
        )}

        {currentStep === 1 && !booting && !noSession ? (
          <KeyboardAvoidingView
            style={styles.flex1}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              {scrollBody}
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        ) : (
          scrollBody
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

// ─── Styles (all tokens; no magic colors/fonts) ───────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex1: { flex: 1 },

  // Progress rail
  railWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  rail: {
    flexDirection: 'row',
    gap: spacing.xs,
    height: 4,
  },
  railSeg: {
    flex: 1,
    borderRadius: radius.full,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  headerSide: { width: 64, alignItems: 'flex-start', justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    ...typography.bodyBold,
  },
  skipHeaderText: {
    color: colors.primary2,
    ...typography.smallBold,
  },

  // Scroll / content
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'center',
  },
  stepContent: {
    alignItems: 'stretch',
    paddingVertical: spacing.lg,
  },
  welcomeContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },

  // CTA
  ctaWrapper: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  ctaDisabled: { opacity: 0.5 },
  cta: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  ctaText: {
    color: colors.text,
    ...typography.button,
  },

  // Status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    backgroundColor: `${colors.success}1f`,
    borderWidth: 1,
    borderColor: `${colors.success}33`,
  },
  statusPillText: {
    color: colors.success,
    ...typography.smallBold,
  },

  // Notice card
  noticeCard: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    ...typography.small,
  },
  noticeRetry: {
    color: colors.primary2,
    ...typography.smallBold,
  },

  // Field
  fieldWrap: { width: '100%', marginTop: spacing.lg },
  fieldLabel: {
    color: colors.textMuted,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    ...glassEffects.glass,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  fieldInputDisabled: { opacity: 0.6 },

  // Glass card (steps 1 & 2 benefit copy)
  glassCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    width: '100%',
  },
  cardTitle: {
    color: colors.text,
    ...typography.bodyBold,
    marginBottom: spacing.xs,
  },
  cardBody: {
    color: colors.textMuted,
    ...typography.small,
  },

  // Step 0 wordmark + orbs
  orbsContainer: {
    width: 160,
    height: 120,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  orb: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    position: 'absolute',
    top: 10,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  wordmarkCouple: {
    color: colors.primary2,
    ...typography.h1,
  },
  wordmarkFlow: {
    color: colors.info,
    ...typography.h1,
  },
  wordmarkHeart: { marginHorizontal: spacing.xs },
  headline: {
    color: colors.text,
    ...typography.h3,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  welcomeCtaWrap: { width: '100%', marginTop: spacing.lg },

  // Step 1 illustration
  illustrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  illoArrow: { marginHorizontal: spacing.md },

  // Step 2 glyph + security
  linkGlyphWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radius.full,
    ...glassEffects.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  securityText: {
    color: colors.textMuted,
    ...typography.caption,
    flex: 1,
  },

  // Skip link
  skipLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  skipLinkText: {
    color: colors.primary2,
    ...typography.smallBold,
  },

  // Step 3 roadmap
  journeyIntro: {
    color: colors.textMuted,
    ...typography.body,
    marginBottom: spacing.lg,
  },
  roadmapCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    width: '100%',
  },
  roadmapItem: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  roadmapLeft: { alignItems: 'center' },
  levelChip: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: spacing.xl,
    backgroundColor: colors.borderGlass,
    marginVertical: spacing.xs,
  },
  roadmapRight: {
    flex: 1,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  levelTitle: {
    color: colors.text,
    ...typography.smallBold,
    marginBottom: spacing.xs,
  },
  levelDesc: {
    color: colors.textMuted,
    ...typography.caption,
  },

  // Center card (empty state)
  centerCard: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  centerTitle: {
    color: colors.text,
    ...typography.h3,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  centerBody: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
    maxWidth: 300,
  },
  centerCtaWrap: { width: '100%', marginTop: spacing.lg },
});
