DROP INDEX IF EXISTS idx_transactions_transfer_pair;
ALTER TABLE transactions DROP COLUMN IF EXISTS transfer_pair_id;
