-- Allow 'simplefin' as a linked-account provider (same widening the Teller
-- migration did — the CHECK predates each new provider).
ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_provider_check;
ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_provider_check
    CHECK (provider IN ('plaid', 'flinks', 'teller', 'simplefin'));
