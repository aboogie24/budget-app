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
  return api.get(`/budgets/user/${userId}/summary`, { month, year });
}

export async function fetchCategories() {
  const userId = await api.getUserId();
  if (!userId) throw new Error('User not found');
  const data = await api.get<any[]>(`/categories/user/${userId}`);
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
