ALTER TABLE bills ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
GRANT ALL ON bills TO youruser;
