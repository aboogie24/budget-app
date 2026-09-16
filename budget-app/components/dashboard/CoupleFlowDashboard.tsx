import { dashboardStyles as styles } from './dashboardStyles';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { DrawerNavigation } from '@/components/DrawerNavigation';
import { AttentionCard } from '@/components/AttentionCard';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius } from '@/utils/design-system';
import { StatusHeadlineCard } from '@/components/dashboard/StatusHeadlineCard';
import { ThisWeekProof } from '@/components/dashboard/ThisWeekProof';
import { TrajectoryStrip } from '@/components/dashboard/TrajectoryStrip';
import { ScopeToggle } from '@/components/dashboard/ScopeToggle';
import { HouseholdChip, StarterBudgetCards, EmptyBudgetsCta } from '@/components/dashboard/FirstRunSection';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useCoupleFlowDashboard } from './useCoupleFlowDashboard';

export default function CoupleFlowDashboard() {
  const {
    router, budgetsData, userName, drawerOpen, setDrawerOpen, userId, householdMembers,
    attention, loading, loadedOnce, refreshing, loadDashboard, onRefresh, isCouple, hhChip,
    scope, onScopeChange, statusErrored, isEmpty, headlineStatus, headlineText, heroCashFlow,
    heroIn, heroOut, recentTx, resolvePartner, greeting, dayLabels, todayIndex,
    netWorthDeltaPercent, showSkeleton, hasTrajectory, drawerItems, thisWeekTotal, weeklyBudget,
    dailyTotals, budgetPercentUsed, savingsCurrent, savingsTarget, savingsPercent, billsPaid,
    billsTotal, netWorth, frameworkLevel, netWorthHistory,
  } = useCoupleFlowDashboard();

  const partners = householdMembers.filter((m) => userId && String(m.user_id) !== String(userId));

  return (
    <GradientBackground variant="bgDarkPurple" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.drawerBtn} onPress={() => setDrawerOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.greetingWrap}>
            <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
            <HouseholdChip label={hhChip} />
          </View>

          <View style={styles.headerRight}>
            {loading && loadedOnce && <ActivityIndicator color={colors.primary2} size="small" />}
            {isCouple && (
              <View style={styles.avatars}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{(userName || 'Y').charAt(0).toUpperCase()}</Text>
                </View>
                {partners.slice(0, 1).map((p) => (
                  <View key={p.user_id} style={[styles.avatar, styles.avatarOverlap, { backgroundColor: colors.info }]}>
                    <Text style={styles.avatarText}>{(p.full_name || 'P').charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}
            <ScopeToggle value={scope} onChange={onScopeChange} visible={isCouple} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary2} colors={[colors.primary2]} />
          }
        >
          {showSkeleton ? (
            <View style={{ gap: spacing.lg }}>
              <StatusHeadlineCard loading status="good" headline="" cashFlow={0} />
              <View style={{ gap: spacing.md }}>
                <Skeleton width={80} height={12} />
                <ThisWeekProof
                  loading
                  spentThisWeek={0} weeklyBudget={0} weeklyByDay={[0, 0, 0, 0, 0, 0, 0]}
                  todayIndex={todayIndex} dayLabels={dayLabels}
                  budgetPercentUsed={0} savingsCurrent={0} savingsTarget={0} savingsProgressPercent={0}
                  billsPaid={0} billsTotal={0}
                />
              </View>
              <TrajectoryStrip loading netWorth={0} level={1} levelName="" progressPercent={0} />
              <View style={{ gap: spacing.md }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skelRow}>
                    <Skeleton width={36} height={36} borderRadius={radius.md} />
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      <Skeleton width="60%" height={12} />
                      <Skeleton width="40%" height={10} />
                    </View>
                    <Skeleton width={60} height={14} />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <>
              <StatusHeadlineCard
                status={headlineStatus}
                headline={headlineText}
                cashFlow={heroCashFlow}
                moneyIn={isEmpty ? undefined : heroIn}
                moneyOut={isEmpty ? undefined : heroOut}
                errored={statusErrored && !isEmpty}
                onRetry={() => loadDashboard(scope)}
                onCtaPress={() => router.push('/link-account' as any)}
              />

              <StarterBudgetCards budgets={budgetsData} />

              {isEmpty ? (
                <EmptyBudgetsCta />
              ) : (
                <>
                  <View style={{ marginTop: spacing.xl }}>
                    <AttentionCard items={attention} onActionComplete={() => loadDashboard(scope)} />
                  </View>

                  <View style={attention.length > 0 ? undefined : { marginTop: spacing.xl }}>
                    <ThisWeekProof
                      spentThisWeek={thisWeekTotal}
                      weeklyBudget={weeklyBudget}
                      weeklyByDay={dailyTotals}
                      todayIndex={todayIndex}
                      dayLabels={dayLabels}
                      budgetPercentUsed={budgetPercentUsed}
                      savingsCurrent={savingsCurrent}
                      savingsTarget={savingsTarget}
                      savingsProgressPercent={savingsPercent}
                      billsPaid={billsPaid}
                      billsTotal={billsTotal}
                      onBudgetPress={() => router.push('/(tabs)/budget' as any)}
                      onSavingsPress={() => router.push('/savings' as any)}
                      onBillsPress={() => router.push('/bills' as any)}
                    />
                  </View>

                  {hasTrajectory && (
                    <View style={{ marginTop: spacing.lg }}>
                      <TrajectoryStrip
                        netWorth={netWorth}
                        netWorthDeltaPercent={netWorthDeltaPercent}
                        netWorthHistory={netWorthHistory}
                        level={frameworkLevel?.current_level ?? 1}
                        levelName={frameworkLevel?.level_name ?? 'Foundation'}
                        progressPercent={frameworkLevel?.progress_percent ?? 0}
                        onPress={() => router.push('/framework' as any)}
                      />
                    </View>
                  )}

                  <View style={{ marginTop: spacing.lg }}>
                    <RecentActivity
                      transactions={recentTx}
                      resolvePartner={resolvePartner}
                      onSeeAll={() => router.push('/transaction/list' as any)}
                      onPressTx={(tx) =>
                        router.push({
                          pathname: '/transaction/[id]',
                          params: {
                            id: tx.id,
                            type: tx.type,
                            amount: String(tx.amount),
                            note: tx.note,
                            category_name: tx.category_name || tx.category,
                            date: tx.date,
                            source: tx.source,
                          },
                        })
                      }
                    />
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <DrawerNavigation isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} items={drawerItems} />

      <FloatingActionButton
        actions={[
          { id: 'add-expense', icon: 'card-outline', label: 'Add Expense', color: colors.error, onPress: () => router.push({ pathname: '/add-transaction', params: { type: 'expense' } }) },
          { id: 'add-income', icon: 'trending-up', label: 'Add Income', color: colors.success, onPress: () => router.push({ pathname: '/add-transaction', params: { type: 'income' } }) },
          { id: 'create-budget', icon: 'pie-chart-outline', label: 'Create Budget', color: colors.info, onPress: () => router.push('/budget/add-budget') },
          { id: 'link-account', icon: 'link-outline', label: 'Link Account', color: colors.success, onPress: () => router.push('/link-account') },
        ]}
      />
    </GradientBackground>
  );
}
