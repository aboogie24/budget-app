ALTER TABLE categories
  DROP COLUMN IF EXISTS limit_amount,
  DROP COLUMN IF EXISTS rollover_enabled;
