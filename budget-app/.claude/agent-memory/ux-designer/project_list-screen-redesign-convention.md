---
name: list-screen-redesign-convention
description: The established CoupleFlow "list archetype" redesign convention that every per-screen redesign spec must follow
metadata:
  type: project
---

CoupleFlow is mid-migration: bespoke per-screen styling is being replaced screen-by-screen with the shared design system (`budget-app/utils/design-system.ts`). Redesign specs live in `budget-app/docs/design/specs/{screen}-redesign.md`, component JSONs in `budget-app/docs/design/components/{screen}-*.json`.

**Why:** early screens each hardcoded their own gradient/palette/surfaces, so the app read as several different apps. The redesign program unifies them.

**How to apply — the settled list-archetype conventions (match `bills-redesign.md`, `calendar-redesign.md`, `dashboard-redesign.md`):**
- Background: `<GradientBackground variant="bgDarkPurple">` — never a raw `LinearGradient`.
- Header: fixed row OUTSIDE the ScrollView = shared `<BackButton>` + `typography.h3` title + gradient/accent action icon (≥44 target).
- One elevated headline card per screen: `glassEffects.glassFloating`, leads with the money number in `typography.h2`. Everything else is flat `glassEffects.glass`.
- Committed-vs-tentative money uses the solid-vs-ghosted metaphor: committed = solid fill / exact amount; tentative (draft/unpaid) = dashed border + `~`-prefixed amount + a WORD label.
- Status is ALWAYS icon + word + color together — never color alone.
- Semantic tint recipe: chip/badge backgrounds = semantic color at 12% opacity (feedback/reject quotes at 8%).
- Loading = `Skeleton` placeholders that hold layout, NOT `ActivityIndicator` (spinner only allowed for background refresh in the header).
- Modals = bottom sheet on `colors.surface2`, one shared form-sheet recipe (input = glass fill + borderGlass), `gradients.primaryGradient` save button.
- Reuse shared components: `GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, `ErrorState`, `AttentionCard`, `Sparkline`, and dashboard sub-components. Partner attribution glyphs: Partner A `colors.primary2`/◑, Partner B `colors.info`/◐, shared = neutral.
- Hard rule: no literal hex/rgba/px after redesign except the documented 12%/8% semantic tints.

Specs are DESIGN-ONLY (no .tsx). Do not edit `design-system.ts`, `changelog.md`, or other screens.
