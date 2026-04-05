CREATE TABLE IF NOT EXISTS category_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('merchant', 'plaid_category', 'keyword')),
  match_value TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  priority INTEGER DEFAULT 0,
  auto_created BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_user ON category_mapping_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_household ON category_mapping_rules(household_id);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_match ON category_mapping_rules(rule_type, match_value);

-- Seed system Plaid category -> system category mappings
INSERT INTO category_mapping_rules (rule_type, match_value, category_id, auto_created) VALUES
  ('plaid_category', 'Food and Drink', 'c0000000-0000-0000-0000-000000000002', true),
  ('plaid_category', 'Groceries', 'c0000000-0000-0000-0002-000000000001', true),
  ('plaid_category', 'Restaurants', 'c0000000-0000-0000-0002-000000000002', true),
  ('plaid_category', 'Coffee Shop', 'c0000000-0000-0000-0002-000000000003', true),
  ('plaid_category', 'Fast Food', 'c0000000-0000-0000-0002-000000000004', true),
  ('plaid_category', 'Transfer', 'c0000000-0000-0000-0000-000000000012', true),
  ('plaid_category', 'Payment', 'c0000000-0000-0000-0012-000000000002', true),
  ('plaid_category', 'Credit Card', 'c0000000-0000-0000-0012-000000000002', true),
  ('plaid_category', 'Travel', 'c0000000-0000-0000-0000-000000000004', true),
  ('plaid_category', 'Airlines and Aviation', 'c0000000-0000-0000-0000-000000000003', true),
  ('plaid_category', 'Shops', 'c0000000-0000-0000-0000-000000000005', true),
  ('plaid_category', 'Clothing', 'c0000000-0000-0000-0005-000000000001', true),
  ('plaid_category', 'Electronics', 'c0000000-0000-0000-0005-000000000002', true),
  ('plaid_category', 'Supermarkets and Groceries', 'c0000000-0000-0000-0002-000000000001', true),
  ('plaid_category', 'Gas Stations', 'c0000000-0000-0000-0003-000000000001', true),
  ('plaid_category', 'Taxi', 'c0000000-0000-0000-0003-000000000005', true),
  ('plaid_category', 'Ride Share', 'c0000000-0000-0000-0003-000000000005', true),
  ('plaid_category', 'Entertainment', 'c0000000-0000-0000-0000-000000000004', true),
  ('plaid_category', 'Recreation', 'c0000000-0000-0000-0000-000000000004', true),
  ('plaid_category', 'Gyms and Fitness Centers', 'c0000000-0000-0000-0006-000000000003', true),
  ('plaid_category', 'Pharmacies', 'c0000000-0000-0000-0006-000000000002', true),
  ('plaid_category', 'Medical', 'c0000000-0000-0000-0006-000000000001', true),
  ('plaid_category', 'Insurance', 'c0000000-0000-0000-0010-000000000003', true),
  ('plaid_category', 'Utilities', 'c0000000-0000-0000-0001-000000000002', true),
  ('plaid_category', 'Telecommunication Services', 'c0000000-0000-0000-0010-000000000001', true),
  ('plaid_category', 'Internet Services', 'c0000000-0000-0000-0010-000000000002', true),
  ('plaid_category', 'Subscription', 'c0000000-0000-0000-0010-000000000004', true),
  ('plaid_category', 'Rent', 'c0000000-0000-0000-0001-000000000001', true),
  ('plaid_category', 'Mortgage', 'c0000000-0000-0000-0001-000000000001', true),
  ('plaid_category', 'Deposit', 'c0000000-0000-0000-0000-000000000007', true),
  ('plaid_category', 'Payroll', 'c0000000-0000-0000-0007-000000000001', true),
  ('plaid_category', 'Interest', 'c0000000-0000-0000-0007-000000000004', true)
ON CONFLICT DO NOTHING;
