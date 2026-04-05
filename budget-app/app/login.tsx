import BudgetAppLogin from '../components/BudgetAppLogin';
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { findUserSession } from '../utils/storage';

export default function LoginScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkIfLoggedIn = async () => {
      const user = await findUserSession();
      if (user) {
        if (user.onboarding_complete) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/onboarding');
        }
      }
    };

    checkIfLoggedIn();
  }, []);
  return <BudgetAppLogin />;
}
