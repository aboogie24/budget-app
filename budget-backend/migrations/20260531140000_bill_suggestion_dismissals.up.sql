-- Tracks merchants the user has explicitly marked "not a bill" so the
-- suggestion engine doesn't keep re-surfacing them.
CREATE TABLE IF NOT EXISTS bill_suggestion_dismissals (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_normalized TEXT NOT NULL,
    dismissed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, merchant_normalized)
);
