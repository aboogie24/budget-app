import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser } from '@/utils/storage';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius } from '@/utils/design-system';
import {
  TOTAL_ONBOARDING_STEPS,
  DEFAULT_STARTER_EXPENSES,
  type StarterExpense,
  type BankProvider,
  ensureHouseholdAlways,
  bootstrapStarterBudgets,
  completeOnboardingAndPersist,
  canCreateStarterBudgets,
  finishSummaryLabel,
} from '@/utils/onboarding';
import {
  OnboardingProgressRail,
  OnboardingHeader,
  OnboardingPrimaryCta,
} from './OnboardingChrome';
import { OnboardingStepViews } from './OnboardingStepViews';
import { styles } from './onboardingStyles';

const FADE_MS = 150;

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [booting, setBooting] = useState(true);
  const [noSession, setNoSession] = useState(false);
  const reduceMotion = useRef(false);

  const [partnerEmail, setPartnerEmail] = useState('');
  const [hhBusy, setHhBusy] = useState(false);
  const [hhReady, setHhReady] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [inviteError, setInviteError] = useState(false);

  const [expenses, setExpenses] = useState<StarterExpense[]>(() =>
    DEFAULT_STARTER_EXPENSES.map((e) => ({ ...e })),
  );
  const [income, setIncome] = useState('');
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [budgetError, setBudgetError] = useState(false);
  const [budgetNeedOne, setBudgetNeedOne] = useState(false);
  const [budgetsSkipped, setBudgetsSkipped] = useState(false);
  const [incomeCreated, setIncomeCreated] = useState(false);

  const [showProviders, setShowProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<BankProvider | null>(null);
  const [linkerNotice, setLinkerNotice] = useState(false);

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
    animateTransition(Math.min(currentStep + 1, TOTAL_ONBOARDING_STEPS - 1));
  };

  const goBack = () => {
    animateTransition(Math.max(currentStep - 1, 0));
  };

  const handleHouseholdContinue = async () => {
    setInviteError(false);
    setHhBusy(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');
      const result = await ensureHouseholdAlways({
        userId: user.id,
        fullName: user.full_name || user.name,
        partnerEmail,
      });
      if (!result.household_id) throw new Error('No household_id');
      setHhReady(true);
      setInvitePending(result.invite_pending);
      setInviteError(result.invite_error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!result.invite_error) {
        setTimeout(() => goNext(), result.invite_pending ? 700 : 500);
      }
    } catch (err) {
      console.error('Household ensure error:', err);
      setInviteError(true);
    } finally {
      setHhBusy(false);
    }
  };

  const continueAfterInviteError = () => {
    setInviteError(false);
    goNext();
  };

  const toggleExpense = (id: string) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, on: !e.on } : e)));
    setBudgetNeedOne(false);
  };

  const handleCreateBudgets = async () => {
    setBudgetError(false);
    if (!canCreateStarterBudgets(expenses, income)) {
      setBudgetNeedOne(true);
      return;
    }
    setBudgetBusy(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');
      await bootstrapStarterBudgets({
        userId: user.id,
        action: 'create',
        expenses,
        income,
      });
      setBudgetsSkipped(false);
      setIncomeCreated(!!(income && parseFloat(income) > 0));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => goNext(), 400);
    } catch (err) {
      console.error('Bootstrap error:', err);
      setBudgetError(true);
    } finally {
      setBudgetBusy(false);
    }
  };

  const handleSkipBudgets = async () => {
    setBudgetError(false);
    setBudgetNeedOne(false);
    const user = await getCurrentUser();
    if (user?.id) {
      await bootstrapStarterBudgets({
        userId: user.id,
        action: 'skip',
        expenses,
        income,
      });
    }
    setBudgetsSkipped(true);
    setIncomeCreated(false);
    goNext();
  };

  const handleConnectLater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goNext();
  };

  const handleChooseProvider = (provider: BankProvider) => {
    setSelectedProvider(provider);
    setLinkerNotice(true);
  };

  const handleProviderContinue = () => {
    setLinkerNotice(false);
    goNext();
  };

  const handleComplete = async () => {
    setCompleteError(false);
    setCompleting(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');
      await completeOnboardingAndPersist({ userId: user.id, monthlyBudgetGoal: 0 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      console.error('Complete onboarding error:', err);
      setCompleteError(true);
      setTimeout(() => router.replace('/(tabs)/dashboard'), 900);
    } finally {
      setCompleting(false);
    }
  };

  const expenseOnCount = expenses.filter((e) => e.on).length;
  const summary = finishSummaryLabel({
    budgetsSkipped,
    expenseCount: budgetsSkipped ? 0 : expenseOnCount,
    hasIncome: !budgetsSkipped && incomeCreated,
  });

  const stepMeta = [
    { title: 'Welcome', showBack: false, skippable: false },
    { title: 'Your household', showBack: true, skippable: true },
    { title: 'Set up your budget', showBack: true, skippable: true },
    { title: 'Connect accounts', showBack: true, skippable: true },
    { title: 'Your CoupleFlow Journey', showBack: true, skippable: false },
  ];
  const meta = stepMeta[currentStep];

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

  const onHeaderSkip = () => {
    if (currentStep === 1) { handleHouseholdContinue(); return; }
    if (currentStep === 2) { handleSkipBudgets(); return; }
    if (currentStep === 3) { handleConnectLater(); return; }
    goNext();
  };

  const stepProps = {
    step: currentStep,
    goNext,
    partnerEmail, setPartnerEmail,
    hhBusy, hhReady, invitePending, inviteError,
    handleHouseholdContinue, continueAfterInviteError,
    expenses, toggleExpense, income, setIncome,
    budgetBusy, budgetError, budgetNeedOne, budgetsSkipped,
    handleCreateBudgets, handleSkipBudgets,
    showProviders, setShowProviders, selectedProvider, linkerNotice,
    handleConnectLater, handleChooseProvider, handleProviderContinue,
    summary, completeError, completing, handleComplete,
  };

  const scrollBody = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: reduceMotion.current ? 1 : fadeAnim, flexGrow: 1 }}>
        {booting ? renderSkeleton() : noSession ? renderNoSession() : <OnboardingStepViews {...stepProps} />}
      </Animated.View>
    </ScrollView>
  );

  const needsKeyboard = currentStep === 1 || currentStep === 2;

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.railWrap}>
          <OnboardingProgressRail totalSteps={TOTAL_ONBOARDING_STEPS} currentStep={currentStep} />
        </View>
        {!booting && !noSession && (
          <OnboardingHeader
            title={meta.title}
            onBack={goBack}
            onSkip={meta.skippable ? onHeaderSkip : undefined}
            showBack={meta.showBack}
          />
        )}
        {needsKeyboard && !booting && !noSession ? (
          <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
