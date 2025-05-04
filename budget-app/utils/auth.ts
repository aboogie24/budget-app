// utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserData } from './storage';

export async function authenticateUser(email: string, password: string): Promise<{ success: boolean, isFirstLogin: boolean }> {
  try {
    const usersRaw = await AsyncStorage.getItem('budgetAppUsers');
    const users: UserData[] = usersRaw ? JSON.parse(usersRaw) : [];

    console.log('All users:', users);

    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      return { success: true, isFirstLogin: user.isFirstLogin };
    } else {
      return { success: false, isFirstLogin: false };
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, isFirstLogin: false };
  }
}
