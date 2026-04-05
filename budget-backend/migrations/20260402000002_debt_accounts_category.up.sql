-- Add debt categorization columns to debt_accounts
ALTER TABLE debt_accounts
  ADD COLUMN IF NOT EXISTS debt_category VARCHAR(20) NOT NULL DEFAULT 'attack',
  ADD COLUMN IF NOT EXISTS liability_type VARCHAR(20) NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS asset_depreciates BOOLEAN;

-- Set smart defaults for existing rows based on name heuristics
UPDATE debt_accounts SET liability_type = 'credit', debt_category = 'attack'
  WHERE LOWER(name) LIKE '%credit%' OR LOWER(name) LIKE '%card%' OR LOWER(name) LIKE '%cc%';
UPDATE debt_accounts SET liability_type = 'auto', debt_category = 'attack', asset_depreciates = true
  WHERE LOWER(name) LIKE '%auto%' OR LOWER(name) LIKE '%car%' OR LOWER(name) LIKE '%vehicle%';
UPDATE debt_accounts SET liability_type = 'mortgage', debt_category = 'structured', asset_depreciates = false
  WHERE LOWER(name) LIKE '%mortgage%' OR LOWER(name) LIKE '%home%';
UPDATE debt_accounts SET liability_type = 'student', debt_category = 'attack'
  WHERE LOWER(name) LIKE '%student%' OR LOWER(name) LIKE '%school%';

-- Index for category queries
CREATE INDEX IF NOT EXISTS idx_debt_accounts_category ON debt_accounts(user_id, debt_category);

GRANT ALL ON debt_accounts TO youruser;
