# C031 — Household Free|Plus entitlements API

Backend contract for CoupleFlow plan gates. **No billing rails** (no Stripe / IAP / RevenueCat / checkout).  
Locked shape: C029 + C030. Settings “Pro Plan” chrome is cosmetic — **real plan lives on `households.plan`**.

## Source of truth

| Field | Location | Values |
|---|---|---|
| Plan | `households.plan` | `free` (default) · `plus` |

Both partners inherit the same entitlements. Solo households are still one household seat.

## Entitlement matrix

| Capability | Free | Plus |
|---|---|---|
| Linked bank accounts | **1** | Unlimited |
| AI advisor | **Light:** read-only tools + `remember_fact` | **Full:** tools + mutating approval cards + web_search (when configured) |
| AI message budget | **10** user msgs / household / rolling **7** days | Soft cap **200** / household / rolling **30** days |
| Nudges | In-app cards only | In-app **+ push** (existing quiet hours + 1/day caps still apply) |
| Shared money (budgets, debts, goals, invite, …) | Yes (never paywalled) | Yes |

## Endpoints

### `GET /auth/entitlements?user_id=`

Auth required. Dedicated entitlements payload.

```json
{
  "plan": "free",
  "household_id": "...",
  "banks_limit": 1,
  "banks_unlimited": false,
  "banks_used": 0,
  "ai_mode": "light",
  "ai_message_budget": {
    "limit": 10,
    "used": 2,
    "remaining": 8,
    "window_days": 7
  },
  "nudges": "in_app"
}
```

Plus example differences: `"plan":"plus"`, `"banks_limit": null`, `"banks_unlimited": true`, `"ai_mode":"full"`, `"nudges":"in_app+push"`, monthly soft budget.

### Extended surfaces

- `GET /auth/users/me?user_id=` — adds `plan` + `entitlements`
- `GET /auth/households/me?user_id=` — adds `plan` + `entitlements`

### Dev / admin: set plan (no payment)

`PUT /auth/households/plan`  
Auth required. Body:

```json
{ "user_id": "<uuid>", "plan": "plus" }
```

Optional `household_id` (must be a household the user belongs to). If omitted, uses / creates the caller’s household via `EnsureHouseholdForUser`.

Response:

```json
{
  "status": "ok",
  "household_id": "...",
  "plan": "plus",
  "entitlements": { "...": "..." }
}
```

**How to set Plus in dev**

```bash
curl -X PUT "$API/auth/households/plan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"YOUR_USER_UUID","plan":"plus"}'
```

Flip back with `"plan":"free"`.

## Server-side enforcement

| Gate | Where | Free behavior |
|---|---|---|
| Bank link | Plaid `link_token` + `exchange_token` (via `WithBankLinkGate`), SimpleFIN / Teller / Flinks connect (new links only; relinks OK) | HTTP **403** `code=banks_limit` when household already has 1 linked account |
| AI chat | `POST /auth/ai/conversations/{id}/messages` | HTTP **403** `code=ai_message_budget` at 10/7d; tool list is light; mutating / `web_search` blocked even if requested |
| Push nudges | `PushNewNudges` | Skips push on Free (in-app nudge rows still created) |

Error body sketch:

```json
{
  "error": "entitlement_limit",
  "code": "banks_limit",
  "message": "...",
  "plan": "free",
  "entitlements": { }
}
```

## Migration

`budget-backend/migrations/20260916000000_household_plan.up.sql`  
Adds `households.plan` (`free`|`plus`, default `free`) and `plan_updated_at`.

## Non-goals

Payment rails, receipt validation, dunning, fake checkout success, rewriting the AI model stack, Expo UI.
