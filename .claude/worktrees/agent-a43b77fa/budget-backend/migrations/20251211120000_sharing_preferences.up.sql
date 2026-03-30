CREATE TABLE IF NOT EXISTS sharing_preferences (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    household_id UUID,
    share_budgets BOOLEAN DEFAULT TRUE,
    share_transactions BOOLEAN DEFAULT TRUE,
    share_debts BOOLEAN DEFAULT TRUE,
    share_savings BOOLEAN DEFAULT TRUE,
    share_priorities BOOLEAN DEFAULT TRUE,
    share_notes BOOLEAN DEFAULT TRUE,
    notify_partner BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sharing_preferences_user_household_idx
    ON sharing_preferences (user_id, household_id);
