-- Bills: recurring expense obligations (rent, utilities, subscriptions, loan payments)
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID,
  name TEXT NOT NULL,
  amount_due NUMERIC NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  frequency TEXT NOT NULL DEFAULT 'monthly',
  payee TEXT,
  category_id UUID,
  debt_account_id UUID REFERENCES debt_accounts(id) ON DELETE SET NULL,
  is_autopay BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bill payment records: tracks individual payment instances per billing period
CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID,
  amount_paid NUMERIC NOT NULL,
  paid_date TIMESTAMP NOT NULL,
  transaction_id UUID,
  source TEXT DEFAULT 'manual',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bills_user_id ON bills(user_id);
CREATE INDEX idx_bills_household_id ON bills(household_id);
CREATE INDEX idx_bills_debt_account_id ON bills(debt_account_id);
CREATE INDEX idx_bill_payments_bill_id ON bill_payments(bill_id);
CREATE INDEX idx_bill_payments_period ON bill_payments(period_start, period_end);
