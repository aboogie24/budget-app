-- Drop webhook event table
DROP TABLE IF EXISTS plaid_webhook_events;

-- Remove webhook columns from linked_accounts
ALTER TABLE linked_accounts DROP COLUMN IF EXISTS item_status;
ALTER TABLE linked_accounts DROP COLUMN IF EXISTS error_code;
ALTER TABLE linked_accounts DROP COLUMN IF EXISTS last_cursor;
ALTER TABLE linked_accounts DROP COLUMN IF EXISTS last_webhook_at;
