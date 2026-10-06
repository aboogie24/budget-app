-- Tombstoned (accepted) invites become dead rows once the columns are gone.
DELETE FROM household_invites WHERE accepted_at IS NOT NULL;
ALTER TABLE household_invites
  DROP COLUMN IF EXISTS accepted_by,
  DROP COLUMN IF EXISTS accepted_at;
