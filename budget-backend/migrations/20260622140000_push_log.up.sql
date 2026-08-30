-- push_log records every interrupting push we send, so the 1/day-per-user cap
-- applies uniformly whether a push is the user's own nudge or a partner's
-- consent-shared nudge.
CREATE TABLE IF NOT EXISTS push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nudge_id UUID REFERENCES ai_nudges(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_log_user_sent ON push_log(user_id, sent_at DESC);
