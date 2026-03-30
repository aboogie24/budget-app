CREATE TABLE IF NOT EXISTS account_balances (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id UUID,
    linked_account_id UUID REFERENCES linked_accounts(id) ON DELETE CASCADE,
    plaid_account_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    official_name TEXT,
    type TEXT NOT NULL DEFAULT 'depository',
    subtype TEXT,
    current_balance NUMERIC DEFAULT 0,
    available_balance NUMERIC,
    iso_currency_code TEXT DEFAULT 'USD',
    institution_name TEXT,
    mask TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_balances_user_idx ON account_balances(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_balances_plaid_idx ON account_balances(user_id, plaid_account_id);
