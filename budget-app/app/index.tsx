import BudgetAppLogin from '../components/BudgetAppLogin';
import React from 'react';

export default function LoginScreen() {
  // Auth redirect is handled by _layout.tsx
  // This screen only renders for unauthenticated users
  return <BudgetAppLogin />;
}
