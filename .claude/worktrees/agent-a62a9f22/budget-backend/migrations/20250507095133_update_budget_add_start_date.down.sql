-- Down Migration: Recreate month/year columns and drop start_date
ALTER TABLE budgets
ADD COLUMN month INT,
ADD COLUMN year INT;

-- Optionally backfill month/year from start_date
-- UPDATE budgets SET month = EXTRACT(MONTH FROM start_date), year = EXTRACT(YEAR FROM start_date) WHERE start_date IS NOT NULL;

ALTER TABLE budgets
DROP COLUMN start_date;