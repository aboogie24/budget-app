-- AI Conversations table: stores chat sessions between users and the AI assistant
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  conversation_type TEXT NOT NULL DEFAULT 'general'
    CHECK (conversation_type IN ('planning', 'advice', 'review', 'general')),
  context_snapshot JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX idx_ai_conversations_household ON ai_conversations(household_id, updated_at DESC);

-- AI Messages table: stores individual messages within a conversation
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB DEFAULT NULL,
  tool_results JSONB DEFAULT NULL,
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at ASC);
