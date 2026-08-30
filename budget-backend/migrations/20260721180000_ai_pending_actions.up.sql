-- Approval layer for AI advisor actions: mutating tool calls are queued here
-- instead of executing immediately; the chat UI renders an Approve/Decline
-- card. Approving executes the stored call; everything is auditable.
CREATE TABLE IF NOT EXISTS ai_pending_actions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    tool_name TEXT NOT NULL,
    tool_input JSONB NOT NULL,
    summary TEXT NOT NULL,          -- human-readable "what will happen"
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'declined', 'failed')),
    result TEXT,                    -- tool result JSON after approval (or error)
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user
    ON ai_pending_actions (user_id, status, created_at DESC);
