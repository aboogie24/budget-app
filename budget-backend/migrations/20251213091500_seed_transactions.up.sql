-- Seed sample transactions only if the user exists to avoid migration errors
INSERT INTO transactions (id, user_id, household_id, type, amount, category_name, note, date, frequency, due_day, source)
SELECT v.*
FROM (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'a3a264bc-74ce-4724-893b-53b422b5123b'::uuid, NULL::uuid, 'income', 3200::numeric, 'Salary', 'Paycheck', NOW() - INTERVAL '5 days', 'monthly', NULL::int, 'manual'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'a3a264bc-74ce-4724-893b-53b422b5123b'::uuid, NULL::uuid, 'expense', 127.43::numeric, 'Groceries', 'Whole Foods', NOW() - INTERVAL '2 days', 'one-time', NULL::int, 'bank'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'a3a264bc-74ce-4724-893b-53b422b5123b'::uuid, NULL::uuid, 'expense', 15.99::numeric, 'Entertainment', 'Netflix', NOW() - INTERVAL '1 day', 'monthly', NULL::int, 'bank'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'a3a264bc-74ce-4724-893b-53b422b5123b'::uuid, NULL::uuid, 'expense', 45.67::numeric, 'Transport', 'Ride share', NOW() - INTERVAL '3 days', 'one-time', NULL::int, 'manual')
) AS v(id, user_id, household_id, type, amount, category_name, note, date, frequency, due_day, source)
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = v.user_id);
