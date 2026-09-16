import { useCallback, useMemo } from 'react';
import { parseLocalDate } from './dashboardModelShared';
import type { Scope } from '@/components/dashboard/ScopeToggle';
import type { Tx } from './dashboardModelShared';
import type { HouseholdSummary } from './dashboardModelShared';

type Args = {
  transactions: Tx[];
  budgetsData: any[];
  billsData: any[];
  userId: string | null;
  effectiveScope: Scope;
  monthStart: Date;
  monthEnd: Date;
  householdSummary: HouseholdSummary | null;
  savingsSummary: { totalTarget: number; totalCurrent: number };
  debtSummary: { total: number };
  cashTotal: number;
  investmentTotal: number;
  propertyTotal: number;
};

export function useDashboardCashflow(a: Args) {
  const {
    transactions, budgetsData, billsData, userId, effectiveScope,
    monthStart, monthEnd, householdSummary, savingsSummary, debtSummary,
    cashTotal, investmentTotal, propertyTotal,
  } = a;

  const scopedTx = useMemo(() => {
    if (effectiveScope === 'me') {
      return transactions.filter((t) => userId && String(t.user_id) === String(userId));
    }
    return transactions;
  }, [transactions, effectiveScope, userId]);

  const { monthInflow, monthOutflow, monthFlow } = useMemo(() => {
    let inflow = 0, outflow = 0;
    for (const t of scopedTx) {
      const d = parseLocalDate(t.date);
      if (!d || d < monthStart || d > monthEnd) continue;
      if (t.type === 'income') inflow += t.amount || 0;
      else if (t.type === 'expense') outflow += t.amount || 0;
    }
    return { monthInflow: inflow, monthOutflow: outflow, monthFlow: inflow - outflow };
  }, [scopedTx, monthStart, monthEnd]);

  const countOccurrencesInMonth = useCallback((startDate?: string, frequency?: string) => {
    const freq = (frequency || '').toLowerCase();
    const start = (startDate ? parseLocalDate(startDate) : null) ?? monthStart;
    if (start > monthEnd) return 0;
    if (freq === 'weekly' || freq === 'biweekly') {
      const step = freq === 'weekly' ? 7 : 14;
      const current = new Date(start);
      if (current < monthStart) {
        const days = Math.floor((monthStart.getTime() - current.getTime()) / 86400000);
        current.setDate(current.getDate() + Math.ceil(days / step) * step);
      }
      let count = 0;
      while (current <= monthEnd) { count++; current.setDate(current.getDate() + step); }
      return count;
    }
    if (freq === '1st-15th') return 2;
    return 1;
  }, [monthStart, monthEnd]);

  const budgetExpenseTotal = useMemo(() => budgetsData
    .filter((x) => (x.type || '').toLowerCase() === 'expense')
    .reduce((sum, x) => sum + (x.amount || 0) * countOccurrencesInMonth(x.start_date, x.frequency), 0),
    [budgetsData, countOccurrencesInMonth]);

  const budgetPercentUsed = budgetExpenseTotal > 0
    ? Math.min(999, Math.round((monthOutflow / budgetExpenseTotal) * 100)) : 0;

  const useHousehold = effectiveScope === 'household' && householdSummary;
  const savingsTarget = useHousehold ? householdSummary!.total_savings_target : savingsSummary.totalTarget;
  const savingsCurrent = useHousehold ? householdSummary!.total_savings_current : savingsSummary.totalCurrent;
  const savingsPercent = savingsTarget > 0 ? Math.round((savingsCurrent / savingsTarget) * 100) : 0;
  const netWorth = cashTotal + investmentTotal + propertyTotal - debtSummary.total;

  const scopedBills = useMemo(() => {
    if (effectiveScope === 'me' && userId) {
      return billsData.filter((x: any) => !x.user_id || String(x.user_id) === String(userId));
    }
    return billsData;
  }, [billsData, effectiveScope, userId]);
  const billsPaid = scopedBills.filter((x: any) => x.status === 'paid').length;
  const billsTotal = scopedBills.length;
  const billsOverdue = scopedBills.filter((x: any) => x.status === 'overdue').length;
  const billsDueSoon = scopedBills.filter((x: any) => x.status === 'due' || x.status === 'due_soon').length;

  const { dailyTotals, thisWeekTotal } = useMemo(() => {
    const today = new Date();
    const dow = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);
    const totals = [0, 0, 0, 0, 0, 0, 0];
    let week = 0;
    scopedTx.forEach((tx) => {
      if (tx.type !== 'expense') return;
      const txDate = parseLocalDate(typeof tx.date === 'string' ? tx.date : '');
      if (!txDate) return;
      const diff = Math.round((txDate.getTime() - weekStart.getTime()) / 86400000);
      if (diff >= 0 && diff <= dow) {
        totals[diff] += tx.amount || 0;
        week += tx.amount || 0;
      }
    });
    return { dailyTotals: totals, thisWeekTotal: week };
  }, [scopedTx]);

  const weeklyBudget = useMemo(() => {
    if (budgetExpenseTotal <= 0) return 0;
    const n = new Date();
    const dim = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    return Math.round((budgetExpenseTotal * 7) / dim);
  }, [budgetExpenseTotal]);

  return {
    scopedTx, monthInflow, monthOutflow, monthFlow, budgetPercentUsed,
    savingsTarget, savingsCurrent, savingsPercent, netWorth,
    billsPaid, billsTotal, billsOverdue, billsDueSoon, dailyTotals, thisWeekTotal, weeklyBudget,
  };
}
