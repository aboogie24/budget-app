import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '@/components/GradientBackground';
import { BackButton } from '@/components/BackButton';
import { colors, spacing, radius, typography, glassEffects } from '@/utils/design-system';
import {
  CHECKOUT_PLACEHOLDER,
  PLUS_MONTHLY,
  PLUS_YEARLY,
  isPlus,
} from '@/utils/entitlements';
import { useEntitlements } from '@/hooks/useEntitlements';

type Billing = 'monthly' | 'yearly';

type CompareRow = {
  feature: string;
  free: string;
  plus: string;
  keep?: boolean;
  freeTone?: 'yes' | 'cap' | 'no';
  plusTone?: 'yes' | 'cap' | 'no';
};

const ROWS: CompareRow[] = [
  { feature: 'Budgets, debts, goals', free: 'Included', plus: 'Included', keep: true, freeTone: 'yes', plusTone: 'yes' },
  { feature: 'Household + invite', free: 'Included', plus: 'Included', keep: true, freeTone: 'yes', plusTone: 'yes' },
  { feature: 'Linked bank accounts', free: '1 account', plus: 'Unlimited', freeTone: 'cap', plusTone: 'yes' },
  { feature: 'AI advisor', free: 'Light · 10 msgs / week', plus: 'Full tools + approvals', freeTone: 'cap', plusTone: 'yes' },
  { feature: 'Nudges', free: 'In-app only', plus: 'In-app + push', freeTone: 'cap', plusTone: 'yes' },
];

function toneColor(tone?: 'yes' | 'cap' | 'no') {
  if (tone === 'yes') return colors.success;
  if (tone === 'cap') return colors.warning;
  if (tone === 'no') return colors.textMuted;
  return colors.textMuted;
}

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reason?: string | string[] }>();
  const reasonRaw = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const { plan, planLabel, entitlements } = useEntitlements();
  const alreadyPlus = isPlus(plan);
  const [billing, setBilling] = useState<Billing>('yearly');

  const priceLabel = billing === 'yearly' ? PLUS_YEARLY : PLUS_MONTHLY;
  const periodLine = billing === 'yearly' ? 'per year · household' : 'per month · household';

  const reasonCopy = useMemo(() => {
    if (reasonRaw === 'ai_message_budget') {
      return 'You’ve used this week’s Free advisor messages. Upgrade for full AI — still one household plan.';
    }
    if (reasonRaw === 'banks_limit') {
      return 'Free includes 1 linked account for the household. Plus unlocks multi-bank.';
    }
    if (reasonRaw === 'lapse') {
      return 'Plus ended — shared budgets still work. Upgrade anytime for full AI and multi-bank.';
    }
    return 'Shared money stays Free. Plus unlocks full advisor, multi-bank, and push nudges for the household.';
  }, [reasonRaw]);

  const onSubscribe = () => {
    Alert.alert('CoupleFlow Plus', CHECKOUT_PLACEHOLDER);
  };

  const onManage = () => {
    Alert.alert('Manage plan', CHECKOUT_PLACEHOLDER);
  };

  const onContinueFree = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/settings');
  };

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/settings" color={colors.primary2} />
          <Text style={styles.headerTitle}>CoupleFlow Plus</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>One plan for both of you</Text>
          <Text style={styles.sub}>{reasonCopy}</Text>

          {alreadyPlus ? (
            <View style={styles.activeCard}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>{planLabel} active</Text>
                <Text style={styles.activeBody}>
                  Full AI with tools & approvals, unlimited banks, push nudges. Shared budgets were never gated.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleChip, billing === 'monthly' && styles.toggleChipOn]}
              onPress={() => setBilling('monthly')}
              accessibilityRole="button"
              accessibilityState={{ selected: billing === 'monthly' }}
              accessibilityLabel="Monthly billing"
            >
              <Text style={[styles.toggleText, billing === 'monthly' && styles.toggleTextOn]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleChip, billing === 'yearly' && styles.toggleChipOn]}
              onPress={() => setBilling('yearly')}
              accessibilityRole="button"
              accessibilityState={{ selected: billing === 'yearly' }}
              accessibilityLabel="Yearly billing"
            >
              <Text style={[styles.toggleText, billing === 'yearly' && styles.toggleTextOn]}>Yearly</Text>
              <View style={styles.savePill}>
                <Text style={styles.savePillText}>Save</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.price}>{billing === 'yearly' ? '$89' : '$9.99'}</Text>
            <Text style={styles.period}>{periodLine}</Text>
            <Text style={styles.covers}>Covers you + partner · one household seat</Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.thFeat]}> </Text>
              <Text style={styles.th}>Free</Text>
              <Text style={[styles.th, styles.thPlus]}>Plus</Text>
            </View>
            {ROWS.map((row) => (
              <View key={row.feature} style={[styles.tr, row.keep && styles.trKeep]}>
                <Text style={styles.tdFeat}>{row.feature}</Text>
                <Text style={[styles.td, { color: toneColor(row.freeTone) }]}>{row.free}</Text>
                <Text style={[styles.td, styles.tdPlus, { color: toneColor(row.plusTone) }]}>{row.plus}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.helper}>
            Free keeps the couple money core. Caps are on AI depth and bank links — never on shared budgets.
          </Text>

          {alreadyPlus ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onManage}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Manage plan"
            >
              <Text style={styles.primaryBtnText}>Manage plan</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onSubscribe}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Subscribe to Plus ${priceLabel}`}
              >
                <Text style={styles.primaryBtnText}>Subscribe to Plus · {priceLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={onContinueFree}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Continue with Free"
              >
                <Text style={styles.ghostBtnText}>Continue with Free</Text>
              </TouchableOpacity>
            </>
          )}

          {entitlements && !alreadyPlus ? (
            <Text style={styles.footMeta}>
              Now on Free
              {entitlements.ai_message_budget
                ? ` · ${entitlements.ai_message_budget.used}/${entitlements.ai_message_budget.limit} AI msgs this week`
                : ''}
              {entitlements.banks_unlimited
                ? ''
                : ` · ${entitlements.banks_used}/${entitlements.banks_limit ?? 1} banks`}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  h1: {
    ...typography.h3,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  activeCard: {
    ...glassEffects.glass,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  activeTitle: {
    ...typography.smallBold,
    color: colors.success,
    marginBottom: 4,
  },
  activeBody: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toggleChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  toggleChipOn: {
    borderColor: `${colors.primary2}88`,
    backgroundColor: `${colors.primary2}22`,
  },
  toggleText: {
    ...typography.smallBold,
    color: colors.textMuted,
  },
  toggleTextOn: {
    color: colors.text,
  },
  savePill: {
    backgroundColor: `${colors.success}33`,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  savePillText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
    fontSize: 10,
  },
  priceCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  price: {
    ...typography.h2,
    fontWeight: '800',
    color: colors.text,
  },
  period: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 4,
  },
  covers: {
    ...typography.caption,
    color: colors.primary2,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  table: {
    ...glassEffects.glass,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  th: {
    flex: 1,
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  thFeat: { flex: 1.4, textAlign: 'left' },
  thPlus: { color: colors.primary2 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  trKeep: {
    backgroundColor: `${colors.success}0a`,
  },
  tdFeat: {
    flex: 1.4,
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  td: {
    flex: 1,
    ...typography.caption,
    textAlign: 'center',
  },
  tdPlus: {
    fontWeight: '700',
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    ...typography.smallBold,
    color: colors.text,
  },
  ghostBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ghostBtnText: {
    ...typography.smallBold,
    color: colors.textMuted,
  },
  footMeta: {
    ...typography.caption,
    color: colors.textDark,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
