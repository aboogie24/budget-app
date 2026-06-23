-- Internal-transfer tracking. When a bank-synced inflow can be paired with a
-- corresponding outflow in another of the user's linked accounts, both rows
-- get type='transfer' and point at each other via transfer_pair_id. This lets
-- the calendar and budget views exclude them from income/expense sums while
-- keeping them visible in the transaction list.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_pair_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair
    ON transactions (transfer_pair_id)
    WHERE transfer_pair_id IS NOT NULL;
