-- System-wide keyword + merchant seeds. These catch the long tail of bank-synced
-- transactions where the provider (Teller especially) supplies no usable category.
-- Keyword rules use substring matching on the normalized merchant name; merchant
-- rules are exact-match shortcuts for unambiguous names. All seeds are scoped
-- system-wide (user_id IS NULL AND household_id IS NULL) and won't shadow any
-- user-created rules — the resolver always checks user/household tiers first.

-- NOTE: there's no unique constraint on system rules, so we guard with NOT EXISTS
-- to keep this migration idempotent.

WITH seeds(rule_type, match_value, category_id) AS (VALUES
  -- ── Gas / fuel ─────────────────────────────────────────────────
  ('keyword',  'bp ',          'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'shell ',       'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'exxon',        'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'chevron',      'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'mobil',        'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'speedway',     'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'sheetz',       'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'circle k',     'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  '7-eleven',     'c0000000-0000-0000-0003-000000000001'::uuid),
  ('keyword',  'wawa',         'c0000000-0000-0000-0003-000000000001'::uuid),

  -- ── Groceries ─────────────────────────────────────────────────
  ('merchant', 'foodlion',     'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'food lion',    'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'kroger',       'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'safeway',      'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'whole foods',  'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'trader joe',   'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'aldi',         'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'publix',       'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'costco',       'c0000000-0000-0000-0002-000000000001'::uuid),
  ('keyword',  'iga',          'c0000000-0000-0000-0002-000000000001'::uuid),

  -- ── Fast food / restaurants ───────────────────────────────────
  ('keyword',  'mcdonald',     'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'chipotle',     'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'chick-fil-a',  'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'chickfila',    'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'subway',       'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'taco bell',    'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'wendys',       'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'burger king',  'c0000000-0000-0000-0002-000000000004'::uuid),
  ('keyword',  'doordash',     'c0000000-0000-0000-0002-000000000002'::uuid),
  ('keyword',  'uber eats',    'c0000000-0000-0000-0002-000000000002'::uuid),
  ('keyword',  'grubhub',      'c0000000-0000-0000-0002-000000000002'::uuid),
  ('keyword',  'postmates',    'c0000000-0000-0000-0002-000000000002'::uuid),
  ('keyword',  'waffle',       'c0000000-0000-0000-0002-000000000002'::uuid),

  -- ── Coffee shops ──────────────────────────────────────────────
  ('keyword',  'starbucks',    'c0000000-0000-0000-0002-000000000003'::uuid),
  ('keyword',  'dunkin',       'c0000000-0000-0000-0002-000000000003'::uuid),
  ('keyword',  'peets',        'c0000000-0000-0000-0002-000000000003'::uuid),

  -- ── Pharmacy / health ─────────────────────────────────────────
  ('keyword',  'cvs ',         'c0000000-0000-0000-0006-000000000002'::uuid),
  ('keyword',  'walgreens',    'c0000000-0000-0000-0006-000000000002'::uuid),
  ('keyword',  'rite aid',     'c0000000-0000-0000-0006-000000000002'::uuid),

  -- ── Shopping ──────────────────────────────────────────────────
  ('keyword',  'walmart',      'c0000000-0000-0000-0000-000000000005'::uuid),
  ('keyword',  'target',       'c0000000-0000-0000-0000-000000000005'::uuid),
  ('keyword',  'amazon',       'c0000000-0000-0000-0000-000000000005'::uuid),
  ('keyword',  'amzn',         'c0000000-0000-0000-0000-000000000005'::uuid),
  ('keyword',  'best buy',     'c0000000-0000-0000-0005-000000000002'::uuid),
  ('keyword',  'lowe',         'c0000000-0000-0000-0005-000000000003'::uuid),
  ('keyword',  'home depot',   'c0000000-0000-0000-0005-000000000003'::uuid),

  -- ── Rideshare / transport ─────────────────────────────────────
  ('keyword',  'lyft',         'c0000000-0000-0000-0003-000000000005'::uuid),
  ('keyword',  'uber',         'c0000000-0000-0000-0003-000000000005'::uuid),

  -- ── Subscriptions / streaming ─────────────────────────────────
  ('keyword',  'netflix',      'c0000000-0000-0000-0004-000000000001'::uuid),
  ('keyword',  'spotify',      'c0000000-0000-0000-0004-000000000001'::uuid),
  ('keyword',  'hulu',         'c0000000-0000-0000-0004-000000000001'::uuid),
  ('keyword',  'disney',       'c0000000-0000-0000-0004-000000000001'::uuid),
  ('keyword',  'apple.com/bill','c0000000-0000-0000-0010-000000000004'::uuid),
  ('keyword',  'google *',     'c0000000-0000-0000-0010-000000000004'::uuid),

  -- ── Utilities / internet / phone ──────────────────────────────
  ('keyword',  'comcast',      'c0000000-0000-0000-0010-000000000002'::uuid),
  ('keyword',  'xfinity',      'c0000000-0000-0000-0010-000000000002'::uuid),
  ('keyword',  'verizon',      'c0000000-0000-0000-0010-000000000001'::uuid),
  ('keyword',  'at&t',         'c0000000-0000-0000-0010-000000000001'::uuid),
  ('keyword',  't-mobile',     'c0000000-0000-0000-0010-000000000001'::uuid),

  -- ── Auto ──────────────────────────────────────────────────────
  ('keyword',  'tesla',        'c0000000-0000-0000-0003-000000000002'::uuid),

  -- ── Personal care ─────────────────────────────────────────────
  ('keyword',  'vape',         'c0000000-0000-0000-0000-000000000011'::uuid),
  ('keyword',  'tobacco',      'c0000000-0000-0000-0000-000000000011'::uuid),
  ('keyword',  'abc store',    'c0000000-0000-0000-0000-000000000011'::uuid)
)
INSERT INTO category_mapping_rules (rule_type, match_value, category_id, auto_created)
SELECT s.rule_type, s.match_value, s.category_id, true
FROM seeds s
WHERE NOT EXISTS (
  SELECT 1 FROM category_mapping_rules r
  WHERE r.user_id IS NULL
    AND r.household_id IS NULL
    AND r.rule_type = s.rule_type
    AND LOWER(r.match_value) = LOWER(s.match_value)
);
