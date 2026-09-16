import {
  planLabel,
  isPlus,
  atBankLimit,
  atAiCap,
  parseEntitlementErrorCode,
  type Entitlements,
} from '../entitlements';

function makeEnt(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    plan: 'free',
    household_id: 'hh-1',
    banks_limit: 1,
    banks_unlimited: false,
    banks_used: 0,
    ai_mode: 'light',
    ai_message_budget: {
      limit: 10,
      used: 2,
      remaining: 8,
      window_days: 7,
    },
    nudges: 'in_app',
    ...overrides,
  };
}

describe('entitlements helpers', () => {
  describe('planLabel', () => {
    it('returns Free for free / missing / unknown', () => {
      expect(planLabel('free')).toBe('Free');
      expect(planLabel(null)).toBe('Free');
      expect(planLabel(undefined)).toBe('Free');
      expect(planLabel('pro')).toBe('Free');
    });

    it('returns Plus for plus (case-insensitive)', () => {
      expect(planLabel('plus')).toBe('Plus · Household');
      expect(planLabel('Plus')).toBe('Plus · Household');
    });
  });

  describe('isPlus', () => {
    it('is true only for plus', () => {
      expect(isPlus('plus')).toBe(true);
      expect(isPlus('Plus')).toBe(true);
      expect(isPlus('free')).toBe(false);
      expect(isPlus(null)).toBe(false);
    });
  });

  describe('atBankLimit', () => {
    it('is false when entitlements missing', () => {
      expect(atBankLimit(null)).toBe(false);
      expect(atBankLimit(undefined)).toBe(false);
    });

    it('is false for Plus unlimited', () => {
      expect(
        atBankLimit(
          makeEnt({
            plan: 'plus',
            banks_unlimited: true,
            banks_limit: null,
            banks_used: 5,
          })
        )
      ).toBe(false);
    });

    it('is true when Free used >= limit', () => {
      expect(atBankLimit(makeEnt({ banks_used: 1, banks_limit: 1 }))).toBe(true);
      expect(atBankLimit(makeEnt({ banks_used: 0, banks_limit: 1 }))).toBe(false);
    });

    it('defaults limit to 1 when banks_limit is null and not unlimited', () => {
      expect(
        atBankLimit(
          makeEnt({
            banks_unlimited: false,
            banks_limit: null,
            banks_used: 1,
          })
        )
      ).toBe(true);
    });
  });

  describe('atAiCap', () => {
    it('is false when entitlements missing', () => {
      expect(atAiCap(null)).toBe(false);
    });

    it('uses remaining when present', () => {
      expect(
        atAiCap(
          makeEnt({
            ai_message_budget: { limit: 10, used: 10, remaining: 0, window_days: 7 },
          })
        )
      ).toBe(true);
      expect(
        atAiCap(
          makeEnt({
            ai_message_budget: { limit: 10, used: 9, remaining: 1, window_days: 7 },
          })
        )
      ).toBe(false);
    });

    it('falls back to used >= limit when remaining absent', () => {
      const ent = makeEnt();
      // @ts-expect-error intentional partial for fallback path
      ent.ai_message_budget = { limit: 10, used: 10, window_days: 7 };
      expect(atAiCap(ent)).toBe(true);
    });
  });

  describe('parseEntitlementErrorCode', () => {
    it('parses JSON body with code', () => {
      expect(
        parseEntitlementErrorCode(
          JSON.stringify({
            error: 'entitlement_limit',
            code: 'ai_message_budget',
            message: 'cap',
          })
        )
      ).toBe('ai_message_budget');
    });

    it('parses banks_limit', () => {
      expect(
        parseEntitlementErrorCode('{"code":"banks_limit","error":"entitlement_limit"}')
      ).toBe('banks_limit');
    });

    it('returns null for plain text', () => {
      expect(parseEntitlementErrorCode('Request failed: 403')).toBe(null);
      expect(parseEntitlementErrorCode(null)).toBe(null);
    });
  });
});
