-- 002_update_categories_table.down.sql

ALTER TABLE categories
  ADD COLUMN level INT,
  ADD COLUMN parent_id UUID,
  DROP COLUMN user_id,
  DROP CONSTRAINT type_check;

-- Revert id back to TEXT (if it was originally TEXT)
ALTER TABLE categories
  ALTER COLUMN id TYPE TEXT USING id::text;