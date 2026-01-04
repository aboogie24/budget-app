import { getCurrentUser } from './storage';
import Constants from 'expo-constants';

export async function fetchUserTransactions() {
  const user = await getCurrentUser();
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080'; // fallback

  if (!user?.id) throw new Error('User not found');

  // Backend protects transactions under /auth and expects the session cookie.
  const response = await fetch(`${API_URL}/auth/transactions?user_id=${user.id}`, {
    credentials: 'include',
    headers: user.token ? { Authorization: `Bearer ${user.token}` } : undefined,
  });
  if (!response.ok) throw new Error(`Failed to fetch transactions: ${response.status}`);

  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => ({
    ...t,
    category_name: t.category_name ?? t.category ?? t.categoryName,
  }));
}
