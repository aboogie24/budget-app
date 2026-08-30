-- Advisor memories: durable facts the AI advisor remembers about a couple
-- across conversations. Two-tier visibility:
--   scope='shared'  → visible to the whole household (both partners)
--   scope='private' → visible only to the user who owns it (never the partner)
CREATE TABLE IF NOT EXISTS advisor_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'private'
    CHECK (scope IN ('shared', 'private')),
  fact TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared lookups are by household; private lookups are by owner.
CREATE INDEX idx_advisor_memories_household ON advisor_memories(household_id, scope);
CREATE INDEX idx_advisor_memories_user ON advisor_memories(user_id, scope);
