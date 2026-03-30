-- Add webhook tracking columns to linked_accounts
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'good';
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS last_cursor TEXT DEFAULT '';
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

-- Webhook event log for audit trail
CREATE TABLE IF NOT EXISTS plaid_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id TEXT NOT NULL,
    webhook_type TEXT NOT NULL,
    webhook_code TEXT NOT NULL,
    error_code TEXT,
    new_transactions INTEGER DEFAULT 0,
    removed_transactions INTEGER DEFAULT 0,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_item ON plaid_webhook_events(item_id, created_at DESC);
