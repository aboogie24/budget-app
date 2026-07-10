import { api } from './apiClient';

export async function fetchUserTransactions() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');

  const data = await api.get<any[]>(`/auth/transactions`, { user_id: userId });
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => ({
    ...t,
    category_name: t.category_name ?? t.category ?? t.categoryName,
  }));
}

export async function fetchBudgetSummary(month: number, year: number) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.get(`/auth/budgets/user/${userId}/summary`, { month, year });
}

export async function fetchCategories() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>(`/auth/categories/user/${userId}`);
  return Array.isArray(data) ? data : [];
}

export async function syncPlaidTransactions() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post(`/auth/plaid/sync?user_id=${userId}`, undefined);
}

export type AttentionItem = {
  id: string;
  priority: number;
  title: string;
  body?: string;
  icon: string;
  color: string;
  cta_label: string;
  action: 'reconnect' | 'mark_paid' | 'review' | 'open_budget' | 'ai_categorize';
  payload?: Record<string, any>;
};

export async function fetchAttention() {
  return api.get<{ items: AttentionItem[]; count: number }>('/auth/dashboard/attention');
}

// ─── Dashboard status verdict ───────────────────────────────────
// GET /auth/dashboard/status?scope=household|personal — a ready-to-render
// "how are we doing right now?" summary for the Status Headline card. The
// backend synthesizes the worst-signal-wins status, an AI-authored warm
// sentence, and this-month cash flow. If this call fails, the dashboard
// falls back to a client-side computation (never an empty headline).
export type DashboardStatusScope = 'household' | 'personal';
export type DashboardStatus = 'good' | 'watch' | 'alert';

export type DashboardStatusSignals = {
  income_month: number;
  expense_month: number;
  cash_flow_month: number;
  budgeted_month: number;
  spent_month: number;
  within_budget: boolean;
  bills_overdue: number;
  bills_due_soon: number;
  bills_covered: boolean;
  top_category: string;
  top_category_amount: number;
};

export type DashboardStatusResponse = {
  scope: DashboardStatusScope;
  status: DashboardStatus;
  headline: string;
  hero_label: string;
  hero_value: number;
  signals: DashboardStatusSignals;
};

/**
 * Fetch the synthesized dashboard status verdict for the given scope.
 * The ScopeToggle's "Me" segment maps to scope=personal.
 */
export async function fetchDashboardStatus(scope: DashboardStatusScope = 'household') {
  return api.get<DashboardStatusResponse>('/auth/dashboard/status', { scope });
}

export type NetWorthSnapshotPoint = {
  date: string; // YYYY-MM-DD
  total: number;
};

export async function recordNetWorthSnapshot(values: {
  cash: number;
  investments: number;
  properties: number;
  debt: number;
  total: number;
}, days: number = 30) {
  return api.post<{ snapshots: NetWorthSnapshotPoint[]; days: number }>(
    `/auth/dashboard/networth/snapshot?days=${days}`,
    values,
  );
}

export async function aiCategorizeTransactions() {
  return api.post<{ merchants: number; classified: number; applied: number }>(
    '/auth/transactions/ai-categorize',
    undefined,
  );
}

export type AdvisorMemory = {
  id: string;
  scope: 'shared' | 'private';
  fact: string;
};

export async function fetchAdvisorMemories() {
  return api.get<{ memories: AdvisorMemory[] }>('/auth/ai/memories');
}

export async function deleteAdvisorMemory(id: string) {
  return api.delete(`/auth/ai/memories/${id}`);
}

export async function syncAllBankAccounts() {
  return api.post<{
    synced: number;
    per_provider: Record<string, number>;
    accounts: Array<{ account_id: string; provider: string; synced: number; error?: string }>;
  }>(`/auth/bank/sync-all`, undefined);
}

export async function processRecurring() {
  return api.post(`/auth/recurring/process`);
}

export async function fetchLinkedAccounts() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>(`/auth/linked-accounts`, { user_id: userId });
  return Array.isArray(data) ? data : [];
}

export async function deleteLinkedAccount(id: string) {
  return api.delete(`/auth/linked-accounts`, { id });
}

export async function syncPlaidInvestments() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post(`/auth/plaid/investments?user_id=${userId}`, undefined);
}

export async function fetchInvestmentHoldings() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>(`/auth/plaid/investments`, { user_id: userId });
  return Array.isArray(data) ? data : [];
}

export async function syncPlaidLiabilities() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post(`/auth/plaid/liabilities?user_id=${userId}`, undefined);
}

export async function fetchLiabilities() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>(`/auth/plaid/liabilities`, { user_id: userId });
  return Array.isArray(data) ? data : [];
}

export async function syncPlaidBalances() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post(`/auth/plaid/balances?user_id=${userId}`, undefined);
}

export async function fetchAccountBalances(type?: string) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const params: Record<string, string> = { user_id: userId };
  if (type) params.type = type;
  const data = await api.get<any[]>(`/auth/plaid/balances`, params);
  return Array.isArray(data) ? data : [];
}

// Properties
export async function fetchProperties() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>('/auth/properties', { user_id: userId });
  return Array.isArray(data) ? data : [];
}

export async function createProperty(property: {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  manual_value?: number | null;
  debt_account_id?: string | null;
  is_shared?: boolean;
}) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post('/auth/properties', { ...property, user_id: userId });
}

export async function updateProperty(id: string, property: Record<string, any>) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.put(`/auth/properties/${id}?user_id=${userId}`, property);
}

export async function deleteProperty(id: string) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.delete(`/auth/properties/${id}?user_id=${userId}`);
}

export async function refreshPropertyValue(id: string) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post(`/auth/properties/${id}/refresh?user_id=${userId}`, undefined);
}

// Households
export async function fetchHouseholdSummary() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.get('/auth/households/summary', { user_id: userId });
}

// Activity Feed
export async function fetchActivityFeed(limit = 50, offset = 0) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.get<any[]>('/auth/activity-feed', { user_id: userId, limit, offset });
}

// Spending Alerts
export async function fetchSpendingAlerts() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>('/auth/spending-alerts', { user_id: userId });
  return Array.isArray(data) ? data : [];
}

export async function checkBudgetThresholds() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const response = await api.post<{ alerts: any[] }>(`/auth/spending-alerts/check?user_id=${userId}`);
  return response?.alerts ?? [];
}

export async function upsertSpendingAlert(budgetId: string, thresholdPercent: number, isEnabled: boolean) {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  return api.post('/auth/spending-alerts', {
    user_id: userId,
    budget_id: budgetId,
    threshold_percent: thresholdPercent,
    is_enabled: isEnabled,
  });
}

// Linked Account Status & Re-auth
export async function getLinkedAccountStatus() {
  return api.get('/auth/linked-accounts/status');
}

export async function createUpdateLinkToken(itemId: string) {
  return api.post('/auth/plaid/update-link-token', { item_id: itemId });
}

export async function resetLinkedAccountError(accountId: string) {
  return api.put(`/auth/linked-accounts/${accountId}/reset`);
}
