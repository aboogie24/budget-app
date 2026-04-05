ALTER TABLE transactions DROP COLUMN IF EXISTS is_split;

DROP INDEX IF EXISTS idx_splits_category;
DROP INDEX IF EXISTS idx_splits_transaction;

DROP TABLE IF EXISTS transaction_splits;
