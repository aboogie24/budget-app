ALTER TABLE transactions DROP COLUMN IF EXISTS household_id;
ALTER TABLE trips DROP COLUMN IF EXISTS household_id;
ALTER TABLE financial_priorities DROP COLUMN IF EXISTS household_id;
ALTER TABLE debt_accounts DROP COLUMN IF EXISTS household_id;
ALTER TABLE savings_goals DROP COLUMN IF EXISTS household_id;
ALTER TABLE budgets DROP COLUMN IF EXISTS household_id;
DROP TABLE IF EXISTS household_members;
DROP TABLE IF EXISTS households;
