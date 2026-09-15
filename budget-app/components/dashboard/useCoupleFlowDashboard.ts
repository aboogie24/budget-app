import { useCallback, useMemo } from 'react';
import { colors } from '@/utils/design-system';
import { type HeadlineStatus } from '@/components/dashboard/StatusHeadlineCard';
import { type RecentTx, type PartnerGlyph } from '@/components/dashboard/RecentActivity';
import { parseLocalDate, severityMin } from './dashboardModelShared';
import { useCoupleFlowDashboardBase } from './useCoupleFlowDashboardBase';
import { useDashboardCashflow } from './useDashboardCashflow';

export function useCoupleFlowDashboard() {
  const b = useCoupleFlowDashboardBase();
  const cf = useDashboardCashflow({
    transactions: b.transactions,
    budgetsData: b.budgetsData,
    billsData: b.billsData,
    userId: b.userId,
    effectiveScope: b.effectiveScope,
    monthStart: b.monthStart,
    monthEnd: b.monthEnd,
    householdSummary: b.householdSummary,
    savingsSummary: b.savingsSummary,
    debtSummary: b.debtSummary,
    cashTotal: b.cashTotal,
    investmentTotal: b.investmentTotal,
    propertyTotal: b.propertyTotal,
  });

  const {
    scopedTx, monthInflow, monthOutflow, monthFlow, budgetPercentUsed,
    savingsTarget, savingsCurrent, savingsPercent, netWorth,
    billsPaid, billsTotal, billsOverdue, billsDueSoon, dailyTotals, thisWeekTotal, weeklyBudget,
  } = cf;

  const {
    router, budgetsData, userName, drawerOpen, setDrawerOpen, frameworkLevel, userId,
    householdMembers, invitePending, attention, netWorthHistory, scope, statusResp,
    statusErrored, loading, loadedOnce, refreshing, loadDashboard, onRefresh, isCouple,
    hhChip, effectiveScope, onScopeChange, transactions,
  } = b;

  const clientStatus = useMemo(() => {
    const billsStatus: Exclude<HeadlineStatus, 'setup'> =
      billsOverdue > 0 ? 'alert' : billsDueSoon > 0 ? 'watch' : 'good';
    let spendStatus: Exclude<HeadlineStatus, 'setup'> = 'good';
    if (weeklyBudget > 0) {
      const over = ((thisWeekTotal - weeklyBudget) / weeklyBudget) * 100;
      if (over > 20) spendStatus = 'alert';
      else if (over > 5) spendStatus = 'watch';
    }
    const cashFlowStatus: Exclude<HeadlineStatus, 'setup'> =
      monthFlow < 0 ? 'alert' : monthFlow < 50 ? 'watch' : 'good';
    const overall = severityMin(billsStatus, spendStatus, cashFlowStatus);
    let headline: string;
    if (overall === 'good') {
      headline = weeklyBudget > 0 && thisWeekTotal < weeklyBudget
        ? "You're under budget and bills are covered — nice week."
        : 'Everything looks on track this week.';
    } else if (overall === 'watch') {
      if (spendStatus === 'watch') headline = "Spending's running a bit hot this week — keep an eye on it.";
      else if (billsStatus === 'watch') headline = 'A bill is coming due soon — worth a look.';
      else headline = "Cash flow's near flat this month — keep an eye on it.";
    } else if (billsStatus === 'alert') {
      headline = "Heads up — a bill is overdue. Let's get it handled.";
    } else if (cashFlowStatus === 'alert') {
      headline = "You're spending more than you're bringing in this month.";
    } else {
      headline = "Spending's well over budget this week — time to reset.";
    }
    return { status: overall, headline };
  }, [billsOverdue, billsDueSoon, weeklyBudget, thisWeekTotal, monthFlow]);

  const isEmpty = loadedOnce && !loading && transactions.length === 0 && budgetsData.length === 0;
  const headlineStatus: HeadlineStatus = isEmpty ? 'setup' : (statusResp?.status ?? clientStatus.status);
  const headlineText = isEmpty
    ? "Let's get your first numbers in — link an account or add a transaction."
    : (statusResp?.headline || clientStatus.headline);
  const heroCashFlow = statusResp?.hero_value ?? monthFlow;
  const heroIn = statusResp?.signals?.income_month ?? monthInflow;
  const heroOut = statusResp?.signals?.expense_month ?? monthOutflow;

  const recentTx: RecentTx[] = useMemo(() =>
    [...scopedTx]
      .sort((a, c) => (parseLocalDate(c.date)?.getTime() ?? 0) - (parseLocalDate(a.date)?.getTime() ?? 0))
      .slice(0, 3),
    [scopedTx]);

  const resolvePartner = useCallback((tx: RecentTx): PartnerGlyph => {
    if (effectiveScope === 'me' || !tx.user_id || !userId) return null;
    if (String(tx.user_id) === String(userId)) {
      const me = householdMembers.find((m) => String(m.user_id) === String(userId));
      return { glyph: '◑', color: colors.primary2, name: (me?.full_name || userName || 'You').split(' ')[0] };
    }
    const partner = householdMembers.find((m) => String(m.user_id) === String(tx.user_id));
    if (!partner) return null;
    return { glyph: '◐', color: colors.info, name: (partner.full_name || 'Partner').split(' ')[0] };
  }, [effectiveScope, userId, householdMembers, userName]);

  const hr = new Date().getHours();
  const greeting = `${hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}, ${(userName || 'there').split(' ')[0]}`;
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayIndex = new Date().getDay();

  const netWorthDeltaPercent = useMemo(() => {
    if (netWorthHistory.length < 2) return null;
    const first = netWorthHistory[0].total;
    const last = netWorthHistory[netWorthHistory.length - 1].total;
    if (!first) return null;
    return Math.round(((last - first) / Math.abs(first)) * 1000) / 10;
  }, [netWorthHistory]);

  const showSkeleton = loading && !loadedOnce;
  const hasTrajectory = frameworkLevel != null || netWorthHistory.length >= 2 || netWorth !== 0;

  const drawerItems = (
    [
      ['dashboard', 'grid-outline', 'Dashboard', '/(tabs)/dashboard'],
      ['budgets', 'pie-chart-outline', 'Budgets', '/(tabs)/budget'],
      ['transactions', 'swap-horizontal-outline', 'Transactions', '/transaction/list'],
      ['bills', 'receipt-outline', 'Bills', '/bills'],
      ['debts', 'card-outline', 'Debts', '/debts'],
      ['savings', 'trending-up-outline', 'Savings', '/savings'],
      ['priorities', 'star-outline', 'Priorities', '/priorities'],
      ['investments', 'briefcase-outline', 'Investments', '/investments'],
      ['properties', 'home-outline', 'Properties', '/properties'],
      ['activity', 'time-outline', 'Activity Feed', '/activity-feed'],
      ['accounts', 'link-outline', 'Linked Accounts', '/linked-accounts'],
    ] as const
  ).map(([id, icon, label, href]) => ({ id, icon, label, onPress: () => router.push(href as any) }));

  return {
    router, budgetsData, userName, drawerOpen, setDrawerOpen, userId, householdMembers,
    invitePending, attention, loading, loadedOnce, refreshing, loadDashboard, onRefresh,
    isCouple, hhChip, scope, onScopeChange, statusErrored, isEmpty, headlineStatus, headlineText,
    heroCashFlow, heroIn, heroOut, recentTx, resolvePartner, greeting, dayLabels, todayIndex,
    netWorthDeltaPercent, showSkeleton, hasTrajectory, drawerItems, thisWeekTotal, weeklyBudget,
    dailyTotals, budgetPercentUsed, savingsCurrent, savingsTarget, savingsPercent, billsPaid,
    billsTotal, netWorth, frameworkLevel,
  };
}
