DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'budget_id'
  ) THEN
    ALTER TABLE categories
      ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL;

    UPDATE categories c
    SET budget_id = bc.budget_id
    FROM budget_categories bc
    WHERE bc.category_id = c.id;
  END IF;
END $$;

DROP TABLE IF EXISTS budget_categories;
