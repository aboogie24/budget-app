DROP INDEX IF EXISTS idx_debt_accounts_plaid;
ALTER TABLE debt_accounts DROP COLUMN IF EXISTS source;
ALTER TABLE debt_accounts DROP COLUMN IF EXISTS linked_account_id;
ALTER TABLE debt_accounts DROP COLUMN IF EXISTS plaid_account_id;
