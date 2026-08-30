-- Seed Teller's transaction-category vocabulary into the system mapping rules.
-- The 32 rules seeded in 20260403000002 use Plaid's vocabulary; Teller emits a
-- different lowercase set (dining, fuel, transport, ...). Terms that already
-- match a Plaid rule case-insensitively (groceries, clothing, utilities, ...)
-- are intentionally not duplicated here.
INSERT INTO category_mapping_rules (rule_type, match_value, category_id, auto_created) VALUES
  ('plaid_category', 'dining',         'c0000000-0000-0000-0002-000000000002', true),
  ('plaid_category', 'bar',            'c0000000-0000-0000-0002-000000000002', true),
  ('plaid_category', 'charity',        'c0000000-0000-0000-0011-000000000002', true),
  ('plaid_category', 'fuel',           'c0000000-0000-0000-0003-000000000001', true),
  ('plaid_category', 'home',           'c0000000-0000-0000-0000-000000000001', true),
  ('plaid_category', 'income',         'c0000000-0000-0000-0000-000000000007', true),
  ('plaid_category', 'loan',           'c0000000-0000-0000-0012-000000000002', true),
  ('plaid_category', 'phone',          'c0000000-0000-0000-0010-000000000001', true),
  ('plaid_category', 'shopping',       'c0000000-0000-0000-0000-000000000005', true),
  ('plaid_category', 'software',       'c0000000-0000-0000-0010-000000000004', true),
  ('plaid_category', 'sport',          'c0000000-0000-0000-0006-000000000003', true),
  ('plaid_category', 'transport',      'c0000000-0000-0000-0000-000000000003', true),
  ('plaid_category', 'transportation', 'c0000000-0000-0000-0000-000000000003', true),
  ('plaid_category', 'education',      'c0000000-0000-0000-0011-000000000003', true),
  ('plaid_category', 'investment',     'c0000000-0000-0000-0012-000000000003', true),
  ('plaid_category', 'health',         'c0000000-0000-0000-0000-000000000006', true)
ON CONFLICT DO NOTHING;
