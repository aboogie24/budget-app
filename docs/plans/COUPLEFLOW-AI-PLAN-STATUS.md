# CoupleFlow AI plan — status inventory (C028)

Synced to code on `main` per C025 audit (2026-09-15). Canonical narrative plan:
[`COUPLEFLOW-AI-PLAN.md`](./COUPLEFLOW-AI-PLAN.md) and root
[`COUPLEFLOW-AI-PLAN.html`](../../COUPLEFLOW-AI-PLAN.html).

## Shipped (not "open")

- **Phases 1-2 core:** Claude chat (SSE), tools, debt payoff / savings projection, financial plans API + UI
- **Mutating tool approvals / action queue:** write tools queued -> Approve/Decline cards (`ai_pending_actions`)
- **Partner plan approval:** ApprovePlan / RejectPlan; activates when all household members approve
- **Advisor memory:** two-tier shared vs private; Settings list/delete; prompt inject
- **Nudges (Phase 5 largely):** deterministic generators + Haiku authoring; dashboard cards; push with quiet hours (9pm-8am) + 1/day cap; seed-into-chat
- **C027:** household-shared grounding for snapshot/read tools + chat context; empty-state setup-first policy
- **C026 (onboarding backend):** always ensure household; budget bootstrap on complete

## Phase tags

| Phase | Status |
|---|---|
| 1 AI Foundation | SHIPPED |
| 2 Path Planning Engine | SHIPPED (core calculators + plans) |
| 3 Couple Collaboration | SHIPPED (partner plan approval; AI negotiation still thin) |
| 4 Framework & Milestones | PARTIAL (plans/milestones exist; dedicated framework path UX thinner) |
| 5 Proactive Intelligence | SHIPPED (nudges + push caps; what-if / monthly-review thinner) |
| 6 Polish & Launch | OPEN (ongoing) |

## Still open / partial

- **Leave household** — UI still "Coming soon"
- **Richer path / framework UX** — not a dedicated path-engine surface beyond chat + Plans
- **Phase 6 polish** — splash/brand, onboarding multi-provider bank UX, etc.

Do not treat Phases 3-5 as blanket open.
