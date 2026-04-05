ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS match_confidence TEXT,
  ADD COLUMN IF NOT EXISTS matched_rule_id UUID REFERENCES category_mapping_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_verified BOOLEAN DEFAULT false;

-- Backfill: all existing manual transactions (source IS NULL or source = 'manual') are user-verified
UPDATE transactions SET user_verified = true WHERE COALESCE(source, 'manual') = 'manual' AND user_verified IS NULL;

-- All existing transactions with a category_id are considered verified
UPDATE transactions SET user_verified = true WHERE category_id IS NOT NULL AND user_verified IS NULL;
