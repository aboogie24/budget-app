ALTER TABLE households DROP CONSTRAINT IF EXISTS households_plan_check;
ALTER TABLE households DROP COLUMN IF EXISTS plan_updated_at;
ALTER TABLE households DROP COLUMN IF EXISTS plan;
