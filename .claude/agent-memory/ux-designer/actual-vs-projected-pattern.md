---
name: actual-vs-projected-pattern
description: CoupleFlow's core money-flow visual metaphor — solid for real money, ghosted/dashed/outline for projected unpaid bills; never blend into one number
metadata:
  type: project
---

CoupleFlow distinguishes **actual money** (real income + real expenses, including paid
bills) from **projected** money (unpaid bills not yet paid). The agreed visual language:

- **Actual** = solid fill, full-opacity text, filled icon chip, exact amount.
- **Projected** = dashed/outlined border, ~70% opacity text, OUTLINE icon, `~` amount
  prefix, plus a literal label ("projected" / "DUE"). Color: `colors.warning`.

**Why:** A bill is a projection while UNPAID; once paid it's replaced by its real
transaction (the scheduled bill disappears). Bills were previously double-counted. Totals
must use a SPLIT — "Spent so far $X / Still due $Y / Income $Z" — and never sum spent +
due into one expense number. The predicate to drive all projected styling:
`isProjected = source === 'bill' && billStatus !== 'paid'`.

**How to apply:** Use this metaphor anywhere money-flow surfaces (calendar, dashboard,
bills, forecasts). Encode actual-vs-projected via fill style + icon style + text label,
never color alone (accessibility). Keep `spentSoFar` and `stillDue` as separate fields
end-to-end as the regression guard.

Related: [[design-system]]
