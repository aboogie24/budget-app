-- Reverts the system keyword + merchant seeds added in the up migration.
DELETE FROM category_mapping_rules
WHERE user_id IS NULL
  AND household_id IS NULL
  AND auto_created = true
  AND rule_type IN ('keyword','merchant')
  AND LOWER(match_value) IN (
    'bp ','shell ','exxon','chevron','mobil','speedway','sheetz','circle k','7-eleven','wawa',
    'foodlion','food lion','kroger','safeway','whole foods','trader joe','aldi','publix','costco','iga',
    'mcdonald','chipotle','chick-fil-a','chickfila','subway','taco bell','wendys','burger king',
    'doordash','uber eats','grubhub','postmates','waffle',
    'starbucks','dunkin','peets',
    'cvs ','walgreens','rite aid',
    'walmart','target','amazon','amzn','best buy','lowe','home depot',
    'lyft','uber',
    'netflix','spotify','hulu','disney','apple.com/bill','google *',
    'comcast','xfinity','verizon','at&t','t-mobile',
    'tesla',
    'vape','tobacco','abc store'
  );
