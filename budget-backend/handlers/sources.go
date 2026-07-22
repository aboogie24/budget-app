package handlers

// bankSourcesSQL is the ONE list of bank-synced transaction sources, as a SQL
// IN-list fragment. Every query that means "rows that came from a bank" must
// use this — three separate features (AI categorization, transfer detection,
// bill auto-detection) each silently ignored SimpleFIN because they carried
// their own stale copy of this list. Update here when adding a provider.
const bankSourcesSQL = "('teller','bank','flinks','simplefin')"
