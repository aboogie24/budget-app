import {
  shouldCallBootstrap,
  canCreateStarterBudgets,
  buildBootstrapPayload,
  ensureHouseholdAlways,
  bootstrapStarterBudgets,
  completeOnboardingAndPersist,
  persistOnboardingComplete,
  resolveHouseholdId,
  DEFAULT_STARTER_EXPENSES,
  householdChipLabel,
  TOTAL_ONBOARDING_STEPS,
} from '../onboarding';

describe('C026 onboarding helpers', () => {
  it('uses a 5-step wizard (OB0–OB4)', () => {
    expect(TOTAL_ONBOARDING_STEPS).toBe(5);
  });

  describe('household always (OB1)', () => {
    it('always POSTs /auth/households even without invite', async () => {
      const post = jest.fn().mockResolvedValue({ household_id: 'hh-1', created: true });
      const result = await ensureHouseholdAlways({
        userId: 'u-1',
        fullName: 'Alex',
        post: post as any,
      });
      expect(post).toHaveBeenCalledWith('/auth/households', {
        user_id: 'u-1',
        name: "Alex's Household",
      });
      expect(result.household_id).toBe('hh-1');
      expect(result.solo).toBe(true);
      expect(result.invite_pending).toBe(false);
    });

    it('sends optional invite after create and marks invite_pending', async () => {
      const post = jest
        .fn()
        .mockResolvedValueOnce({ household_id: 'hh-2', created: false })
        .mockResolvedValueOnce({ ok: true });
      const result = await ensureHouseholdAlways({
        userId: 'u-2',
        partnerEmail: 'partner@example.com',
        post: post as any,
      });
      expect(post).toHaveBeenNthCalledWith(1, '/auth/households', expect.any(Object));
      expect(post).toHaveBeenNthCalledWith(2, '/auth/households/invite', {
        household_id: 'hh-2',
        invitee_email: 'partner@example.com',
        user_id: 'u-2',
      });
      expect(result.invite_pending).toBe(true);
      expect(result.solo).toBe(false);
    });

    it('continues with household when invite fails', async () => {
      const post = jest
        .fn()
        .mockResolvedValueOnce({ household_id: 'hh-3', created: true })
        .mockRejectedValueOnce(new Error('invite failed'));
      const result = await ensureHouseholdAlways({
        userId: 'u-3',
        partnerEmail: 'bad@example.com',
        post: post as any,
      });
      expect(result.household_id).toBe('hh-3');
      expect(result.invite_error).toBe(true);
      expect(result.invite_pending).toBe(false);
    });
  });

  describe('bootstrap skip vs create (OB2)', () => {
    it('does not call bootstrap on skip', async () => {
      const post = jest.fn();
      const result = await bootstrapStarterBudgets({
        userId: 'u-1',
        action: 'skip',
        expenses: DEFAULT_STARTER_EXPENSES,
        post: post as any,
      });
      expect(shouldCallBootstrap('skip')).toBe(false);
      expect(post).not.toHaveBeenCalled();
      expect(result.called).toBe(false);
      expect(result.skipped).toBe(true);
    });

    it('POSTs /auth/budgets/bootstrap on create with selected expenses + income', async () => {
      const post = jest.fn().mockResolvedValue({
        budgets: [{ id: 'b1' }],
        created_count: 6,
      });
      const expenses = DEFAULT_STARTER_EXPENSES.map((e) =>
        e.id === 'fun' ? { ...e, on: false } : e,
      );
      const result = await bootstrapStarterBudgets({
        userId: 'u-1',
        action: 'create',
        expenses,
        income: '5200',
        post: post as any,
      });
      expect(shouldCallBootstrap('create')).toBe(true);
      expect(post).toHaveBeenCalledWith(
        '/auth/budgets/bootstrap',
        expect.objectContaining({
          user_id: 'u-1',
          income: 5200,
          expenses: expect.arrayContaining([
            { name: 'Rent/housing', amount: 1800 },
            { name: 'Groceries', amount: 600 },
          ]),
        }),
      );
      const body = post.mock.calls[0][1];
      expect(body.expenses.find((e: any) => e.name === 'Fun/misc')).toBeUndefined();
      expect(result.called).toBe(true);
      expect(result.created_count).toBe(6);
    });

    it('requires ≥1 expense ON or positive income to create', () => {
      const allOff = DEFAULT_STARTER_EXPENSES.map((e) => ({ ...e, on: false }));
      expect(canCreateStarterBudgets(allOff, '')).toBe(false);
      expect(canCreateStarterBudgets(allOff, '100')).toBe(true);
      expect(canCreateStarterBudgets(DEFAULT_STARTER_EXPENSES, '')).toBe(true);
    });

    it('buildBootstrapPayload omits non-positive income', () => {
      const payload = buildBootstrapPayload('u', DEFAULT_STARTER_EXPENSES, '');
      expect(payload.income).toBeUndefined();
      expect(payload.expenses.length).toBe(5);
    });
  });

  describe('onboarding_complete gate (OB4)', () => {
    it('persists onboarding_complete from complete response', async () => {
      const store: Record<string, string> = {
        budgetAppSession: JSON.stringify({ id: 'u-1', token: 't', onboarding_complete: false }),
      };
      const storage = {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => {
          store[k] = v;
        }),
      };
      const post = jest.fn().mockResolvedValue({
        status: 'onboarding complete',
        onboarding_complete: true,
        user_id: 'u-1',
      });
      const get = jest.fn();
      const result = await completeOnboardingAndPersist({
        userId: 'u-1',
        post: post as any,
        get: get as any,
        storage: storage as any,
      });
      expect(post).toHaveBeenCalledWith('/auth/onboarding/complete', {
        user_id: 'u-1',
        monthly_budget_goal: 0,
      });
      expect(get).not.toHaveBeenCalled();
      expect(result.onboarding_complete).toBe(true);
      expect(result.persisted).toBe(true);
      expect(JSON.parse(store.budgetAppSession).onboarding_complete).toBe(true);
    });

    it('falls back to GET /auth/users/me when complete omits flag', async () => {
      const store: Record<string, string> = {
        budgetAppSession: JSON.stringify({ id: 'u-1', onboarding_complete: false }),
      };
      const storage = {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => {
          store[k] = v;
        }),
      };
      const post = jest.fn().mockResolvedValue({ status: 'onboarding complete' });
      const get = jest.fn().mockResolvedValue({ id: 'u-1', onboarding_complete: true });
      const result = await completeOnboardingAndPersist({
        userId: 'u-1',
        post: post as any,
        get: get as any,
        storage: storage as any,
      });
      expect(get).toHaveBeenCalledWith('/auth/users/me', { user_id: 'u-1' });
      expect(result.onboarding_complete).toBe(true);
      expect(JSON.parse(store.budgetAppSession).onboarding_complete).toBe(true);
    });

    it('persistOnboardingComplete updates session without wiping token', async () => {
      const store: Record<string, string> = {
        budgetAppSession: JSON.stringify({ id: 'u', token: 'abc', email: 'a@b.c' }),
      };
      const storage = {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => {
          store[k] = v;
        }),
      };
      await persistOnboardingComplete(true, storage as any);
      const session = JSON.parse(store.budgetAppSession);
      expect(session.onboarding_complete).toBe(true);
      expect(session.token).toBe('abc');
    });
  });

  it('resolveHouseholdId prefers household_id', () => {
    expect(resolveHouseholdId({ household_id: 'a', id: 'b' })).toBe('a');
    expect(resolveHouseholdId({ id: 'b' })).toBe('b');
    expect(resolveHouseholdId(null)).toBeNull();
  });

  it('householdChipLabel covers Solo / Invite pending / Couple', () => {
    expect(householdChipLabel({})).toBe('Solo');
    expect(householdChipLabel({ invitePending: true })).toBe('Invite pending');
    expect(householdChipLabel({ memberCount: 2 })).toBe('Couple');
  });
});
