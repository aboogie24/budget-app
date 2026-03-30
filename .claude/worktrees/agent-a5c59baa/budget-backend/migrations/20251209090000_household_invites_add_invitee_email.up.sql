ALTER TABLE household_invites
ADD COLUMN IF NOT EXISTS invitee_email TEXT;

CREATE INDEX IF NOT EXISTS idx_household_invites_invitee_email
  ON household_invites (LOWER(invitee_email));
