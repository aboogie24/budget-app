import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/utils/design-system';
import {
  BANK_PROVIDERS,
  WORDMARK,
  type StarterExpense,
  type BankProvider,
} from '@/utils/onboarding';
import {
  OnboardingPrimaryCta,
  OnboardingGhostCta,
  OnboardingNoticeCard,
  OnboardingField,
  OnboardingRoadmap,
  WelcomeOrbs,
} from './OnboardingChrome';
import { styles } from './onboardingStyles';

export type StepViewProps = {
  step: number;
  goNext: () => void;
  partnerEmail: string;
  setPartnerEmail: (t: string) => void;
  hhBusy: boolean;
  hhReady: boolean;
  hhCreateError: boolean;
  invitePending: boolean;
  inviteError: boolean;
  handleHouseholdContinue: () => void;
  continueAfterInviteError: () => void;
  expenses: StarterExpense[];
  toggleExpense: (id: string) => void;
  income: string;
  setIncome: (t: string) => void;
  budgetBusy: boolean;
  budgetError: boolean;
  budgetNeedOne: boolean;
  budgetsSkipped: boolean;
  handleCreateBudgets: () => void;
  handleSkipBudgets: () => void;
  showProviders: boolean;
  setShowProviders: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProvider: BankProvider | null;
  linkerNotice: boolean;
  handleConnectLater: () => void;
  handleChooseProvider: (p: BankProvider) => void;
  handleProviderContinue: () => void;
  summary: string;
  completeError: boolean;
  completing: boolean;
  handleComplete: () => void;
};

export function OnboardingStepViews(p: StepViewProps) {
  if (p.step === 0) {
    return (
      <View style={styles.welcomeContent}>
        <WelcomeOrbs />
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmarkCouple, { color: WORDMARK.couple }]}>Couple</Text>
          <Text style={[styles.wordmarkHeartGlyph, { color: WORDMARK.heart }]}>♥</Text>
          <Text style={[styles.wordmarkFlow, { color: WORDMARK.flow }]}>Flow</Text>
        </View>
        <Text style={styles.headline}>Build your financial future, together</Text>
        <Text style={styles.subtitle}>
          Take control of your finances as a couple — starting with a shared household and clear budgets.
        </Text>
        <View style={styles.welcomeCtaWrap}>
          <OnboardingPrimaryCta label="Continue" onPress={p.goNext} iconTrailing="arrow-forward" />
        </View>
      </View>
    );
  }
  if (p.step === 1) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.headlineLeft}>Your household</Text>
        <Text style={styles.cardBody}>
          We'll create a household for your money. Invite your partner now or later.
        </Text>
        <OnboardingField
          label="PARTNER'S EMAIL (OPTIONAL)"
          value={p.partnerEmail}
          onChangeText={p.setPartnerEmail}
          placeholder="partner@example.com"
          editable={!p.hhBusy && !p.hhReady}
        />
        {p.hhReady && !p.inviteError && (
          <OnboardingNoticeCard
            tone="success"
            message={
              p.invitePending
                ? 'Invite sent. They will see it when they open CoupleFlow.'
                : 'Solo household ready — you can invite later in Settings'
            }
          />
        )}
        {p.hhCreateError && !p.hhReady && (
          <OnboardingNoticeCard
            tone="error"
            message="Could not create your household. Retry to continue."
            onRetry={p.handleHouseholdContinue}
            retryLabel="Retry"
          />
        )}
        {p.inviteError && p.hhReady && (
          <OnboardingNoticeCard
            tone="error"
            message="Invite could not be sent. Your household is ready — you can invite again in Settings."
            onRetry={p.continueAfterInviteError}
            retryLabel="Continue"
          />
        )}
        {!p.hhReady && (
          <OnboardingPrimaryCta
            label={p.partnerEmail.trim() ? 'Send invite' : 'Continue without invite'}
            onPress={p.handleHouseholdContinue}
            loading={p.hhBusy}
            loadingLabel="Setting up…"
          />
        )}
        {!p.hhReady && (
          <TouchableOpacity
            onPress={p.handleHouseholdContinue}
            style={styles.skipLink}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={p.hhBusy}
          >
            <Text style={styles.skipLinkText}>Continue without invite</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  if (p.step === 2) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.headlineLeft}>What should we track first?</Text>
        <Text style={styles.cardBody}>Set a few starter budgets so the dashboard is not empty.</Text>
        <OnboardingField
          label="MONTHLY TAKE-HOME INCOME (OPTIONAL)"
          value={p.income}
          onChangeText={p.setIncome}
          placeholder="e.g. 7200"
          keyboardType="decimal-pad"
          editable={!p.budgetBusy}
        />
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>STARTER EXPENSES</Text>
        {p.expenses.map((exp) => (
          <TouchableOpacity
            key={exp.id}
            style={[styles.expenseRow, !exp.on && styles.expenseRowOff]}
            onPress={() => p.toggleExpense(exp.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: exp.on }}
            accessibilityLabel={`${exp.name} ${exp.amount}`}
          >
            <Ionicons
              name={exp.on ? 'checkbox' : 'square-outline'}
              size={22}
              color={exp.on ? colors.primary2 : colors.textMuted}
            />
            <Text style={styles.expenseName}>{exp.name}</Text>
            <Text style={styles.expenseAmt}>${exp.amount}</Text>
          </TouchableOpacity>
        ))}
        <Text style={[styles.helper, { marginTop: spacing.sm }]}>
          These become shared budgets when your partner joins.
        </Text>
        {p.budgetNeedOne && (
          <OnboardingNoticeCard tone="info" message="Turn on at least one expense, or skip for now." />
        )}
        {p.budgetError && (
          <OnboardingNoticeCard
            tone="error"
            message="Could not create budgets. Retry, or continue and set them up later."
            onRetry={p.handleCreateBudgets}
            retryLabel="Retry"
          />
        )}
        <OnboardingPrimaryCta
          label="Create starter budgets"
          onPress={p.handleCreateBudgets}
          loading={p.budgetBusy}
          loadingLabel="Creating…"
        />
        <OnboardingGhostCta label="Skip for now" onPress={p.handleSkipBudgets} disabled={p.budgetBusy} />
        {p.budgetsSkipped ? (
          <OnboardingNoticeCard
            tone="warning"
            message="Skipped for now — you can create budgets anytime from the Dashboard."
          />
        ) : null}
      </View>
    );
  }
  if (p.step === 3) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.headlineLeft}>Link banks later or now</Text>
        <Text style={styles.cardBody}>
          CoupleFlow supports Plaid, Teller, Flinks, and SimpleFIN. You can connect anytime in Settings.
        </Text>
        <OnboardingNoticeCard
          tone="info"
          message="Recommended: connect later so you can explore with starter budgets first."
        />
        <OnboardingPrimaryCta label="Connect later" onPress={p.handleConnectLater} iconTrailing="arrow-forward" />
        <OnboardingGhostCta label="Choose a provider" onPress={() => p.setShowProviders((v) => !v)} />
        {p.showProviders && (
          <View style={styles.providerGrid}>
            {BANK_PROVIDERS.map((prov) => (
              <TouchableOpacity
                key={prov}
                style={[styles.providerPill, p.selectedProvider === prov && styles.providerPillOn]}
                onPress={() => p.handleChooseProvider(prov)}
                accessibilityRole="button"
                accessibilityLabel={prov}
              >
                <Text style={styles.providerPillText}>{prov}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {p.linkerNotice && p.selectedProvider && (
          <>
            <OnboardingNoticeCard tone="info" message={`Would open ${p.selectedProvider} linker`} />
            <OnboardingPrimaryCta label="Continue" onPress={p.handleProviderContinue} />
          </>
        )}
      </View>
    );
  }
  return (
    <View style={styles.stepContent}>
      <Text style={styles.headlineLeft}>The CoupleFlow Method</Text>
      <Text style={styles.cardBody}>A clear path from foundation to the life you are building together.</Text>
      <OnboardingRoadmap />
      <View style={styles.summaryChips}>
        <Text style={styles.summaryChipText}>{p.summary}</Text>
      </View>
      {p.completeError && (
        <OnboardingNoticeCard
          tone="error"
          message="Could not finish onboarding. Retry before leaving — otherwise you'll return to this wizard on next launch."
          onRetry={p.handleComplete}
          retryLabel="Retry"
        />
      )}
      <OnboardingPrimaryCta
        label="Let's go"
        onPress={p.handleComplete}
        loading={p.completing}
        loadingLabel="Finishing…"
        iconTrailing="rocket-outline"
      />
    </View>
  );
}
