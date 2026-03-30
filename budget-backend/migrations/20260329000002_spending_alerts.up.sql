CREATE TABLE IF NOT EXISTS spending_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  budget_id UUID NOT NULL REFERENCES budgets(id),
  alert_type TEXT NOT NULL DEFAULT 'threshold',
  threshold_percent INTEGER DEFAULT 80,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spending_alerts_household ON spending_alerts(household_id);
CREATE INDEX IF NOT EXISTS idx_spending_alerts_budget ON spending_alerts(budget_id);
