# Auto-Categorization Improvement Plan

Status: **Planning** — awaiting go-ahead before implementation.

## 1. Goal

Make automatic transaction categorization actually reliable. Today it is pure
exact-string rule matching ([internal/categories/resolver.go](budget-backend/internal/categories/resolver.go))
and it breaks on real bank-transaction text. We will rebuild it as a layered
pipeline — normalize → deterministic rules → Claude LLM fallback — that
auto-applies categories, flags them for review, and learns from every edit.

## 2. How it works today

`ResolveCategory` is an 8-step waterfall run **only on bank-synced transactions**
(Plaid/Flinks/Teller `SyncTransactions`) and bills:

1-2. User / household **merchant** rule — *exact* lowercase match → `exact`
3-4. User / household **keyword** rule — `LIKE %kw%` → `high`
5. System **plaid_category** rule (32 seeded mappings) → `high`
6. System merchant rule — exact → `medium`
7. Fuzzy `ILIKE` of a Plaid category vs. category names → `medium`
8. No match → `low`, uncategorized

Confidence is stored as `transactions.match_confidence`; anything not `exact`
goes to the review queue. Learning happens only via the review screen's
"Always categorize X as Y?" prompt, which creates an *exact merchant* rule.

### Why it fails
- **Exact matching vs. messy text** — `SQ *BLUE BOTTLE`, `TST* CHIPOTLE 0481`,
  `AMZN MKTP US*1A2B3`, `POS DEBIT STARBUCKS #1234 SEATTLE`. The store
  number/date/location changes every time, so a learned rule never re-matches.
- **No merchant normalization** — raw descriptions go straight into matching
  and into learned rules. Teller's clean `counterparty.name` and Plaid's
  `merchant_name` are underused; Flinks gives only raw text.
- **Teller's category vocabulary is unmapped** — the 32 seeded rules use
  Plaid's terms; Teller's (`dining`, `groceries`, …) match nothing.
- **Confidence isn't actuated** — everything below `exact` goes to review even
  when `high`; `usage_count` is tracked but never used.
- **No retroactive fix** — a learned rule only helps future syncs.
- **Weak learning** — only the explicit prompt teaches anything.

## 3. Decisions locked in

- **AI approach:** improve the deterministic rules **and** add a **Claude LLM
  fallback** for transactions rules can't place. Each distinct merchant is
  classified once, then cached as a rule — so cost and latency stay low.
- **Confident results:** **auto-apply, but flag for review** — the category is
  written immediately (budgets stay correct), but the transaction stays
  unverified so the user can scan and correct.
- **Learning:** re-categorizing a transaction **retroactively re-applies** to
  matching unverified transactions from the same merchant.
- **Backfill:** when Phase 1 ships, a one-time backfill re-runs the new
  pipeline over all existing synced transactions — the fix reaches the backlog,
  not just future syncs.
- **Rule scope:** LLM-created rules are **household-scoped** when the user
  belongs to a household, so every member benefits from each classification.
- **LLM floor:** Claude returns a confidence; below a set threshold the
  transaction is left uncategorized rather than guessed.

## 4. The improved pipeline

```
synced transaction
   │
   ├─▶ Stage 0  Normalize merchant  → canonical name (e.g. "blue bottle coffee")
   │
   ├─▶ Stage 1  Deterministic waterfall (matches on the normalized name)
   │              user/household merchant → keyword → provider-category → fuzzy
   │              hit → confidence exact/high/medium
   │
   ├─▶ Stage 2  LLM fallback (only if Stage 1 = low)
   │              distinct normalized merchants → Claude → category + confidence
   │              result cached as a rule → next time it hits Stage 1
   │
   ├─▶ Stage 3  Apply: write category_id always; set user_verified by source
   │              user-confirmed rule → verified;  everything else → flagged
   │
   └─▶ Stage 4  Learn: a user edit upserts a normalized merchant rule AND
                  re-applies it to matching unverified transactions
```

### Stage 0 — Merchant normalization (new)
`internal/categories/normalize.go` — `NormalizeMerchant(rawDescription, providerCleanName) string`:
- Prefer a provider-supplied clean name (Teller `counterparty.name`,
  Plaid `merchant_name`) when present.
- Otherwise clean the raw description: strip processor prefixes (`SQ *`,
  `TST*`, `SP *`, `PYPL *`, `POS DEBIT`, `CHECKCARD`, `ACH`, …), trailing store
  numbers (`#1234`), dates, state/location codes, long digit/reference runs;
  collapse whitespace; lowercase.
- The normalized name is what Stages 1, 2, and 4 match and store on.

### Stage 1 — Deterministic waterfall (improved)
- All merchant/keyword matching uses the **normalized** name.
- Seed the **Teller category vocabulary** (`dining`, `groceries`,
  `transportation`, `income`, …) into the system mapping rules so Teller
  transactions resolve like Plaid ones. *(Implementation note: reuse the
  `plaid_category` rule_type as a generic "provider category" — or rename it;
  decided at build time.)*
- Use `usage_count` to rank tie-breaks and to nudge confidence (a rule a user
  has relied on 20× is more trustworthy than a fresh one).

### Stage 2 — Claude LLM fallback (new)
- After a sync, transactions still at `low` confidence have their distinct
  normalized merchants collected and **deduped**.
- A merchant not already covered by a rule is sent to Claude — batched, many
  merchants per call — with: merchant name, a sample description, amount sign,
  the provider category hint, and the user's category list (id, name, parent).
- Claude returns, per merchant: best `category_id`, a confidence, short reason.
- Each answer is written as a `category_mapping_rules` row keyed on the
  normalized merchant (`auto_created = true`, `household_id` set when the user
  is in a household), so **every future transaction from that merchant — for
  anyone in the household — hits Stage 1 and never calls the LLM again**.
- Claude returns a confidence with each answer; below a set threshold the
  transaction is **left uncategorized** (no guess) and surfaces in review.
- Runs **asynchronously** — it never blocks or slows a sync.
- Built on the existing `internal/ai` Claude integration, with prompt caching
  on the (stable) category list to cut token cost.

### Stage 3 — Auto-apply + flag for review
- Every categorized transaction gets `category_id` written immediately so
  budgets are correct the moment a sync finishes.
- `user_verified` is set by source:
  - `exact` (a rule the user themselves created/confirmed) → `verified` — no
    need to review your own decision.
  - `high` / `medium` / `low` / LLM → **applied but unverified** → shows in the
    review queue as "confirm or correct," already pre-filled.
- The review screen becomes a *confirm/correct* surface instead of a
  *categorize-from-scratch* one, and LLM-sourced rows get an "AI" badge.

### Stage 4 — Learning + retroactive re-apply
- Any user re-categorization (category chip, review screen, edit screen) →
  upsert a user `merchant` rule on the **normalized** name, high priority.
- Then `UPDATE transactions SET category_id = … WHERE merchant_normalized = …
  AND user_id = … AND user_verified = false` — fixes the existing backlog from
  that merchant in one shot. Verified transactions are left untouched.
- The lightweight `SetTransactionCategory` endpoint (just built) is the hook —
  extend it to do the learn + retroactive step.

## 5. Schema changes
- `transactions.merchant_normalized TEXT` — the canonical merchant name, set at
  sync time; indexed `(user_id, merchant_normalized)` for retroactive updates.
- `category_mapping_rules` — LLM-created rules reuse `rule_type='merchant'` +
  `auto_created=true`; optionally add a `source TEXT` (`user|system|llm`) for
  analytics and the review-screen "AI" badge.
- Migration seeding the Teller category vocabulary.

## 6. Backend work items
- `internal/categories/normalize.go` — `NormalizeMerchant` + unit tests over a
  corpus of real-world description strings.
- `internal/categories/resolver.go` — match on normalized name; use
  `usage_count`; keep the waterfall shape.
- `internal/categories/llm.go` — `ClassifyMerchants(ctx, merchants, categories)`
  via `internal/ai`, batched, prompt-cached; writes resulting rules.
- Async categorization runner — invoked after each provider sync to LLM-classify
  the `low`-confidence remainder.
- Providers (Plaid/Flinks/Teller `SyncTransactions`) — compute & store
  `merchant_normalized`, always apply the category, set `user_verified` by
  source.
- Extend `SetTransactionCategory` — learn a normalized rule + retroactive
  re-apply. Optional `POST /auth/transactions/recategorize` to re-run the
  pipeline on demand.

## 7. Frontend work items
- Review screen ([transactions/review.tsx](budget-app/app/transactions/review.tsx)) —
  rows arrive pre-categorized; reframe as confirm/correct, add an "AI"
  badge for LLM-sourced suggestions, keep swipe-to-confirm.
- Optional "Re-run categorization" action on the budget or review screen.

## 8. LLM cost & safety
- **Cost** is bounded by per-merchant dedupe + permanent rule caching + batching
  + prompt caching: a user with 200 transactions across ~60 merchants costs
  ~1-2 batched calls total, then $0 ongoing for those merchants.
- **Mis-categorization** is caught by Stage 3 — LLM results are flagged for
  review, never silently trusted, and carry the "AI" badge.
- **Normalization over-stripping** (merging distinct merchants) is guarded by a
  conservative rule set and the test corpus.

## 9. Phased delivery
- **Phase 1 — Normalization + deterministic wins:** `NormalizeMerchant`,
  `merchant_normalized` column, waterfall matches on it, Teller vocab seed,
  plus a **one-time backfill** that re-normalizes and re-resolves existing
  synced transactions. No LLM. Biggest reliability gain for the least risk.
- **Phase 2 — Auto-apply + confidence:** write categories always, set
  `user_verified` by source, review screen becomes confirm/correct.
- **Phase 3 — Learning + retroactive:** edits upsert normalized rules and
  re-apply to the unverified backlog.
- **Phase 4 — Claude LLM fallback:** the async classifier, batching, rule
  caching, "AI" badge.

## 10. Prior art

This builds on `CATEGORY-SYSTEM-UPGRADE.md`, which specified the category
hierarchy, the `category_mapping_rules` table, the resolver, and the review
screen — all already shipped. This plan is the next iteration: it makes the
resolver reliable on real bank-transaction text, adds the Claude LLM tier, and
closes the learning loop.
