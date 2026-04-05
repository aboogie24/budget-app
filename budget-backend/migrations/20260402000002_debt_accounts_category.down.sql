ALTER TABLE debt_accounts
  DROP COLUMN IF EXISTS debt_category,
  DROP COLUMN IF EXISTS liability_type,
  DROP COLUMN IF EXISTS asset_depreciates;

DROP INDEX IF EXISTS idx_debt_accounts_category;
