-- Reset a user's financial data for a fresh start (dev/testing).
-- Usage:  make reset-user USER_EMAIL=you@example.com
--
-- CAVEAT: this deletes the linked_accounts row (and its access token) but the
-- enrollment still exists on the BANK PROVIDER's side. For Teller, revoke the
-- old enrollment in the Teller dashboard (or DELETE /accounts with the token
-- BEFORE running this) — orphaned enrollments count against the development
-- tier limit, and re-enrolling the same bank shortly after can trip Teller's
-- "try again later" rate protection.
--
-- Deletes (for the target user): bank links + synced data, transactions,
-- budgets, bills, debts, savings goals, priorities, plans, insights artifacts,
-- AI conversations/nudges, snapshots, activity, trips, properties.
--
-- Keeps: the user account + login, household + membership, sharing prefs,
-- settings, push tokens, and the category taxonomy (system + user categories —
-- the categorizer needs it). SYSTEM categorization rules (user_id IS NULL)
-- survive; the user's own merchant/keyword rules, advisor memories, goals,
-- plans, and debts are all removed so everything starts genuinely fresh.

\set ON_ERROR_STOP on

SELECT id AS target_id FROM users WHERE lower(email) = lower(:'target_email') \gset
\echo Resetting data for user :target_id (:target_email)

BEGIN;

-- Transactions and their children
DELETE FROM transaction_splits WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = :'target_id');
DELETE FROM transactions WHERE user_id = :'target_id';

-- Bank links and everything synced from them
DELETE FROM account_balances WHERE user_id = :'target_id';
DELETE FROM investment_holdings WHERE user_id = :'target_id';
DELETE FROM liabilities WHERE user_id = :'target_id';
DELETE FROM linked_accounts WHERE user_id = :'target_id';

-- Bills
DELETE FROM bill_payments WHERE user_id = :'target_id';
DELETE FROM bill_suggestion_dismissals WHERE user_id = :'target_id';
DELETE FROM bills WHERE user_id = :'target_id';

-- Budgets (children first)
DELETE FROM spending_alerts WHERE budget_id IN (SELECT id FROM budgets WHERE user_id = :'target_id');
DELETE FROM budget_categories WHERE budget_id IN (SELECT id FROM budgets WHERE user_id = :'target_id');
DELETE FROM budgets WHERE user_id = :'target_id';

-- Plans (children first), debts, goals, priorities
DELETE FROM plan_milestones  WHERE plan_id IN (SELECT id FROM financial_plans WHERE created_by = :'target_id');
DELETE FROM plan_allocations WHERE plan_id IN (SELECT id FROM financial_plans WHERE created_by = :'target_id');
DELETE FROM plan_snapshots   WHERE plan_id IN (SELECT id FROM financial_plans WHERE created_by = :'target_id');
DELETE FROM plan_approvals   WHERE user_id = :'target_id';
DELETE FROM financial_plans  WHERE created_by = :'target_id';
DELETE FROM debt_accounts WHERE user_id = :'target_id';
DELETE FROM savings_goals WHERE user_id = :'target_id';
DELETE FROM financial_priorities WHERE user_id = :'target_id';

-- The user's categorization rules (system rules with user_id IS NULL survive)
DELETE FROM category_mapping_rules WHERE user_id = :'target_id';

-- AI artifacts
DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = :'target_id');
DELETE FROM ai_conversations WHERE user_id = :'target_id';
DELETE FROM ai_nudges WHERE user_id = :'target_id';
DELETE FROM advisor_memories WHERE user_id = :'target_id';
DELETE FROM push_log WHERE user_id = :'target_id';

-- Trend + feed artifacts
DELETE FROM net_worth_snapshots WHERE user_id = :'target_id';
DELETE FROM activity_events WHERE user_id = :'target_id';
DELETE FROM calendar_events WHERE user_id = :'target_id';

-- Other holdings
DELETE FROM trip_expenses WHERE user_id = :'target_id';
DELETE FROM trips WHERE user_id = :'target_id';
DELETE FROM properties WHERE user_id = :'target_id';

COMMIT;

\echo Done. Account, household, categories, and settings were kept.
