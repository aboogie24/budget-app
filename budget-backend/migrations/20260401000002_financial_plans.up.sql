CREATE TABLE IF NOT EXISTS financial_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES households(id),
    created_by UUID REFERENCES users(id),
    name TEXT NOT NULL,
    plan_type TEXT NOT NULL DEFAULT 'combined',
    status TEXT NOT NULL DEFAULT 'draft',
    framework_level TEXT,
    monthly_contribution NUMERIC NOT NULL DEFAULT 0,
    start_date DATE,
    projected_end_date DATE,
    ai_analysis JSONB DEFAULT '{}',
    scenarios JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_amount NUMERIC,
    target_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plan_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES financial_plans(id) ON DELETE CASCADE,
    target_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    monthly_amount NUMERIC NOT NULL DEFAULT 0,
    priority_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_financial_plans_household ON financial_plans(household_id);
CREATE INDEX IF NOT EXISTS idx_financial_plans_created_by ON financial_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_plan_milestones_plan ON plan_milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_allocations_plan ON plan_allocations(plan_id);
