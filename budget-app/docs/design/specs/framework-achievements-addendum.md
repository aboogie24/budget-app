# Framework screen — Achievements section (relocation addendum)

**Applies to:** the `/framework` screen redesign (`budget-app/app/framework.tsx`).
**Why:** the Achievements badge row was cut from the redesigned Dashboard (it's motivation, not right-now status) and relocated here, the app's progress/level surface. The framework implementer MUST add this section, tokenized to the design system, as part of the framework redesign.

## Placement
A new **"Achievements"** section on the framework screen (below the level/progress content, above or beside milestones — implementer's judgment per the framework-redesign.md layout). A horizontal-scroll row of badge chips, styled with design-system tokens (glass chips, `colors.primary2` accent for unlocked, muted/`colors.textDark` for locked). Unlocked = full-color emoji + label; locked = dimmed + the hint as a tooltip/subtitle.

## The six badges (exact definitions — port verbatim)
Net worth = `cash + investments + properties − debt`.

| id | emoji | label | unlocked when | hint (locked) |
|---|---|---|---|---|
| `first-link` | 🔗 | First link | a transaction has `source` ∈ {teller, bank, flinks} | Link a bank account |
| `budget-set` | 📊 | Budget set | budgets count > 0 | Create a budget |
| `reviewer` | ✅ | Reviewer | count of `user_verified` transactions ≥ 10 | Verify 10 transactions |
| `savings-1k` | 💸 | $1k saved | savings current ≥ 1000 | Save your first $1k |
| `positive-nw` | 🌱 | In the green | net worth > 0 | Get net worth above zero |
| `nw-10k` | 💎 | $10k club | net worth ≥ 10000 | Net worth ≥ $10k |

## Data the framework screen must fetch to compute these
The current framework screen only loads framework-level + plans. It must additionally load (reuse existing api helpers, mirror how the old dashboard did it):
- transactions (`fetchUserTransactions`) — for `first-link` (source) and `reviewer` (user_verified count).
- budgets (`/auth/budgets/user/{id}`) — count for `budget-set`.
- savings goals (`/auth/savings-goals`) — sum current for `savings-1k`.
- net-worth inputs (`fetchAccountBalances('depository')`, `fetchInvestmentHoldings`, `fetchProperties`, `/auth/debts`) — for `positive-nw` and `nw-10k`.

Compute unlock states client-side (memoized), exactly as the pre-redesign dashboard did. Keep it lightweight — this is a badge row, not a data-heavy tier.
