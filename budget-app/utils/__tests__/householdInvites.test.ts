import {
  primaryCtaForAction,
  settingsRowCtaForAction,
  requiresMigrateConsent,
  isJoinWithoutConfirm,
  previewChipsFromBlockers,
  edgeCopyForAcceptError,
  edgeCopyForBlockedAction,
  isSentInvitePending,
  invitePreviewLine,
} from '../householdInvites';
import { ApiError } from '../apiClient';

describe('C039 householdInvites helpers', () => {
  describe('primaryCtaForAction', () => {
    it('maps join/discard/already_member to Join household', () => {
      for (const a of ['join', 'discard_solo', 'already_member']) {
        expect(primaryCtaForAction(a)).toEqual({
          kind: 'join',
          label: 'Join household',
          disabled: false,
        });
      }
    });
    it('maps migrate to Review & join', () => {
      expect(primaryCtaForAction('migrate_solo').label).toBe('Review & join');
      expect(primaryCtaForAction('migrate_confirmation_required').kind).toBe('review');
    });
    it('maps blocked banks to See how to fix', () => {
      expect(primaryCtaForAction('blocked_banks_limit')).toEqual({
        kind: 'fix_banks',
        label: 'See how to fix',
        disabled: false,
      });
    });
    it('maps multi-member to disabled Can’t join', () => {
      expect(primaryCtaForAction('blocked_multi_member').disabled).toBe(true);
    });
  });

  describe('settingsRowCtaForAction', () => {
    it('uses short Join / Why? labels', () => {
      expect(settingsRowCtaForAction('discard_solo').label).toBe('Join');
      expect(settingsRowCtaForAction('blocked_banks_limit').label).toBe('Why?');
    });
  });

  it('requiresMigrateConsent only for migrate path', () => {
    expect(requiresMigrateConsent({ action: 'migrate_solo' })).toBe(true);
    expect(requiresMigrateConsent({ action: 'discard_solo' })).toBe(false);
    expect(requiresMigrateConsent({ action: 'join', requires_confirm_migrate: true })).toBe(true);
    expect(isJoinWithoutConfirm('discard_solo')).toBe(true);
    expect(isJoinWithoutConfirm('migrate_solo')).toBe(false);
  });

  it('builds preview chips from blockers', () => {
    expect(
      previewChipsFromBlockers({
        transactions: 3,
        non_starter_budgets: 1,
        linked_accounts: 0,
      }),
    ).toBe('3 transactions · 1 budget · 0 banks');
  });

  it('maps edge copy per BRIEF §E', () => {
    expect(edgeCopyForBlockedAction('blocked_banks_limit')).toMatch(/Unlink a bank/);
    expect(edgeCopyForBlockedAction('blocked_multi_member')).toMatch(/Leave isn't available/);
    const expired = new ApiError(400, 'Invite expired');
    expect(edgeCopyForAcceptError(expired)).toMatch(/expired/);
    const wrong = new ApiError(403, 'Invite not intended for this user');
    expect(edgeCopyForAcceptError(wrong)).toMatch(/different email/);
    const invalid = new ApiError(400, 'Invalid invite');
    expect(edgeCopyForAcceptError(invalid)).toMatch(/doesn't look right/);
    const banks = new ApiError(
      409,
      JSON.stringify({ code: 'banks_limit_conflict', message: 'banks' }),
    );
    expect(edgeCopyForAcceptError(banks)).toMatch(/Unlink a bank/);
  });

  it('excludes expired from pending sent chip', () => {
    expect(
      isSentInvitePending({
        code: 'x',
        household_id: 'h',
        expired: true,
      }),
    ).toBe(false);
    expect(
      isSentInvitePending({
        code: 'x',
        household_id: 'h',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).toBe(true);
  });

  it('formats invite preview line', () => {
    expect(
      invitePreviewLine({
        code: 'c',
        household_id: 'h',
        household_name: 'Alex & Jordan',
        inviter_email: 'alex@example.com',
      }),
    ).toBe('Alex invited you to Alex & Jordan');
  });
});
