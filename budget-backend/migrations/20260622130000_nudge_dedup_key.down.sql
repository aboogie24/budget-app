DROP INDEX IF EXISTS idx_ai_nudges_dedup;
ALTER TABLE ai_nudges DROP COLUMN IF EXISTS dedup_key;
