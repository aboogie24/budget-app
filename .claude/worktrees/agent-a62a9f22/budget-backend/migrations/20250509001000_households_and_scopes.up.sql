-- Households
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Household members
CREATE TABLE IF NOT EXISTS household_members (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (household_id, user_id)
);

-- Add household_id to scoped tables
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
ALTER TABLE debt_accounts ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
ALTER TABLE financial_priorities ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
