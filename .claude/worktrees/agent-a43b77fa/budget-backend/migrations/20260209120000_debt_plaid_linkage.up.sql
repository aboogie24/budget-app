-- Add Plaid linkage columns to debt_accounts for auto-sync from liabilities
ALTER TABLE debt_accounts ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;
ALTER TABLE debt_accounts ADD COLUMN IF NOT EXISTS linked_account_id UUID;
ALTER TABLE debt_accounts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Unique partial index: one debt per Plaid account per user (for ON CONFLICT upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_accounts_plaid ON debt_accounts(user_id, plaid_account_id) WHERE plaid_account_id IS NOT NULL;
