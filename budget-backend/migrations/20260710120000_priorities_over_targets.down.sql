DROP INDEX IF EXISTS idx_plan_allocations_target;
DROP INDEX IF EXISTS idx_priorities_target;
ALTER TABLE financial_priorities DROP COLUMN IF EXISTS target_type;
ALTER TABLE financial_priorities DROP COLUMN IF EXISTS target_id;
