-- Investment holdings from Plaid
CREATE TABLE IF NOT EXISTS investment_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    household_id UUID REFERENCES households(id),
    linked_account_id UUID REFERENCES linked_accounts(id) ON DELETE CASCADE,
    plaid_account_id TEXT NOT NULL,
    plaid_security_id TEXT NOT NULL,
    -- Security info (denormalized for simplicity)
    security_name TEXT,
    ticker_symbol TEXT,
    security_type TEXT,       -- cash, equity, etf, mutual fund, etc.
    -- Holding data
    quantity NUMERIC NOT NULL DEFAULT 0,
    institution_price NUMERIC NOT NULL DEFAULT 0,
    institution_value NUMERIC NOT NULL DEFAULT 0,
    cost_basis NUMERIC,
    iso_currency_code TEXT DEFAULT 'USD',
    price_as_of TEXT,         -- YYYY-MM-DD from Plaid
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investment_holdings_user ON investment_holdings(user_id);
CREATE INDEX idx_investment_holdings_linked ON investment_holdings(linked_account_id);

-- Liabilities from Plaid (credit cards, mortgages, student loans)
CREATE TABLE IF NOT EXISTS liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    household_id UUID REFERENCES households(id),
    linked_account_id UUID REFERENCES linked_accounts(id) ON DELETE CASCADE,
    plaid_account_id TEXT NOT NULL,
    liability_type TEXT NOT NULL,  -- 'credit', 'mortgage', 'student'
    -- Common fields
    account_number TEXT,
    last_payment_amount NUMERIC,
    last_payment_date TEXT,
    minimum_payment_amount NUMERIC,
    next_payment_due_date TEXT,
    is_overdue BOOLEAN DEFAULT FALSE,
    -- Credit card specific
    last_statement_balance NUMERIC,
    -- Mortgage specific
    loan_term TEXT,
    loan_type_description TEXT,
    maturity_date TEXT,
    origination_date TEXT,
    origination_principal NUMERIC,
    interest_rate NUMERIC,
    escrow_balance NUMERIC,
    has_pmi BOOLEAN,
    property_address TEXT,
    ytd_interest_paid NUMERIC,
    ytd_principal_paid NUMERIC,
    -- Student loan specific
    loan_name TEXT,
    loan_status TEXT,
    expected_payoff_date TEXT,
    guarantor TEXT,
    interest_rate_pct NUMERIC,
    outstanding_interest NUMERIC,
    repayment_plan TEXT,
    servicer_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_liabilities_user ON liabilities(user_id);
CREATE INDEX idx_liabilities_linked ON liabilities(linked_account_id);
CREATE INDEX idx_liabilities_type ON liabilities(liability_type);
