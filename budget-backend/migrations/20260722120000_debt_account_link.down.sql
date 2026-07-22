DROP INDEX IF EXISTS idx_debt_accounts_linked_balance;
ALTER TABLE debt_accounts DROP COLUMN IF EXISTS linked_balance_id;
