---
name: dashboard-hierarchy
description: CoupleFlow dashboard's north-star question and 5-tier hierarchy contract — the rule that makes the Status Headline unmistakably the top of the screen
metadata:
  type: project
---

The CoupleFlow dashboard (home) answers ONE question at a glance: **"How are we doing
right now?"** — household by default. It uses a strict **5-tier hierarchy** (top to
bottom): (1) Status Headline, (2) Attention, (3) This-week proof, (4) Trajectory strip,
(5) Recent activity.

**Why:** The old dashboard was a flat pile of ~equal cards with no clear top; the product
owner decided the right-now verdict must be primary and everything else must visibly
support it.

**How to apply:** The hierarchy enforcer — **only the Status Headline floats
(`glassEffects.glassFloating`) and only it uses `typography.h1`** (the hero number = this
month's cash flow). If any other card ever competes for "biggest thing on screen," the
hierarchy has broken. Status is a 3-level worst-signal-wins verdict (good/watch/alert)
over bills + spending + cash-flow, conveyed by icon + word + semantic color (never color
alone). A **ScopeToggle (Household | Me)** re-scopes the whole screen; hidden for solo
users. Cut for good: achievements badge row, Sun/Mon recap card, standalone AI-nudge card.
Full spec at `budget-app/docs/design/specs/dashboard-redesign.md`.

Related: [[design-system]], [[actual-vs-projected-pattern]], [[design-artifact-locations]]
