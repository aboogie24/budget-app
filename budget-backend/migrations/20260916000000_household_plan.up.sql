-- C031: household-level Free|Plus plan (source of truth). No billing rails.
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;

-- Backfill + constrain after add (IF NOT EXISTS path may skip DEFAULT-only).
UPDATE households SET plan = 'free' WHERE plan IS NULL OR plan = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'households_plan_check'
  ) THEN
    ALTER TABLE households
      ADD CONSTRAINT households_plan_check CHECK (plan IN ('free', 'plus'));
  END IF;
END $$;
