-- Prevent duplicate budgets for the same (user, category, type). Without this,
-- the budget summary endpoint can double-count spending when it joins
-- transactions against multiple budget rows for the same category, making
-- spent figures look inflated on the budget screen.
--
-- Partial index because user_id and category_id are both nullable in the
-- schema (system / household budgets without a user, budgets whose category
-- was deleted via ON DELETE SET NULL). We only constrain the typical case:
-- a real user budget tied to a real category.
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_category_type_unique
    ON budgets (user_id, category_id, type)
    WHERE user_id IS NOT NULL AND category_id IS NOT NULL;
