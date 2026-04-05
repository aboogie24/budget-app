-- Expand liabilities table with debt categorization and manual entry support
ALTER TABLE liabilities
  ADD COLUMN IF NOT EXISTS debt_category VARCHAR(20) NOT NULL DEFAULT 'attack',
  ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS asset_depreciates BOOLEAN;

-- Set smart defaults for existing rows based on liability type
UPDATE liabilities SET debt_category = 'structured' WHERE liability_type = 'mortgage';
UPDATE liabilities SET debt_category = 'attack' WHERE liability_type IN ('credit', 'student');
UPDATE liabilities SET asset_depreciates = false WHERE liability_type = 'mortgage';

-- Index for category-based queries (attack vs structured debt views)
CREATE INDEX IF NOT EXISTS idx_liabilities_user_category ON liabilities(user_id, debt_category);
CREATE INDEX IF NOT EXISTS idx_liabilities_type ON liabilities(liability_type);

GRANT ALL ON liabilities TO youruser;
