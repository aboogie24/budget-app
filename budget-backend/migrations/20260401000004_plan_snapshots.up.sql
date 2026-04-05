CREATE TABLE IF NOT EXISTS plan_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  financial_state JSONB NOT NULL DEFAULT '{}',
  progress_metrics JSONB NOT NULL DEFAULT '{}',
  ai_review_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_plan ON plan_snapshots(plan_id, snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_snapshots_plan_date ON plan_snapshots(plan_id, snapshot_date);
