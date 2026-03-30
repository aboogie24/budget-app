-- Drop tables in reverse dependency order

DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS user_categories;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;

-- Optionally drop the extension if you had enabled it
-- DROP EXTENSION IF EXISTS "pgcrypto";
