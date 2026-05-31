# Teller Integration Plan

Branch: `feat/aboogie/adding-banksync` *(named before we switched providers —
optionally rename to `feat/aboogie/adding-teller`)*
Status: **Planning** — awaiting go-ahead before implementation.

## 1. Goal

Add **Teller** as a third bank-data provider, alongside the existing Plaid and
Flinks integrations. Teller was chosen over Plaid/BankSync because:

- **Free up to 100 live bank connections** — a personal/couple app never hits
  that, so it is effectively $0.
- Clean developer experience, real-time-ish data, you control the connect UI.

Decisions locked in:

- **Role:** third provider alongside Plaid + Flinks. No migration of existing
  linked accounts.
- **Region:** US only. (Canada stays on Flinks — Teller is US-only.)
- **Data scope:** **transactions + balances** are the priority. Investments &
  liabilities are "nice to have" — Teller has no investment data and no loan
  detail endpoint, so `SyncInvestments` / `SyncLiabilities` will be no-ops.

## 2. Architectural fit

The backend already abstracts providers behind
[budget-backend/internal/bankprovider/provider.go](budget-backend/internal/bankprovider/provider.go):

```
Provider interface { Name, SyncTransactions, SyncBalances, SyncInvestments, SyncLiabilities }
GetProvider(name) → Provider
```

Teller slots in as a new file behind that interface, mirroring the Flinks layout:

| Concern         | Flinks (existing)                     | Teller (new)                          |
|-----------------|---------------------------------------|---------------------------------------|
| HTTP client     | `internal/flinks/{client,models}.go`  | `internal/teller/{client,models}.go`  |
| Provider impl   | `bankprovider/flinks_provider.go`      | `bankprovider/teller_provider.go`     |
| HTTP handlers   | `handlers/flinks.go`                   | `handlers/teller.go`                  |
| Connect page    | (Flinks-hosted iframe)                 | `GET /teller/connect-page` (our HTML) |
| Routes          | `/auth/flinks/*`                       | `/auth/teller/*`                      |
| DB              | migration `..._provider_support`       | new migration extending `provider` CHECK |

## 3. Two things that make Teller different — and drive the design

### 3.1 mTLS client certificate (the one genuinely new piece)

Teller authenticates API callers with **mutual TLS**. Teller issues a client
**certificate + private key** (from the Teller Dashboard). Every API request in
**development and production** must present that cert; **sandbox does not
require it**.

- Go side: build a dedicated `http.Client` whose `Transport.TLSClientConfig`
  loads the keypair via `tls.LoadX509KeyPair`. This is the only structural
  novelty vs. Plaid/Flinks.
- The access token is sent **separately** as HTTP Basic Auth — token as the
  username, empty password (`curl -u ACCESS_TOKEN: https://api.teller.io/...`).
- "Access tokens are useless without a Teller client certificate" — both are
  required together for dev/prod.
- Sandbox needs no cert, so **Phase 1 can be built and tested entirely in
  sandbox** before any cert handling is wired up.

### 3.2 No official React Native SDK for Teller Connect

Teller Connect (the account-linking widget) ships as a web script, plus React,
Apple, and Android SDKs — **no React Native / Expo SDK**.

**Solution: the WebView pattern this app already uses.** The Flinks flow loads
a connect URL in a `react-native-webview` modal, and the Plaid flow loads a
backend-hosted HTML page (`handlers.PlaidLinkPage`). Teller follows the same
recipe: our backend serves a tiny HTML page that loads `connect.js`, runs
`TellerConnect.setup()`, and posts the enrollment result back to the app.

## 4. Teller API surface we will use

Base URL `https://api.teller.io` · Version header `Teller-Version: 2020-10-12`.

| Method & path                                   | Used for                                  |
|--------------------------------------------------|--------------------------------------------|
| `GET /accounts`                                  | List the user's accounts                   |
| `GET /accounts/:id`                              | Single account                             |
| `GET /accounts/:id/balances`                     | Account balance (separate call — see §6.2) |
| `GET /accounts/:id/transactions?count=&from_id=&start_date=&end_date=` | Transactions, paginated |
| `GET /accounts/:id/details`                      | Account/routing numbers (optional)         |

`429` = rate limited → exponential backoff. Not every institution supports
every capability — check the account's `links` object before calling a
sub-resource.

### Key field shapes
- **Account:** `id`, `enrollment_id`, `name`, `type` (`depository` | `credit`),
  `subtype` (`checking`, `savings`, `credit_card`, …), `currency`, `last_four`,
  `status`, `institution`, `links`. **No balance field** — balance is a
  separate endpoint.
- **Transaction:** `id`, `account_id`, `amount` (**signed string** — parse to
  float), `date` (ISO 8601), `description`, `status` (`posted` | `pending`),
  `type` (`card_payment`, `atm`, `transfer`, …), `running_balance` (nullable),
  and `details.category` (`dining`, `groceries`, `income`, …) +
  `details.counterparty.name`.

## 5. Connect flow

```
[App] user picks "Teller"
  │
  ├─▶ [App] open GET /teller/connect-page in a WebView modal
  │       (reuse the Flinks WebView modal component)
  │
  ├─▶ [connect-page HTML] loads cdn.teller.io connect.js,
  │       TellerConnect.setup({ applicationId, environment,
  │                             products:['transactions','balance'] }).open()
  │       user authenticates with their bank (MFA handled by Teller)
  │
  ├─▶ onSuccess(enrollment) → window.ReactNativeWebView.postMessage(enrollment)
  │       enrollment = { accessToken, user.id, enrollment.id,
  │                       enrollment.institution.name }
  │
  ├─▶ [App] WebView onMessage → POST /auth/teller/connect
  │       { access_token, enrollment_id, user_id, institution }
  │
  ├─▶ Backend: INSERT linked_accounts
  │       (provider='teller', item_id=enrollment_id, access_token=accessToken, …)
  │
  └─▶ Backend: trigger initial sync (transactions + balances)
```

The access token is delivered via WebView `postMessage` (in-process), **not** a
deep-link URL, so the token never lands in browser history or a redirect query
string.

## 6. Backend work items

### 6.1 `internal/teller/` — API client
- `client.go`: `NewClient()` reads `TELLER_APPLICATION_ID`, `TELLER_ENV`
  (`sandbox` | `development` | `production`), and — for dev/prod —
  `TELLER_CERT_PATH` + `TELLER_KEY_PATH` (or PEM contents via
  `TELLER_CERT_PEM` / `TELLER_KEY_PEM`).
  - Builds an `http.Client` with `TLSClientConfig` from
    `tls.LoadX509KeyPair`/`tls.X509KeyPair`. In sandbox, skip the cert.
  - `IsAvailable()` — true when application ID is set (and cert present for
    dev/prod).
  - Per-request helper: set Basic auth (access token : empty), `Teller-Version`
    header, unwrap JSON, retry `429` with backoff.
- Methods: `ListAccounts(token)`, `GetAccount`, `GetBalances(token, acctID)`,
  `ListTransactions(token, acctID, opts)` with `count` / `from_id` /
  `start_date` / `end_date`.
- `models.go`: `Account`, `Balance`, `Transaction` (+ `Details`,
  `Counterparty`) structs.

### 6.2 `bankprovider/teller_provider.go` — `Provider` impl
- `SyncTransactions`: `ListAccounts(token)` → per account
  `ListTransactions(start_date = last 90 days)` → map and insert.
  - `amount` is a signed string → `strconv.ParseFloat`. Convention: negative =
    money out → `type=expense`; positive → `type=income` (verify against
    sandbox in Phase 4).
  - Categorization: pass `details.category` into `categories.ResolveCategory`
    as a hint (Flinks passes none — Teller gives us a real category).
  - `pending` transactions: insert but leave low-confidence; they re-appear as
    `posted` later — handled by the dedup in §6.6.
- `SyncBalances`: `ListAccounts` → per account `GetBalances` → upsert
  `account_balances`. (Teller `/accounts` has no balance field, so one extra
  call per account is unavoidable.)
- `SyncInvestments`, `SyncLiabilities`: **no-ops** — Teller exposes neither.
  (Credit-card accounts still come through as balances/transactions.)
- `mapTellerAccountType`: `depository → depository`, `credit → credit`.

### 6.3 `handlers/teller.go`
- `TellerConnectPage` — `GET /teller/connect-page`: serves the HTML that hosts
  Teller Connect (mirrors `handlers.PlaidLinkPage`).
- `TellerConnect` — `POST /auth/teller/connect`: stores the `linked_accounts`
  row and kicks off a background initial sync (mirrors `FlinksConnect`).
- Existing `SyncBankAccount` (`/auth/bank/sync`) already dispatches by provider
  via `GetProvider` — works for Teller once §6.5 lands, no change needed.

### 6.4 Migration `20260520xxxxxx_teller_provider`
```sql
-- extend the provider CHECK constraint
ALTER TABLE linked_accounts DROP CONSTRAINT IF EXISTS linked_accounts_provider_check;
ALTER TABLE linked_accounts ADD CONSTRAINT linked_accounts_provider_check
    CHECK (provider IN ('plaid','flinks','teller'));
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS teller_user_id TEXT; -- Teller user.id, optional
```
Teller reuses existing columns: `access_token` (already present, used by Plaid)
holds the Teller access token; `item_id` holds the `enrollment.id`. The CHECK
constraint is the only hard schema blocker. *(Confirm the auto-generated
constraint name with `\d linked_accounts` before writing the migration.)*

### 6.5 Wire-up
- `bankprovider.GetProvider`: add `case "teller": return NewTellerProvider()`.
- `handlers/bank_connect.go::GetBankProviders`: append a Teller entry when
  `TELLER_APPLICATION_ID` is set.
- `routes/routes.go`: register `/teller/connect-page` (public) and
  `/auth/teller/connect`; log Teller availability at startup like Flinks.

### 6.6 Recommended: fix transaction idempotency (Phase 1)
The current Flinks provider inserts each transaction with a fresh random UUID +
`ON CONFLICT DO NOTHING`, so the conflict never fires and **every re-sync
duplicates every transaction**. Teller transaction IDs are stable, and a
`pending`→`posted` transition reuses the same ID, so doing this right is
essential:
- Add `transactions.external_id TEXT` + a partial unique index on
  `(user_id, source, external_id) WHERE external_id IS NOT NULL`.
- Insert with `ON CONFLICT (...) DO UPDATE` so a pending transaction is updated
  in place when it posts.
- Also fixes the latent Flinks duplicate bug. Small extra migration + a couple
  of lines per provider.

## 7. Frontend work items ([budget-app/app/link-account.tsx](budget-app/app/link-account.tsx))
- Add `'teller'` to the `SelectedProvider` type and a third provider card
  ("Teller — connect US banks").
- Teller connect handler: open `/teller/connect-page` in a WebView modal
  (reuse `renderFlinksWebView`); handle the `onMessage` enrollment payload →
  `POST /auth/teller/connect`.
- `utils/api.ts`: add a `tellerConnect` helper. "Sync Now" already calls
  `/auth/bank/sync` per account — works once the backend provider exists.
- Provider badge colour for Teller in the linked-accounts list.

## 8. Configuration
New backend env vars:
```
TELLER_APPLICATION_ID=app_xxx          # from the Teller Dashboard, used by Connect
TELLER_ENV=sandbox|development|production
TELLER_CERT_PEM=...                    # client certificate (dev/prod only)
TELLER_KEY_PEM=...                     # private key   (dev/prod only) — keep secret
```
The private key is server-side only and must never reach the app. Phase 1 runs
in `sandbox`, which needs no certificate.

## 9. Open questions — verify in sandbox
1. **Amount sign convention** — confirm negative = debit for depository and how
   credit-card accounts sign charges vs. payments.
2. **Re-auth / disconnection** — how Teller signals an access token that needs
   re-enrollment (MFA expiry, revoked), and the matching error response, so we
   can surface a "reconnect" prompt.
3. **Webhooks** — confirm Teller has no transaction webhook for our tier;
   if none, syncing stays pull-based (on connect, "Sync Now", or scheduled).
4. **Pagination** — confirm `from_id` backward-paging behaviour for accounts
   with long histories.
5. **Cert delivery** — decide cert-as-file-path vs. cert-as-env-PEM for the
   deployment environment.

## 10. Phased delivery
- **Phase 1 — Backend core (sandbox, no cert):** `internal/teller` client +
  models, migration, `TellerProvider` (transactions + balances), connect
  handlers + connect-page HTML, routes, wire-up, idempotency fix (§6.6). Unit
  tests with `httptest`.
- **Phase 2 — Frontend:** provider card, WebView connect flow, api helper.
- **Phase 3 — mTLS + verification:** wire the client certificate for
  development/production, resolve §9 items, end-to-end test against a real bank,
  handler tests mirroring `handlers/*_test.go`.

## 11. Risks
- **mTLS** is the only unfamiliar piece; it is well-trodden in Go's stdlib
  (`crypto/tls`) and isolated to `internal/teller/client.go`. Sandbox lets us
  defer it to Phase 3.
- **No RN SDK** — mitigated by the existing WebView pattern; worst case is
  contained to `link-account.tsx` + the connect-page HTML.
- **Free-tier rate limits** are undisclosed — keep syncs modest (on-demand /
  scheduled, not polling) and rely on the client's `429` backoff.
- **Investments/liabilities** are explicitly out — if that need grows later,
  it forces a richer provider (Plaid) for those accounts.
