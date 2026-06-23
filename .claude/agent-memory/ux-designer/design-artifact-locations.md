---
name: design-artifact-locations
description: Where design artifacts are stored in the budget-app repo (specs, component JSON, tokens, flows, changelog)
metadata:
  type: reference
---

Design artifacts for this project live under `budget-app/docs/design/`:

- `specs/` — per-screen design specs (.md), e.g. `calendar-redesign.md`
- `components/` — structured component specs (.json) a frontend dev implements directly
- `tokens/` — calendar/feature-specific token mappings (.json) that point back to
  `budget-app/utils/design-system.ts`
- `flows/` — user-flow diagrams (.mermaid)
- `changelog.md` — dated log of design decisions; append after each session

**How to apply:** When designing a new screen, follow this structure and update the
changelog. Component specs are the primary handoff format for the frontend agent here.
