import { api } from '@/utils/apiClient';

/** Household plan — Free + Plus only (C029/C031). */
export type Plan = 'free' | 'plus';

export type AiMode = 'light' | 'full' | string;

export type NudgesMode = 'in_app' | 'in_app+push' | string;

export type AiMessageBudget = {
  limit: number;
  used: number;
  remaining: number;
  window_days: number;
};

/**
 * GET /auth/entitlements?user_id= payload (C031).
 * Both partners inherit the same household entitlements.
 */
export type Entitlements = {
  plan: Plan;
  household_id: string;
  banks_limit: number | null;
  banks_unlimited: boolean;
  banks_used: number;
  ai_mode: AiMode;
  ai_message_budget: AiMessageBudget;
  nudges: NudgesMode;
};

/** Display label for Settings / ProfileCard — never "Pro Plan". */
export function planLabel(plan: Plan | string | null | undefined): string {
  if (typeof plan === 'string' && plan.toLowerCase() === 'plus') return 'Plus · Household';
  return 'Free';
}

export const PLUS_MONTHLY = '$9.99/mo';
export const PLUS_YEARLY = '$89/yr';
export const CHECKOUT_PLACEHOLDER = 'Checkout not connected yet';

export function aiCapCopy(ent: Entitlements | null | undefined): string {
  const b = ent?.ai_message_budget;
  if (!b) return 'Weekly AI messages used up';
  return `${b.used}/${b.limit} messages this week`;
}

export function isPlus(plan: Plan | string | null | undefined): boolean {
  return typeof plan === 'string' && plan.toLowerCase() === 'plus';
}

/**
 * Free households are capped at banks_limit (typically 1).
 * Plus has banks_unlimited — never at limit for new links.
 */
export function atBankLimit(ent: Entitlements | null | undefined): boolean {
  if (!ent) return false;
  if (ent.banks_unlimited) return false;
  const limit = ent.banks_limit == null ? 1 : ent.banks_limit;
  return (ent.banks_used ?? 0) >= limit;
}

/** True when Free (or Plus soft) AI message budget has no remaining messages. */
export function atAiCap(ent: Entitlements | null | undefined): boolean {
  if (!ent?.ai_message_budget) return false;
  const remaining = ent.ai_message_budget.remaining;
  if (typeof remaining === 'number') return remaining <= 0;
  const { limit, used } = ent.ai_message_budget;
  if (typeof limit === 'number' && typeof used === 'number') {
    return used >= limit;
  }
  return false;
}

/**
 * Fetch household entitlements for the current (or given) user.
 * Contract: GET /auth/entitlements?user_id=
 */
export async function fetchEntitlements(userId?: string | null): Promise<Entitlements> {
  const uid = userId ?? (await api.getUserId());
  if (!uid) {
    throw new Error('Not signed in');
  }
  return api.get<Entitlements>('/auth/entitlements', { user_id: uid });
}

/**
 * ApiError.message may be a JSON string with `{ code, error, ... }`.
 * Returns the entitlement gate code when present (e.g. ai_message_budget, banks_limit).
 */
export function parseEntitlementErrorCode(message: string | null | undefined): string | null {
  if (!message || typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed.startsWith('{')) {
    // Sometimes the body is embedded; try to find a JSON object.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return typeof parsed?.code === 'string' ? parsed.code : null;
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed?.code === 'string' ? parsed.code : null;
  } catch {
    return null;
  }
}
