-- Add a stable external transaction ID so synced transactions can be deduped.
-- Before this, providers inserted every synced transaction with a fresh random
-- UUID + `ON CONFLICT DO NOTHING`, so the conflict never fired and every
-- re-sync duplicated every transaction.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique per (user, source, external_id). Partial so manual transactions
-- (external_id IS NULL) are never constrained.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_id_idx
    ON transactions (user_id, source, external_id)
    WHERE external_id IS NOT NULL;
