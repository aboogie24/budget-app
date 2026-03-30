-- Remove currency column from transactions
ALTER TABLE transactions DROP COLUMN IF EXISTS currency;

-- Remove currency column from budgets
ALTER TABLE budgets DROP COLUMN IF EXISTS currency;

-- Remove default_currency from households
ALTER TABLE households DROP COLUMN IF EXISTS default_currency;

-- Remove default_currency from users
ALTER TABLE users DROP COLUMN IF EXISTS default_currency;
