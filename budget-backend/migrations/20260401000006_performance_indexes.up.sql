-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_type ON budgets(user_id, type);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id, due_day);
CREATE INDEX IF NOT EXISTS idx_debt_accounts_user ON debt_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_nudges_expires ON ai_nudges(expires_at) WHERE expires_at IS NOT NULL;
