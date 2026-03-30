CREATE TABLE IF NOT EXISTS linked_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    household_id UUID,
    item_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    institution_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS linked_accounts_user_idx ON linked_accounts(user_id);
CREATE INDEX IF NOT EXISTS linked_accounts_household_idx ON linked_accounts(household_id);

ALTER TABLE linked_accounts
    ADD CONSTRAINT linked_accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

