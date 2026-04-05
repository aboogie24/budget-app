-- Remove provider index
DROP INDEX IF EXISTS idx_linked_accounts_provider;

-- Remove Flinks-specific columns
ALTER TABLE linked_accounts
    DROP COLUMN IF EXISTS flinks_institution_id;
ALTER TABLE linked_accounts
    DROP COLUMN IF EXISTS flinks_request_id;

-- Remove provider column
ALTER TABLE linked_accounts
    DROP COLUMN IF EXISTS provider;

-- Restore NOT NULL on access_token
ALTER TABLE linked_accounts
    ALTER COLUMN access_token SET NOT NULL;
