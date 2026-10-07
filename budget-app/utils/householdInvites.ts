/**
 * C039 — Partner join / accept_preview helpers (C037 BRIEF + C038 RULES).
 * Drive every Accept CTA from accept_preview.action; confirm_migrate only on migrate path.
 */
import { api, ApiError } from './apiClient';

export type AcceptAction =
  | 'join'
  | 'discard_solo'
  | 'already_member'
  | 'migrate_solo'
  | 'migrate_confirmation_required'
  | 'blocked_banks_limit'
  | 'blocked_multi_member';

export type AcceptBlockers = {
  linked_accounts?: number;
  transactions?: number;
  non_starter_budgets?: number;
  debts?: number;
  savings_goals?: number;
  bills?: number;
  properties?: number;
  [key: string]: number | undefined;
};

export type AcceptPreview = {
  current_household_id?: string | null;
  current_is_solo?: boolean;
  current_is_empty?: boolean;
  requires_confirm_migrate?: boolean;
  action: AcceptAction | string;
  blockers?: AcceptBlockers;
  plan_current?: string;
  plan_target?: string;
  plan_after_join?: string;
};

export type HouseholdInvite = {
  code: string;
  household_id: string;
  household_name?: string;
  expires_at?: string;
  invitee_email?: string;
  inviter_email?: string;
  created_by?: string;
  accepted_at?: string | null;
  accepted?: boolean;
  expired?: boolean;
  accept_preview?: AcceptPreview;
};

export type AcceptResult = {
  household_id: string;
  action?: string;
  plan?: string;
  already_member?: boolean;
  entitlements?: unknown;
};

export type PrimaryCtaKind =
  | 'join'
  | 'review'
  | 'fix_banks'
  | 'cant_join'
  | 'disabled';

/** BRIEF §A — primary CTA label + kind from accept_preview.action */
export function primaryCtaForAction(action?: string | null): {
  kind: PrimaryCtaKind;
  label: string;
  disabled: boolean;
} {
  switch (action) {
    case 'join':
    case 'discard_solo':
    case 'already_member':
      return { kind: 'join', label: 'Join household', disabled: false };
    case 'migrate_solo':
    case 'migrate_confirmation_required':
      return { kind: 'review', label: 'Review & join', disabled: false };
    case 'blocked_banks_limit':
      return { kind: 'fix_banks', label: 'See how to fix', disabled: false };
    case 'blocked_multi_member':
      return { kind: 'cant_join', label: "Can't join", disabled: true };
    default:
      return { kind: 'join', label: 'Join household', disabled: false };
  }
}

/** Settings row CTA (§D) — shorter labels. */
export function settingsRowCtaForAction(action?: string | null): {
  kind: PrimaryCtaKind;
  label: string;
  disabled: boolean;
} {
  switch (action) {
    case 'join':
    case 'discard_solo':
    case 'already_member':
      return { kind: 'join', label: 'Join', disabled: false };
    case 'migrate_solo':
    case 'migrate_confirmation_required':
      return { kind: 'review', label: 'Review & join', disabled: false };
    case 'blocked_banks_limit':
    case 'blocked_multi_member':
      return { kind: 'fix_banks', label: 'Why?', disabled: false };
    default:
      return { kind: 'join', label: 'Join', disabled: false };
  }
}

export function requiresMigrateConsent(preview?: AcceptPreview | null): boolean {
  if (!preview) return false;
  if (preview.requires_confirm_migrate) return true;
  return (
    preview.action === 'migrate_solo' ||
    preview.action === 'migrate_confirmation_required'
  );
}

export function isJoinWithoutConfirm(action?: string | null): boolean {
  return action === 'join' || action === 'discard_solo' || action === 'already_member';
}

/** Compact chips from blockers counts — e.g. "3 transactions · 1 budget · 0 banks". */
export function previewChipsFromBlockers(blockers?: AcceptBlockers | null): string {
  if (!blockers) return '';
  const parts: string[] = [];
  const tx = blockers.transactions ?? 0;
  const budgets = blockers.non_starter_budgets ?? 0;
  const banks = blockers.linked_accounts ?? 0;
  const debts = blockers.debts ?? 0;
  const savings = blockers.savings_goals ?? 0;
  const bills = blockers.bills ?? 0;
  parts.push(`${tx} transaction${tx === 1 ? '' : 's'}`);
  parts.push(`${budgets} budget${budgets === 1 ? '' : 's'}`);
  parts.push(`${banks} bank${banks === 1 ? '' : 's'}`);
  if (debts > 0) parts.push(`${debts} debt${debts === 1 ? '' : 's'}`);
  if (savings > 0) parts.push(`${savings} savings`);
  if (bills > 0) parts.push(`${bills} bill${bills === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function inviterDisplayName(invite: HouseholdInvite): string {
  const email = invite.inviter_email?.trim();
  if (!email) return 'Your partner';
  const local = email.split('@')[0] || email;
  const pretty = local.replace(/[._-]+/g, ' ').trim();
  if (!pretty) return 'Your partner';
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function householdDisplayName(invite: HouseholdInvite): string {
  return invite.household_name?.trim() || 'their household';
}

export function invitePreviewLine(invite: HouseholdInvite): string {
  return `${inviterDisplayName(invite)} invited you to ${householdDisplayName(invite)}`;
}

export function migrateHeadline(invite: HouseholdInvite): string {
  const name = inviterDisplayName(invite);
  const possessive = name.endsWith('s') ? `${name}'` : `${name}'s`;
  return `Move your household into ${possessive}?`;
}

export function migrateBody(invite: HouseholdInvite): string {
  const hh = householdDisplayName(invite);
  return `Accepting shares your existing money data with ${hh} — transactions, budgets you created, debts, savings, bills. Starter placeholders from signup are removed. Plus plan wins if either of you has it.`;
}

/** BRIEF §E edge copy */
export function edgeCopyForAcceptError(err: unknown): string {
  if (!err) return "Couldn't join right now. Try again.";

  const status = (err as ApiError)?.status;
  const code = String(
    (err as ApiError)?.code ||
      (err as any)?.body?.code ||
      (err as any)?.body?.error ||
      '',
  ).toLowerCase();
  const raw = String((err as Error)?.message || err || '').toLowerCase();

  if (
    code === 'banks_limit_conflict' ||
    code === 'blocked_banks_limit' ||
    raw.includes('banks_limit')
  ) {
    return 'Both households are on Free with a linked bank. Unlink a bank, or upgrade either household to Plus, then try again.';
  }
  if (
    code === 'blocked_multi_member' ||
    raw.includes('blocked_multi_member') ||
    raw.includes('multi_member')
  ) {
    return "You're already in a household with someone else. Leave isn't available yet.";
  }
  if (status === 403 || raw.includes('different email') || raw.includes('not intended')) {
    return "This invite was sent to a different email than the one you're signed in with.";
  }
  if (raw.includes('expired') || code === 'invite_expired') {
    return 'This invite expired. Ask your partner to send a new one.';
  }
  if (
    status === 400 ||
    raw.includes('invalid') ||
    raw.includes("doesn't look right") ||
    code === 'invalid_invite'
  ) {
    return "That code doesn't look right. Check with your partner and try again.";
  }
  if (
    status === 0 ||
    raw.includes('network') ||
    raw.includes('failed to fetch') ||
    raw.includes("couldn't join")
  ) {
    return "Couldn't join right now. Try again.";
  }
  return "Couldn't join right now. Try again.";
}

export function edgeCopyForBlockedAction(action?: string | null): string {
  if (action === 'blocked_banks_limit') {
    return 'Both households are on Free with a linked bank. Unlink a bank, or upgrade either household to Plus, then try again.';
  }
  if (action === 'blocked_multi_member') {
    return "You're already in a household with someone else. Leave isn't available yet.";
  }
  return "Couldn't join right now. Try again.";
}

export function isInviteExpired(invite: HouseholdInvite): boolean {
  if (invite.expired === true) return true;
  if (!invite.expires_at) return false;
  const t = new Date(invite.expires_at).getTime();
  return !isNaN(t) && t < Date.now();
}

/** Sent-invite pending chip: exclude accepted + expired. */
export function isSentInvitePending(invite: HouseholdInvite): boolean {
  if (invite.accepted_at || invite.accepted) return false;
  if (isInviteExpired(invite)) return false;
  return true;
}

export async function fetchIncomingInvites(
  userId: string,
  get: typeof api.get = api.get.bind(api) as typeof api.get,
): Promise<HouseholdInvite[]> {
  const data = await get<HouseholdInvite[]>(`/auth/households/invites`, { user_id: userId });
  return Array.isArray(data) ? data : [];
}

export async function acceptHouseholdInvite(opts: {
  code: string;
  userId: string;
  confirmMigrate?: boolean;
  post?: typeof api.post;
}): Promise<AcceptResult> {
  const post = opts.post ?? (api.post.bind(api) as typeof api.post);
  const body: Record<string, unknown> = {
    code: opts.code,
    user_id: opts.userId,
  };
  if (opts.confirmMigrate) {
    body.confirm_migrate = true;
  }
  return post<AcceptResult>('/auth/households/accept', body);
}

/**
 * Resolve preview for a typed invite code: match GET invites first;
 * otherwise provisional join preview (accept will surface real errors).
 */
export async function resolveInviteByCode(
  userId: string,
  code: string,
  get?: typeof api.get,
): Promise<HouseholdInvite> {
  const trimmed = code.trim();
  const list = await fetchIncomingInvites(userId, get);
  const found = list.find(
    (i) => String(i.code || '').toLowerCase() === trimmed.toLowerCase(),
  );
  if (found) return found;
  return {
    code: trimmed,
    household_id: '',
    household_name: 'Household',
    accept_preview: {
      action: 'join',
      requires_confirm_migrate: false,
      current_is_empty: true,
      current_is_solo: false,
    },
  };
}

/** Extract accept_preview from a 409 ApiError body when present. */
export function acceptPreviewFromError(err: unknown): AcceptPreview | null {
  const body = (err as ApiError)?.body;
  if (body?.accept_preview && typeof body.accept_preview === 'object') {
    return body.accept_preview as AcceptPreview;
  }
  return null;
}
