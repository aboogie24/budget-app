-- Canonical merchant key derived from the transaction description (see
-- internal/categories.NormalizeMerchant). Drives rule matching and the
-- learning loop, replacing brittle exact-string matching on raw bank text.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_normalized TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_normalized
    ON transactions (user_id, merchant_normalized)
    WHERE merchant_normalized IS NOT NULL;
