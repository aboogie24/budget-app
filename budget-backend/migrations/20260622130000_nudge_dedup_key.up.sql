-- dedup_key is a stable identity for a nudge (nudge_type + the deterministic
-- title) computed BEFORE the AI rewrites the display title/body. Deduplication
-- keys on this so AI-authored copy variation doesn't defeat the 24h de-spam.
ALTER TABLE ai_nudges ADD COLUMN IF NOT EXISTS dedup_key TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_nudges_dedup
  ON ai_nudges(user_id, dedup_key, created_at DESC);
