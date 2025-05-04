// utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserData {
  email: string;
  password: string;
  isFirstLogin: boolean;
  name?: string;
  budgetGoal?: string;
}

const USERS_KEY = 'budgetAppUsers';
const SESSION_KEY = 'budgetAppSession';

export async function saveUser(user: UserData): Promise<void> {
  const existing = await AsyncStorage.getItem(USERS_KEY);
  const users = existing ? JSON.parse(existing) : [];
  users.push(user);
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function findUser(email: string, password: string): Promise<UserData | null> {
  const existing = await AsyncStorage.getItem(USERS_KEY);
  if (!existing) return null;
  const users: UserData[] = JSON.parse(existing);
  return users.find(u => u.email === email && u.password === password) || null;
}

export async function markUserNotFirstLogin(email: string): Promise<void> {
  const existing = await AsyncStorage.getItem(USERS_KEY);
  if (!existing) return;
  const users: UserData[] = JSON.parse(existing);
  const updated = users.map(u =>
    u.email === email ? { ...u, isFirstLogin: false } : u
  );
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
}

export async function updateUserProfile(email: string, data: Partial<Omit<UserData, 'email'>>): Promise<void> {
  const existing = await AsyncStorage.getItem(USERS_KEY);
  if (!existing) return;
  const users: UserData[] = JSON.parse(existing);
  const updated = users.map(user =>
    user.email === email ? { ...user, ...data } : user
  );
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
}

export async function setUserSession(email: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, email);
}

export async function findUserSession(): Promise<UserData | null> {
	try {
    const json = await AsyncStorage.getItem('budgetAppSession');
    return json ? JSON.parse(json) : null;
  } catch (err) {
    console.error('Failed to read user session:', err);
    return null;
  }
  // const email = await AsyncStorage.getItem(SESSION_KEY);
  // if (!email) return null;
  // const existing = await AsyncStorage.getItem(USERS_KEY);
  // if (!existing) return null;
  // const users: UserData[] = JSON.parse(existing);
  // return users.find(u => u.email === email) || null;
}

export async function clearUserSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
  }

export interface Transaction {
id: string;
type: 'income' | 'expense';
amount: number;
category: string;
note?: string;
date: string; // ISO format
}

const TRANSACTIONS_KEY = 'budgetAppTransactions';

// Save a transaction
export async function addTransaction(tx: Transaction): Promise<void> {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    console.log(data)
    const existing: Transaction[] = data ? JSON.parse(data) : [];
    existing.push(tx);
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(existing));
}

export async function getAllTransactions() {
	try {
		const jsonValue = await AsyncStorage.getItem(TRANSACTIONS_KEY);
		return jsonValue != null ? JSON.parse(jsonValue) : [];
	} catch (e) {
		console.error('Failed to fetch transactions:', e);
		return [];
	}
}

export async function removeTransaction(id: string) {
  try {
    const stored = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    const transactions = stored ? JSON.parse(stored) : [];

    const filtered = transactions.filter((t: any) => t.id !== id);
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error removing transaction:', e);
  }
}

export async function getCurrentUser() {
  try {
    const json = await AsyncStorage.getItem('budgetAppSession');
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load user:', e);
    return null;
  }
}