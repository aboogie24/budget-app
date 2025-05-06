-- 1. Drop the foreign key constraint if it exists
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_category;

-- 2. Drop the new UUID column
ALTER TABLE transactions DROP COLUMN IF EXISTS category_id;

-- 3. Rename the old column back
ALTER TABLE transactions RENAME COLUMN category_name TO category;
