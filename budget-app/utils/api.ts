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
