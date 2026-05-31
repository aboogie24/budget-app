-- Backstop for duplicate manual transactions. The primary defense is a submit
-- guard on the client, but a partial unique index ensures a race or network
-- retry can't double-write the same manual entry.
--
-- Synced transactions are excluded (external_id IS NOT NULL) — they have their
-- own dedupe via transactions_external_id_idx. We bucket date to the second so
-- two rapid taps with ms-different timestamps still collide; legitimate
-- duplicates (same amount/note within one second) are vanishingly rare for
-- manual entry.

-- Clean up any pre-existing duplicates so the unique index can be created.
-- Keeps the oldest row per group (smaller ctid), deletes the rest. Cascading
-- FKs (e.g. transaction_splits) will drop dependents of the deleted rows.
DELETE FROM transactions a
USING transactions b
WHERE a.ctid > b.ctid
  AND a.external_id IS NULL
  AND b.external_id IS NULL
  AND a.user_id = b.user_id
  AND a.type = b.type
  AND a.amount = b.amount
  AND date_trunc('second', a.date) = date_trunc('second', b.date)
  AND COALESCE(a.note, '') = COALESCE(b.note, '');

CREATE UNIQUE INDEX IF NOT EXISTS transactions_manual_dedupe_idx
    ON transactions (
        user_id,
        type,
        amount,
        (date_trunc('second', date)),
        COALESCE(note, '')
    )
    WHERE external_id IS NULL;
