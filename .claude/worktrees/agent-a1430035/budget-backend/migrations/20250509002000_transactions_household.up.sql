ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id);
