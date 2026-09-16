import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  fetchEntitlements,
  planLabel as formatPlanLabel,
  type Entitlements,
} from '@/utils/entitlements';

export type UseEntitlementsResult = {
  entitlements: Entitlements | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  plan: Entitlements['plan'] | 'free';
  planLabel: string;
};

/**
 * Loads household entitlements on mount and when the screen/app regains focus.
 * Shared money is never gated — this only drives Free caps (AI / banks) UI.
 */
export function useEntitlements(): UseEntitlementsResult {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEntitlements();
      setEntitlements(data);
      setError(null);
    } catch (e: any) {
      console.error('Failed to load entitlements:', e);
      setError(e?.message || 'Failed to load plan');
      // Keep last-known entitlements so soft gates stay calm on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        refresh();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  return {
    entitlements,
    loading,
    error,
    refresh,
    plan: entitlements?.plan ?? 'free',
    planLabel: formatPlanLabel(entitlements?.plan),
  };
}

export default useEntitlements;
