CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  zestimate NUMERIC,
  manual_value NUMERIC,
  zillow_url TEXT,
  zpid TEXT,
  debt_account_id UUID REFERENCES debt_accounts(id) ON DELETE SET NULL,
  last_fetched_at TIMESTAMP,
  is_shared BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_household_id ON properties(household_id);
