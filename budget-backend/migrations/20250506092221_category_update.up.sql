-- 1. Rename old text category column
ALTER TABLE transactions RENAME COLUMN category TO category_name;

-- 2. Add new UUID column
ALTER TABLE transactions ADD COLUMN category_id UUID;

-- 3. Populate new column from name match (optional but useful)
UPDATE transactions t
SET category_id = c.id
FROM categories c
WHERE LOWER(t.category_name) = LOWER(c.name);

