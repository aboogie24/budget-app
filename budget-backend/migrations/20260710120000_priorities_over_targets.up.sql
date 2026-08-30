-- Coherence redesign: Priorities become a RANKING over real targets (savings
-- goals + debts), not a free-text list. financial_priorities now stores one row
-- per ranked target; ListPriorities overlays these ranks on the union of the
-- couple's goals and debts.

ALTER TABLE financial_priorities
  ADD COLUMN IF NOT EXISTS target_id UUID,
  ADD COLUMN IF NOT EXISTS target_type TEXT
    CHECK (target_type IS NULL OR target_type IN ('savings_goal', 'debt'));

-- Title was required for the old free-text model; now it's an optional cached label.
ALTER TABLE financial_priorities ALTER COLUMN title DROP NOT NULL;

-- The old free-text priorities were never used by any business logic — clear
-- them so the list only contains real, rankable targets going forward.
DELETE FROM financial_priorities WHERE target_id IS NULL;

-- A given target is ranked at most once per scope (household, or user if solo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_priorities_target
  ON financial_priorities (COALESCE(household_id, user_id), target_id, target_type)
  WHERE target_id IS NOT NULL;

-- plan_allocations.target_id is polymorphic (savings_goal | debt), so it can't
-- carry a real FK. Index it so read-time orphan-skipping joins and aggregation
-- across active plans stay cheap.
CREATE INDEX IF NOT EXISTS idx_plan_allocations_target
  ON plan_allocations (target_type, target_id);
