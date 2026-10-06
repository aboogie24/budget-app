# C026 — First-run onboarding API (CoupleFlow)

Backend contract for anvil’s OB1–OB4 wizard. No Expo UI in this PR.

## OB1 — Always create household

`POST /auth/households`  
Auth required. Body:

```json
{ "user_id": "<uuid>", "name": "Optional display name" }
```

- Creates a household + owner membership when the user has none.
- **Idempotent:** if the user is already in a household, returns `200` with that `household_id` and `"created": false` (no 400).
- Empty/omitted `name` defaults to `"Household"`.
- Invite remains optional: `POST /auth/households/invite` after create.

Acceptance: after continue (invite or skip), `GET /auth/households/me?user_id=` returns `200` with a non-null `household_id`.

## OB2 — Starter budgets bootstrap

`POST /auth/budgets/bootstrap`  
Auth required. Body:

```json
{
  "user_id": "<uuid>",
  "income": 5200,
  "expenses": [
    { "name": "Rent/housing", "amount": 1800 },
    { "name": "Groceries", "amount": 600 }
  ]
}
```

- `income` optional; when `> 0`, creates a shared income budget named **Take-home**.
- `expenses` entries with empty name or `amount <= 0` are ignored.
- At least one valid expense **or** positive income is required. Explicit skip is **client-side** — do not call this endpoint on skip (no silent zero budgets).
- Ensures a household exists (uses `EnsureHouseholdForUser`), sets `household_id`, `is_shared: true`, `frequency: monthly`.
- **Idempotent** on `(user_id, type, lower(name))`: re-calls update amount / share binding and return `"created": false`.

Response sketch:

```json
{
  "household_id": "...",
  "budgets": [ { "id", "name", "amount", "type", "household_id", "is_shared", "created" } ],
  "created_count": 5,
  "total": 5
}
```

## OB4 — Persist onboarding_complete

`POST /auth/onboarding/complete`  
Body: `{ "user_id": "<uuid>", "monthly_budget_goal": 0 }` (`monthly_budget_goal` may be `0` when budgets were created via bootstrap).

Response (truthful for AsyncStorage):

```json
{
  "status": "onboarding complete",
  "onboarding_complete": true,
  "user_id": "...",
  "monthly_budget_goal": 0
}
```

Also ensures a household exists as a safety net.

### Cold-start / me

`GET /auth/users/me?user_id=<uuid>` → `{ id, email, full_name, onboarding_complete, monthly_budget_goal }`

Login / OAuth already return `user.onboarding_complete`. Register returns `onboarding_complete: false`.

## Anvil call order (happy path)

1. Register / login  
2. OB1 continue → `POST /auth/households` (then optional invite)  
3. OB2 create → `POST /auth/budgets/bootstrap` **or** skip (no call)  
4. OB3 bank defer (existing providers)  
5. OB4 finish → `POST /auth/onboarding/complete` → store `onboarding_complete: true` from response or refresh via `GET /auth/users/me`

## C038 — Accept invite when user already has a solo household

After OB1, every user has a household. `POST /auth/households/accept` therefore must handle an existing solo:

Body: `{ "code", "user_id"?, "confirm_migrate"?: boolean }`

**Auth binding (C038 / helm):** for every household-scoped route — `POST /households`, `GET /households/me`, `GET /households/summary`, `POST /households/invite`, `POST /households/accept`, `GET /households/invites`, `GET /entitlements`, `GET|POST /sharing-preferences`, `POST /budgets/bootstrap` — the actor `user_id` comes from the authenticated session/JWT only (`user_id` in body/query is optional). A body/query `user_id` that does not match the authenticated user returns **403**. A client-supplied `household_id` (invite, summary, sharing-preferences) must be a household the caller belongs to, else **403** (invite: an unknown/stale `household_id` falls back to the caller's own household). Invitee email on accept must still match the authenticated user when set on the invite.

**Invite codes:** consumed invites are kept as tombstones (`accepted_at`, `accepted_by`; migration `20261005220000`) and hidden from the invites list. Re-accepting a consumed code returns 200 `already_member` only if the caller is a member of *that invite's* household; unknown, revoked, or non-UUID codes return **400**. Concurrent accepts that lose a race restart once with fresh reads (never 5xx).

| Current state | Behavior |
|---|---|
| No membership | Join as before (200) |
| Already on target | Idempotent 200 (`already_member: true`) |
| Empty solo (starter budgets only — no txns, banks, budgets, debts, savings, bills, properties, custom categories, priorities, trips, plans, advisor memories, category mapping rules, holdings, liabilities) | Discard starters, hard-delete solo, join target as `member` (200). `confirm_migrate` ignored. |
| Non-empty solo without `confirm_migrate: true` | **409** `migrate_confirmation_required` + `accept_preview` |
| Non-empty solo with `confirm_migrate: true` | Migrate `household_id` on rows → target, move membership, delete solo (200) |
| Free+Free bank-cap would exceed 1 after merge | **409** `banks_limit_conflict` (even with confirm) |
| Multi-member current household | **409** `blocked_multi_member` |

Plan after join = `max(solo, target)` (Plus wins). Response includes refreshed `entitlements`.

`GET /auth/households/invites?user_id=` continues to return invites for users who already have a household, and each invite includes `accept_preview` (`discard_solo` \| `migrate_solo` \| `join` \| `already_member` \| `blocked_*`).
