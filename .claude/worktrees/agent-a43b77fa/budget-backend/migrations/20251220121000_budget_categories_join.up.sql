CREATE TABLE IF NOT EXISTS budget_categories (
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (budget_id, category_id),
  UNIQUE (category_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'budget_id'
  ) THEN
    INSERT INTO budget_categories (budget_id, category_id)
    SELECT budget_id, id
    FROM categories
    WHERE budget_id IS NOT NULL
    ON CONFLICT (category_id) DO NOTHING;

    ALTER TABLE categories DROP COLUMN budget_id;
  END IF;
END $$;
