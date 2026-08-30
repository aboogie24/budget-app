-- Link a manual debt to a synced bank account (e.g. "this debt IS my USAA
-- Visa"). When linked, the debt's balance mirrors the account balance on every
-- balance sync instead of being manually tracked — and the Finances screen
-- de-duplicates the pair instead of counting the same dollars twice.
ALTER TABLE debt_accounts ADD COLUMN IF NOT EXISTS linked_balance_id UUID;

-- One debt per account: two debts reading the same balance would double-count
-- what's owed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_accounts_linked_balance
    ON debt_accounts (linked_balance_id) WHERE linked_balance_id IS NOT NULL;
