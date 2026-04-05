ALTER TABLE transactions
  DROP COLUMN IF EXISTS match_confidence,
  DROP COLUMN IF EXISTS matched_rule_id,
  DROP COLUMN IF EXISTS user_verified;
