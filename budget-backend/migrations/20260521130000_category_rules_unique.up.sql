-- Guard against duplicate user rules. The upsert in CreateRuleFromEdit relied
-- on a unique constraint that was never created, so repeated edits of the same
-- merchant could insert duplicate rows. Dedupe (keeping the newest), then add
-- the partial unique index that makes ON CONFLICT upserts work.
DELETE FROM category_mapping_rules a
USING category_mapping_rules b
WHERE a.ctid < b.ctid
  AND a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.rule_type = b.rule_type
  AND a.match_value = b.match_value;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mapping_rules_user_unique
  ON category_mapping_rules (user_id, rule_type, match_value)
  WHERE user_id IS NOT NULL;
