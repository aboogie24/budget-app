-- Remove new columns
ALTER TABLE budgets
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS type;

-- Restore original foreign key behavior
ALTER TABLE budgets
  DROP CONSTRAINT budgets_category_id_fkey;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
