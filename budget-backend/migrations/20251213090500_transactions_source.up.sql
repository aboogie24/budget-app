ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
