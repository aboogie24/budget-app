ALTER TABLE liabilities
  DROP COLUMN IF EXISTS debt_category,
  DROP COLUMN IF EXISTS manual_entry,
  DROP COLUMN IF EXISTS current_balance,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS asset_depreciates;

DROP INDEX IF EXISTS idx_liabilities_user_category;
DROP INDEX IF EXISTS idx_liabilities_type;
