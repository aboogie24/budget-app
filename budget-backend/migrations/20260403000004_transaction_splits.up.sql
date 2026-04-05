CREATE TABLE IF NOT EXISTS transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_splits_transaction ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_splits_category ON transaction_splits(category_id);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT false;
