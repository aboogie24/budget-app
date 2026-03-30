-- Up Migration: Add start_date column and drop month/year columns
ALTER TABLE budgets
ADD COLUMN start_date DATE;

-- Optionally migrate existing data to start_date (if needed)
-- UPDATE budgets SET start_date = TO_DATE(CONCAT(year, '-', month, '-01'), 'YYYY-MM-DD') WHERE start_date IS NULL;

ALTER TABLE budgets
DROP COLUMN month,
DROP COLUMN year;