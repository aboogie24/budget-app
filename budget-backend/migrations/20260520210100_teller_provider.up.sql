-- Allow 'teller' as a bank-data provider alongside 'plaid' and 'flinks'.
-- The provider column's CHECK was created inline in 20260402000003, so Postgres
-- auto-named it linked_accounts_provider_check.
ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_provider_check;
ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_provider_check
    CHECK (provider IN ('plaid', 'flinks', 'teller'));

-- Teller's user.id from the Connect enrollment (optional, for diagnostics).
-- Teller reuses existing columns: access_token = Teller access token,
-- item_id = Teller enrollment.id.
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS teller_user_id TEXT;
