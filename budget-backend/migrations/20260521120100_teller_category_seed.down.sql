DELETE FROM category_mapping_rules
WHERE rule_type = 'plaid_category'
  AND user_id IS NULL AND household_id IS NULL
  AND match_value IN (
    'dining', 'bar', 'charity', 'fuel', 'home', 'income', 'loan', 'phone',
    'shopping', 'software', 'sport', 'transport', 'transportation',
    'education', 'investment', 'health'
  );
