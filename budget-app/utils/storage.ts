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
  const email = await AsyncStorage.getItem(SESSION_KEY);
  if (!email) return null;
  const existing = await AsyncStorage.getItem(USERS_KEY);
  if (!existing) return null;
  const users: UserData[] = JSON.parse(existing);
  return users.find(u => u.email === email) || null;
}

export async function clearUserSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
  }