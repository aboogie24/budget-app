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
import { FormButton, FormField, FormInput } from '@/components/form';
import { MigrateConsentPanel } from '@/components/household/MigrateConsentPanel';
import {
  OnboardingPrimaryCta,
  OnboardingGhostCta,
  OnboardingNoticeCard,
  OnboardingField,
  OnboardingRoadmap,
  WelcomeOrbs,
} from './OnboardingChrome';
import { styles } from './onboardingStyles';
import {
  type HouseholdInvite,
  invitePreviewLine,
  primaryCtaForAction,
} from '@/utils/householdInvites';

export type JoinMode = 'choice' | 'enter_code' | 'migrate';

export type StepViewProps = {
  step: number;
  goNext: () => void;
  // OB1 join-or-start
  joinMode: JoinMode;
  setJoinMode: (m: JoinMode) => void;
  pendingIncoming: HouseholdInvite[];
  selectedInvite: HouseholdInvite | null;
  inviteCode: string;
  setInviteCode: (t: string) => void;
  joinBusy: boolean;
  joinError: string | null;
  joinSuccessName: string | null;
  handleJoinPrimary: (invite: HouseholdInvite) => void;
  handleMigrateConfirm: () => void;
  handleMigrateCancel: () => void;
  handleEnterCodeContinue: () => void;
  handleStartOwn: () => void;
  handleShowEnterCode: () => void;
  // OB2 household create
  partnerEmail: string;
  setPartnerEmail: (t: string) => void;
  hhBusy: boolean;
  hhReady: boolean;
  hhCreateError: boolean;
  invitePending: boolean;
  inviteError: boolean;
  handleHouseholdContinue: () => void;
  continueAfterInviteError: () => void;
  // OB3 budgets
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
  // OB4 banks
  showProviders: boolean;
  setShowProviders: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProvider: BankProvider | null;
  linkerNotice: boolean;
  handleConnectLater: () => void;
  handleChooseProvider: (p: BankProvider) => void;
  handleProviderContinue: () => void;
  // OB5 finish
  summary: string;
  completeError: boolean;
  completing: boolean;
  handleComplete: () => void;
};

function ChoiceCard({
  icon,
  title,
  body,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.choiceCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.choiceIcon}>
        <Ionicons name={icon} size={22} color={colors.primary2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function JoinOrStartStep(p: StepViewProps) {
  if (p.joinMode === 'migrate' && p.selectedInvite) {
    return (
      <View style={styles.stepContent}>
        <MigrateConsentPanel
          invite={p.selectedInvite}
          busy={p.joinBusy}
          onConfirm={p.handleMigrateConfirm}
          onCancel={p.handleMigrateCancel}
        />
      </View>
    );
  }

  if (p.joinMode === 'enter_code') {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.headlineLeft}>Enter your invite code</Text>
        <Text style={styles.cardBody}>
          Paste the code your partner shared. We'll show what joining looks like before anything moves.
        </Text>
        <FormField label="Invite code" error={p.joinError}>
          <FormInput
            value={p.inviteCode}
            onChangeText={p.setInviteCode}
            placeholder="Paste invite code"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!p.joinBusy}
          />
        </FormField>
        <View style={{ marginTop: spacing.md }}>
          <FormButton
            label="Continue"
            onPress={p.handleEnterCodeContinue}
            loading={p.joinBusy}
            disabled={!p.inviteCode.trim()}
            icon="arrow-forward"
          />
          <FormButton
            label="Back"
            onPress={() => p.setJoinMode('choice')}
            variant="ghost"
            disabled={p.joinBusy}
          />
        </View>
      </View>
    );
  }

  // choice mode
  const pending = p.pendingIncoming[0];
  return (
    <View style={styles.stepContent}>
      <Text style={styles.headlineLeft}>Together or solo first?</Text>
      <Text style={styles.cardBody}>
        If your partner already invited you, join their household. Otherwise start yours and invite them
        later.
      </Text>

      {p.joinSuccessName ? (
        <OnboardingNoticeCard tone="success" message={`You're in ${p.joinSuccessName}`} />
      ) : null}
      {p.joinError && !pending ? (
        <OnboardingNoticeCard tone="error" message={p.joinError} />
      ) : null}

      {pending ? (
        <View style={styles.pendingInviteCard}>
          <View style={styles.choiceIcon}>
            <Ionicons name="home" size={22} color={colors.primary2} />
          </View>
          <Text style={styles.choiceTitle}>{invitePreviewLine(pending)}</Text>
          <Text style={[styles.choiceBody, { marginBottom: spacing.md }]}>
            {pending.household_name || 'Household'}
            {pending.inviter_email ? ` · from ${pending.inviter_email}` : ''}
          </Text>
          {(() => {
            const cta = primaryCtaForAction(pending.accept_preview?.action);
            return (
              <FormButton
                label={cta.label}
                onPress={() => p.handleJoinPrimary(pending)}
                loading={p.joinBusy}
                disabled={cta.disabled}
                icon={cta.kind === 'join' ? 'checkmark-circle-outline' : 'arrow-forward'}
              />
            );
          })()}
          {p.joinError ? (
            <Text style={[styles.helper, { color: colors.error, marginTop: spacing.sm }]}>
              {p.joinError}
            </Text>
          ) : null}
          <FormButton
            label="Start my own instead"
            onPress={p.handleStartOwn}
            variant="ghost"
            disabled={p.joinBusy}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <ChoiceCard
            icon="mail-unread-outline"
            title="I have an invite"
            body="Enter a code from your partner"
            onPress={p.handleShowEnterCode}
          />
          <ChoiceCard
            icon="home-outline"
            title="Start a new household"
            body="Create yours and invite them later"
            onPress={p.handleStartOwn}
          />
        </View>
      )}
    </View>
  );
}

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
    return <JoinOrStartStep {...p} />;
  }

  if (p.step === 2) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.headlineLeft}>Your household</Text>
        <Text style={styles.cardBody}>
          We'll create a household for your money. Invite your partner now or later.
        </Text>
        <OnboardingField
          label="Partner's email (optional)"
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
          <FormButton
            label={p.partnerEmail.trim() ? 'Send invite' : 'Continue without invite'}
            onPress={p.handleHouseholdContinue}
            loading={p.hhBusy}
            icon="arrow-forward"
          />
        )}
        {!p.hhReady && (
          <FormButton
            label="Continue without invite"
            onPress={p.handleHouseholdContinue}
            variant="ghost"
            disabled={p.hhBusy}
          />
        )}
      </View>
    );
  }

  if (p.step === 3) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.headlineLeft}>What should we track first?</Text>
        <Text style={styles.cardBody}>Set a few starter budgets so the dashboard is not empty.</Text>
        <OnboardingField
          label="Monthly take-home income (optional)"
          value={p.income}
          onChangeText={p.setIncome}
          placeholder="e.g. 7200"
          keyboardType="decimal-pad"
          editable={!p.budgetBusy}
        />
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Starter expenses</Text>
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
        <FormButton
          label="Create starter budgets"
          onPress={p.handleCreateBudgets}
          loading={p.budgetBusy}
        />
        <FormButton label="Skip for now" onPress={p.handleSkipBudgets} variant="ghost" disabled={p.budgetBusy} />
        {p.budgetsSkipped ? (
          <OnboardingNoticeCard
            tone="warning"
            message="Skipped for now — you can create budgets anytime from the Dashboard."
          />
        ) : null}
      </View>
    );
  }

  if (p.step === 4) {
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
        <FormButton label="Connect later" onPress={p.handleConnectLater} icon="arrow-forward" />
        <FormButton
          label="Choose a provider"
          onPress={() => p.setShowProviders((v) => !v)}
          variant="ghost"
        />
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
            <FormButton label="Continue" onPress={p.handleProviderContinue} />
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
      <FormButton
        label="Let's go"
        onPress={p.handleComplete}
        loading={p.completing}
        icon="rocket-outline"
      />
    </View>
  );
}
