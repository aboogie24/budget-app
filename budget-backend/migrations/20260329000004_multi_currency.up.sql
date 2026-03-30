-- Add currency column to transactions (default USD)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add currency column to budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add default_currency to households
ALTER TABLE households ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'USD';

-- Add default_currency to users (for pre-household use)
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'USD';
