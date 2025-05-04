-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- User settings table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  weekly_multiplier INTEGER DEFAULT 4,
  biweekly_multiplier INTEGER DEFAULT 2,
  monthly_multiplier INTEGER DEFAULT 1
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  budget_id TEXT REFERENCES budgets(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'income' or 'expense'
  amount FLOAT NOT NULL,
  category TEXT,
  note TEXT,
  date TIMESTAMP NOT NULL,
  frequency TEXT, -- 'monthly', 'biweekly', 'weekly'
  due_day INTEGER -- for monthly recurring expenses
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME
);