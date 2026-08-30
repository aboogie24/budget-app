-- Designate a real bank account as a savings goal's fund (e.g. "this HYSA IS
-- our emergency fund"). When linked, the goal's current_amount mirrors the
-- account balance on every balance sync instead of being manually tracked.
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS linked_balance_id UUID;

-- One goal per account: two goals reading the same balance would double-count
-- the same dollars toward different purposes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_savings_goals_linked_balance
    ON savings_goals (linked_balance_id) WHERE linked_balance_id IS NOT NULL;
