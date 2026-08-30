-- Daily net-worth snapshots. The dashboard upserts today's row on each load
-- so the sparkline can show a real 30-day trend without needing a cron.
-- Components are stored so we can later break down what's moving (cash vs
-- debt vs investments vs property).
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    user_id        UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date  DATE             NOT NULL,
    cash           DOUBLE PRECISION NOT NULL DEFAULT 0,
    investments    DOUBLE PRECISION NOT NULL DEFAULT 0,
    properties     DOUBLE PRECISION NOT NULL DEFAULT 0,
    debt           DOUBLE PRECISION NOT NULL DEFAULT 0,
    total          DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at     TIMESTAMP        NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP        NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_date
    ON net_worth_snapshots (user_id, snapshot_date DESC);
