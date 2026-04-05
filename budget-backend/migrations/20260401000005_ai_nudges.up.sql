CREATE TABLE IF NOT EXISTS ai_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  nudge_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_type TEXT,
  action_data TEXT,
  priority INT NOT NULL DEFAULT 5,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_nudges_user ON ai_nudges(user_id, is_read, created_at DESC);
