DROP INDEX IF EXISTS idx_transactions_merchant_normalized;
ALTER TABLE transactions DROP COLUMN IF EXISTS merchant_normalized;
