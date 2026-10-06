-- C038 (N2): keep consumed invites as tombstones so re-accepting a used code is
-- idempotent only for members of that invite's household; unknown codes stay 400.
ALTER TABLE household_invites
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL;
