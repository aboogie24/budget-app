-- 002_update_categories_table.up.sql

-- Change id to UUID if not already
ALTER TABLE categories
  ALTER COLUMN id TYPE UUID USING id::uuid;

-- Remove unused columns
ALTER TABLE categories
  DROP COLUMN level,
  DROP COLUMN parent_id;

-- Add user_id (nullable)
ALTER TABLE categories
  ADD COLUMN user_id UUID;

-- Add check constraint for 'type'
ALTER TABLE categories
  ADD CONSTRAINT type_check CHECK (type IN ('income', 'expense'));