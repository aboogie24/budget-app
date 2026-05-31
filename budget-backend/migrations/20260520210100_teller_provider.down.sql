ALTER TABLE linked_accounts DROP COLUMN IF EXISTS teller_user_id;

ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_provider_check;
ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_provider_check
    CHECK (provider IN ('plaid', 'flinks'));
