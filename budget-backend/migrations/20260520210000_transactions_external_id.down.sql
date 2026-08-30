DROP INDEX IF EXISTS transactions_external_id_idx;
ALTER TABLE transactions DROP COLUMN IF EXISTS external_id;
