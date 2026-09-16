import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchDashboardStatus, type AttentionItem, type NetWorthSnapshotPoint, type DashboardStatusResponse } from '@/utils/api';
import { type Scope } from '@/components/dashboard/ScopeToggle';
import { householdChipLabel } from '@/utils/onboarding';
import {
  type Tx,
  type HouseholdSummary,
  type FrameworkLevel,
  type Member,
} from './dashboardModelShared';
import { loadCoupleFlowDashboard } from './loadCoupleFlowDashboard';

export function useCoupleFlowDashboardBase() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [debtSummary, setDebtSummary] = useState({ total: 0 });
  const [savingsSummary, setSavingsSummary] = useState({ totalTarget: 0, totalCurrent: 0 });
  const [billsData, setBillsData] = useState<any[]>([]);
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const [householdSummary, setHouseholdSummary] = useState<HouseholdSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [frameworkLevel, setFrameworkLevel] = useState<FrameworkLevel | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Member[]>([]);
  const [invitePending, setInvitePending] = useState(false);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshotPoint[]>([]);
  const [scope, setScope] = useState<Scope>('household');
  const [statusResp, setStatusResp] = useState<DashboardStatusResponse | null>(null);
  const [statusErrored, setStatusErrored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const monthEnd = useMemo(() => new Date(currentYear, currentMonth + 1, 0), [currentYear, currentMonth]);

  const loadDashboard = useCallback(async (activeScope: Scope) => {
    const r = await loadCoupleFlowDashboard(activeScope, currentMonth, currentYear);
    setTransactions(r.transactions);
    setUserName(r.userName);
    setUserId(r.userId);
    setHouseholdMembers(r.householdMembers);
    setInvitePending(r.invitePending);
    setHouseholdSummary(r.householdSummary);
    setDebtSummary(r.debtSummary);
    setSavingsSummary(r.savingsSummary);
    setBudgetsData(r.budgetsData);
    setBillsData(r.billsData);
    setInvestmentTotal(r.investmentTotal);
    setCashTotal(r.cashTotal);
    setPropertyTotal(r.propertyTotal);
    setFrameworkLevel(r.frameworkLevel);
    setAttention(r.attention);
    setNetWorthHistory(r.netWorthHistory);
    setStatusResp(r.statusResp);
    setStatusErrored(r.statusErrored);
    setLoading(false);
    setLoadedOnce(true);
  }, [currentMonth, currentYear]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadDashboard(scope); } finally { setRefreshing(false); }
  }, [loadDashboard, scope]);

  useEffect(() => { loadDashboard(scope); }, [loadDashboard]);
  useFocusEffect(useCallback(() => { loadDashboard(scope); }, [loadDashboard]));

  const isCouple = householdMembers.length >= 2;
  const hhChip = householdChipLabel({ invitePending, memberCount: householdMembers.length || 1 });
  const effectiveScope: Scope = isCouple ? scope : 'me';

  const onScopeChange = useCallback((next: Scope) => {
    setScope(next);
    (async () => {
      try {
        const statusScope = next === 'me' ? 'personal' : 'household';
        setStatusResp(await fetchDashboardStatus(statusScope));
        setStatusErrored(false);
      } catch {
        setStatusResp(null);
        setStatusErrored(true);
      }
    })();
  }, []);

  return {
    router, transactions, budgetsData, debtSummary, savingsSummary, billsData,
    investmentTotal, cashTotal, propertyTotal, userName, householdSummary,
    drawerOpen, setDrawerOpen, frameworkLevel, userId, householdMembers, invitePending,
    attention, netWorthHistory, scope, statusResp, statusErrored, loading, loadedOnce,
    refreshing, monthStart, monthEnd, loadDashboard, onRefresh, isCouple, hhChip,
    effectiveScope, onScopeChange,
  };
}
