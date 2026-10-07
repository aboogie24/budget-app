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
import { InviteEdgeSheet } from '@/components/household/InviteEdgeSheet';
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
  type HouseholdInvite,
  fetchIncomingInvites,
  acceptHouseholdInvite,
  primaryCtaForAction,
  requiresMigrateConsent,
  edgeCopyForAcceptError,
  edgeCopyForBlockedAction,
  resolveInviteByCode,
  acceptPreviewFromError,
  householdDisplayName,
  isInviteExpired,
} from '@/utils/householdInvites';
import {
  OnboardingProgressRail,
  OnboardingHeader,
  OnboardingPrimaryCta,
} from './OnboardingChrome';
import { OnboardingStepViews, type JoinMode } from './OnboardingStepViews';
import { styles } from './onboardingStyles';

const FADE_MS = 150;

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [booting, setBooting] = useState(true);
  const [noSession, setNoSession] = useState(false);
  const reduceMotion = useRef(false);

  // OB1 join-or-start
  const [joinMode, setJoinMode] = useState<JoinMode>('choice');
  const [pendingIncoming, setPendingIncoming] = useState<HouseholdInvite[]>([]);
  const [selectedInvite, setSelectedInvite] = useState<HouseholdInvite | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccessName, setJoinSuccessName] = useState<string | null>(null);
  const [joinedViaInvite, setJoinedViaInvite] = useState(false);
  const [edgeVisible, setEdgeVisible] = useState(false);
  const [edgeMessage, setEdgeMessage] = useState('');

  const [partnerEmail, setPartnerEmail] = useState('');
  const [hhBusy, setHhBusy] = useState(false);
  const [hhReady, setHhReady] = useState(false);
  const [hhCreateError, setHhCreateError] = useState(false);
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
        if (!user?.id) {
          setNoSession(true);
        } else {
          try {
            const invites = await fetchIncomingInvites(user.id);
            if (mounted) {
              setPendingIncoming(invites.filter((i) => !isInviteExpired(i)));
            }
          } catch (e) {
            console.log('Incoming invites fetch skipped:', e);
          }
        }
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
    if (currentStep === 1 && joinMode !== 'choice') {
      setJoinMode('choice');
      setJoinError(null);
      setSelectedInvite(null);
      return;
    }
    animateTransition(Math.max(currentStep - 1, 0));
  };

  const goToBudgets = () => {
    // Skip household create (step 2) when already joined via invite.
    animateTransition(3);
  };

  const showEdge = (message: string) => {
    setEdgeMessage(message);
    setEdgeVisible(true);
  };

  const onJoinSuccess = (invite: HouseholdInvite) => {
    const name = householdDisplayName(invite);
    setJoinSuccessName(name);
    setJoinedViaInvite(true);
    setHhReady(true);
    setJoinError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => goToBudgets(), 600);
  };

  const postAccept = async (invite: HouseholdInvite, confirmMigrate?: boolean) => {
    const user = await getCurrentUser();
    if (!user?.id) throw new Error('No user session');
    return acceptHouseholdInvite({
      code: invite.code,
      userId: user.id,
      confirmMigrate,
    });
  };

  const handleJoinPrimary = async (invite: HouseholdInvite) => {
    setJoinError(null);
    setSelectedInvite(invite);
    const action = invite.accept_preview?.action;
    const cta = primaryCtaForAction(action);

    if (cta.kind === 'cant_join') {
      showEdge(edgeCopyForBlockedAction(action));
      return;
    }
    if (cta.kind === 'fix_banks') {
      showEdge(edgeCopyForBlockedAction(action));
      return;
    }
    if (cta.kind === 'review' || requiresMigrateConsent(invite.accept_preview)) {
      setJoinMode('migrate');
      return;
    }

    // join / discard_solo / already_member — one tap, no confirm_migrate
    setJoinBusy(true);
    try {
      await postAccept(invite, false);
      onJoinSuccess(invite);
    } catch (err) {
      const preview = acceptPreviewFromError(err);
      if (preview && requiresMigrateConsent(preview)) {
        setSelectedInvite({ ...invite, accept_preview: preview });
        setJoinMode('migrate');
        return;
      }
      if (preview?.action === 'blocked_banks_limit' || preview?.action === 'blocked_multi_member') {
        showEdge(edgeCopyForBlockedAction(preview.action));
        return;
      }
      const msg = edgeCopyForAcceptError(err);
      setJoinError(msg);
      if (
        msg.includes('bank') ||
        msg.includes('Leave') ||
        msg.includes('different email') ||
        msg.includes('expired')
      ) {
        showEdge(msg);
      }
    } finally {
      setJoinBusy(false);
    }
  };

  const handleMigrateConfirm = async () => {
    if (!selectedInvite) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      await postAccept(selectedInvite, true);
      setJoinMode('choice');
      onJoinSuccess(selectedInvite);
    } catch (err) {
      const msg = edgeCopyForAcceptError(err);
      setJoinError(msg);
      showEdge(msg);
    } finally {
      setJoinBusy(false);
    }
  };

  const handleMigrateCancel = () => {
    setJoinMode('choice');
    setJoinError(null);
  };

  const handleEnterCodeContinue = async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');
      const invite = await resolveInviteByCode(user.id, code);
      setSelectedInvite(invite);
      const action = invite.accept_preview?.action;
      const cta = primaryCtaForAction(action);
      if (cta.kind === 'review' || requiresMigrateConsent(invite.accept_preview)) {
        setJoinMode('migrate');
        return;
      }
      if (cta.kind === 'fix_banks' || cta.kind === 'cant_join') {
        showEdge(edgeCopyForBlockedAction(action));
        return;
      }
      // Same accept path as pending card
      setJoinMode('choice');
      setPendingIncoming((prev) => {
        if (prev.some((i) => i.code === invite.code)) return prev;
        return [invite, ...prev];
      });
    } catch (err) {
      setJoinError(edgeCopyForAcceptError(err));
    } finally {
      setJoinBusy(false);
    }
  };

  const handleStartOwn = () => {
    setJoinError(null);
    setJoinMode('choice');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(2); // household create — ensure only after choice
  };

  const handleShowEnterCode = () => {
    setJoinError(null);
    setJoinMode('enter_code');
  };

  const handleHouseholdContinue = async () => {
    setInviteError(false);
    setHhCreateError(false);
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
      setHhCreateError(false);
      setInvitePending(result.invite_pending);
      setInviteError(result.invite_error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!result.invite_error) {
        setTimeout(() => goNext(), result.invite_pending ? 700 : 500);
      }
    } catch (err) {
      console.error('Household create error:', err);
      setHhReady(false);
      setInviteError(false);
      setHhCreateError(true);
    } finally {
      setHhBusy(false);
    }
  };

  const continueAfterInviteError = () => {
    if (!hhReady) return;
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
      // If user skipped join AND skipped create somehow, ensure once before finish.
      // Normal paths: joinedViaInvite OR hhReady from create.
      if (!joinedViaInvite && !hhReady) {
        await ensureHouseholdAlways({
          userId: user.id,
          fullName: user.full_name || user.name,
        });
        setHhReady(true);
      }
      const result = await completeOnboardingAndPersist({
        userId: user.id,
        monthlyBudgetGoal: 0,
      });
      if (!result.onboarding_complete || !result.persisted) {
        setCompleteError(true);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      console.error('Complete onboarding error:', err);
      setCompleteError(true);
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
    { title: 'Join or start', showBack: true, skippable: false },
    { title: 'Your household', showBack: true, skippable: true },
    { title: 'Set up your budget', showBack: true, skippable: true },
    { title: 'Connect accounts', showBack: true, skippable: true },
    { title: 'Your CoupleFlow Journey', showBack: true, skippable: false },
  ];
  const meta = stepMeta[currentStep] || stepMeta[0];

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
    if (currentStep === 2) {
      handleHouseholdContinue();
      return;
    }
    if (currentStep === 3) {
      handleSkipBudgets();
      return;
    }
    if (currentStep === 4) {
      handleConnectLater();
      return;
    }
    goNext();
  };

  const stepProps = {
    step: currentStep,
    goNext,
    joinMode,
    setJoinMode,
    pendingIncoming,
    selectedInvite,
    inviteCode,
    setInviteCode,
    joinBusy,
    joinError,
    joinSuccessName,
    handleJoinPrimary,
    handleMigrateConfirm,
    handleMigrateCancel,
    handleEnterCodeContinue,
    handleStartOwn,
    handleShowEnterCode,
    partnerEmail,
    setPartnerEmail,
    hhBusy,
    hhReady,
    hhCreateError,
    invitePending,
    inviteError,
    handleHouseholdContinue,
    continueAfterInviteError,
    expenses,
    toggleExpense,
    income,
    setIncome,
    budgetBusy,
    budgetError,
    budgetNeedOne,
    budgetsSkipped,
    handleCreateBudgets,
    handleSkipBudgets,
    showProviders,
    setShowProviders,
    selectedProvider,
    linkerNotice,
    handleConnectLater,
    handleChooseProvider,
    handleProviderContinue,
    summary,
    completeError,
    completing,
    handleComplete,
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

  const needsKeyboard = currentStep === 1 || currentStep === 2 || currentStep === 3;

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
        <InviteEdgeSheet
          visible={edgeVisible}
          message={edgeMessage}
          onClose={() => setEdgeVisible(false)}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}
