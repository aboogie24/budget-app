import BudgetAppLogin from '../components/BudgetAppLogin';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { findUserSession } from '../utils/storage';

export default function LoginScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkIfLoggedIn = async () => {
      const user = await findUserSession();
      if (user) {
        router.replace('/(tabs)/dashboard'); // ✅ Redirect to tabbed dashboard
      }
    };

    checkIfLoggedIn();
  }, []);
  return <BudgetAppLogin />;
}
