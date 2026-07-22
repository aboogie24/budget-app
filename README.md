# CoupleFlow

A budgeting app built for **couples** — track money together, attack debt, hit shared goals, and get advice from an AI advisor that knows your real numbers and can act inside the app.

React Native (Expo) frontend · Go + PostgreSQL backend · Claude-powered AI.

---

## What it does

### 💸 Money tracking
- **Bank sync from four providers** — connect real accounts and transactions flow in automatically:

  | Provider | Coverage | Notes |
  |---|---|---|
  | Plaid | 12,000+ US institutions | Also syncs investments & liabilities |
  | Teller | US banks & credit unions | mTLS certs; dev tier capped at 100 lifetime enrollments |
  | Flinks | North America (strong Canadian coverage) | OAuth + scraping |
  | SimpleFIN | Bring-your-own bridge token | User-funded (~$1.50/mo), no app-level config, no connection limits |

- **Post-sync pipeline (fully automatic):** deterministic categorization rules → internal **transfer detection** (pairs inter-account moves so card payments don't read as income) → **AI categorization** of whatever's left (Claude Haiku with structured outputs; answers are cached as rules so the same merchant never hits the LLM twice).
- **Transactions** — server-side pagination (50/page infinite scroll), server search across note/category/source/amount, type filters, day grouping with per-day net, timezone-correct date handling, splits, manual entry & editing, source badges per provider.
- **Review queue** — every non-exact categorization lands in a review screen with confidence badges (Exact/High/AI), swipe-to-confirm, one-request batch "Confirm all", and category quick-assign.
- **Category system** — hierarchical categories with subcategory→parent rollup, custom categories, auto-categorization rules (merchant/keyword/system) you can inspect and edit.

### 📊 Budgets
- Expense **and income** budgets with real calendar-aware frequencies — weekly/biweekly budgets count actual occurrences per month (a 5-payday month counts 5), anchored to each budget's start date. Backend and dashboard math always agree.
- **Expected vs Received** income view — planned income budgets against actual income received, with income-correct status colors (beating expected is green "Ahead", never over-budget red).
- Per-category progress with status model (on-track ≤80% / watch >80% / over >100%), spending shown for **all** categories — budgeted or not — including bill payments.
- Budget alerts with custom thresholds, real-time checks on new transactions, and partner notifications on shared budgets.

### 📅 Bills, debts, savings, plans
- **Bills** — due days, autopay flags, mark-as-paid (records a payment transaction), auto-detection from recurring transactions, calendar due markers (correct in short months).
- **Debts** — "attack" vs "structured" classification, real % paid tracked against opening balance, and a **payoff calculator** (avalanche/snowball/custom) that correctly rolls freed-up minimums forward as debts clear.
- **Savings goals** — targets, deadlines, progress bars, and feasibility checks against your actual free cash flow. A goal can **link a real bank account as its fund** (e.g. "this HYSA is our emergency fund") — progress then mirrors the account balance on every sync, with manual edits disabled.
- **Priorities** — ONE ranked list across the couple's real goals and debts (shared per household) that drives plan allocations.
- **Plans** — monthly allocations per target, dated milestones, AI analysis, and a partner approval flow.

### 👫 Couple features
- Household create/invite/accept, with **granular sharing preferences** (control exactly what your partner sees: transactions, budgets, bills, goals, debts…).
- **Partner dashboard** — combined household income/expenses/net cash flow, shared savings progress.
- **Activity feed** — "Alex added a $45 grocery expense" transparency for every change, including actions taken by the AI advisor.
- Partner spending alerts with per-budget thresholds.

### 🤖 AI (Claude-powered)
- **Chat advisor** (Claude Opus, adaptive thinking) that is grounded in your real data via tools — and knows how the app itself works, so it gives exact navigation directions.
  - *Read tools:* financial snapshot, debts, goals, bills, spending by category, partner status, debt-payoff & savings projections, goal feasibility.
  - *Action tools:* create savings goals, create financial plans with milestones, create budgets, update goal progress, log transactions — always with your agreement, additive-only (it can never delete), logged to the household activity feed.
  - *Web search* (Tavily) for real prices — flights, hotels, rates — feeding end-to-end flows like *"build me a savings plan for a trip to Jamaica in December"*: research costs → check feasibility → create the goal → create the tracked plan with actionable milestones.
- **Advisor memory** — two-tier (shared household + private per-user, never the partner's private facts), written via a `remember_fact` tool, fully visible and deletable in Settings → Advisor Memory.
- **Proactive nudges** — deterministic triggers author cards via Haiku, surfaced on the dashboard and pushed (quiet hours 9pm–8am, 1/day cap, partner-consent routing); tapping opens a pre-seeded chat.
- **Auto-categorization** — Haiku + structured outputs classifies unknown merchants in batches, capped per call, resilient to API blips (automatic retry with backoff).

### 📈 Insights & dashboards
- **Dashboard** — cash-flow status headline (worst-signal-wins), this-week spending bars vs your expense budgets, budget/savings/bills cards, net-worth strip with real snapshot-backed sparkline and 30-day delta, Me/Household scope toggle.
- **Insights** — monthly income vs expenses, daily spending chart, top categories (CVD-safe categorical palette).
- **Investments & properties** — Plaid holdings with gain/loss, property values with automatic estimates; all feed net worth.
- **CoupleFlow Method** — a 5-level financial framework (Foundation → Attack Debt → Build Security → Grow Wealth → Dream Big) with level progress tracking.

### 🎨 Product polish
- Glassmorphic dark theme (light theme toggle), validated chart palette, empty/error/loading states everywhere, pull-to-refresh, haptics, drawer + tab navigation, floating quick-add.
- Sign-in with email, **Google, or Apple**; JWT auth with silent refresh; 13-currency support; push notifications (Expo).

---

## Architecture

```
budget-app/        React Native (Expo Router) app
  app/             file-based routes (tabs, screens)
  components/      shared UI (charts, cards, design system consumers)
  utils/           api client, design system, helpers

budget-backend/    Go API (gorilla/mux) + PostgreSQL
  handlers/        one file per domain (transactions, budgets, bills, ai_chat…)
  internal/
    ai/            Claude client (retry/backoff), advisor tools, nudges, memory
    bankprovider/  Provider interface + Plaid/Flinks/Teller/SimpleFIN impls
    categories/    merchant normalization, rule resolver, LLM classifier
    simplefin/     SimpleFIN Bridge protocol client
    teller/        Teller API client (mTLS)
    transfers/     inter-account transfer pair detection
  migrations/      sequential SQL migrations
  routes/          route registration
```

- **Auth:** JWT (24h) with refresh; auth-specific rate limiting; security headers.
- **API rate limit:** 120 req/min per IP (burst 20) — bulk operations use batch endpoints.
- **Models:** chat advisor = Claude Opus; categorization & nudge copy = Claude Haiku (structured outputs).

## Getting started

Prereqs: Go 1.23+, Node 18+, PostgreSQL 15+ (local or Docker), Expo CLI.

```bash
make setup          # start Postgres, run migrations, install frontend deps
make backend        # run the Go API (localhost:8080)
make frontend       # run the Expo dev server
```

Useful targets:

```bash
make migrate-up / migrate-down / migrate-status
make db-reset                          # DROP + recreate + migrate (all data!)
make reset-user USER_EMAIL=you@x.com   # wipe ONE user's financial data, keep login/household/categories
make test                              # backend test suite
```

### Configuration (`budget-backend/.env`)

| Area | Vars |
|---|---|
| Core | `JWT_SECRET`, `PG_*` connection settings |
| AI | `ANTHROPIC_API_KEY` (advisor, categorization, nudges), `TAVILY_API_KEY` (web search) |
| Plaid | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_WEBHOOK_URL` |
| Teller | `TELLER_APPLICATION_ID`, `TELLER_ENV` (sandbox/development/production), `TELLER_CERT_PATH`, `TELLER_KEY_PATH` |
| Flinks | `FLINKS_INSTANCE_ID`, `FLINKS_AUTH_KEY`, `FLINKS_ENV` |
| OAuth | `GOOGLE_CLIENT_ID`, `APPLE_BUNDLE_ID` |

SimpleFIN needs **no** configuration — users paste their own bridge setup token in the app.

Frontend env: `EXPO_PUBLIC_API_URL` (see `budget-app/.env.example`).

## Testing

```bash
cd budget-backend && go test ./...          # unit tests (sqlmock + httptest)
go test -tags integration ./...             # integration tests (real Postgres)
go test -tags live ./internal/categories/   # live LLM categorization smoke test
cd budget-app && npx tsc --noEmit && npx jest   # typecheck + component/unit tests
# E2E: Maestro flows in budget-app/e2e/maestro/
```

## Project tracker

Open `tracker.html` in a browser — a kanban/timeline of every phase and task, kept current as features land.
