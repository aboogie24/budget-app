-- Add hierarchy columns to categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Seed system default category tree (user_id IS NULL = system categories)
-- Only insert if no system categories exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND parent_id IS NULL LIMIT 1) THEN
    -- Parent categories (expense)
    INSERT INTO categories (id, name, type, color, icon, sort_order) VALUES
      ('c0000000-0000-0000-0000-000000000001', 'Housing', 'expense', '#7c3aed', 'home', 1),
      ('c0000000-0000-0000-0000-000000000002', 'Food & Dining', 'expense', '#ec4899', 'restaurant', 2),
      ('c0000000-0000-0000-0000-000000000003', 'Transportation', 'expense', '#3b82f6', 'car', 3),
      ('c0000000-0000-0000-0000-000000000004', 'Entertainment', 'expense', '#f59e0b', 'film', 4),
      ('c0000000-0000-0000-0000-000000000005', 'Shopping', 'expense', '#10b981', 'cart', 5),
      ('c0000000-0000-0000-0000-000000000006', 'Health', 'expense', '#ef4444', 'fitness', 6),
      ('c0000000-0000-0000-0000-000000000010', 'Bills & Subscriptions', 'expense', '#6366f1', 'receipt', 7),
      ('c0000000-0000-0000-0000-000000000011', 'Personal', 'expense', '#8b5cf6', 'person', 8),
      ('c0000000-0000-0000-0000-000000000012', 'Savings & Debt', 'expense', '#14b8a6', 'shield', 9);

    -- Parent category (income)
    INSERT INTO categories (id, name, type, color, icon, sort_order) VALUES
      ('c0000000-0000-0000-0000-000000000007', 'Income', 'income', '#22c55e', 'cash', 1);

    -- Subcategories: Housing
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0001-000000000001', 'Rent/Mortgage', 'expense', '#7c3aed', 'home', 1, 'c0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0001-000000000002', 'Utilities', 'expense', '#7c3aed', 'flash', 2, 'c0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0001-000000000003', 'Home Insurance', 'expense', '#7c3aed', 'shield', 3, 'c0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0001-000000000004', 'Maintenance', 'expense', '#7c3aed', 'construct', 4, 'c0000000-0000-0000-0000-000000000001');

    -- Subcategories: Food & Dining
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0002-000000000001', 'Groceries', 'expense', '#ec4899', 'cart', 1, 'c0000000-0000-0000-0000-000000000002'),
      ('c0000000-0000-0000-0002-000000000002', 'Restaurants', 'expense', '#ec4899', 'restaurant', 2, 'c0000000-0000-0000-0000-000000000002'),
      ('c0000000-0000-0000-0002-000000000003', 'Coffee Shops', 'expense', '#ec4899', 'cafe', 3, 'c0000000-0000-0000-0000-000000000002'),
      ('c0000000-0000-0000-0002-000000000004', 'Fast Food', 'expense', '#ec4899', 'fast-food', 4, 'c0000000-0000-0000-0000-000000000002');

    -- Subcategories: Transportation
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0003-000000000001', 'Gas', 'expense', '#3b82f6', 'car', 1, 'c0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0003-000000000002', 'Auto Payment', 'expense', '#3b82f6', 'card', 2, 'c0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0003-000000000003', 'Auto Insurance', 'expense', '#3b82f6', 'shield', 3, 'c0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0003-000000000004', 'Public Transit', 'expense', '#3b82f6', 'bus', 4, 'c0000000-0000-0000-0000-000000000003'),
      ('c0000000-0000-0000-0003-000000000005', 'Rideshare', 'expense', '#3b82f6', 'car', 5, 'c0000000-0000-0000-0000-000000000003');

    -- Subcategories: Entertainment
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0004-000000000001', 'Streaming', 'expense', '#f59e0b', 'tv', 1, 'c0000000-0000-0000-0000-000000000004'),
      ('c0000000-0000-0000-0004-000000000002', 'Movies & Events', 'expense', '#f59e0b', 'film', 2, 'c0000000-0000-0000-0000-000000000004'),
      ('c0000000-0000-0000-0004-000000000003', 'Hobbies', 'expense', '#f59e0b', 'color-palette', 3, 'c0000000-0000-0000-0000-000000000004'),
      ('c0000000-0000-0000-0004-000000000004', 'Games', 'expense', '#f59e0b', 'game-controller', 4, 'c0000000-0000-0000-0000-000000000004');

    -- Subcategories: Shopping
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0005-000000000001', 'Clothing', 'expense', '#10b981', 'shirt', 1, 'c0000000-0000-0000-0000-000000000005'),
      ('c0000000-0000-0000-0005-000000000002', 'Electronics', 'expense', '#10b981', 'phone-portrait', 2, 'c0000000-0000-0000-0000-000000000005'),
      ('c0000000-0000-0000-0005-000000000003', 'Home Goods', 'expense', '#10b981', 'home', 3, 'c0000000-0000-0000-0000-000000000005'),
      ('c0000000-0000-0000-0005-000000000004', 'Personal Care', 'expense', '#10b981', 'body', 4, 'c0000000-0000-0000-0000-000000000005');

    -- Subcategories: Health
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0006-000000000001', 'Medical', 'expense', '#ef4444', 'medkit', 1, 'c0000000-0000-0000-0000-000000000006'),
      ('c0000000-0000-0000-0006-000000000002', 'Pharmacy', 'expense', '#ef4444', 'medical', 2, 'c0000000-0000-0000-0000-000000000006'),
      ('c0000000-0000-0000-0006-000000000003', 'Gym & Fitness', 'expense', '#ef4444', 'fitness', 3, 'c0000000-0000-0000-0000-000000000006'),
      ('c0000000-0000-0000-0006-000000000004', 'Mental Health', 'expense', '#ef4444', 'heart', 4, 'c0000000-0000-0000-0000-000000000006');

    -- Subcategories: Income
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0007-000000000001', 'Salary', 'income', '#22c55e', 'cash', 1, 'c0000000-0000-0000-0000-000000000007'),
      ('c0000000-0000-0000-0007-000000000002', 'Freelance', 'income', '#22c55e', 'laptop', 2, 'c0000000-0000-0000-0000-000000000007'),
      ('c0000000-0000-0000-0007-000000000003', 'Side Hustle', 'income', '#22c55e', 'briefcase', 3, 'c0000000-0000-0000-0000-000000000007'),
      ('c0000000-0000-0000-0007-000000000004', 'Investment Income', 'income', '#22c55e', 'trending-up', 4, 'c0000000-0000-0000-0000-000000000007');

    -- Subcategories: Bills & Subscriptions
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0010-000000000001', 'Phone', 'expense', '#6366f1', 'phone-portrait', 1, 'c0000000-0000-0000-0000-000000000010'),
      ('c0000000-0000-0000-0010-000000000002', 'Internet', 'expense', '#6366f1', 'wifi', 2, 'c0000000-0000-0000-0000-000000000010'),
      ('c0000000-0000-0000-0010-000000000003', 'Insurance', 'expense', '#6366f1', 'shield', 3, 'c0000000-0000-0000-0000-000000000010'),
      ('c0000000-0000-0000-0010-000000000004', 'Subscriptions', 'expense', '#6366f1', 'card', 4, 'c0000000-0000-0000-0000-000000000010');

    -- Subcategories: Personal
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0011-000000000001', 'Gifts', 'expense', '#8b5cf6', 'gift', 1, 'c0000000-0000-0000-0000-000000000011'),
      ('c0000000-0000-0000-0011-000000000002', 'Donations', 'expense', '#8b5cf6', 'heart', 2, 'c0000000-0000-0000-0000-000000000011'),
      ('c0000000-0000-0000-0011-000000000003', 'Education', 'expense', '#8b5cf6', 'school', 3, 'c0000000-0000-0000-0000-000000000011'),
      ('c0000000-0000-0000-0011-000000000004', 'Pets', 'expense', '#8b5cf6', 'paw', 4, 'c0000000-0000-0000-0000-000000000011');

    -- Subcategories: Savings & Debt
    INSERT INTO categories (id, name, type, color, icon, sort_order, parent_id) VALUES
      ('c0000000-0000-0000-0012-000000000001', 'Emergency Fund', 'expense', '#14b8a6', 'shield', 1, 'c0000000-0000-0000-0000-000000000012'),
      ('c0000000-0000-0000-0012-000000000002', 'Debt Payment', 'expense', '#14b8a6', 'card', 2, 'c0000000-0000-0000-0000-000000000012'),
      ('c0000000-0000-0000-0012-000000000003', 'Investments', 'expense', '#14b8a6', 'trending-up', 3, 'c0000000-0000-0000-0000-000000000012'),
      ('c0000000-0000-0000-0012-000000000004', 'Retirement', 'expense', '#14b8a6', 'wallet', 4, 'c0000000-0000-0000-0000-000000000012');
  END IF;
END $$;
