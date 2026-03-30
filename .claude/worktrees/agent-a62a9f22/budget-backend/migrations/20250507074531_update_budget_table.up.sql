-- Add new columns
ALTER TABLE budgets
  ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled',
  ADD COLUMN type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense'));

-- Change category_id to allow SET NULL on delete
ALTER TABLE budgets
  DROP CONSTRAINT budgets_category_id_fkey;

ALTER TABLE budgets
  ADD CONSTRAINT budgets_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
