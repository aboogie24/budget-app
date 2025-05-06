-- Rename old column
ALTER TABLE transactions RENAME COLUMN category TO category_name;

-- Add new foreign key column
ALTER TABLE transactions ADD COLUMN category_id UUID;

-- Optionally populate the new column for existing data
UPDATE transactions t
SET category_id = c.id
FROM categories c
WHERE LOWER(t.category_name) = LOWER(c.name);

-- Set up foreign key constraint
ALTER TABLE transactions
ADD CONSTRAINT fk_category
FOREIGN KEY (category_id)
REFERENCES categories(id);