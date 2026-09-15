import { type HeadlineStatus } from '@/components/dashboard/StatusHeadlineCard';

export type Tx = {
  id: string;
  user_id?: string;
  type: 'income' | 'expense';
  amount: number;
  note?: string;
  category?: string;
  date: string;
  frequency?: string;
  color?: string;
  category_name?: string;
  source?: string;
};

export type HouseholdSummary = {
  household_id: string | null;
  household_name?: string;
  member_count?: number;
  total_income: number;
  total_expenses: number;
  net_cash_flow: number;
  total_debt: number;
  total_savings_target: number;
  total_savings_current: number;
  savings_progress: number;
};

export type FrameworkLevel = {
  current_level: number;
  level_name: string;
  progress_percent: number;
  steps_completed: number;
  total_steps: number;
};

export type Member = { user_id: string; full_name: string; role: string };

export const parseLocalDate = (value?: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const SEVERITY: Record<Exclude<HeadlineStatus, 'setup'>, number> = {
  good: 0, watch: 1, alert: 2,
};

export const severityMin = (...s: Exclude<HeadlineStatus, 'setup'>[]) =>
  s.reduce(
    (worst, cur) => (SEVERITY[cur] > SEVERITY[worst] ? cur : worst),
    'good' as Exclude<HeadlineStatus, 'setup'>,
  );
