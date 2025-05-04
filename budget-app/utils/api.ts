import { getCurrentUser } from './storage';

export async function fetchUserTransactions() {
  const user = await getCurrentUser();
  if (!user?.id) throw new Error('User not found');
	                       
  const response = await fetch(`http://10.0.20.204:8080/transactions?user_id=${user.id}`);
  if (!response.ok) throw new Error('Failed to fetch transactions');

  return await response.json();
}