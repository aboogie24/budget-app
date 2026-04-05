-- Add provider column to distinguish Plaid vs Flinks accounts
ALTER TABLE linked_accounts
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'plaid'
        CHECK (provider IN ('plaid', 'flinks'));

-- Flinks-specific fields
ALTER TABLE linked_accounts
    ADD COLUMN IF NOT EXISTS flinks_request_id TEXT,
    ADD COLUMN IF NOT EXISTS flinks_institution_id TEXT;

-- Make access_token nullable (Flinks doesn't use it)
ALTER TABLE linked_accounts
    ALTER COLUMN access_token DROP NOT NULL;

-- Index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_linked_accounts_provider
    ON linked_accounts(user_id, provider);
