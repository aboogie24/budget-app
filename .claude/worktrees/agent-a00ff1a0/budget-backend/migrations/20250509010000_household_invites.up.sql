CREATE TABLE IF NOT EXISTS household_invites (
  code UUID PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
