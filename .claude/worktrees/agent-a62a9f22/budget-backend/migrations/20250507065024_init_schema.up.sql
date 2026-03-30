-- Enable pgcrypto if you ever want DB-side UUIDs (optional)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- USER SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  weekly_multiplier INTEGER DEFAULT 4,
  biweekly_multiplier INTEGER DEFAULT 2,
  monthly_multiplier INTEGER DEFAULT 1
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  user_id UUID,
  color TEXT
);

-- DEFAULT CATEGORIES
INSERT INTO categories (id, name, user_id, type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Salary', NULL, 'income'),
  ('00000000-0000-0000-0000-000000000002', 'Freelance', NULL, 'income'),
  ('00000000-0000-0000-0000-000000000003', 'Rent', NULL, 'expense'),
  ('00000000-0000-0000-0000-000000000004', 'Groceries', NULL, 'expense'),
  ('00000000-0000-0000-0000-000000000005', 'Utilities', NULL, 'expense');

-- USER CATEGORIES
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  custom_name TEXT
);

-- BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  amount FLOAT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
  category_name TEXT,
  category_id UUID REFERENCES categories(id),
  type TEXT NOT NULL,
  amount FLOAT NOT NULL,
  note TEXT,
  date TIMESTAMP NOT NULL,
  frequency TEXT,
  due_day INTEGER
);

-- CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME
);
