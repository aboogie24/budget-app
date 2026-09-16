import {
  fetchUserTransactions,
  fetchInvestmentHoldings,
  fetchAccountBalances,
  fetchProperties,
  fetchAttention,
  fetchAINudges,
  recordNetWorthSnapshot,
  fetchDashboardStatus,
  type AttentionItem,
  type NetWorthSnapshotPoint,
  type DashboardStatusResponse,
} from '@/utils/api';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { colors } from '@/utils/design-system';
import { type Scope } from '@/components/dashboard/ScopeToggle';
import {
  type Tx,
  type HouseholdSummary,
  type FrameworkLevel,
  type Member,
} from './dashboardModelShared';

export type DashboardLoadResult = {
  transactions: Tx[];
  userName: string | null;
  userId: string | null;
  householdMembers: Member[];
  invitePending: boolean;
  householdSummary: HouseholdSummary | null;
  debtSummary: { total: number };
  savingsSummary: { totalTarget: number; totalCurrent: number };
  budgetsData: any[];
  billsData: any[];
  investmentTotal: number;
  cashTotal: number;
  propertyTotal: number;
  frameworkLevel: FrameworkLevel | null;
  attention: AttentionItem[];
  netWorthHistory: NetWorthSnapshotPoint[];
  statusResp: DashboardStatusResponse | null;
  statusErrored: boolean;
};

export async function loadCoupleFlowDashboard(
  activeScope: Scope,
  currentMonth: number,
  currentYear: number,
): Promise<DashboardLoadResult> {
  const result: DashboardLoadResult = {
    transactions: [],
    userName: null,
    userId: null,
    householdMembers: [],
    invitePending: false,
    householdSummary: null,
    debtSummary: { total: 0 },
    savingsSummary: { totalTarget: 0, totalCurrent: 0 },
    budgetsData: [],
    billsData: [],
    investmentTotal: 0,
    cashTotal: 0,
    propertyTotal: 0,
    frameworkLevel: null,
    attention: [],
    netWorthHistory: [],
    statusResp: null,
    statusErrored: false,
  };

  const data = await fetchUserTransactions();
  if (data) result.transactions = data as Tx[];

  const user = await getCurrentUser();
  if (user) {
    result.userName = user.full_name || user.email || null;
    result.userId = user.id || null;
  }
  if (!user?.id) return result;

  try {
    const householdData = await api.get<any>(`/auth/households/me`, { user_id: user.id });
    const householdID = householdData?.household_id;
    if (householdID) {
      let members = householdData.members;
      if (typeof members === 'string') {
        try { members = JSON.parse(members); } catch {}
      }
      if (Array.isArray(members) && members.length > 0) {
        result.householdMembers = members;
      }
      try {
        result.householdSummary = await api.get<HouseholdSummary>(`/auth/households/summary`, { household_id: householdID });
      } catch (summaryErr) {
        console.log('Household summary error (non-blocking):', summaryErr);
      }
      try {
        const sent = await api.get<any[]>(`/auth/households/invites/sent`, { user_id: user.id });
        const pending = Array.isArray(sent) && sent.some((i) => !i.accepted_at && !i.accepted);
        result.invitePending = !!pending && (!Array.isArray(members) || members.length < 2);
      } catch {
        result.invitePending = false;
      }
    }
  } catch (e) {
    console.log('Household fetch error:', e);
  }

  let localDebt = 0;
  try {
    const debts = await api.get(`/auth/debts`, { user_id: user.id });
    const debtsArray = Array.isArray(debts) ? debts : [];
    const totalDebt = debtsArray.reduce((sum: number, d: any) => sum + (d.balance || 0), 0);
    result.debtSummary = { total: totalDebt };
    localDebt = totalDebt;
  } catch (e) {
    console.error('Debts fetch error:', e);
  }

  try {
    const goals = await api.get(`/auth/savings-goals`, { user_id: user.id });
    const goalsArray = Array.isArray(goals) ? goals : [];
    result.savingsSummary = {
      totalTarget: goalsArray.reduce((sum: number, g: any) => sum + (g.target_amount || 0), 0),
      totalCurrent: goalsArray.reduce((sum: number, g: any) => sum + (g.current_amount || 0), 0),
    };
  } catch (e) {
    console.error('Savings goals fetch error:', e);
  }

  try {
    const budgets = await api.get(`/auth/budgets/user/${user.id}`, { month: currentMonth, year: currentYear });
    result.budgetsData = Array.isArray(budgets) ? budgets : [];
  } catch (e) {
    console.error('Budgets fetch error:', e);
  }

  try {
    const bills = await api.get(`/auth/bills`, { user_id: user.id });
    result.billsData = Array.isArray(bills) ? bills : [];
  } catch (e) {
    console.error('Bills fetch error:', e);
  }

  let localCash = 0;
  let localInvestments = 0;
  let localProperties = 0;
  try {
    const [holdingsData, balancesData, propsData] = await Promise.all([
      fetchInvestmentHoldings(),
      fetchAccountBalances('depository'),
      fetchProperties(),
    ]);
    const invTotal = (Array.isArray(holdingsData) ? holdingsData : []).reduce(
      (sum: number, h: any) => sum + (h.institution_value || 0), 0,
    );
    result.investmentTotal = invTotal;
    localInvestments = invTotal;
    const cash = (Array.isArray(balancesData) ? balancesData : []).reduce(
      (sum: number, a: any) => sum + (a.current_balance || 0), 0,
    );
    result.cashTotal = cash;
    localCash = cash;
    const propTotal = (Array.isArray(propsData) ? propsData : []).reduce(
      (sum: number, p: any) => sum + (p.manual_value || p.zestimate || 0), 0,
    );
    result.propertyTotal = propTotal;
    localProperties = propTotal;
  } catch {}

  try {
    const levelData = await api.get<FrameworkLevel>('/auth/ai/framework-level');
    if (levelData) result.frameworkLevel = levelData;
  } catch {
    console.log('Framework level fetch skipped');
  }

  try {
    const att = await fetchAttention();
    const items = Array.isArray(att?.items) ? [...att.items] : [];
    try {
      const nudges = await fetchAINudges();
      for (const n of Array.isArray(nudges) ? nudges : []) {
        if (n.is_read) continue;
        const navigates = n.action_type === 'navigate_to' && !!n.action_data;
        items.push({
          id: `nudge-${n.id}`,
          priority: 100 + (n.priority || 0),
          title: n.title,
          body: n.body,
          icon: 'sparkles',
          color: colors.primary2,
          cta_label: navigates ? 'Open' : 'Ask AI',
          action: navigates ? 'navigate' : 'ask_ai',
          payload: navigates
            ? { href: n.action_data }
            : { seed: n.action_data || `${n.title} — ${n.body}. What should we do about this?` },
        });
      }
    } catch (e) {
      console.log('Nudge fetch error (non-blocking):', e);
    }
    result.attention = items;
  } catch (e) {
    console.log('Attention fetch error (non-blocking):', e);
  }

  try {
    const snapTotal = localCash + localInvestments + localProperties - localDebt;
    const res = await recordNetWorthSnapshot(
      { cash: localCash, investments: localInvestments, properties: localProperties, debt: localDebt, total: snapTotal },
      30,
    );
    result.netWorthHistory = Array.isArray(res?.snapshots) ? res.snapshots : [];
  } catch (e) {
    console.log('Net-worth snapshot error (non-blocking):', e);
  }

  try {
    const statusScope = activeScope === 'me' ? 'personal' : 'household';
    result.statusResp = await fetchDashboardStatus(statusScope);
    result.statusErrored = false;
  } catch (e) {
    console.log('Status fetch error (falling back):', e);
    result.statusResp = null;
    result.statusErrored = true;
  }

  return result;
}
