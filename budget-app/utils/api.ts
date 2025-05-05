import { getCurrentUser } from './storage';
import Constants from 'expo-constants';

export async function fetchUserTransactions() {
  const user = await getCurrentUser();
  const API_URL =
    Constants.expoConfig?.extra?.API_URL ??
    Constants.manifest?.extra?.API_URL ??
    'http://localhost:8080'; // fallback
    
  if (!user?.id) throw new Error('User not found');
	                       
  const response = await fetch(`${API_URL}/transactions?user_id=${user.id}`);
  if (!response.ok) throw new Error('Failed to fetch transactions');

  return await response.json();
}