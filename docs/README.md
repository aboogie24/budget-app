# CoupleFlow Documentation

Documentation for the CoupleFlow budget app (React Native + Go). Project
progress lives in [`tracker.html`](../tracker.html) at the repo root; design
specs per screen live in
[`budget-app/docs/design/`](../budget-app/docs/design/), with the JSX visual
mockups in
[`budget-app/docs/design/mockups/`](../budget-app/docs/design/mockups/).

## Layout

```
docs/
├── plans/     # Feature & integration plans (point-in-time; see status notes)
├── app/       # Frontend (budget-app): builds, design system, testing
└── backend/   # Backend (budget-backend): testing & implementation notes
```

## App (`docs/app/`)

| Doc | What it covers |
|---|---|
| [BUILDS.md](app/BUILDS.md) | EAS build profiles, environments, OTA updates, store submission |
| [DESIGN_SYSTEM.md](app/DESIGN_SYSTEM.md) | Glassmorphic design system: tokens, components, usage |
| [TESTING.md](app/TESTING.md) | Frontend testing guide: unit, component, and E2E layers |
| [TESTS_INDEX.md](app/TESTS_INDEX.md) | Quick reference to every test file |
| [TEST_SUMMARY.md](app/TEST_SUMMARY.md) | Test infrastructure summary (Jest setup, coverage) |

Also: [`budget-app/.maestro/README.md`](../budget-app/.maestro/README.md)
(mobile E2E flows) stays with the flows it documents.

## Backend (`docs/backend/`)

| Doc | What it covers |
|---|---|
| [TESTING_GUIDE.md](backend/TESTING_GUIDE.md) | Integration test framework + API validation layer |
| [IMPLEMENTATION_SUMMARY.md](backend/IMPLEMENTATION_SUMMARY.md) | Integration tests implementation notes (task #61) |

Backend E2E suite is documented in code at
[`budget-backend/e2e/`](../budget-backend/e2e/); deployment chart at
[`budget-backend/chart/`](../budget-backend/chart/).

## Plans (`docs/plans/`)

Point-in-time planning docs. **Status reflects when they were written** — the
tracker is the source of truth for what actually shipped.

| Doc | What it covers | Status |
|---|---|---|
| [COUPLEFLOW-AI-PLAN.md](plans/COUPLEFLOW-AI-PLAN.md) | AI financial assistant: product & architecture | Phases 1–2 + tools/approval shipped; 3–5 open |
| [TELLER-INTEGRATION-PLAN.md](plans/TELLER-INTEGRATION-PLAN.md) | Teller as bank provider | Implemented |
| [FLINKS-INTEGRATION-PLAN.md](plans/FLINKS-INTEGRATION-PLAN.md) | Flinks (Canada) + provider-choice architecture | Provider abstraction implemented |
| [CATEGORIZATION-IMPROVEMENT-PLAN.md](plans/CATEGORIZATION-IMPROVEMENT-PLAN.md) | Auto-categorization improvements | Largely shipped (rules + AI pass) |
| [CATEGORY-SYSTEM-UPGRADE.md](plans/CATEGORY-SYSTEM-UPGRADE.md) | Smart tagging, auto-matching, subcategories | Implemented |
| [BUDGET-SCREEN-UPGRADE.md](plans/BUDGET-SCREEN-UPGRADE.md) | Subcategory-aware budget screen | Implemented |
| [DEBT-CATEGORIZATION-PLAN.md](plans/DEBT-CATEGORIZATION-PLAN.md) | Auto loans & flexible liability types | Implemented |
| [ONBOARDING-REDESIGN-PLAN.md](plans/ONBOARDING-REDESIGN-PLAN.md) | Onboarding flow redesign | Implemented |
| [FIX-WELCOME-REDIRECT.md](plans/FIX-WELCOME-REDIRECT.md) | Login → welcome-screen redirect bug | Fixed |

## Operations

- Releases: manual [Release API workflow](../.github/workflows/release-api.yml)
  — choose patch/minor/major; publishes image + Helm chart to GHCR
  (see BUILDS.md for the mobile side).
- Deploy: `helm install budget-api oci://ghcr.io/aboogie24/budget-app/charts/budget-api`
  (bundled PostgreSQL, migrations run automatically).
