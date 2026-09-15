import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '@/utils/design-system';

export function HouseholdChip({ label }: { label: string }) {
  return (
    <View style={styles.hhChip} accessibilityLabel={`Household: ${label}`}>
      <Text style={styles.hhChipText}>{label}</Text>
    </View>
  );
}

export function StarterBudgetCards({ budgets }: { budgets: any[] }) {
  const router = useRouter();
  if (!budgets?.length) return null;
  return (
    <View style={styles.budgetCards} accessibilityLabel="Starter budgets">
      <Text style={styles.budgetCardsTitle}>Your budgets</Text>
      {budgets.slice(0, 6).map((b: any) => {
        const amount = Number(b.amount || 0);
        const spent = Number(b.spent || b.spent_amount || 0);
        const remaining = Math.max(0, amount - spent);
        const pct = amount > 0 ? Math.min(100, Math.round((remaining / amount) * 100)) : 100;
        return (
          <TouchableOpacity
            key={b.id || b.name}
            style={styles.budgetCard}
            onPress={() => router.push('/(tabs)/budget' as any)}
            accessibilityRole="button"
            accessibilityLabel={`${b.name} ${remaining} remaining`}
          >
            <View style={styles.budgetCardRow}>
              <Text style={styles.budgetCardName} numberOfLines={1}>{b.name}</Text>
              <Text style={styles.budgetCardAmt}>${remaining.toLocaleString()}</Text>
            </View>
            <View style={styles.budgetBarTrack}>
              <View style={[styles.budgetBarFill, { width: `${pct}%` }]} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function EmptyBudgetsCta() {
  const router = useRouter();
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No budgets yet</Text>
      <Text style={styles.emptyText}>Create your first shared budget to see remaining balances here.</Text>
      <TouchableOpacity
        style={styles.emptyCta}
        onPress={() => router.push('/budget/add-budget' as any)}
        accessibilityRole="button"
        accessibilityLabel="Create your first budget"
      >
        <Text style={styles.emptyCtaText}>Create your first budget</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  hhChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  hhChipText: { ...typography.caption, color: colors.textMuted },
  budgetCards: { marginTop: spacing.lg, gap: spacing.sm },
  budgetCardsTitle: { ...typography.smallBold, color: colors.textMuted, marginBottom: spacing.xs },
  budgetCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  budgetCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  budgetCardName: { ...typography.smallBold, color: colors.text, flex: 1, marginRight: spacing.sm },
  budgetCardAmt: { ...typography.small, color: colors.textMuted },
  budgetBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  budgetBarFill: { height: '100%', borderRadius: 999, backgroundColor: colors.primary2 },
  emptyCard: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
  },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
  emptyCta: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyCtaText: { ...typography.button, color: colors.text },
});
