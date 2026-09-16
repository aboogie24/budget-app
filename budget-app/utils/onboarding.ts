/**
 * C026 CoupleFlow first-run helpers.
 * Pure logic + thin API wrappers so Jest can cover household-always,
 * bootstrap create-vs-skip, and onboarding_complete persistence without RN.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './apiClient';

type PostFn = <T = unknown>(path: string, body?: unknown) => Promise<T>;
type GetFn = <T = unknown>(path: string, params?: Record<string, string | number>) => Promise<T>;

export const TOTAL_ONBOARDING_STEPS = 5;
export const SPLASH_DURATION_MS = 1200;
export const SPLASH_BG = '#0f172a';
export const WORDMARK = {
  couple: '#a855f7',
  heart: '#a855f7',
  flow: '#3b82f6',
} as const;

export const BANK_PROVIDERS = ['Plaid', 'Teller', 'Flinks', 'SimpleFIN'] as const;
export type BankProvider = (typeof BANK_PROVIDERS)[number];

export type StarterExpense = {
  id: string;
  name: string;
  amount: number;
  on: boolean;
};

export const DEFAULT_STARTER_EXPENSES: StarterExpense[] = [
  { id: 'rent', name: 'Rent/housing', amount: 1800, on: true },
  { id: 'groceries', name: 'Groceries', amount: 600, on: true },
  { id: 'dining', name: 'Dining out', amount: 250, on: true },
  { id: 'transport', name: 'Transport', amount: 200, on: true },
  { id: 'fun', name: 'Fun/misc', amount: 150, on: true },
];

export const METHOD_LEVELS = [
  { title: 'Foundation', description: 'Set up budgets & emergency fund', icon: 'home-outline' as const },
  { title: 'Attack Debt', description: 'Eliminate high-interest debt', icon: 'flame-outline' as const },
  { title: 'Build Security', description: '3-6 month safety net', icon: 'shield-checkmark-outline' as const },
  { title: 'Grow Wealth', description: 'Invest & build assets', icon: 'trending-up-outline' as const },
  { title: 'Dream Big', description: 'Plan your dream goals', icon: 'star-outline' as const },
];

export type BootstrapExpense = { name: string; amount: number };

export type BootstrapPayload = {
  user_id: string;
  income?: number;
  expenses: BootstrapExpense[];
};

/** Explicit skip must never hit the bootstrap endpoint. */
export function shouldCallBootstrap(action: 'create' | 'skip'): boolean {
  return action === 'create';
}

export function selectedExpenses(expenses: StarterExpense[]): BootstrapExpense[] {
  return expenses
    .filter((e) => e.on && e.name.trim() && e.amount > 0)
    .map((e) => ({ name: e.name.trim(), amount: e.amount }));
}

export function canCreateStarterBudgets(
  expenses: StarterExpense[],
  incomeRaw: string | number | null | undefined,
): boolean {
  const expensesOn = selectedExpenses(expenses).length > 0;
  const income = typeof incomeRaw === 'string' ? parseFloat(incomeRaw) : Number(incomeRaw);
  const hasIncome = Number.isFinite(income) && income > 0;
  return expensesOn || hasIncome;
}

export function buildBootstrapPayload(
  userId: string,
  expenses: StarterExpense[],
  incomeRaw: string | number | null | undefined,
): BootstrapPayload {
  const payload: BootstrapPayload = {
    user_id: userId,
    expenses: selectedExpenses(expenses),
  };
  const income = typeof incomeRaw === 'string' ? parseFloat(incomeRaw) : Number(incomeRaw);
  if (Number.isFinite(income) && income > 0) {
    payload.income = income;
  }
  return payload;
}

export function resolveHouseholdId(body: any): string | null {
  if (!body || typeof body !== 'object') return null;
  return body.household_id || body.id || null;
}

export type EnsureHouseholdResult = {
  household_id: string | null;
  created: boolean;
  invite_pending: boolean;
  invite_error: boolean;
  solo: boolean;
};

/**
 * OB1: always POST /auth/households (idempotent). Optional invite afterwards.
 * Never leave the user without attempting household create.
 */
export async function ensureHouseholdAlways(opts: {
  userId: string;
  fullName?: string;
  partnerEmail?: string;
  post?: PostFn;
}): Promise<EnsureHouseholdResult> {
  const post: PostFn = (opts.post ?? (api.post.bind(api) as PostFn));
  const name = opts.fullName?.trim()
    ? `${opts.fullName.trim()}'s Household`
    : 'Household';

  let createdRes: any;
  try {
    createdRes = await post<any>('/auth/households', {
      user_id: opts.userId,
      name,
    });
  } catch (err) {
    // Create failure must surface to the wizard — never look like invite-fail.
    throw err;
  }
  const householdId = resolveHouseholdId(createdRes);
  if (!householdId) {
    throw new Error('No household_id');
  }
  const created = !!createdRes?.created;

  let invite_pending = false;
  let invite_error = false;
  const email = opts.partnerEmail?.trim();

  if (email && householdId) {
    try {
      await post('/auth/households/invite', {
        household_id: householdId,
        invitee_email: email,
        user_id: opts.userId,
      });
      invite_pending = true;
    } catch {
      invite_error = true;
    }
  }

  return {
    household_id: householdId,
    created,
    invite_pending,
    invite_error,
    solo: !invite_pending,
  };
}

export type BootstrapResult = {
  called: boolean;
  budgets: any[];
  created_count: number;
  skipped: boolean;
};

/** OB2: call bootstrap only on create; skip is client-side only. */
export async function bootstrapStarterBudgets(opts: {
  userId: string;
  action: 'create' | 'skip';
  expenses: StarterExpense[];
  income?: string | number | null;
  post?: PostFn;
}): Promise<BootstrapResult> {
  if (!shouldCallBootstrap(opts.action)) {
    return { called: false, budgets: [], created_count: 0, skipped: true };
  }
  const post: PostFn = (opts.post ?? (api.post.bind(api) as PostFn));
  const body = buildBootstrapPayload(opts.userId, opts.expenses, opts.income);
  const res = await post<any>('/auth/budgets/bootstrap', body);
  return {
    called: true,
    budgets: Array.isArray(res?.budgets) ? res.budgets : [],
    created_count: Number(res?.created_count ?? 0),
    skipped: false,
  };
}

export type CompleteOnboardingResult = {
  onboarding_complete: boolean;
  persisted: boolean;
};

/**
 * OB4 finish: POST complete, then persist flag from response and/or GET /auth/users/me
 * so cold start does not bounce back into the wizard.
 */
export async function completeOnboardingAndPersist(opts: {
  userId: string;
  monthlyBudgetGoal?: number;
  post?: PostFn;
  get?: GetFn;
  storage?: typeof AsyncStorage;
}): Promise<CompleteOnboardingResult> {
  const post: PostFn = (opts.post ?? (api.post.bind(api) as PostFn));
  const get: GetFn = (opts.get ?? (api.get.bind(api) as GetFn));
  const storage = opts.storage ?? AsyncStorage;

  const completeRes = await post<any>('/auth/onboarding/complete', {
    user_id: opts.userId,
    monthly_budget_goal: opts.monthlyBudgetGoal ?? 0,
  });

  let flag = completeRes?.onboarding_complete === true;

  if (!flag) {
    try {
      const me = await get<any>('/auth/users/me', { user_id: opts.userId });
      flag = me?.onboarding_complete === true;
    } catch {
      // keep flag from complete response
    }
  }

  const persisted = await persistOnboardingComplete(flag, storage);
  return { onboarding_complete: flag, persisted };
}

export async function persistOnboardingComplete(
  value: boolean,
  storage: typeof AsyncStorage = AsyncStorage,
): Promise<boolean> {
  try {
    const raw = await storage.getItem('budgetAppSession');
    if (!raw) return false;
    const session = JSON.parse(raw);
    session.onboarding_complete = value;
    await storage.setItem('budgetAppSession', JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function householdChipLabel(opts: {
  invitePending?: boolean;
  memberCount?: number;
}): 'Solo' | 'Invite pending' | 'Couple' {
  if (opts.invitePending) return 'Invite pending';
  if ((opts.memberCount ?? 1) >= 2) return 'Couple';
  return 'Solo';
}

export function finishSummaryLabel(opts: {
  budgetsSkipped: boolean;
  expenseCount: number;
  hasIncome: boolean;
}): string {
  if (opts.budgetsSkipped) {
    return 'Budgets skipped — create them anytime from the Dashboard.';
  }
  const parts: string[] = [];
  if (opts.expenseCount > 0) parts.push(`${opts.expenseCount} expense`);
  if (opts.hasIncome) parts.push('1 income');
  return parts.length ? parts.join(' + ') : 'Starter budgets ready';
}
