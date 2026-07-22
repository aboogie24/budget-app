DROP INDEX IF EXISTS idx_savings_goals_linked_balance;
ALTER TABLE savings_goals DROP COLUMN IF EXISTS linked_balance_id;
