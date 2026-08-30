-- Real debt payoff progress needs the opening balance: "% paid" was previously
-- a hardcoded heuristic that always rendered ~23%. Backfill with the current
-- balance — existing debts start at 0% paid from today, which is honest.
ALTER TABLE debt_accounts ADD COLUMN IF NOT EXISTS original_balance NUMERIC;
UPDATE debt_accounts SET original_balance = balance WHERE original_balance IS NULL;
