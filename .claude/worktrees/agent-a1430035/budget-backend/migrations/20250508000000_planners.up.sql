-- Savings goals for shared/personal targets
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC,
  current_amount NUMERIC DEFAULT 0,
  target_date TEXT,
  priority INTEGER DEFAULT 3,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Debts for payoff planning
CREATE TABLE IF NOT EXISTS debt_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance NUMERIC NOT NULL,
  apr NUMERIC,
  min_payment NUMERIC,
  due_day INTEGER,
  strategy TEXT,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Financial priorities ranking
CREATE TABLE IF NOT EXISTS financial_priorities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rank INTEGER,
  notes TEXT,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Travel / trips
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT,
  end_date TEXT,
  budget NUMERIC,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID PRIMARY KEY,
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  amount NUMERIC,
  note TEXT,
  date TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
